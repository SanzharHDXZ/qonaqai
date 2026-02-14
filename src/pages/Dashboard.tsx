import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3, TrendingUp, Percent, DollarSign, AlertTriangle, Building2,
  SlidersHorizontal, ArrowUpRight, ArrowDownRight, Bell, Calendar, Zap,
  ChevronLeft, Settings, Info, Database, FlaskConical, Target, AlertCircle,
  Plus, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { generateForecasts, generateAlerts, computeKPIs, type DailyForecast, type Alert } from "@/data/mockData";
import { simulateRevenue, runBacktest, computeHistoricalStats, calculateForecastAccuracy, buildForecastRecords, fetchWeatherData, fetchEventData } from "@/pricing-engine";
import type { CompetitorRate, WeatherData, LocalEvent } from "@/pricing-engine";
import ExplainPrice from "@/components/ExplainPrice";
import UserMenu from "@/components/UserMenu";
import HotelSwitcher from "@/components/HotelSwitcher";
import { useActiveHotel } from "@/hooks/useActiveHotel";
import { useHotelHistoricalData } from "@/hooks/useHotelHistoricalData";
import { useAlerts } from "@/hooks/useAlerts";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, safeNum } from "@/lib/formatPrice";

// ─── KPI Card ──────────────────────────────────────────
function KPICard({ title, value, sub, icon: Icon, trend }: {
  title: string; value: string; sub?: string; icon: any; trend?: { value: string; positive: boolean };
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{title}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
          <Icon className="h-4 w-4 text-accent-foreground" />
        </div>
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      {(sub || trend) && (
        <div className="mt-1 flex items-center gap-2 text-xs">
          {trend && (
            <span className={`flex items-center gap-0.5 font-medium ${trend.positive ? "text-success" : "text-destructive"}`}>
              {trend.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {trend.value}
            </span>
          )}
          {sub && <span className="text-muted-foreground">{sub}</span>}
        </div>
      )}
    </div>
  );
}

// ─── Alert Item ────────────────────────────────────────
function AlertItem({ alert }: { alert: Alert }) {
  const iconMap = { surge: TrendingUp, event: Calendar, risk: AlertTriangle };
  const colorMap = { surge: "text-primary", event: "text-warning", risk: "text-destructive" };
  const Icon = iconMap[alert.type];
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-card p-4">
      <div className={`mt-0.5 ${colorMap[alert.type]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{alert.title}</div>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{alert.description}</p>
        <div className="mt-2 flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">{alert.date}</span>
          <span className="font-medium text-primary">{alert.impact}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Confidence Gauge ──────────────────────────────────
function ConfidenceGauge({ value }: { value: number }) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (safeNum(value) / 100) * circumference;
  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="40" fill="none"
          stroke="hsl(var(--primary))" strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-700"
        />
      </svg>
      <div className="relative -mt-[68px] text-center">
        <div className="text-2xl font-bold">{safeNum(value)}%</div>
        <div className="text-[10px] text-muted-foreground">Confidence</div>
      </div>
    </div>
  );
}

// ─── Add Competitor Form ───────────────────────────────
function AddCompetitorForm({ hotelId, onAdded }: { hotelId: string; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) return;
    setSaving(true);
    const { error } = await supabase.from("competitor_rates").insert({
      hotel_id: hotelId,
      competitor_name: name.trim(),
      price: parseFloat(price),
      date,
    });
    if (!error) {
      setName("");
      setPrice("");
      onAdded();
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-dashed border-border p-3 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <Input placeholder="Competitor name" value={name} onChange={(e) => setName(e.target.value)} className="text-xs h-8" required />
        <Input type="number" placeholder="Price (€)" value={price} onChange={(e) => setPrice(e.target.value)} className="text-xs h-8" required />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-xs h-8" />
      </div>
      <Button type="submit" size="sm" className="w-full h-7 text-xs" disabled={saving}>
        {saving ? "Saving…" : "Add Competitor"}
      </Button>
    </form>
  );
}

// ─── Main Dashboard ────────────────────────────────────
export default function Dashboard() {
  const { activeHotel, allHotels, loading: hotelLoading, switchHotel } = useActiveHotel();
  const { historicalData, loading: dataLoading } = useHotelHistoricalData(activeHotel?.id);
  const { unreadCount } = useAlerts(activeHotel?.id);

  // Fetch competitor rates for active hotel
  const [competitorRates, setCompetitorRates] = useState<CompetitorRate[]>([]);
  const [competitorRatesRaw, setCompetitorRatesRaw] = useState<{ competitor_name: string; price: number; date: string }[]>([]);
  // Real API data
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [eventData, setEventData] = useState<LocalEvent[]>([]);
  const [apiWarnings, setApiWarnings] = useState<string[]>([]);
  const [showAddCompetitor, setShowAddCompetitor] = useState(false);

  const fetchCompetitorRates = () => {
    if (!activeHotel?.id) return;
    supabase
      .from("competitor_rates")
      .select("competitor_name, price, date")
      .eq("hotel_id", activeHotel.id)
      .order("date", { ascending: false })
      .then(({ data }) => {
        if (data) {
          setCompetitorRatesRaw(data);
          setCompetitorRates(data.map(d => ({ competitor_name: d.competitor_name, price: d.price })));
        }
      });
  };

  useEffect(() => {
    fetchCompetitorRates();
  }, [activeHotel?.id]);

  // Fetch real weather and event data
  useEffect(() => {
    if (!activeHotel) return;
    const city = activeHotel.city_name || activeHotel.city;
    if (!city) return;
    const warnings: string[] = [];
    const geoOpts = { lat: activeHotel.latitude, lon: activeHotel.longitude };
    const eventOpts = { countryCode: activeHotel.country_code, lat: activeHotel.latitude, lon: activeHotel.longitude };

    Promise.all([
      fetchWeatherData(city, geoOpts).then((result) => {
        setWeatherData(result.data);
        if (!result.available) warnings.push("Weather data unavailable");
      }),
      fetchEventData(city, eventOpts).then((result) => {
        setEventData(result.data);
        if (!result.available) {
          warnings.push("Events API error — external signal impact set to 0");
        } else if (result.data.length === 0) {
          warnings.push("No events found for this city and date range");
        }
      }),
    ]).then(() => setApiWarnings(warnings));
  }, [activeHotel?.id]);

  // Derive hotel profile from active hotel (real DB data)
  const hotel = useMemo(() => {
    if (!activeHotel) return { name: "Loading…", rooms: 85, city: "", avgOccupancy: 0.72, basePrice: 120, currency: "€" };
    return {
      name: activeHotel.name,
      rooms: safeNum(activeHotel.rooms, 85),
      city: activeHotel.city,
      avgOccupancy: safeNum(Number(activeHotel.avg_occupancy), 0.72),
      basePrice: safeNum(Number(activeHotel.base_price), 120),
      currency: activeHotel.currency || "€",
    };
  }, [activeHotel]);

  const historicalStats = useMemo(() => computeHistoricalStats(historicalData), [historicalData]);

  const forecasts = useMemo(() => generateForecasts(
    hotel.rooms,
    hotel.basePrice,
    hotel.avgOccupancy,
    historicalStats.hasData ? {
      dataPointCount: historicalStats.totalRecords,
      occupancyVolatility: historicalStats.occupancyVolatility,
      weekdayAvgOccupancy: historicalStats.weekdayAvgOccupancy,
      rolling7DayTrend: historicalStats.rolling7DayTrend,
      rolling30DaySeasonality: historicalStats.rolling30DaySeasonality,
      weekdayBookingPace: historicalStats.weekdayBookingPace,
    } : undefined,
    hotel.city,
    competitorRates,
    weatherData,
    eventData
  ), [hotel, historicalStats, competitorRates, weatherData, eventData]);

  const kpiData = useMemo(() => computeKPIs(forecasts), [forecasts]);
  const alerts = useMemo(() => generateAlerts(forecasts), [forecasts]);
  const [selectedDay, setSelectedDay] = useState<DailyForecast | null>(null);
  const activeDay = selectedDay || forecasts[0];
  const [manualPrice, setManualPrice] = useState<number | null>(null);

  // Sync manualPrice when activeDay changes (e.g. forecasts load or day selection changes)
  useEffect(() => {
    if (activeDay?.recommendedPrice) {
      setManualPrice(safeNum(activeDay.recommendedPrice, hotel.basePrice));
    }
  }, [activeDay?.recommendedPrice, activeDay?.dayLabel]);

  const effectiveManualPrice = manualPrice ?? safeNum(activeDay?.recommendedPrice, hotel.basePrice);
  const [showExplain, setShowExplain] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);

  // Backtest results
  const backtestResult = useMemo(() => {
    if (!showBacktest || historicalData.length === 0) return null;
    return runBacktest(historicalData, {
      baseOccupancy: hotel.avgOccupancy,
      basePrice: hotel.basePrice,
      totalRooms: hotel.rooms,
    });
  }, [showBacktest, historicalData, hotel]);

  // Forecast accuracy tracking
  const forecastAccuracy = useMemo(() => {
    if (!backtestResult || historicalData.length === 0) return null;
    const predictions = backtestResult.dailyResults.map(d => ({
      date: d.date,
      predictedOccupancy: d.aiProjectedOccupancy,
    }));
    const records = buildForecastRecords(historicalData, predictions);
    return calculateForecastAccuracy(records);
  }, [backtestResult, historicalData]);

  // Revenue simulation
  const simulation = useMemo(() => simulateRevenue({
    totalRooms: hotel.rooms,
    predictedOccupancy: safeNum(activeDay?.predictedOccupancy, 72),
    recommendedPrice: safeNum(activeDay?.recommendedPrice, hotel.basePrice),
    staticPrice: safeNum(activeDay?.staticPrice, hotel.basePrice),
    manualPrice: effectiveManualPrice,
  }), [effectiveManualPrice, activeDay, hotel]);

  const chartData = forecasts.map((f) => ({
    name: f.dayLabel,
    occupancy: safeNum(f.predictedOccupancy),
    aiPrice: safeNum(f.recommendedPrice),
    staticPrice: safeNum(f.staticPrice),
    aiRevenue: safeNum(f.aiRevenue),
    staticRevenue: safeNum(f.staticRevenue),
  }));

  if (hotelLoading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const priceDiff = safeNum(kpiData.avgRecommendedPrice) - safeNum(hotel.basePrice);
  const revLift = safeNum(kpiData.projectedRevenue) - safeNum(kpiData.staticRevenue);

  // Deduplicate competitors for display (latest price per name)
  const uniqueCompetitors = new Map<string, { competitor_name: string; price: number; date: string }>();
  for (const r of competitorRatesRaw) {
    if (!uniqueCompetitors.has(r.competitor_name) || r.date > (uniqueCompetitors.get(r.competitor_name)!.date)) {
      uniqueCompetitors.set(r.competitor_name, r);
    }
  }
  const competitorList = Array.from(uniqueCompetitors.values());

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2 font-semibold">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                <BarChart3 className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              RevPilot
            </div>
            <HotelSwitcher activeHotel={activeHotel} allHotels={allHotels} onSwitch={switchHotel} />
          </div>
          <div className="flex items-center gap-2">
            <Link to="/data-import">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                <Database className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Import Data</span>
              </Button>
            </Link>
            <Link to="/notifications">
              <Button variant="ghost" size="icon" className="h-8 w-8 relative">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </Link>
            <Link to="/settings">
              <Button variant="ghost" size="icon" className="h-8 w-8"><Settings className="h-4 w-4" /></Button>
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6 space-y-6">
        {/* API Data Warnings */}
        {apiWarnings.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-2 text-sm text-warning">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{apiWarnings.join(" · ")} — external signal impact set to 0</span>
          </div>
        )}

        {/* Welcome + Data Status */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Revenue Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {hotel.name} · {hotel.rooms} rooms · {hotel.city}
              {historicalStats.hasData && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs text-success font-medium">
                  <Database className="h-3 w-3" />
                  {historicalStats.totalRecords} days of data
                </span>
              )}
            </p>
          </div>
          {historicalData.length > 0 ? (
            <Button
              variant={showBacktest ? "default" : "outline"}
              size="sm"
              onClick={() => setShowBacktest(!showBacktest)}
              className="gap-2"
            >
              <FlaskConical className="h-4 w-4" />
              {showBacktest ? "Hide Backtest" : "Backtest Mode"}
            </Button>
          ) : (
            <Link to="/data-import">
              <Button variant="outline" size="sm" className="gap-2">
                <Database className="h-4 w-4" />
                Import data to unlock backtesting
              </Button>
            </Link>
          )}
        </div>

        {/* Backtest Results */}
        {showBacktest && backtestResult && (
          <div className="rounded-xl border-2 border-primary/20 bg-accent/20 p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-primary" /> Backtest Results
              </h3>
              <span className="text-xs text-muted-foreground">{backtestResult.totalDays} days analyzed</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <div className="text-xs text-muted-foreground">Actual Revenue</div>
                <div className="text-lg font-bold mt-1">{formatPrice(backtestResult.actualTotalRevenue, hotel.currency)}</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <div className="text-xs text-muted-foreground">AI Projected Revenue</div>
                <div className="text-lg font-bold text-primary mt-1">{formatPrice(backtestResult.aiTotalRevenue, hotel.currency)}</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <div className="text-xs text-muted-foreground">Revenue Difference</div>
                <div className={`text-lg font-bold mt-1 ${safeNum(backtestResult.revenueDifference) >= 0 ? "text-success" : "text-destructive"}`}>
                  {safeNum(backtestResult.revenueDifference) >= 0 ? "+" : ""}{formatPrice(backtestResult.revenueDifference, hotel.currency)}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <div className="text-xs text-muted-foreground">Uplift</div>
                <div className={`text-lg font-bold mt-1 ${safeNum(backtestResult.revenueUpliftPercent) >= 0 ? "text-success" : "text-destructive"}`}>
                  {safeNum(backtestResult.revenueUpliftPercent) >= 0 ? "+" : ""}{safeNum(backtestResult.revenueUpliftPercent)}%
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <div className="text-xs text-muted-foreground">Forecast MAE</div>
                <div className="text-lg font-bold mt-1">{safeNum(backtestResult.meanAbsoluteError)} pts</div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-success/10 p-3 text-center">
                <div className="text-2xl font-bold text-success">{safeNum(backtestResult.winDays)}</div>
                <div className="text-xs text-muted-foreground">Win Days</div>
              </div>
              <div className="rounded-lg bg-destructive/10 p-3 text-center">
                <div className="text-2xl font-bold text-destructive">{safeNum(backtestResult.lossDays)}</div>
                <div className="text-xs text-muted-foreground">Loss Days</div>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <div className="text-2xl font-bold">{safeNum(backtestResult.avgConfidence)}%</div>
                <div className="text-xs text-muted-foreground">Avg Confidence</div>
              </div>
            </div>

            {/* Forecast Accuracy Panel */}
            {forecastAccuracy && forecastAccuracy.totalDays > 0 && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <h4 className="text-xs font-medium flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-primary" /> Forecast Accuracy
                </h4>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Overall Accuracy</div>
                    <div className={`text-lg font-bold mt-1 ${safeNum(forecastAccuracy.accuracy) >= 85 ? "text-success" : safeNum(forecastAccuracy.accuracy) >= 70 ? "text-warning" : "text-destructive"}`}>
                      {safeNum(forecastAccuracy.accuracy)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">MAE</div>
                    <div className="text-lg font-bold mt-1">{safeNum(forecastAccuracy.mae)} pts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">MAPE</div>
                    <div className="text-lg font-bold mt-1">{safeNum(forecastAccuracy.mape)}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">30-Day Accuracy</div>
                    <div className={`text-lg font-bold mt-1 ${safeNum(forecastAccuracy.rolling30.accuracy) >= 85 ? "text-success" : safeNum(forecastAccuracy.rolling30.accuracy) >= 70 ? "text-warning" : "text-destructive"}`}>
                      {safeNum(forecastAccuracy.rolling30.accuracy)}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">{safeNum(forecastAccuracy.rolling30.days)} days</div>
                  </div>
                </div>
              </div>
            )}

            {/* Backtest daily chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={backtestResult.dailyResults.slice(-30)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${hotel.currency}${(safeNum(v) / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="actualRevenue" fill="hsl(var(--muted-foreground))" radius={[2, 2, 0, 0]} name="Actual Revenue" />
                  <Bar dataKey="aiProjectedRevenue" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} name="AI Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* KPIs */}
        {forecasts.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Avg. Predicted Occupancy"
              value={`${safeNum(kpiData.avgOccupancy)}%`}
              icon={Percent}
              trend={{ value: `${priceDiff >= 0 ? "+" : ""}${hotel.currency}${priceDiff}`, positive: priceDiff > 0 }}
              sub="vs static pricing"
            />
            <KPICard
              title="Avg. Recommended Price"
              value={formatPrice(kpiData.avgRecommendedPrice, hotel.currency)}
              icon={DollarSign}
              trend={{ value: `${priceDiff >= 0 ? "+" : ""}${hotel.currency}${priceDiff}`, positive: true }}
              sub={`above base ${formatPrice(hotel.basePrice, hotel.currency)}`}
            />
            <KPICard
              title="AI Confidence Score"
              value={`${safeNum(kpiData.avgConfidence)}%`}
              icon={Zap}
              sub={historicalStats.hasData ? `Based on ${historicalStats.totalRecords} data points` : "30-day average"}
            />
            <KPICard
              title="Projected Revenue Lift"
              value={`+${safeNum(kpiData.revenueLift)}%`}
              icon={TrendingUp}
              trend={{ value: `+${formatPrice(revLift, hotel.currency)}`, positive: true }}
              sub="this month"
            />
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <Database className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No forecast data available. Import historical data to see KPIs.</p>
          </div>
        )}

        {/* Charts */}
        <Tabs defaultValue="occupancy">
          <TabsList>
            <TabsTrigger value="occupancy">Occupancy Forecast</TabsTrigger>
            <TabsTrigger value="pricing">Price Comparison</TabsTrigger>
            <TabsTrigger value="revenue">Revenue Impact</TabsTrigger>
          </TabsList>

          <TabsContent value="occupancy" className="rounded-xl border border-border bg-card p-5 mt-3">
            <h3 className="text-sm font-medium mb-4">Predicted Occupancy – Next 30 Days</h3>
            {chartData.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis domain={[40, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <defs>
                      <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="occupancy" stroke="hsl(var(--primary))" fill="url(#occGrad)" strokeWidth={2} name="Occupancy %" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
            )}
          </TabsContent>

          <TabsContent value="pricing" className="rounded-xl border border-border bg-card p-5 mt-3">
            <h3 className="text-sm font-medium mb-4">AI Price vs Static Price</h3>
            {chartData.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${hotel.currency}${v}`} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="aiPrice" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="AI Price" />
                    <Line type="monotone" dataKey="staticPrice" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Static Price" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
            )}
          </TabsContent>

          <TabsContent value="revenue" className="rounded-xl border border-border bg-card p-5 mt-3">
            <h3 className="text-sm font-medium mb-4">Revenue: AI vs Static Pricing</h3>
            {chartData.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${hotel.currency}${(safeNum(v) / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="staticRevenue" fill="hsl(var(--muted))" radius={[2, 2, 0, 0]} name="Static Revenue" />
                    <Bar dataKey="aiRevenue" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} name="AI Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
            )}
          </TabsContent>
        </Tabs>

        {/* Bottom Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Pricing Table */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-medium">Daily Pricing Recommendations</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-xs text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Occupancy</th>
                    <th className="px-4 py-3 text-right font-medium">AI Price</th>
                    <th className="px-4 py-3 text-right font-medium">Range</th>
                    <th className="px-4 py-3 text-right font-medium">Confidence</th>
                    <th className="px-4 py-3 text-left font-medium">Tier</th>
                    <th className="px-4 py-3 text-left font-medium">Event</th>
                    <th className="px-4 py-3 text-center font-medium">Explain</th>
                  </tr>
                </thead>
                <tbody>
                  {forecasts.slice(0, 10).map((f) => (
                    <tr
                      key={f.date}
                      className={`border-b border-border hover:bg-muted/30 cursor-pointer transition-colors ${activeDay?.date === f.date ? "bg-accent/50" : ""}`}
                      onClick={() => { setSelectedDay(f); setManualPrice(safeNum(f.recommendedPrice, hotel.basePrice)); setShowExplain(false); }}
                    >
                      <td className="px-4 py-3 font-medium">{f.dayLabel}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`${safeNum(f.predictedOccupancy) >= 80 ? "text-success" : safeNum(f.predictedOccupancy) < 60 ? "text-destructive" : ""}`}>
                          {safeNum(f.predictedOccupancy)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{formatPrice(f.recommendedPrice, hotel.currency)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatPrice(f.minPrice, hotel.currency)}–{formatPrice(f.maxPrice, hotel.currency)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          safeNum(f.confidence) >= 85 ? "bg-success/10 text-success" : safeNum(f.confidence) >= 70 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
                        }`}>
                          {safeNum(f.confidence)}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          f.pricingTier === "saturation" ? "bg-primary/20 text-primary" :
                          f.pricingTier === "surge" ? "bg-destructive/10 text-destructive" :
                          f.pricingTier === "premium" ? "bg-warning/10 text-warning" :
                          f.pricingTier === "discount" ? "bg-muted text-muted-foreground" :
                          "bg-accent text-accent-foreground"
                        }`}>
                          {f.isSaturated ? "🔥 " : ""}{f.pricingTier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{f.event || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDay(f);
                            setManualPrice(safeNum(f.recommendedPrice, hotel.basePrice));
                            setShowExplain(true);
                          }}
                        >
                          <Info className="h-3.5 w-3.5 text-primary" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Explain Price Panel */}
            {showExplain && activeDay && (
              <ExplainPrice
                forecast={activeDay}
                basePrice={hotel.basePrice}
                onClose={() => setShowExplain(false)}
              />
            )}

            {/* Confidence Gauge */}
            {!showExplain && activeDay && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-medium mb-4">Price Confidence – {activeDay.dayLabel}</h3>
                <div className="flex justify-center my-4">
                  <ConfidenceGauge value={safeNum(activeDay.confidence)} />
                </div>
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Data completeness</span>
                    <span className="font-medium">{Math.round(safeNum(activeDay.dataCompleteness) * 100)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Event signal</span>
                    <span className="font-medium">{Math.round(safeNum(activeDay.eventSignalStrength) * 100)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Trend consistency</span>
                    <span className="font-medium">{Math.round(safeNum(activeDay.trendConsistency) * 100)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Data volume</span>
                    <span className="font-medium">{Math.round(safeNum(activeDay.dataVolumeScore) * 100)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Volatility score</span>
                    <span className="font-medium">{Math.round(safeNum(activeDay.volatilityScore) * 100)}%</span>
                  </div>
                  <div className="border-t border-border my-2" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Underpricing risk</span>
                    <span className={`font-medium ${safeNum(activeDay.predictedOccupancy) > 75 ? "text-warning" : "text-success"}`}>{safeNum(activeDay.predictedOccupancy) > 75 ? "High" : "Low"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Overpricing risk</span>
                    <span className={`font-medium ${safeNum(activeDay.predictedOccupancy) < 60 ? "text-destructive" : "text-success"}`}>{safeNum(activeDay.predictedOccupancy) < 60 ? "High" : "Low"}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Alerts */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" /> Smart Alerts
              </h3>
              <div className="space-y-3">
                {alerts.length > 0 ? (
                  alerts.map((a) => <AlertItem key={a.id} alert={a} />)
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">No alerts at this time</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Simulator + Competitors */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Revenue Simulator */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-medium mb-1 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" /> Revenue Simulator
            </h3>
            <p className="text-xs text-muted-foreground mb-5">Adjust price for {activeDay?.dayLabel} and see projected impact</p>

            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Manual Price</span>
                  <span className="text-lg font-bold">{formatPrice(effectiveManualPrice, hotel.currency)}</span>
                </div>
                {activeDay && (
                  <>
                    <Slider
                      value={[effectiveManualPrice]}
                      onValueChange={([v]) => setManualPrice(v)}
                      min={safeNum(activeDay.minPrice, 50)}
                      max={safeNum(activeDay.maxPrice, 500)}
                      step={1}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{formatPrice(activeDay.minPrice, hotel.currency)}</span>
                      <span>{formatPrice(activeDay.maxPrice, hotel.currency)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted p-3 text-center">
                  <div className="text-xs text-muted-foreground">Occupancy</div>
                  <div className="text-lg font-bold">{safeNum(simulation.manualOccupancy)}%</div>
                </div>
                <div className="rounded-lg bg-muted p-3 text-center">
                  <div className="text-xs text-muted-foreground">Revenue</div>
                  <div className="text-lg font-bold">{formatPrice(simulation.manualRevenue, hotel.currency)}</div>
                </div>
                <div className="rounded-lg bg-muted p-3 text-center">
                  <div className="text-xs text-muted-foreground">vs AI</div>
                  <div className={`text-lg font-bold ${safeNum(simulation.revenueVsAI) >= 0 ? "text-success" : "text-destructive"}`}>
                    {safeNum(simulation.revenueVsAI) >= 0 ? "+" : ""}{formatPrice(simulation.revenueVsAI, hotel.currency)}
                  </div>
                </div>
              </div>
              {(safeNum(simulation.underpricingLoss) > 0 || safeNum(simulation.overpricingLoss) > 0) && (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  {safeNum(simulation.underpricingLoss) > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-warning">Underpricing loss</span>
                      <span className="font-medium text-warning">-{formatPrice(simulation.underpricingLoss, hotel.currency)}</span>
                    </div>
                  )}
                  {safeNum(simulation.overpricingLoss) > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-destructive">Overpricing loss</span>
                      <span className="font-medium text-destructive">-{formatPrice(simulation.overpricingLoss, hotel.currency)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Competitor Comparison */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Competitor Comparison
              </h3>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setShowAddCompetitor(!showAddCompetitor)}
              >
                {showAddCompetitor ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                {showAddCompetitor ? "Cancel" : "Add Competitor"}
              </Button>
            </div>

            {showAddCompetitor && activeHotel && (
              <div className="mb-4">
                <AddCompetitorForm hotelId={activeHotel.id} onAdded={() => { fetchCompetitorRates(); setShowAddCompetitor(false); }} />
              </div>
            )}

            <div className="space-y-4">
              {competitorList.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No competitors added yet. Click "Add Competitor" to start tracking.</p>
              )}
              {competitorList.map((c) => (
                <div key={`${c.competitor_name}-${c.date}`} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <div className="text-sm font-medium">{c.competitor_name}</div>
                    <div className="text-xs text-muted-foreground">as of {c.date}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{formatPrice(c.price, hotel.currency)}</div>
                    <div className="text-xs text-muted-foreground">avg/night</div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-lg border-2 border-primary/30 bg-accent/50 p-4">
                <div>
                  <div className="text-sm font-medium text-primary">{hotel.name} (You)</div>
                  <div className="text-xs text-muted-foreground">AI Recommended</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">{formatPrice(kpiData.avgRecommendedPrice, hotel.currency)}</div>
                  <div className="text-xs text-muted-foreground">avg/night</div>
                </div>
              </div>
              {competitorList.length > 0 && (
                <div className="rounded-lg bg-muted p-3 text-center">
                  <span className="text-xs text-muted-foreground">Market Average: </span>
                  <span className="text-sm font-semibold">{formatPrice(Math.round(competitorList.reduce((s, c) => s + safeNum(c.price), 0) / competitorList.length), hotel.currency)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}