import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Building2, ArrowRight, MapPin, CheckCircle, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveHotel } from "@/hooks/useActiveHotel";
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
  const { user, memberships, currentOrg, refreshMemberships } = useAuth();
  const { allHotels, loading: hotelsLoading, refetch: refetchHotels } = useActiveHotel();
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
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Check if user already has a hotel and redirect
  useEffect(() => {
    if (!hotelsLoading && allHotels.length > 0 && currentOrg) {
      // User already has a hotel — set it active and redirect
      const hotel = allHotels[0];
      supabase.rpc("set_active_hotel", { _hotel_id: hotel.id }).then(() => {
        navigate("/dashboard", { replace: true });
      });
    }
  }, [hotelsLoading, allHotels, currentOrg, navigate]);

  // Debug panel data fetch
  const fetchDebugInfo = useCallback(async () => {
    if (!user) return;
    const uid = user.id;

    const { data: settings } = await supabase
      .from("user_settings")
      .select("active_organization_id, active_hotel_id")
      .eq("user_id", uid)
      .maybeSingle();

    const orgId = currentOrg?.organization_id || settings?.active_organization_id;

    let hotelCount = 0;
    if (orgId) {
      const { data: hotels } = await supabase
        .from("hotels")
        .select("id")
        .eq("organization_id", orgId);
      hotelCount = hotels?.length || 0;
    }

    setDebugInfo({
      uid,
      activeOrgId: settings?.active_organization_id || "null",
      activeHotelId: settings?.active_hotel_id || "null",
      currentOrgFromContext: currentOrg?.organization_id || "null",
      membershipCount: memberships.length,
      hotelCountForOrg: hotelCount,
      allHotelsFromHook: allHotels.length,
      conditionNoMemberships: memberships.length === 0,
      conditionNoHotels: allHotels.length === 0,
      conditionNoCurrentOrg: !currentOrg,
    });
  }, [user, currentOrg, memberships, allHotels]);

  useEffect(() => {
    if (showDebug) fetchDebugInfo();
  }, [showDebug, fetchDebugInfo]);

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

  // "Use existing hotel" one-click action
  const handleUseExistingHotel = async () => {
    if (allHotels.length === 0) return;
    setSubmitting(true);
    try {
      await supabase.rpc("set_active_hotel", { _hotel_id: allHotels[0].id });
      await refreshMemberships();
      toast({ title: "Welcome back!", description: "Your existing hotel is now active." });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
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

      // Check if org already has a hotel
      const { data: existingHotels } = await supabase
        .from("hotels")
        .select("id")
        .eq("organization_id", orgId);

      if (existingHotels && existingHotels.length > 0) {
        await supabase.rpc("set_active_hotel", { _hotel_id: existingHotels[0].id });
        await refreshMemberships();
        toast({ title: "Welcome back!", description: "Your hotel is already set up." });
        navigate("/dashboard", { replace: true });
        return;
      }

      const { data: hotelId, error: hotelError } = await supabase.rpc("create_hotel_for_org", {
        _org_id: orgId,
        _name: hotelName.trim(),
        _city: selectedCity.name,
        _rooms: parseInt(rooms) || 85,
        _base_price: parseFloat(basePrice) || 120,
      });
      if (hotelError) {
        if (hotelError.message?.includes("unique") || hotelError.message?.includes("duplicate")) {
          toast({ title: "This organization already has a hotel.", description: "Redirecting to dashboard.", variant: "destructive" });
          await refreshMemberships();
          navigate("/dashboard", { replace: true });
          return;
        }
        throw hotelError;
      }

      await supabase
        .from("hotels")
        .update({
          city_name: selectedCity.name,
          country_code: selectedCity.country,
          latitude: selectedCity.lat,
          longitude: selectedCity.lon,
        })
        .eq("id", hotelId);

      await supabase.rpc("set_active_hotel", { _hotel_id: hotelId });
      await refreshMemberships();

      toast({ title: "Welcome to RevPilot!", description: `${orgName} and ${hotelName} created.` });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      toast({ title: "Setup failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // If user already has hotels, show shortcut
  const hasExistingHotel = !hotelsLoading && allHotels.length > 0;

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

        {/* "Use existing hotel" shortcut */}
        {hasExistingHotel && (
          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <CheckCircle className="h-4 w-4" />
              You already have a hotel: {allHotels[0].name}
            </div>
            <Button onClick={handleUseExistingHotel} className="w-full" disabled={submitting}>
              {submitting ? "Redirecting…" : "Use existing hotel → Dashboard"}
            </Button>
          </div>
        )}

        {/* Debug Panel */}
        <div>
          <Button variant="ghost" size="sm" onClick={() => setShowDebug(!showDebug)} className="gap-1.5 text-xs text-muted-foreground">
            <Bug className="h-3 w-3" /> {showDebug ? "Hide" : "Show"} Debug Panel
          </Button>
          {showDebug && debugInfo && (
            <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3 text-xs font-mono space-y-1">
              <div>auth.uid(): <span className="text-primary">{debugInfo.uid}</span></div>
              <div>active_organization_id: <span className="text-primary">{debugInfo.activeOrgId}</span></div>
              <div>currentOrg (context): <span className="text-primary">{debugInfo.currentOrgFromContext}</span></div>
              <div>active_hotel_id: <span className="text-primary">{debugInfo.activeHotelId}</span></div>
              <div>memberships count: <span className="text-primary">{debugInfo.membershipCount}</span></div>
              <div>hotels for org (DB): <span className="text-primary">{debugInfo.hotelCountForOrg}</span></div>
              <div>allHotels (hook): <span className="text-primary">{debugInfo.allHotelsFromHook}</span></div>
              <hr className="border-border" />
              <div className="font-bold">Onboarding triggers:</div>
              <div>memberships === 0: <span className={debugInfo.conditionNoMemberships ? "text-destructive" : "text-success"}>{String(debugInfo.conditionNoMemberships)}</span></div>
              <div>allHotels === 0: <span className={debugInfo.conditionNoHotels ? "text-destructive" : "text-success"}>{String(debugInfo.conditionNoHotels)}</span></div>
              <div>currentOrg === null: <span className={debugInfo.conditionNoCurrentOrg ? "text-destructive" : "text-success"}>{String(debugInfo.conditionNoCurrentOrg)}</span></div>
            </div>
          )}
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
              {selectedCity && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedCity.name}, {selectedCity.country} — lat: {selectedCity.lat.toFixed(4)}, lon: {selectedCity.lon.toFixed(4)}
                </p>
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
