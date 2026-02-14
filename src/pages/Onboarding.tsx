import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function Onboarding() {
  const [orgName, setOrgName] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [city, setCity] = useState("Barcelona");
  const [rooms, setRooms] = useState("85");
  const [basePrice, setBasePrice] = useState("120");
  const [submitting, setSubmitting] = useState(false);
  const { refreshMemberships } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !hotelName.trim()) return;

    setSubmitting(true);
    try {
      // Step 1: Create org + owner membership via security definer
      const { data: orgId, error: orgError } = await supabase.rpc("create_org_and_owner", {
        _org_name: orgName.trim(),
      });
      if (orgError) throw orgError;

      // Step 2: Create hotel via security definer
      const { error: hotelError } = await supabase.rpc("create_hotel_for_org", {
        _org_id: orgId,
        _name: hotelName.trim(),
        _city: city.trim(),
        _rooms: parseInt(rooms) || 85,
        _base_price: parseFloat(basePrice) || 120,
      });
      if (hotelError) throw hotelError;

      // Refresh membership data in context
      await refreshMemberships();

      toast({ title: "Welcome to RevPilot!", description: `${orgName} and ${hotelName} created.` });
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Setup failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 font-semibold text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <BarChart3 className="h-4 w-4 text-primary-foreground" />
            </div>
            RevPilot
          </div>
          <h1 className="mt-4 text-2xl font-bold">Set up your hotel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create your organization and first hotel to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4 text-primary" /> Organization
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Hotels" required />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4 text-primary" /> First Hotel
            </div>
            <div className="space-y-2">
              <Label htmlFor="hotelName">Hotel Name</Label>
              <Input id="hotelName" value={hotelName} onChange={(e) => setHotelName(e.target.value)} placeholder="Grand Hotel Barcelona" required />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rooms">Rooms</Label>
                <Input id="rooms" type="number" value={rooms} onChange={(e) => setRooms(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Base Price (€)</Label>
                <Input id="price" type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Setting up…" : "Launch RevPilot"} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
