import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Package, ExternalLink, Phone, Upload, Eye } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { OrderManagementDialog } from "@/components/deals/OrderManagementDialog";

type Deal = Tables<"deals">;

export default function MyDeals() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchDeals();
    }
  }, [user]);

  const fetchDeals = async () => {
    try {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .or(`merchant_id.eq.${user?.id},customer_id.eq.${user?.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDeals(data || []);
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      approved: "default",
      rejected: "destructive",
      accepted: "default",
      in_progress: "default",
      completed: "default",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const merchantDeals = deals.filter((d) => d.merchant_id === user?.id);
  const customerDeals = deals.filter((d) => d.customer_id === user?.id);

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const DealCard = ({ deal, role }: { deal: Deal; role: "merchant" | "customer" }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{deal.product_name}</CardTitle>
          </div>
          {getStatusBadge(deal.status || "pending")}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Card Offer:</span>
            <span className="ml-1 font-medium">₹{deal.card_offer_price}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Commission:</span>
            <span className="ml-1 font-medium text-green-600">₹{deal.commission_amount}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Card Required:</span>
            <span className="ml-1">{deal.required_card}</span>
          </div>
          {deal.admin_contact_number && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              <span>{deal.admin_contact_number}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" asChild>
            <a href={deal.product_link} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              View Product
            </a>
          </Button>
          
          {(deal.status === "accepted" || deal.status === "in_progress") && (
            <Button
              size="sm"
              onClick={() => {
                setSelectedDeal(deal);
                setDialogOpen(true);
              }}
            >
              {role === "merchant" ? (
                <>
                  <Upload className="h-4 w-4 mr-1" />
                  Manage Order
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1" />
                  View Order
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Deals</h1>
          <p className="text-muted-foreground">Manage your created and accepted deals</p>
        </div>

        <Tabs defaultValue="created" className="w-full">
          <TabsList>
            <TabsTrigger value="created">Created by Me ({merchantDeals.length})</TabsTrigger>
            <TabsTrigger value="accepted">Accepted by Me ({customerDeals.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="created" className="mt-4">
            {merchantDeals.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  You haven't created any deals yet.
                  <Button className="ml-2" onClick={() => navigate("/create-deal")}>
                    Create Deal
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {merchantDeals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} role="merchant" />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="accepted" className="mt-4">
            {customerDeals.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  You haven't accepted any deals yet.
                  <Button className="ml-2" onClick={() => navigate("/browse-deals")}>
                    Browse Deals
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {customerDeals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} role="customer" />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <OrderManagementDialog
        deal={selectedDeal}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUpdate={fetchDeals}
        userRole={selectedDeal?.merchant_id === user?.id ? "merchant" : "customer"}
      />
    </DashboardLayout>
  );
}
