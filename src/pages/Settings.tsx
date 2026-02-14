import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, BarChart3, Building2, Hotel, Save, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveHotel } from "@/hooks/useActiveHotel";
import { useToast } from "@/hooks/use-toast";
import UserMenu from "@/components/UserMenu";

interface CompetitorEntry {
  id?: string;
  competitor_name: string;
  price: string;
  date: string;
}

export default function Settings() {
  const { currentOrg } = useAuth();
  const { activeHotel, refetch } = useActiveHotel();
  const { toast } = useToast();

  // Org fields
  const [orgName, setOrgName] = useState("");
  // Hotel fields
  const [hotelName, setHotelName] = useState("");
  const [city, setCity] = useState("");
  const [rooms, setRooms] = useState("");
  const [basePrice, setBasePrice] = useState("");
  // Competitor rates
  const [competitors, setCompetitors] = useState<CompetitorEntry[]>([]);
  const [newComp, setNewComp] = useState<CompetitorEntry>({ competitor_name: "", price: "", date: "" });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentOrg) setOrgName(currentOrg.organization_name);
  }, [currentOrg]);

  useEffect(() => {
    if (activeHotel) {
      setHotelName(activeHotel.name);
      setCity(activeHotel.city);
      setRooms(String(activeHotel.rooms));
      setBasePrice(String(activeHotel.base_price));
      // Fetch competitors
      supabase
        .from("competitor_rates")
        .select("*")
        .eq("hotel_id", activeHotel.id)
        .order("date", { ascending: true })
        .then(({ data }) => {
          if (data) {
            setCompetitors(
              data.map((d) => ({
                id: d.id,
                competitor_name: d.competitor_name,
                price: String(d.price),
                date: d.date,
              }))
            );
          }
        });
    }
  }, [activeHotel]);

  const canEdit = currentOrg?.role === "owner" || currentOrg?.role === "manager";

  const handleSave = async () => {
    if (!canEdit || !currentOrg || !activeHotel) return;
    setSaving(true);

    try {
      if (currentOrg.role === "owner" && orgName.trim() !== currentOrg.organization_name) {
        const { error } = await supabase
          .from("organizations")
          .update({ name: orgName.trim() })
          .eq("id", currentOrg.organization_id);
        if (error) throw error;
      }

      const { error: hotelError } = await supabase
        .from("hotels")
        .update({
          name: hotelName.trim(),
          city: city.trim(),
          rooms: parseInt(rooms) || activeHotel.rooms,
          base_price: parseFloat(basePrice) || activeHotel.base_price,
        })
        .eq("id", activeHotel.id);
      if (hotelError) throw hotelError;

      await refetch();
      toast({ title: "Settings saved", description: "Your changes have been applied." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddCompetitor = async () => {
    if (!activeHotel || !newComp.competitor_name.trim() || !newComp.price || !newComp.date) return;
    const { data, error } = await supabase
      .from("competitor_rates")
      .insert({
        hotel_id: activeHotel.id,
        competitor_name: newComp.competitor_name.trim(),
        price: parseFloat(newComp.price),
        date: newComp.date,
      })
      .select()
      .single();
    if (error) {
      toast({ title: "Failed to add", description: error.message, variant: "destructive" });
      return;
    }
    setCompetitors((prev) => [
      ...prev,
      { id: data.id, competitor_name: data.competitor_name, price: String(data.price), date: data.date },
    ]);
    setNewComp({ competitor_name: "", price: "", date: "" });
    toast({ title: "Competitor added" });
  };

  const handleDeleteCompetitor = async (id: string) => {
    const { error } = await supabase.from("competitor_rates").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setCompetitors((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2 font-semibold">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                <BarChart3 className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              RevPilot
            </div>
            <span className="hidden sm:inline text-sm text-muted-foreground">/ Settings</span>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>

        {/* Organization */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Building2 className="h-4 w-4 text-primary" /> Organization
          </div>
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              disabled={currentOrg?.role !== "owner"}
            />
            {currentOrg?.role !== "owner" && (
              <p className="text-xs text-muted-foreground">Only the owner can edit the organization name.</p>
            )}
          </div>
        </div>

        {/* Hotel Details */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Hotel className="h-4 w-4 text-primary" /> Hotel Details
          </div>
          {activeHotel ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="hotelName">Hotel Name</Label>
                <Input id="hotelName" value={hotelName} onChange={(e) => setHotelName(e.target.value)} disabled={!canEdit} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} disabled={!canEdit} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rooms">Rooms</Label>
                  <Input id="rooms" type="number" value={rooms} onChange={(e) => setRooms(e.target.value)} disabled={!canEdit} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="basePrice">Base Price (€)</Label>
                  <Input id="basePrice" type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} disabled={!canEdit} />
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No hotel selected.</p>
          )}
        </div>

        {/* Competitor Rates */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Building2 className="h-4 w-4 text-primary" /> Competitor Rates
          </div>
          <p className="text-xs text-muted-foreground">
            Add competitor pricing to improve demand forecasting. These feed into the External Market Signals layer.
          </p>

          {/* Existing competitors */}
          {competitors.length > 0 && (
            <div className="space-y-2">
              {competitors.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{c.competitor_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">€{c.price} · {c.date}</span>
                  </div>
                  {canEdit && c.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDeleteCompetitor(c.id!)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add new */}
          {canEdit && (
            <div className="grid grid-cols-4 gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  placeholder="Hotel name"
                  value={newComp.competitor_name}
                  onChange={(e) => setNewComp((p) => ({ ...p, competitor_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rate (€)</Label>
                <Input
                  type="number"
                  placeholder="150"
                  value={newComp.price}
                  onChange={(e) => setNewComp((p) => ({ ...p, price: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={newComp.date}
                  onChange={(e) => setNewComp((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
              <Button onClick={handleAddCompetitor} size="sm" className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
          )}
        </div>

        {canEdit && (
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        )}
      </main>
    </div>
  );
}
