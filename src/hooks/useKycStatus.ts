import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type KycStatus = "not_submitted" | "pending" | "approved" | "rejected";

interface KycStatusResult {
  status: KycStatus;
  loading: boolean;
  canCreateDeal: boolean;
  canAcceptDeal: boolean;
  message: string;
  refetch: () => Promise<void>;
}

export function useKycStatus(): KycStatusResult {
  const { profile } = useAuth();
  const [status, setStatus] = useState<KycStatus>("not_submitted");
  const [loading, setLoading] = useState(true);

  const fetchKycStatus = async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("kycs")
      .select("status")
      .eq("user_id", profile.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching KYC status:", error);
      setLoading(false);
      return;
    }

    if (!data) {
      setStatus("not_submitted");
    } else {
      setStatus(data.status as KycStatus);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchKycStatus();
  }, [profile?.id]);

  const canCreateDeal = status === "approved";
  const canAcceptDeal = status === "approved";

  const getMessage = (): string => {
    switch (status) {
      case "not_submitted":
        return "Please complete your KYC verification to proceed.";
      case "pending":
        return "Your KYC is under verification. Please wait for admin approval.";
      case "rejected":
        return "Your KYC was rejected. Please resubmit with correct details.";
      case "approved":
        return "Your KYC is verified. You can create and accept deals.";
      default:
        return "";
    }
  };

  return {
    status,
    loading,
    canCreateDeal,
    canAcceptDeal,
    message: getMessage(),
    refetch: fetchKycStatus,
  };
}
