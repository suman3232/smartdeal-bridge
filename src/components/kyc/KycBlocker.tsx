import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, Clock, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { KycStatus } from "@/hooks/useKycStatus";
import { KycStatusBadge } from "./KycStatusBadge";

interface KycBlockerProps {
  status: KycStatus;
  actionType: "create" | "accept";
}

export function KycBlocker({ status, actionType }: KycBlockerProps) {
  const actionText = actionType === "create" ? "create deals" : "accept deals";

  const getContent = () => {
    switch (status) {
      case "not_submitted":
        return {
          icon: <AlertTriangle className="w-12 h-12 text-warning" />,
          title: "KYC Verification Required",
          description: `You need to complete your KYC verification before you can ${actionText}. This helps us ensure a safe and secure platform for all users.`,
          buttonText: "Complete KYC Now",
          showButton: true,
        };
      case "pending":
        return {
          icon: <Clock className="w-12 h-12 text-warning" />,
          title: "KYC Under Verification",
          description: `Your KYC is being reviewed by our team. You'll be able to ${actionText} once your verification is approved. This usually takes 1-2 business days.`,
          buttonText: "View KYC Status",
          showButton: true,
        };
      case "rejected":
        return {
          icon: <XCircle className="w-12 h-12 text-destructive" />,
          title: "KYC Verification Rejected",
          description: `Your KYC verification was rejected. Please review the rejection reason and resubmit with correct details to ${actionText}.`,
          buttonText: "Resubmit KYC",
          showButton: true,
        };
      default:
        return null;
    }
  };

  const content = getContent();
  if (!content) return null;

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardContent className="pt-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">{content.icon}</div>
          <div className="flex justify-center">
            <KycStatusBadge status={status} size="lg" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">{content.title}</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {content.description}
            </p>
          </div>
          {content.showButton && (
            <Link to="/kyc">
              <Button className="gap-2">
                <Shield className="w-4 h-4" />
                {content.buttonText}
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
