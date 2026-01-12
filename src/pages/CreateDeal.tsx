import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useKycStatus } from "@/hooks/useKycStatus";
import { KycBlocker } from "@/components/kyc/KycBlocker";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Link as LinkIcon, CreditCard, IndianRupee, Loader2, Info, Users, Building2, Wallet, TrendingUp, ShieldCheck, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

// Configurable percentages (these could come from admin settings in future)
const COMMISSION_PERCENTAGE = 70; // Customer gets 70% of extra amount
const ADVANCE_PERCENTAGE = 25; // Merchant pays 25% of final price as advance

export default function CreateDeal() {
  const { profile } = useAuth();
  const { status: kycStatus, loading: kycLoading, canCreateDeal } = useKycStatus();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    product_name: "",
    product_link: "",
    original_price: "",
    card_offer_price: "",
    merchant_final_price: "",
    required_card: "",
  });

  // Parse input values
  const originalPrice = parseFloat(formData.original_price) || 0;
  const cardOfferPrice = parseFloat(formData.card_offer_price) || 0;
  const merchantFinalPrice = parseFloat(formData.merchant_final_price) || 0;

  // Business logic calculations
  const totalSavings = Math.max(0, originalPrice - cardOfferPrice);
  const extraAmount = Math.max(0, merchantFinalPrice - cardOfferPrice);
  const customerCommission = Math.round(extraAmount * (COMMISSION_PERCENTAGE / 100));
  const platformFee = Math.max(0, extraAmount - customerCommission);
  
  // Payment breakdown
  const advanceAmount = Math.round(merchantFinalPrice * (ADVANCE_PERCENTAGE / 100));
  const remainingAmount = merchantFinalPrice - advanceAmount;
  
  // What customer pays on e-commerce site
  const customerPayment = cardOfferPrice;

  // Validation
  const isValidDeal = 
    merchantFinalPrice >= cardOfferPrice && 
    cardOfferPrice > 0 && 
    cardOfferPrice <= originalPrice &&
    merchantFinalPrice > 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile) {
      toast({ title: "Error", description: "Please log in first", variant: "destructive" });
      return;
    }

    if (!canCreateDeal) {
      toast({ title: "KYC Required", description: "Please complete KYC verification first", variant: "destructive" });
      return;
    }

    if (!isValidDeal) {
      toast({ 
        title: "Invalid Pricing", 
        description: "Please check your pricing values. Final price must be ≥ card offer price, and card offer price must be ≤ original price.", 
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("deals").insert({
      merchant_id: profile.id,
      product_name: formData.product_name,
      product_link: formData.product_link,
      original_price: originalPrice,
      card_offer_price: cardOfferPrice,
      expected_buy_price: merchantFinalPrice,
      required_card: formData.required_card,
      commission_amount: customerCommission,
      platform_fee: platformFee,
      advance_amount: advanceAmount,
      remaining_amount: remainingAmount,
      status: "pending"
    });

    setLoading(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Deal created and pending admin approval" });
      navigate("/dashboard");
    }
  };

  // Show loading state while checking KYC
  if (kycLoading) {
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
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Create a Deal</h1>
            <p className="text-muted-foreground">Find someone with the credit card you need</p>
          </div>
        </div>

        {/* KYC Blocker */}
        {!canCreateDeal && (
          <KycBlocker status={kycStatus} actionType="create" />
        )}

        {/* Show form only if KYC is approved */}
        {canCreateDeal && (
          <>
            {/* How it works */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  How OfferBridge Works
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>1. You create a deal with the product you want and the card discount you need.</p>
                <p>2. A customer with the required card accepts your deal and places the order.</p>
                <p>3. You pay the merchant final price (advance now + remaining after delivery).</p>
                <p>4. The customer earns commission, platform takes a small fee.</p>
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-5 gap-6">
              {/* Form */}
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Deal Details</CardTitle>
                  <CardDescription>
                    Enter product information and pricing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Product Info */}
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="product_name">Product Name</Label>
                        <Input
                          id="product_name"
                          name="product_name"
                          placeholder="e.g., iPhone 15 Pro Max"
                          value={formData.product_name}
                          onChange={handleChange}
                          required
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="product_link">Product Link</Label>
                        <div className="relative mt-1">
                          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="product_link"
                            name="product_link"
                            type="url"
                            placeholder="https://amazon.in/..."
                            value={formData.product_link}
                            onChange={handleChange}
                            required
                            className="pl-10"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="required_card">Required Credit Card</Label>
                        <div className="relative mt-1">
                          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="required_card"
                            name="required_card"
                            placeholder="e.g., HDFC Infinia, SBI Elite, ICICI Amazon Pay"
                            value={formData.required_card}
                            onChange={handleChange}
                            required
                            className="pl-10"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Pricing */}
                    <div className="space-y-4">
                      <h3 className="font-semibold">Pricing Details</h3>
                      
                      <div>
                        <Label htmlFor="original_price">Original Price / MRP (₹)</Label>
                        <div className="relative mt-1">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="original_price"
                            name="original_price"
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={formData.original_price}
                            onChange={handleChange}
                            required
                            className="pl-10"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Product price without any discounts</p>
                      </div>

                      <div>
                        <Label htmlFor="card_offer_price">Card Offer Price (₹)</Label>
                        <div className="relative mt-1">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="card_offer_price"
                            name="card_offer_price"
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={formData.card_offer_price}
                            onChange={handleChange}
                            required
                            className="pl-10"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Price after credit card discount (what customer pays on site)</p>
                      </div>

                      <div>
                        <Label htmlFor="merchant_final_price">Merchant Final Price (₹)</Label>
                        <div className="relative mt-1">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="merchant_final_price"
                            name="merchant_final_price"
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={formData.merchant_final_price}
                            onChange={handleChange}
                            required
                            className="pl-10"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Total amount you're willing to pay (must be ≥ card offer price)</p>
                      </div>

                      {merchantFinalPrice > 0 && merchantFinalPrice < cardOfferPrice && (
                        <div className="flex items-center gap-2 text-destructive text-sm">
                          <AlertCircle className="w-4 h-4" />
                          <span>Merchant final price must be at least the card offer price</span>
                        </div>
                      )}
                    </div>

                    <Button type="submit" className="w-full" disabled={loading || !isValidDeal}>
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating Deal...
                        </>
                      ) : (
                        "Create Deal"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Live Calculations Sidebar */}
              <div className="lg:col-span-2 space-y-4">
                {/* Savings Overview */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      Savings Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Card Discount</span>
                      <span className="font-medium text-green-600">₹{totalSavings.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Extra Amount Pool</span>
                      <span className="font-medium">₹{extraAmount.toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Money Split */}
                <Card className="border-primary/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">How Money is Split</CardTitle>
                    <CardDescription className="text-xs">
                      Auto-calculated ({COMMISSION_PERCENTAGE}% to customer)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-500" />
                        <span>Customer Commission</span>
                      </div>
                      <span className="font-bold text-blue-600">₹{customerCommission.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-orange-500" />
                        <span>Platform Fee</span>
                      </div>
                      <span className="font-medium text-orange-600">₹{platformFee.toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-muted-foreground" />
                        <span>Customer Pays Online</span>
                      </div>
                      <span className="font-medium">₹{customerPayment.toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Schedule */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Wallet className="w-4 h-4" />
                      Your Payment Schedule
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {ADVANCE_PERCENTAGE}% advance, rest after delivery
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">Advance (Locked)</div>
                        <div className="text-xs text-muted-foreground">Paid when deal is accepted</div>
                      </div>
                      <span className="font-bold">₹{advanceAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">Remaining</div>
                        <div className="text-xs text-muted-foreground">After delivery confirmation</div>
                      </div>
                      <span className="font-medium">₹{remainingAmount.toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center text-base">
                      <span className="font-semibold">Total You Pay</span>
                      <span className="font-bold text-primary">₹{merchantFinalPrice.toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Escrow Info */}
                <Card className="bg-secondary/30">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-green-500 mt-0.5" />
                      <div className="text-sm">
                        <div className="font-medium">Escrow Protected</div>
                        <div className="text-muted-foreground text-xs mt-1">
                          Your advance is held securely and only released after delivery is confirmed with OTP verification.
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
