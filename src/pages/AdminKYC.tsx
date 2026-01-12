import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Clock, 
  CheckCircle, 
  XCircle,
  ExternalLink,
  Loader2,
  FileCheck,
  User,
  CreditCard,
  Building,
  Camera,
  Calendar
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type KYCWithProfile = {
  id: string;
  user_id: string;
  pan_number: string;
  full_name: string | null;
  date_of_birth: string | null;
  bank_name: string;
  account_number: string;
  account_holder_name: string | null;
  ifsc_code: string;
  document_url: string;
  selfie_url: string | null;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
    phone: string | null;
  } | null;
};

export default function AdminKYC() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [kycs, setKycs] = useState<KYCWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedKyc, setSelectedKyc] = useState<KYCWithProfile | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; kycId: string | null; notes: string }>({
    open: false,
    kycId: null,
    notes: ""
  });

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchKYCs();
    }
  }, [isAdmin]);

  const fetchKYCs = async () => {
    const { data, error } = await supabase
      .from("kycs")
      .select(`
        *,
        profiles!kycs_user_id_fkey (
          full_name,
          email,
          phone
        )
      `)
      .order("created_at", { ascending: false });

    if (data) setKycs(data as KYCWithProfile[]);
    setLoading(false);
  };

  const handleApprove = async (kycId: string) => {
    setActionLoading(kycId);
    
    const { error } = await supabase
      .from("kycs")
      .update({ status: "approved", admin_notes: null })
      .eq("id", kycId);
    
    setActionLoading(null);
    
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "KYC Approved", description: "User has been verified and can now create/accept deals" });
      fetchKYCs();
      setSelectedKyc(null);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog.kycId) return;
    
    setActionLoading(rejectDialog.kycId);
    
    const { error } = await supabase
      .from("kycs")
      .update({ 
        status: "rejected", 
        admin_notes: rejectDialog.notes || "Your submission did not meet our requirements. Please resubmit with correct details." 
      })
      .eq("id", rejectDialog.kycId);
    
    setActionLoading(null);
    setRejectDialog({ open: false, kycId: null, notes: "" });
    
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "KYC Rejected", description: "User has been notified with rejection reason" });
      fetchKYCs();
      setSelectedKyc(null);
    }
  };

  const pendingKycs = kycs.filter(k => k.status === "pending");
  const approvedKycs = kycs.filter(k => k.status === "approved");
  const rejectedKycs = kycs.filter(k => k.status === "rejected");

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "approved": return "success" as const;
      case "rejected": return "rejected" as const;
      default: return "pending" as const;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not provided";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) return null;

  const KYCCard = ({ kyc }: { kyc: KYCWithProfile }) => (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedKyc(kyc)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">{kyc.full_name || kyc.profiles?.full_name || "Unknown"}</h3>
              <p className="text-sm text-muted-foreground">{kyc.profiles?.email}</p>
            </div>
          </div>
          <Badge variant={getStatusVariant(kyc.status)} className="capitalize">
            {kyc.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2 rounded-lg bg-secondary/50">
            <p className="text-xs text-muted-foreground">PAN</p>
            <p className="text-sm font-medium">{kyc.pan_number}</p>
          </div>
          <div className="p-2 rounded-lg bg-secondary/50">
            <p className="text-xs text-muted-foreground">Bank</p>
            <p className="text-sm font-medium truncate">{kyc.bank_name}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); setSelectedKyc(kyc); }}>
            <ExternalLink className="w-4 h-4 mr-1" />
            View Details
          </Button>
          
          {kyc.status === "pending" && (
            <>
              <Button 
                size="sm" 
                onClick={(e) => { e.stopPropagation(); handleApprove(kyc.id); }}
                disabled={actionLoading === kyc.id}
              >
                {actionLoading === kyc.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
              </Button>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={(e) => { e.stopPropagation(); setRejectDialog({ open: true, kycId: kyc.id, notes: "" }); }}
                disabled={actionLoading === kyc.id}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl gradient-bg flex items-center justify-center shadow-glow">
            <FileCheck className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">KYC Verification</h1>
            <p className="text-muted-foreground">Review and approve user verifications</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingKycs.length}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{approvedKycs.length}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rejectedKycs.length}</p>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="w-4 h-4" />
              Pending ({pendingKycs.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <CheckCircle className="w-4 h-4" />
              Approved ({approvedKycs.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2">
              <XCircle className="w-4 h-4" />
              Rejected ({rejectedKycs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingKycs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="w-12 h-12 text-success mb-4" />
                  <p className="text-lg font-semibold">All Caught Up!</p>
                  <p className="text-muted-foreground">No pending KYC verifications</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingKycs.map(kyc => <KYCCard key={kyc.id} kyc={kyc} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4">
            {approvedKycs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileCheck className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-semibold">No Approved KYCs</p>
                  <p className="text-muted-foreground">Approved verifications will appear here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {approvedKycs.map(kyc => <KYCCard key={kyc.id} kyc={kyc} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4">
            {rejectedKycs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <XCircle className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-semibold">No Rejected KYCs</p>
                  <p className="text-muted-foreground">Rejected verifications will appear here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rejectedKycs.map(kyc => <KYCCard key={kyc.id} kyc={kyc} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Details Dialog */}
      <Dialog open={!!selectedKyc} onOpenChange={() => setSelectedKyc(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              KYC Details
              {selectedKyc && (
                <Badge variant={getStatusVariant(selectedKyc.status)} className="capitalize ml-2">
                  {selectedKyc.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedKyc && (
            <div className="space-y-4">
              {/* User Info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{selectedKyc.profiles?.full_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedKyc.profiles?.email}</p>
                  {selectedKyc.profiles?.phone && (
                    <p className="text-sm text-muted-foreground">{selectedKyc.profiles.phone}</p>
                  )}
                </div>
              </div>

              {/* PAN Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CreditCard className="w-4 h-4 text-primary" />
                  PAN Card Details
                </div>
                <div className="p-3 rounded-lg bg-secondary/30 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">PAN Number</p>
                    <p className="font-mono font-semibold">{selectedKyc.pan_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Full Name (as per PAN)</p>
                    <p className="font-medium">{selectedKyc.full_name || "Not provided"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Date of Birth</p>
                      <p className="font-medium">{formatDate(selectedKyc.date_of_birth)}</p>
                    </div>
                  </div>
                </div>
                
                {/* PAN Image */}
                <div>
                  <p className="text-sm font-medium mb-2">PAN Card Image</p>
                  <a href={selectedKyc.document_url} target="_blank" rel="noopener noreferrer">
                    <img 
                      src={selectedKyc.document_url} 
                      alt="PAN Card" 
                      className="w-full h-48 object-cover rounded-lg border hover:opacity-90 transition-opacity"
                    />
                  </a>
                </div>
              </div>

              {/* Bank Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Building className="w-4 h-4 text-primary" />
                  Bank Account Details
                </div>
                <div className="p-3 rounded-lg bg-secondary/30 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Account Holder</p>
                      <p className="font-medium">{selectedKyc.account_holder_name || "Not provided"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Bank Name</p>
                      <p className="font-medium">{selectedKyc.bank_name}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Account Number</p>
                      <p className="font-mono">{selectedKyc.account_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">IFSC Code</p>
                      <p className="font-mono">{selectedKyc.ifsc_code}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Selfie */}
              {selectedKyc.selfie_url && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Camera className="w-4 h-4 text-primary" />
                    Selfie Photo
                  </div>
                  <a href={selectedKyc.selfie_url} target="_blank" rel="noopener noreferrer">
                    <img 
                      src={selectedKyc.selfie_url} 
                      alt="Selfie" 
                      className="w-full h-48 object-cover rounded-lg border hover:opacity-90 transition-opacity"
                    />
                  </a>
                </div>
              )}

              {!selectedKyc.selfie_url && (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-warning" />
                    <span className="text-muted-foreground">No selfie provided by user</span>
                  </div>
                </div>
              )}

              {/* Rejection Notes (if rejected) */}
              {selectedKyc.status === "rejected" && selectedKyc.admin_notes && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm font-medium text-destructive mb-1">Rejection Reason</p>
                  <p className="text-sm text-muted-foreground">{selectedKyc.admin_notes}</p>
                </div>
              )}

              {/* Actions */}
              {selectedKyc.status === "pending" && (
                <div className="flex gap-2 pt-2 border-t">
                  <Button 
                    className="flex-1"
                    onClick={() => handleApprove(selectedKyc.id)}
                    disabled={actionLoading === selectedKyc.id}
                  >
                    {actionLoading === selectedKyc.id ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Approve KYC
                  </Button>
                  <Button 
                    variant="destructive"
                    className="flex-1"
                    onClick={() => setRejectDialog({ open: true, kycId: selectedKyc.id, notes: "" })}
                    disabled={actionLoading === selectedKyc.id}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject KYC
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialog.open} onOpenChange={(open) => !open && setRejectDialog({ ...rejectDialog, open: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject KYC</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a clear reason for rejection. This will be shown to the user so they can correct and resubmit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for rejection (e.g., PAN image is blurry, details don't match, etc.)..."
              value={rejectDialog.notes}
              onChange={(e) => setRejectDialog({ ...rejectDialog, notes: e.target.value })}
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-destructive text-destructive-foreground">
              Reject KYC
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
