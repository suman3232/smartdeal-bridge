import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle, AlertTriangle } from "lucide-react";
import { KycStatus } from "@/hooks/useKycStatus";

interface KycStatusBadgeProps {
  status: KycStatus;
  size?: "sm" | "md" | "lg";
}

export function KycStatusBadge({ status, size = "md" }: KycStatusBadgeProps) {
  const iconSize = size === "sm" ? "w-3 h-3" : size === "lg" ? "w-5 h-5" : "w-4 h-4";
  
  const statusConfig = {
    not_submitted: {
      label: "Not Submitted",
      variant: "secondary" as const,
      icon: <AlertTriangle className={iconSize} />,
    },
    pending: {
      label: "Under Verification",
      variant: "pending" as const,
      icon: <Clock className={iconSize} />,
    },
    approved: {
      label: "Verified",
      variant: "success" as const,
      icon: <CheckCircle className={iconSize} />,
    },
    rejected: {
      label: "Rejected",
      variant: "rejected" as const,
      icon: <XCircle className={iconSize} />,
    },
  };

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className="gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
}
