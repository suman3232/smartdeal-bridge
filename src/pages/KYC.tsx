import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  FileCheck, 
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Building,
  CreditCard,
  FileText
} from "lucide-react";

type KYC = {
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
  updated_at: string;
};

export default function KYC() {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [kyc, setKyc] = useState<KYC | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [form, setForm] = useState({
    pan_number: "",
    bank_name: "",
    account_number: "",
    ifsc_code: "",
    document_url: ""
  });

  useEffect(() => {
    if (profile) {
      fetchKYC();
    }
  }, [profile]);

  const fetchKYC = async () => {
    if (!profile) return;
    
    const { data, error } = await supabase
      .from("kycs")
      .select("*")
      .eq("user_id", profile.id)
      .maybeSingle();

    if (data) {
      setKyc(data as KYC);
      setForm({
        pan_number: data.pan_number,
        bank_name: data.bank_name,
        account_number: data.account_number,
        ifsc_code: data.ifsc_code,
        document_url: data.document_url
      });
    }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
    
    const fileExt = file.name.split(".").pop();
    const fileName = `${profile.id}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from("order-screenshots")
      .upload(fileName, file);

    if (uploadError) {
      toast({ title: "Upload Error", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("order-screenshots").getPublicUrl(fileName);
    setForm({ ...form, document_url: data.publicUrl });
    setUploading(false);
    toast({ title: "Document Uploaded", description: "Your document has been uploaded successfully" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!form.pan_number || !form.bank_name || !form.account_number || !form.ifsc_code || !form.document_url) {
      toast({ title: "Missing Fields", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    if (kyc) {
      // Update existing KYC
      const { error } = await supabase
        .from("kycs")
        .update({
          pan_number: form.pan_number,
          bank_name: form.bank_name,
          account_number: form.account_number,
          ifsc_code: form.ifsc_code,
          document_url: form.document_url,
          status: "pending"
        })
        .eq("id", kyc.id);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "KYC Updated", description: "Your KYC has been resubmitted for review" });
        fetchKYC();
      }
    } else {
      // Create new KYC
      const { error } = await supabase
        .from("kycs")
        .insert({
          user_id: profile.id,
          pan_number: form.pan_number,
          bank_name: form.bank_name,
          account_number: form.account_number,
          ifsc_code: form.ifsc_code,
          document_url: form.document_url
        });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "KYC Submitted", description: "Your KYC has been submitted for review" });
        fetchKYC();
      }
    }

    setSubmitting(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved": return <CheckCircle className="w-5 h-5 text-success" />;
      case "rejected": return <XCircle className="w-5 h-5 text-destructive" />;
      default: return <Clock className="w-5 h-5 text-warning" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "approved": return "success" as const;
      case "rejected": return "rejected" as const;
      default: return "pending" as const;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl gradient-bg flex items-center justify-center shadow-glow">
            <FileCheck className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">KYC Verification</h1>
            <p className="text-muted-foreground">Complete your identity verification</p>
          </div>
        </div>

        {/* Status Card (if KYC exists) */}
        {kyc && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(kyc.status)}
                  <div>
                    <p className="font-medium capitalize">KYC {kyc.status}</p>
                    <p className="text-sm text-muted-foreground">
                      {kyc.status === "pending" && "Your verification is under review"}
                      {kyc.status === "approved" && "Your account is fully verified"}
                      {kyc.status === "rejected" && "Please update and resubmit"}
                    </p>
                  </div>
                </div>
                <Badge variant={getStatusVariant(kyc.status)} className="capitalize">
                  {kyc.status}
                </Badge>
              </div>
              {kyc.status === "rejected" && kyc.admin_notes && (
                <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Rejection Reason</p>
                      <p className="text-sm text-muted-foreground">{kyc.admin_notes}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* KYC Form */}
        {(!kyc || kyc.status === "rejected" || kyc.status === "pending") && (
          <Card>
            <CardHeader>
              <CardTitle>Verification Details</CardTitle>
              <CardDescription>
                Provide your PAN and bank details for verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* PAN Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CreditCard className="w-4 h-4" />
                    PAN Details
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pan">PAN Number *</Label>
                    <Input
                      id="pan"
                      placeholder="ABCDE1234F"
                      value={form.pan_number}
                      onChange={(e) => setForm({ ...form, pan_number: e.target.value.toUpperCase() })}
                      maxLength={10}
                      disabled={kyc?.status === "approved"}
                    />
                  </div>
                </div>

                {/* Bank Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Building className="w-4 h-4" />
                    Bank Details
                  </div>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bank">Bank Name *</Label>
                      <Input
                        id="bank"
                        placeholder="e.g., State Bank of India"
                        value={form.bank_name}
                        onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                        disabled={kyc?.status === "approved"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="account">Account Number *</Label>
                      <Input
                        id="account"
                        placeholder="Enter your account number"
                        value={form.account_number}
                        onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                        disabled={kyc?.status === "approved"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ifsc">IFSC Code *</Label>
                      <Input
                        id="ifsc"
                        placeholder="e.g., SBIN0001234"
                        value={form.ifsc_code}
                        onChange={(e) => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })}
                        maxLength={11}
                        disabled={kyc?.status === "approved"}
                      />
                    </div>
                  </div>
                </div>

                {/* Document Upload */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="w-4 h-4" />
                    Document Upload
                  </div>
                  <div className="space-y-2">
                    <Label>PAN Card Photo *</Label>
                    {form.document_url ? (
                      <div className="relative">
                        <img 
                          src={form.document_url} 
                          alt="Document" 
                          className="w-full h-48 object-cover rounded-lg border"
                        />
                        {kyc?.status !== "approved" && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => setForm({ ...form, document_url: "" })}
                          >
                            Change
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="doc-upload"
                        />
                        <label htmlFor="doc-upload" className="cursor-pointer">
                          {uploading ? (
                            <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-primary" />
                          ) : (
                            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          )}
                          <p className="text-sm text-muted-foreground">
                            {uploading ? "Uploading..." : "Click to upload PAN card image"}
                          </p>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {kyc?.status !== "approved" && (
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : kyc ? (
                      "Resubmit KYC"
                    ) : (
                      "Submit KYC"
                    )}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
        )}

        {/* Approved State */}
        {kyc?.status === "approved" && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Verification Complete</h3>
              <p className="text-muted-foreground">
                Your KYC has been approved. You can now receive payments.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}