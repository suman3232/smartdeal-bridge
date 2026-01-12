import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { KycStatusBadge } from "@/components/kyc/KycStatusBadge";
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
  FileText,
  User,
  Calendar,
  Camera
} from "lucide-react";

type KYCData = {
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
  updated_at: string;
};

export default function KYC() {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [kyc, setKyc] = useState<KYCData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPan, setUploadingPan] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  
  const [form, setForm] = useState({
    pan_number: "",
    full_name: "",
    date_of_birth: "",
    bank_name: "",
    account_number: "",
    account_holder_name: "",
    ifsc_code: "",
    document_url: "",
    selfie_url: ""
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
      setKyc(data as KYCData);
      setForm({
        pan_number: data.pan_number || "",
        full_name: data.full_name || "",
        date_of_birth: data.date_of_birth || "",
        bank_name: data.bank_name || "",
        account_number: data.account_number || "",
        account_holder_name: data.account_holder_name || "",
        ifsc_code: data.ifsc_code || "",
        document_url: data.document_url || "",
        selfie_url: data.selfie_url || ""
      });
    }
    setLoading(false);
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>, 
    type: "pan" | "selfie"
  ) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    const setUploading = type === "pan" ? setUploadingPan : setUploadingSelfie;
    setUploading(true);
    
    const fileExt = file.name.split(".").pop();
    const fileName = `${profile.id}/${type}_${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from("order-screenshots")
      .upload(fileName, file);

    if (uploadError) {
      toast({ title: "Upload Error", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("order-screenshots").getPublicUrl(fileName);
    
    if (type === "pan") {
      setForm({ ...form, document_url: data.publicUrl });
    } else {
      setForm({ ...form, selfie_url: data.publicUrl });
    }
    
    setUploading(false);
    toast({ 
      title: "Uploaded", 
      description: `${type === "pan" ? "PAN Card" : "Selfie"} uploaded successfully` 
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    // Validation
    if (!form.pan_number || !form.full_name || !form.date_of_birth || 
        !form.bank_name || !form.account_number || !form.account_holder_name || 
        !form.ifsc_code || !form.document_url) {
      toast({ 
        title: "Missing Fields", 
        description: "Please fill all required fields including PAN card image", 
        variant: "destructive" 
      });
      return;
    }

    // PAN number validation (basic format: 5 letters, 4 digits, 1 letter)
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(form.pan_number)) {
      toast({ 
        title: "Invalid PAN Number", 
        description: "Please enter a valid PAN number (e.g., ABCDE1234F)", 
        variant: "destructive" 
      });
      return;
    }

    // IFSC validation (basic format: 4 letters, 0, 6 alphanumeric)
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(form.ifsc_code)) {
      toast({ 
        title: "Invalid IFSC Code", 
        description: "Please enter a valid IFSC code (e.g., SBIN0001234)", 
        variant: "destructive" 
      });
      return;
    }

    setSubmitting(true);

    const kycData = {
      pan_number: form.pan_number,
      full_name: form.full_name,
      date_of_birth: form.date_of_birth,
      bank_name: form.bank_name,
      account_number: form.account_number,
      account_holder_name: form.account_holder_name,
      ifsc_code: form.ifsc_code,
      document_url: form.document_url,
      selfie_url: form.selfie_url || null,
      status: "pending" as const
    };

    if (kyc) {
      // Update existing KYC
      const { error } = await supabase
        .from("kycs")
        .update(kycData)
        .eq("id", kyc.id);

      if (error) {
        if (error.code === "23505" && error.message.includes("pan_number")) {
          toast({ 
            title: "PAN Already Registered", 
            description: "This PAN number is already linked to another account", 
            variant: "destructive" 
          });
        } else {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
      } else {
        toast({ title: "KYC Updated", description: "Your KYC has been resubmitted for review" });
        fetchKYC();
      }
    } else {
      // Create new KYC
      const { error } = await supabase
        .from("kycs")
        .insert({
          ...kycData,
          user_id: profile.id
        });

      if (error) {
        if (error.code === "23505" && error.message.includes("pan_number")) {
          toast({ 
            title: "PAN Already Registered", 
            description: "This PAN number is already linked to another account", 
            variant: "destructive" 
          });
        } else {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
      } else {
        toast({ title: "KYC Submitted", description: "Your KYC has been submitted for review" });
        fetchKYC();
      }
    }

    setSubmitting(false);
  };

  const getKycStatus = (): "not_submitted" | "pending" | "approved" | "rejected" => {
    if (!kyc) return "not_submitted";
    return kyc.status;
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl gradient-bg flex items-center justify-center shadow-glow">
              <FileCheck className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">KYC Verification</h1>
              <p className="text-muted-foreground">Complete your identity verification</p>
            </div>
          </div>
          <KycStatusBadge status={getKycStatus()} size="lg" />
        </div>

        {/* Status Card (if KYC exists) */}
        {kyc && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {kyc.status === "approved" && <CheckCircle className="w-5 h-5 text-success" />}
                  {kyc.status === "rejected" && <XCircle className="w-5 h-5 text-destructive" />}
                  {kyc.status === "pending" && <Clock className="w-5 h-5 text-warning" />}
                  <div>
                    <p className="font-medium capitalize">KYC {kyc.status}</p>
                    <p className="text-sm text-muted-foreground">
                      {kyc.status === "pending" && "Your verification is under review. This usually takes 1-2 business days."}
                      {kyc.status === "approved" && "Your account is fully verified. You can now create and accept deals."}
                      {kyc.status === "rejected" && "Please update your details and resubmit."}
                    </p>
                  </div>
                </div>
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
        {(!kyc || kyc.status === "rejected") && (
          <Card>
            <CardHeader>
              <CardTitle>Verification Details</CardTitle>
              <CardDescription>
                Provide your PAN and bank details for verification. All fields marked with * are mandatory.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* PAN Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium border-b pb-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    PAN Card Details
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="pan">PAN Number *</Label>
                    <Input
                      id="pan"
                      placeholder="ABCDE1234F"
                      value={form.pan_number}
                      onChange={(e) => setForm({ ...form, pan_number: e.target.value.toUpperCase() })}
                      maxLength={10}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name (as per PAN) *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="full_name"
                        placeholder="Enter your full name as shown on PAN card"
                        value={form.full_name}
                        onChange={(e) => setForm({ ...form, full_name: e.target.value.toUpperCase() })}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth *</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="dob"
                        type="date"
                        value={form.date_of_birth}
                        onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* PAN Upload */}
                  <div className="space-y-2">
                    <Label>PAN Card Photo *</Label>
                    {form.document_url ? (
                      <div className="relative">
                        <img 
                          src={form.document_url} 
                          alt="PAN Card" 
                          className="w-full h-48 object-cover rounded-lg border"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => setForm({ ...form, document_url: "" })}
                        >
                          Change
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, "pan")}
                          className="hidden"
                          id="pan-upload"
                        />
                        <label htmlFor="pan-upload" className="cursor-pointer">
                          {uploadingPan ? (
                            <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-primary" />
                          ) : (
                            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          )}
                          <p className="text-sm text-muted-foreground">
                            {uploadingPan ? "Uploading..." : "Click to upload clear PAN card image"}
                          </p>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bank Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium border-b pb-2">
                    <Building className="w-4 h-4 text-primary" />
                    Bank Account Details
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="account_holder">Account Holder Name *</Label>
                    <Input
                      id="account_holder"
                      placeholder="Name as per bank records"
                      value={form.account_holder_name}
                      onChange={(e) => setForm({ ...form, account_holder_name: e.target.value.toUpperCase() })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bank">Bank Name *</Label>
                    <Input
                      id="bank"
                      placeholder="e.g., State Bank of India"
                      value={form.bank_name}
                      onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account">Account Number *</Label>
                    <Input
                      id="account"
                      placeholder="Enter your account number"
                      value={form.account_number}
                      onChange={(e) => setForm({ ...form, account_number: e.target.value })}
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
                    />
                  </div>
                </div>

                {/* Selfie Section (Optional) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium border-b pb-2">
                    <Camera className="w-4 h-4 text-primary" />
                    Selfie Photo (Optional but recommended)
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Clear Selfie</Label>
                    {form.selfie_url ? (
                      <div className="relative">
                        <img 
                          src={form.selfie_url} 
                          alt="Selfie" 
                          className="w-full h-48 object-cover rounded-lg border"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => setForm({ ...form, selfie_url: "" })}
                        >
                          Change
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, "selfie")}
                          className="hidden"
                          id="selfie-upload"
                        />
                        <label htmlFor="selfie-upload" className="cursor-pointer">
                          {uploadingSelfie ? (
                            <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-primary" />
                          ) : (
                            <Camera className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                          )}
                          <p className="text-sm text-muted-foreground">
                            {uploadingSelfie ? "Uploading..." : "Upload a clear selfie (optional)"}
                          </p>
                        </label>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      A selfie helps us verify your identity faster and increases trust on the platform.
                    </p>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : kyc ? (
                    "Resubmit KYC"
                  ) : (
                    "Submit KYC for Verification"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Pending State */}
        {kyc?.status === "pending" && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-warning" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Verification In Progress</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Your KYC documents are being reviewed by our team. This usually takes 1-2 business days. You'll be notified once the verification is complete.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Approved State */}
        {kyc?.status === "approved" && (
          <Card className="border-success/30 bg-success/5">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Verification Complete</h3>
              <p className="text-muted-foreground">
                Your KYC has been approved. You can now create deals and accept deals on OfferBridge.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
