import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Building2, ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface CitySuggestion {
  name: string;
  country: string;
  state: string | null;
  lat: number;
  lon: number;
  label: string;
}

export default function Onboarding() {
  const [orgName, setOrgName] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null);
  const [cityQuery, setCityQuery] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [rooms, setRooms] = useState("85");
  const [basePrice, setBasePrice] = useState("120");
  const [submitting, setSubmitting] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const { refreshMemberships } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchCitySuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setCitySuggestions([]);
      return;
    }
    setLoadingCities(true);
    try {
      const { data, error } = await supabase.functions.invoke("geocode", {
        body: { query },
      });
      if (!error && data?.suggestions) {
        setCitySuggestions(data.suggestions);
        setShowSuggestions(true);
      }
    } catch (err) {
      console.warn("City autocomplete failed:", err);
    } finally {
      setLoadingCities(false);
    }
  }, []);

  const handleCityInput = (value: string) => {
    setCityQuery(value);
    setSelectedCity(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchCitySuggestions(value), 300);
  };

  const selectCity = (suggestion: CitySuggestion) => {
    setSelectedCity(suggestion);
    setCityQuery(suggestion.label);
    setShowSuggestions(false);
    setCitySuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !hotelName.trim() || !selectedCity) return;

    setSubmitting(true);
    try {
      const { data: orgId, error: orgError } = await supabase.rpc("create_org_and_owner", {
        _org_name: orgName.trim(),
      });
      if (orgError) throw orgError;

      // MVP guard: check if org already has a hotel
      const { data: existingHotels } = await supabase
        .from("hotels")
        .select("id")
        .eq("organization_id", orgId);

      if (existingHotels && existingHotels.length > 0) {
        // Hotel already exists, just set it active and go
        await supabase.rpc("set_active_hotel", { _hotel_id: existingHotels[0].id });
        await refreshMemberships();
        toast({ title: "Welcome back!", description: "Your hotel is already set up." });
        navigate("/dashboard");
        return;
      }

      const { data: hotelId, error: hotelError } = await supabase.rpc("create_hotel_for_org", {
        _org_id: orgId,
        _name: hotelName.trim(),
        _city: selectedCity.name,
        _rooms: parseInt(rooms) || 85,
        _base_price: parseFloat(basePrice) || 120,
      });
      if (hotelError) throw hotelError;

      // Update hotel with structured city data
      await supabase
        .from("hotels")
        .update({
          city_name: selectedCity.name,
          country_code: selectedCity.country,
          latitude: selectedCity.lat,
          longitude: selectedCity.lon,
        })
        .eq("id", hotelId);

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
            <div className="space-y-2 relative" ref={suggestionsRef}>
              <Label htmlFor="city">City</Label>
              <div className="relative">
                <Input
                  id="city"
                  value={cityQuery}
                  onChange={(e) => handleCityInput(e.target.value)}
                  onFocus={() => citySuggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="Search city…"
                  required
                  autoComplete="off"
                />
                {loadingCities && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                )}
              </div>
              {showSuggestions && citySuggestions.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border bg-card shadow-lg overflow-hidden">
                  {citySuggestions.map((s, i) => (
                    <button
                      key={`${s.name}-${s.country}-${i}`}
                      type="button"
                      onClick={() => selectCity(s)}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors"
                      title={s.label}
                    >
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{s.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
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

          <Button type="submit" className="w-full" disabled={submitting || !selectedCity}>
            {submitting ? "Setting up…" : "Launch RevPilot"} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
