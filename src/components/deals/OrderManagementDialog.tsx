import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";
import { Upload, Package, Truck, CheckCircle, Clock, AlertCircle } from "lucide-react";

type Deal = Tables<"deals">;
type Order = Tables<"orders">;

interface OrderManagementDialogProps {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  userRole: "merchant" | "customer";
}

export function OrderManagementDialog({
  deal,
  open,
  onOpenChange,
  onUpdate,
  userRole,
}: OrderManagementDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [trackingId, setTrackingId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [submittingOtp, setSubmittingOtp] = useState(false);

  useEffect(() => {
    if (deal && open) {
      fetchOrder();
    }
  }, [deal, open]);

  const fetchOrder = async () => {
    if (!deal) return;
    
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("deal_id", deal.id)
        .maybeSingle();

      if (error) throw error;
      setOrder(data);
      if (data?.tracking_id) {
        setTrackingId(data.tracking_id);
      }
    } catch (error: any) {
      console.error("Error fetching order:", error);
    }
  };

  const handleCreateOrder = async () => {
    if (!deal || !user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .insert({
          deal_id: deal.id,
          customer_id: deal.customer_id!,
          status: "placed",
        })
        .select()
        .single();

      if (error) throw error;
      
      setOrder(data);
      toast({
        title: "Order Created",
        description: "Order has been created successfully.",
      });
      onUpdate();
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

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !order || !user) return;

    const file = e.target.files[0];
    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/${order.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("order-screenshots")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("order-screenshots")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("orders")
        .update({ 
          order_screenshot_url: urlData.publicUrl,
          status: "otp_pending" 
        })
        .eq("id", order.id);

      if (updateError) throw updateError;

      // Update deal status to in_progress
      await supabase
        .from("deals")
        .update({ status: "in_progress" })
        .eq("id", deal!.id);

      toast({
        title: "Screenshot Uploaded",
        description: "Order screenshot has been uploaded. Waiting for OTP.",
      });
      
      fetchOrder();
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateTracking = async () => {
    if (!order || !trackingId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ 
          tracking_id: trackingId,
          status: "shipped" 
        })
        .eq("id", order.id);

      if (error) throw error;

      toast({
        title: "Tracking Updated",
        description: "Tracking ID has been saved.",
      });
      
      fetchOrder();
      onUpdate();
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

  const handleSubmitOtp = async () => {
    if (!order || !otpCode || !user) return;

    setSubmittingOtp(true);
    try {
      const { error } = await supabase
        .from("otp_records")
        .insert({
          order_id: order.id,
          otp_code: otpCode,
          submitted_by: user.id,
          status: "pending",
        });

      if (error) throw error;

      toast({
        title: "OTP Submitted",
        description: "Your OTP has been submitted for verification.",
      });
      
      setOtpCode("");
      fetchOrder();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmittingOtp(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "placed":
        return <Package className="h-4 w-4" />;
      case "otp_pending":
        return <Clock className="h-4 w-4" />;
      case "otp_verified":
        return <CheckCircle className="h-4 w-4" />;
      case "shipped":
        return <Truck className="h-4 w-4" />;
      case "delivered":
      case "confirmed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  if (!deal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Management - {deal.product_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Deal Summary */}
          <div className="p-3 rounded-lg bg-secondary/50 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Card Offer Price:</span>
              <span className="font-medium">₹{deal.card_offer_price.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer Commission:</span>
              <span className="font-medium text-green-600">₹{deal.commission_amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Advance (Locked):</span>
              <span className="font-medium text-amber-600">₹{deal.advance_amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining After Delivery:</span>
              <span className="font-medium">₹{deal.remaining_amount.toLocaleString()}</span>
            </div>
          </div>

          <Separator />

          {/* Order Status */}
          {order ? (
            <div className="flex items-center gap-2">
              {getStatusIcon(order.status || "placed")}
              <span className="font-medium">Status:</span>
              <Badge variant="outline">{order.status?.replace("_", " ").toUpperCase()}</Badge>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">No order created yet.</p>
              {userRole === "merchant" && (
                <Button onClick={handleCreateOrder} disabled={loading}>
                  {loading ? "Creating..." : "Create Order"}
                </Button>
              )}
            </div>
          )}

          {order && (
            <>
              <Separator />

              {/* Merchant: Upload Screenshot */}
              {userRole === "merchant" && (
                <div className="space-y-3">
                  <Label>Order Screenshot</Label>
                  {order.order_screenshot_url ? (
                    <div className="space-y-2">
                      <img
                        src={order.order_screenshot_url}
                        alt="Order screenshot"
                        className="w-full rounded-lg border max-h-48 object-cover"
                      />
                      <p className="text-sm text-green-600">Screenshot uploaded</p>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleScreenshotUpload}
                        disabled={uploading}
                        className="hidden"
                        id="screenshot-upload"
                      />
                      <Label
                        htmlFor="screenshot-upload"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {uploading ? "Uploading..." : "Click to upload order screenshot"}
                        </span>
                      </Label>
                    </div>
                  )}
                </div>
              )}

              {/* Customer: View Screenshot */}
              {userRole === "customer" && order.order_screenshot_url && (
                <div className="space-y-2">
                  <Label>Order Screenshot</Label>
                  <img
                    src={order.order_screenshot_url}
                    alt="Order screenshot"
                    className="w-full rounded-lg border max-h-48 object-cover"
                  />
                </div>
              )}

              {/* Merchant: Add Tracking */}
              {userRole === "merchant" && order.order_screenshot_url && (
                <div className="space-y-2">
                  <Label>Tracking ID</Label>
                  <div className="flex gap-2">
                    <Input
                      value={trackingId}
                      onChange={(e) => setTrackingId(e.target.value)}
                      placeholder="Enter tracking ID"
                    />
                    <Button onClick={handleUpdateTracking} disabled={loading || !trackingId}>
                      Save
                    </Button>
                  </div>
                </div>
              )}

              {/* Customer: View Tracking */}
              {userRole === "customer" && order.tracking_id && (
                <div className="space-y-2">
                  <Label>Tracking ID</Label>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded">
                    <Truck className="h-4 w-4" />
                    <span className="font-mono">{order.tracking_id}</span>
                  </div>
                </div>
              )}

              {/* Customer: Submit OTP */}
              {userRole === "customer" && (order.status === "shipped" || order.status === "delivered") && (
                <div className="space-y-2">
                  <Label>Delivery OTP</Label>
                  <p className="text-sm text-muted-foreground">
                    Enter the OTP you received upon delivery
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Enter OTP"
                      maxLength={6}
                    />
                    <Button 
                      onClick={handleSubmitOtp} 
                      disabled={submittingOtp || !otpCode}
                    >
                      {submittingOtp ? "Submitting..." : "Submit OTP"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
