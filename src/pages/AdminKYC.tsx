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
  Shield, 
  Clock, 
  CheckCircle, 
  XCircle,
  ExternalLink,
  Loader2,
  FileCheck,
  User,
  CreditCard,
  Building
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
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  document_url: string;
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
      toast({ title: "KYC Approved", description: "User has been verified" });
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
        admin_notes: rejectDialog.notes || "Your submission did not meet our requirements" 
      })
      .eq("id", rejectDialog.kycId);
    
    setActionLoading(null);
    setRejectDialog({ open: false, kycId: null, notes: "" });
    
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "KYC Rejected", description: "User has been notified" });
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
              <h3 className="font-semibold">{kyc.profiles?.full_name || "Unknown"}</h3>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>KYC Details</DialogTitle>
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
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CreditCard className="w-4 h-4" />
                  PAN Details
                </div>
                <div className="p-3 rounded-lg bg-secondary/30">
                  <p className="text-lg font-mono">{selectedKyc.pan_number}</p>
                </div>
              </div>

              {/* Bank Details */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Building className="w-4 h-4" />
                  Bank Details
                </div>
                <div className="p-3 rounded-lg bg-secondary/30 space-y-1">
                  <p><span className="text-muted-foreground">Bank:</span> {selectedKyc.bank_name}</p>
                  <p><span className="text-muted-foreground">Account:</span> {selectedKyc.account_number}</p>
                  <p><span className="text-muted-foreground">IFSC:</span> {selectedKyc.ifsc_code}</p>
                </div>
              </div>

              {/* Document */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Document</p>
                <a href={selectedKyc.document_url} target="_blank" rel="noopener noreferrer">
                  <img 
                    src={selectedKyc.document_url} 
                    alt="KYC Document" 
                    className="w-full h-48 object-cover rounded-lg border hover:opacity-90 transition-opacity"
                  />
                </a>
              </div>

              {/* Actions */}
              {selectedKyc.status === "pending" && (
                <div className="flex gap-2 pt-2">
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
                    Approve
                  </Button>
                  <Button 
                    variant="destructive"
                    className="flex-1"
                    onClick={() => setRejectDialog({ open: true, kycId: selectedKyc.id, notes: "" })}
                    disabled={actionLoading === selectedKyc.id}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
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
              Please provide a reason for rejection. This will be shown to the user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for rejection..."
              value={rejectDialog.notes}
              onChange={(e) => setRejectDialog({ ...rejectDialog, notes: e.target.value })}
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