import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase, Deal } from "@/lib/supabase";
import { useKycStatus } from "@/hooks/useKycStatus";
import { KycBlocker } from "@/components/kyc/KycBlocker";
import { Loader2, MapPin, CreditCard, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AcceptDealDialogProps {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AcceptDealDialog({ deal, open, onOpenChange, onSuccess }: AcceptDealDialogProps) {
  const { toast } = useToast();
  const { status: kycStatus, loading: kycLoading, canAcceptDeal } = useKycStatus();
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    if (!deal) return;

    if (!canAcceptDeal) {
      toast({ title: "KYC Required", description: "Please complete KYC verification first", variant: "destructive" });
      return;
    }

    // Use merchant's delivery address from the deal
    const merchantAddress = (deal as any).merchant_delivery_address || deal.delivery_address;
    
    if (!merchantAddress) {
      toast({ 
        title: "Error", 
        description: "This deal doesn't have a delivery address configured", 
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);

    // Call the accept_deal database function
    const { error } = await supabase.rpc("accept_deal", {
      p_deal_id: deal.id,
      p_delivery_address: merchantAddress
    });

    setLoading(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deal Accepted!", description: "You can now place the order using the merchant's delivery address" });
      onSuccess();
    }
  };

  if (!deal) return null;

  // Get merchant delivery address
  const merchantAddress = (deal as any).merchant_delivery_address || deal.delivery_address;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Accept Deal</DialogTitle>
          <DialogDescription>
            You're about to accept the deal for {deal.product_name}
          </DialogDescription>
        </DialogHeader>

        {kycLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !canAcceptDeal ? (
          <div className="py-4">
            <KycBlocker status={kycStatus} actionType="accept" />
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              {/* Deal Summary */}
              <div className="p-4 rounded-xl bg-secondary/50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Product</span>
                  <span className="text-sm font-medium">{deal.product_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Required Card</span>
                  <span className="text-sm font-medium flex items-center gap-1">
                    <CreditCard className="w-3 h-3" />
                    {deal.required_card}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Original MRP</span>
                  <span className="text-sm font-medium line-through text-muted-foreground">₹{deal.original_price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Card Offer Price</span>
                  <span className="text-sm font-medium">₹{deal.card_offer_price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Savings</span>
                  <span className="text-sm font-medium text-green-600">₹{(deal.original_price - deal.card_offer_price).toLocaleString()}</span>
                </div>
              </div>

              {/* Merchant Delivery Address - Read Only */}
              {merchantAddress && (
                <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-700">Merchant's Delivery Address</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {merchantAddress}
                  </p>
                  <p className="text-xs text-blue-600 mt-2">
                    You must use this address when placing the order on the e-commerce site.
                  </p>
                </div>
              )}

              {/* Payment Breakdown */}
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                <h4 className="text-sm font-semibold text-primary mb-2">💰 How You'll Earn</h4>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Your Commission (40% of extra)</span>
                  <span className="text-sm font-bold text-green-600">₹{deal.commission_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">You pay on e-commerce site</span>
                  <span className="text-sm font-medium">₹{deal.card_offer_price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total you'll receive</span>
                  <span className="text-sm font-bold text-primary">₹{(deal.card_offer_price + deal.commission_amount).toLocaleString()}</span>
                </div>
              </div>

              {/* Escrow Info */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <p className="font-medium mb-1">Escrow Protection</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Merchant has locked 30% advance (₹{deal.advance_amount.toLocaleString()})</li>
                    <li>Remaining 70% (₹{deal.remaining_amount.toLocaleString()}) paid before OTP</li>
                    <li>Funds released to you after OTP verification</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleAccept} disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  "Accept Deal"
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}