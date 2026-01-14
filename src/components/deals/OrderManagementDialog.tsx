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
import { Upload, Package, Truck, CheckCircle, Clock, AlertCircle, MapPin, Phone, Lock, Wallet } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const [ecommerceOrderId, setEcommerceOrderId] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [submittingOtp, setSubmittingOtp] = useState(false);
  const [payingRemaining, setPayingRemaining] = useState(false);

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
      if ((data as any)?.ecommerce_order_id) {
        setEcommerceOrderId((data as any).ecommerce_order_id);
      }
      if ((data as any)?.customer_phone) {
        setCustomerPhone((data as any).customer_phone);
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
        description: "Order has been created. Now place the order on the e-commerce site.",
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

      toast({
        title: "Screenshot Uploaded",
        description: "Order screenshot has been uploaded.",
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

  const handleUpdateOrderDetails = async () => {
    if (!order || !ecommerceOrderId || !trackingId || !customerPhone) {
      toast({
        title: "Missing Details",
        description: "Please fill all order details (Order ID, Tracking ID, Phone Number)",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Update order with e-commerce details
      const { error: orderError } = await supabase
        .from("orders")
        .update({ 
          tracking_id: trackingId,
          ecommerce_order_id: ecommerceOrderId,
          customer_phone: customerPhone,
          status: "shipped" 
        } as any)
        .eq("id", order.id);

      if (orderError) throw orderError;

      // Lock the deal status to order_placed
      await supabase
        .from("deals")
        .update({ status: "order_placed" } as any)
        .eq("id", deal!.id);

      toast({
        title: "Order Locked",
        description: "Order details saved. The deal is now locked and cannot be cancelled.",
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

  const handlePayRemaining = async () => {
    if (!deal) return;
    
    setPayingRemaining(true);
    try {
      // Update deal to mark remaining as paid
      const { error } = await supabase
        .from("deals")
        .update({ remaining_paid: true, status: "in_progress" } as any)
        .eq("id", deal.id);

      if (error) throw error;

      toast({
        title: "Payment Confirmed",
        description: "Remaining amount has been locked in escrow. OTP can now be shared.",
      });
      
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPayingRemaining(false);
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
        description: "Your OTP has been submitted for admin verification.",
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

  const getDealStatusDisplay = (status: string) => {
    switch (status) {
      case "accepted": return "Accepted - Awaiting Order";
      case "order_placed": return "Order Placed (Locked)";
      case "in_progress": return "In Progress";
      case "completed": return "Completed";
      default: return status;
    }
  };

  const dealStatus = deal?.status || "";
  
  // Check if remaining is paid
  const isRemainingPaid = (deal as any)?.remaining_paid || false;

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
          {/* Deal Status */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10">
            <Lock className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Deal Status:</span>
            <Badge variant="outline">{getDealStatusDisplay(dealStatus)}</Badge>
          </div>

          {/* Merchant Delivery Address */}
          {(deal as any).merchant_delivery_address && (
            <div className="p-3 rounded-lg bg-secondary/50 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Merchant's Delivery Address
              </div>
              <p className="text-sm text-muted-foreground">
                {(deal as any).merchant_delivery_address}
              </p>
            </div>
          )}

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
              <span className="text-muted-foreground">Advance (30%):</span>
              <span className="font-medium text-amber-600">₹{deal.advance_amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining (70%):</span>
              <span className="font-medium">₹{deal.remaining_amount.toLocaleString()}</span>
            </div>
          </div>

          <Separator />

          {/* Customer Flow: Create Order */}
          {!order && userRole === "customer" && (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                Create an order to start the process. Then place the order on the e-commerce site using the merchant's delivery address.
              </p>
              <Button onClick={handleCreateOrder} disabled={loading}>
                {loading ? "Creating..." : "Start Order Process"}
              </Button>
            </div>
          )}

          {/* Merchant View: No order yet */}
          {!order && userRole === "merchant" && (
            <div className="text-center py-4">
              <p className="text-muted-foreground">
                Waiting for customer to place the order...
              </p>
            </div>
          )}

          {order && (
            <>
              {/* Order Status */}
              <div className="flex items-center gap-2">
                {getStatusIcon(order.status || "placed")}
                <span className="font-medium">Order Status:</span>
                <Badge variant="outline">{order.status?.replace("_", " ").toUpperCase()}</Badge>
              </div>

              <Separator />

              {/* Customer: Upload Screenshot & Enter Details */}
              {userRole === "customer" && (
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Order Details</Label>
                  
                  {/* Order Screenshot */}
                  <div className="space-y-2">
                    <Label>Order Screenshot *</Label>
                    {order.order_screenshot_url ? (
                      <div className="space-y-2">
                        <img
                          src={order.order_screenshot_url}
                          alt="Order screenshot"
                          className="w-full rounded-lg border max-h-48 object-cover"
                        />
                        <p className="text-sm text-green-600">✓ Screenshot uploaded</p>
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

                  {/* E-commerce Order ID */}
                  <div className="space-y-2">
                    <Label>E-commerce Order ID *</Label>
                    <Input
                      value={ecommerceOrderId}
                      onChange={(e) => setEcommerceOrderId(e.target.value)}
                      placeholder="Enter order ID from Amazon/Flipkart"
                    />
                  </div>

                  {/* Tracking ID */}
                  <div className="space-y-2">
                    <Label>Tracking ID *</Label>
                    <Input
                      value={trackingId}
                      onChange={(e) => setTrackingId(e.target.value)}
                      placeholder="Enter tracking ID"
                    />
                  </div>

                  {/* Customer Phone */}
                  <div className="space-y-2">
                    <Label>Your Mobile Number (for OTP) *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="10-digit mobile number"
                        className="pl-10"
                        maxLength={10}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The delivery OTP will be sent to this number
                    </p>
                  </div>

                  {/* Lock Order Button */}
                  {order.order_screenshot_url && !order.tracking_id && (
                    <Button 
                      onClick={handleUpdateOrderDetails} 
                      disabled={loading || !ecommerceOrderId || !trackingId || !customerPhone}
                      className="w-full"
                    >
                      {loading ? "Locking..." : "Lock Order (Cannot be cancelled after this)"}
                    </Button>
                  )}

                  {/* OTP Submission (after order is locked and merchant paid remaining) */}
                  {order.tracking_id && (dealStatus === "in_progress" || isRemainingPaid) && (
                    <div className="space-y-2 p-4 rounded-lg border border-primary/30 bg-primary/5">
                      <Label className="text-primary">Submit Delivery OTP</Label>
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
                          {submittingOtp ? "Submitting..." : "Submit"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Waiting for merchant payment */}
                  {order.tracking_id && (dealStatus as string) === "order_placed" && !isRemainingPaid && (
                    <Alert>
                      <Clock className="h-4 w-4" />
                      <AlertDescription>
                        Waiting for merchant to pay remaining amount (₹{deal.remaining_amount.toLocaleString()}) before OTP can be shared.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Merchant View */}
              {userRole === "merchant" && (
                <div className="space-y-4">
                  {/* View Screenshot */}
                  {order.order_screenshot_url && (
                    <div className="space-y-2">
                      <Label>Order Screenshot</Label>
                      <img
                        src={order.order_screenshot_url}
                        alt="Order screenshot"
                        className="w-full rounded-lg border max-h-48 object-cover"
                      />
                    </div>
                  )}

                  {/* View Order Details */}
                  {(order as any).ecommerce_order_id && (
                    <div className="p-3 rounded-lg bg-muted space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Order ID:</span>
                        <span className="font-mono">{(order as any).ecommerce_order_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tracking ID:</span>
                        <span className="font-mono">{order.tracking_id}</span>
                      </div>
                      {(order as any).customer_phone && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Customer Phone:</span>
                          <span className="font-mono">{(order as any).customer_phone}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pay Remaining Button */}
                  {(dealStatus as string) === "order_placed" && !isRemainingPaid && (
                    <div className="p-4 rounded-lg border-2 border-amber-500/30 bg-amber-500/10 space-y-3">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-amber-600" />
                        <span className="font-semibold text-amber-700">Payment Required</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Pay the remaining 70% (₹{deal.remaining_amount.toLocaleString()}) to lock funds in escrow. 
                        OTP will be shared with admin after payment.
                      </p>
                      <Button 
                        onClick={handlePayRemaining}
                        disabled={payingRemaining}
                        className="w-full bg-amber-600 hover:bg-amber-700"
                      >
                        {payingRemaining ? "Processing..." : `Pay ₹${deal.remaining_amount.toLocaleString()} (Remaining)`}
                      </Button>
                    </div>
                  )}

                  {/* Remaining Paid Confirmation */}
                  {isRemainingPaid && (
                    <Alert className="border-green-500/30 bg-green-500/10">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-700">
                        Remaining amount paid and locked in escrow. Waiting for delivery and OTP verification.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}