import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, BarChart3, Building2, Hotel, Save, Plus, Trash2, Wifi, WifiOff, MapPin, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveHotel } from "@/hooks/useActiveHotel";
import { useToast } from "@/hooks/use-toast";
import { checkApiStatus } from "@/pricing-engine";
import type { ApiStatus } from "@/pricing-engine";
import UserMenu from "@/components/UserMenu";

interface CompetitorEntry {
  id?: string;
  competitor_name: string;
  price: string;
  date: string;
}

interface CitySuggestion {
  name: string;
  country: string;
  state: string | null;
  lat: number;
  lon: number;
  label: string;
}

interface DebugInfo {
  weather: { params: string; status: string; count: string } | null;
  events: { params: string; status: string; count: string } | null;
}

export default function Settings() {
  const { currentOrg } = useAuth();
  const { activeHotel, refetch } = useActiveHotel();
  const { toast } = useToast();

  const [orgName, setOrgName] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null);
  const [cityQuery, setCityQuery] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [rooms, setRooms] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [competitors, setCompetitors] = useState<CompetitorEntry[]>([]);
  const [newComp, setNewComp] = useState<CompetitorEntry>({ competitor_name: "", price: "", date: "" });
  const [saving, setSaving] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [checkingApis, setCheckingApis] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({ weather: null, events: null });
  const [debugLoading, setDebugLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (currentOrg) setOrgName(currentOrg.organization_name);
  }, [currentOrg]);

  useEffect(() => {
    if (activeHotel) {
      setHotelName(activeHotel.name);
      setCityQuery(activeHotel.city_name || activeHotel.city);
      setSelectedCity(
        activeHotel.city_name ? {
          name: activeHotel.city_name,
          country: activeHotel.country_code || "",
          state: null,
          lat: activeHotel.latitude || 0,
          lon: activeHotel.longitude || 0,
          label: `${activeHotel.city_name}${activeHotel.country_code ? `, ${activeHotel.country_code}` : ""}`,
        } : null
      );
      setRooms(String(activeHotel.rooms));
      setBasePrice(String(activeHotel.base_price));
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

  // Check API status on mount
  useEffect(() => {
    setCheckingApis(true);
    checkApiStatus().then((status) => {
      setApiStatus(status);
      setCheckingApis(false);
    });
  }, []);

  const fetchCitySuggestions = useCallback(async (query: string) => {
    if (query.length < 2) { setCitySuggestions([]); return; }
    setLoadingCities(true);
    try {
      const { data, error } = await supabase.functions.invoke("geocode", { body: { query } });
      if (!error && data?.suggestions) {
        setCitySuggestions(data.suggestions);
        setShowSuggestions(true);
      }
    } catch { /* ignore */ } finally { setLoadingCities(false); }
  }, []);

  const handleCityInput = (value: string) => {
    setCityQuery(value);
    setSelectedCity(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchCitySuggestions(value), 300);
  };

  const selectCity = (s: CitySuggestion) => {
    setSelectedCity(s);
    setCityQuery(s.label);
    setShowSuggestions(false);
  };

  const canEdit = currentOrg?.role === "owner" || currentOrg?.role === "manager";

  const handleSave = async () => {
    if (!canEdit || !currentOrg || !activeHotel) return;
    setSaving(true);
    try {
      if (currentOrg.role === "owner" && orgName.trim() !== currentOrg.organization_name) {
        const { error } = await supabase.from("organizations").update({ name: orgName.trim() }).eq("id", currentOrg.organization_id);
        if (error) throw error;
      }

      const updatePayload: Record<string, unknown> = {
        name: hotelName.trim(),
        rooms: parseInt(rooms) || activeHotel.rooms,
        base_price: parseFloat(basePrice) || activeHotel.base_price,
      };

      // If a structured city was selected, save all fields properly
      if (selectedCity) {
        updatePayload.city = selectedCity.name;
        updatePayload.city_name = selectedCity.name;
        updatePayload.country_code = selectedCity.country;
        updatePayload.latitude = selectedCity.lat;
        updatePayload.longitude = selectedCity.lon;
      }

      const { error: hotelError } = await supabase.from("hotels").update(updatePayload).eq("id", activeHotel.id);
      if (hotelError) throw hotelError;
      await refetch();
      toast({ title: "Settings saved", description: "Your changes have been applied." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleAddCompetitor = async () => {
    if (!activeHotel || !newComp.competitor_name.trim() || !newComp.price || !newComp.date) return;
    const { data, error } = await supabase.from("competitor_rates").insert({
      hotel_id: activeHotel.id,
      competitor_name: newComp.competitor_name.trim(),
      price: parseFloat(newComp.price),
      date: newComp.date,
    }).select().single();
    if (error) { toast({ title: "Failed to add", description: error.message, variant: "destructive" }); return; }
    setCompetitors((prev) => [...prev, { id: data.id, competitor_name: data.competitor_name, price: String(data.price), date: data.date }]);
    setNewComp({ competitor_name: "", price: "", date: "" });
    toast({ title: "Competitor added" });
  };

  const handleDeleteCompetitor = async (id: string) => {
    const { error } = await supabase.from("competitor_rates").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    setCompetitors((prev) => prev.filter((c) => c.id !== id));
  };

  // Debug: test API calls and show raw results
  const runDebugTest = async () => {
    if (!activeHotel) return;
    setDebugLoading(true);
    const city = activeHotel.city_name || activeHotel.city;
    const newDebug: DebugInfo = { weather: null, events: null };

    try {
      const weatherBody: Record<string, unknown> = { city };
      if (activeHotel.latitude != null && activeHotel.longitude != null) {
        weatherBody.lat = activeHotel.latitude;
        weatherBody.lon = activeHotel.longitude;
      }
      const { data: wData, error: wErr } = await supabase.functions.invoke("weather", { body: weatherBody });
      newDebug.weather = {
        params: JSON.stringify(weatherBody),
        status: wErr ? `Error: ${wErr.message}` : `${wData?.error ? "API Error: " + wData.error : "OK"}`,
        count: wData?.data ? `${wData.data.length} forecast days` : "0",
      };
    } catch (err: any) {
      newDebug.weather = { params: city, status: `Exception: ${err.message}`, count: "0" };
    }

    try {
      const eventsBody: Record<string, unknown> = { city };
      if (activeHotel.country_code) eventsBody.countryCode = activeHotel.country_code;
      if (activeHotel.latitude != null && activeHotel.longitude != null) {
        eventsBody.lat = activeHotel.latitude;
        eventsBody.lon = activeHotel.longitude;
      }
      const { data: eData, error: eErr } = await supabase.functions.invoke("events", { body: eventsBody });
      newDebug.events = {
        params: JSON.stringify(eventsBody),
        status: eErr ? `Error: ${eErr.message}` : `${eData?.error ? "API Error: " + eData.error : "OK"}`,
        count: eData?.data ? `${eData.data.length} events found` : eData?.message || "0 events",
      };
    } catch (err: any) {
      newDebug.events = { params: city, status: `Exception: ${err.message}`, count: "0" };
    }

    setDebugInfo(newDebug);
    setDebugLoading(false);
  };

  const statusIcon = (status: string) => {
    if (status === "connected") return <Wifi className="h-4 w-4 text-success" />;
    if (status === "error") return <WifiOff className="h-4 w-4 text-destructive" />;
    return <WifiOff className="h-4 w-4 text-muted-foreground" />;
  };

  const statusLabel = (status: string) => {
    if (status === "connected") return "Connected";
    if (status === "error") return "Error";
    return "Not configured";
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

        {/* Integrations Status */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Wifi className="h-4 w-4 text-primary" /> Integrations
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => { setShowDebug(!showDebug); if (!showDebug && !debugInfo.weather) runDebugTest(); }}>
              <Bug className="h-3.5 w-3.5" />
              {showDebug ? "Hide Debug" : "Debug"}
            </Button>
          </div>
          {checkingApis ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Checking API connections…
            </div>
          ) : apiStatus ? (
            <div className="grid gap-2">
              {[
                { label: "Weather API (OpenWeather)", status: apiStatus.weather },
                { label: "Events API (Ticketmaster)", status: apiStatus.events },
                { label: "Competitor Rates (Manual)", status: apiStatus.competitor },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm">{item.label}</span>
                  <div className="flex items-center gap-2">
                    {statusIcon(item.status)}
                    <span className={`text-xs font-medium ${
                      item.status === "connected" ? "text-success" :
                      item.status === "error" ? "text-destructive" : "text-muted-foreground"
                    }`}>{statusLabel(item.status)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Debug Panel */}
          {showDebug && (
            <div className="space-y-3 rounded-lg border border-dashed border-warning/50 bg-warning/5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-warning">API Debug Panel</span>
                <Button variant="outline" size="sm" className="h-6 text-xs" onClick={runDebugTest} disabled={debugLoading}>
                  {debugLoading ? "Testing…" : "Re-test APIs"}
                </Button>
              </div>
              {debugInfo.weather && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold">Weather API</span>
                  <div className="text-xs text-muted-foreground font-mono bg-muted/50 rounded p-2 space-y-0.5">
                    <div><span className="text-foreground">Params:</span> {debugInfo.weather.params}</div>
                    <div><span className="text-foreground">Status:</span> {debugInfo.weather.status}</div>
                    <div><span className="text-foreground">Result:</span> {debugInfo.weather.count}</div>
                  </div>
                </div>
              )}
              {debugInfo.events && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold">Events API</span>
                  <div className="text-xs text-muted-foreground font-mono bg-muted/50 rounded p-2 space-y-0.5">
                    <div><span className="text-foreground">Params:</span> {debugInfo.events.params}</div>
                    <div><span className="text-foreground">Status:</span> {debugInfo.events.status}</div>
                    <div><span className="text-foreground">Result:</span> {debugInfo.events.count}</div>
                  </div>
                </div>
              )}
              {!debugInfo.weather && !debugInfo.events && !debugLoading && (
                <p className="text-xs text-muted-foreground">Click "Re-test APIs" to run a diagnostic.</p>
              )}
            </div>
          )}
        </div>

        {/* Organization */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Building2 className="h-4 w-4 text-primary" /> Organization
          </div>
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={currentOrg?.role !== "owner"} />
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
              <div className="space-y-2 relative" ref={suggestionsRef}>
                <Label htmlFor="city">City</Label>
                <div className="relative">
                  <Input
                    id="city"
                    value={cityQuery}
                    onChange={(e) => handleCityInput(e.target.value)}
                    onFocus={() => citySuggestions.length > 0 && setShowSuggestions(true)}
                    disabled={!canEdit}
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
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
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
          {competitors.length > 0 && (
            <div className="space-y-2">
              {competitors.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{c.competitor_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">€{c.price} · {c.date}</span>
                  </div>
                  {canEdit && c.id && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteCompetitor(c.id!)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {canEdit && (
            <div className="grid grid-cols-4 gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input placeholder="Hotel name" value={newComp.competitor_name} onChange={(e) => setNewComp((p) => ({ ...p, competitor_name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rate (€)</Label>
                <Input type="number" placeholder="150" value={newComp.price} onChange={(e) => setNewComp((p) => ({ ...p, price: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={newComp.date} onChange={(e) => setNewComp((p) => ({ ...p, date: e.target.value }))} />
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
