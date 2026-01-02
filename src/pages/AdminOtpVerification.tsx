import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, Package, User } from "lucide-react";

interface OtpRecord {
  id: string;
  order_id: string;
  otp_code: string;
  status: string;
  submitted_at: string;
  submitted_by: string;
  notes: string | null;
  order?: {
    id: string;
    deal_id: string;
    customer_id: string;
    status: string;
    tracking_id: string | null;
    order_screenshot_url: string | null;
    deal?: {
      product_name: string;
      merchant_id: string;
    };
  };
  submitter?: {
    full_name: string;
    email: string;
  };
}

export default function AdminOtpVerification() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [otpRecords, setOtpRecords] = useState<OtpRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; otpId: string | null; notes: string }>({
    open: false,
    otpId: null,
    notes: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    } else if (!authLoading && user && !isAdmin) {
      navigate("/dashboard");
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchOtpRecords();
    }
  }, [user, isAdmin]);

  const fetchOtpRecords = async () => {
    try {
      // Fetch OTP records
      const { data: otps, error: otpError } = await supabase
        .from("otp_records")
        .select("*")
        .eq("status", "pending")
        .order("submitted_at", { ascending: true });

      if (otpError) throw otpError;

      // Fetch related data for each OTP
      const enrichedOtps = await Promise.all(
        (otps || []).map(async (otp) => {
          const { data: order } = await supabase
            .from("orders")
            .select("*, deal:deals(product_name, merchant_id)")
            .eq("id", otp.order_id)
            .single();

          const { data: submitter } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", otp.submitted_by)
            .single();

          return {
            ...otp,
            order,
            submitter,
          };
        })
      );

      setOtpRecords(enrichedOtps);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (otpId: string, orderId: string, dealId: string) => {
    setActionLoading(otpId);
    try {
      // Update OTP record
      const { error: otpError } = await supabase
        .from("otp_records")
        .update({
          status: "verified",
          verified_at: new Date().toISOString(),
          verified_by: user?.id,
        })
        .eq("id", otpId);

      if (otpError) throw otpError;

      // Update order status
      const { error: orderError } = await supabase
        .from("orders")
        .update({ 
          otp_verified: true,
          status: "confirmed" 
        })
        .eq("id", orderId);

      if (orderError) throw orderError;

      // Complete the deal escrow
      const { error: escrowError } = await supabase.rpc("complete_deal_escrow", {
        p_deal_id: dealId,
      });

      if (escrowError) throw escrowError;

      toast({
        title: "OTP Verified",
        description: "Deal completed and commission released!",
      });

      fetchOtpRecords();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectOtp = async () => {
    if (!rejectDialog.otpId) return;

    setActionLoading(rejectDialog.otpId);
    try {
      const { error } = await supabase
        .from("otp_records")
        .update({
          status: "rejected",
          notes: rejectDialog.notes || null,
          verified_at: new Date().toISOString(),
          verified_by: user?.id,
        })
        .eq("id", rejectDialog.otpId);

      if (error) throw error;

      toast({
        title: "OTP Rejected",
        description: "The OTP has been marked as invalid.",
      });

      setRejectDialog({ open: false, otpId: null, notes: "" });
      fetchOtpRecords();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">OTP Verification</h1>
          <p className="text-muted-foreground">Verify delivery OTPs to complete deals</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : otpRecords.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              No pending OTPs to verify.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {otpRecords.map((otp) => (
              <Card key={otp.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">
                        {otp.order?.deal?.product_name || "Unknown Product"}
                      </CardTitle>
                    </div>
                    <Badge variant="secondary">
                      <Clock className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">OTP Code:</span>
                      <p className="font-mono text-lg font-bold">{otp.otp_code}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Submitted by:</span>
                      <p className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {otp.submitter?.full_name}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tracking ID:</span>
                      <p className="font-mono">{otp.order?.tracking_id || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Submitted:</span>
                      <p>{new Date(otp.submitted_at).toLocaleString()}</p>
                    </div>
                  </div>

                  {otp.order?.order_screenshot_url && (
                    <div>
                      <span className="text-sm text-muted-foreground">Order Screenshot:</span>
                      <img
                        src={otp.order.order_screenshot_url}
                        alt="Order screenshot"
                        className="mt-1 max-h-32 rounded-lg border object-cover"
                      />
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => handleVerifyOtp(otp.id, otp.order_id, otp.order?.deal_id || "")}
                      disabled={actionLoading === otp.id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      {actionLoading === otp.id ? "Processing..." : "Verify & Complete"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setRejectDialog({ open: true, otpId: otp.id, notes: "" })}
                      disabled={actionLoading === otp.id}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ ...rejectDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject OTP</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this OTP? You can add a note explaining why.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Rejection reason (optional)"
            value={rejectDialog.notes}
            onChange={(e) => setRejectDialog({ ...rejectDialog, notes: e.target.value })}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRejectOtp} className="bg-destructive text-destructive-foreground">
              Reject OTP
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
