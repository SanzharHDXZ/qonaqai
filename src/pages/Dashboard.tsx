import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3, TrendingUp, Percent, DollarSign, AlertTriangle, Building2,
  SlidersHorizontal, ArrowUpRight, ArrowDownRight, Bell, Calendar, Zap,
  ChevronLeft, Settings, LogOut, Info, Database, FlaskConical, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { generateForecasts, generateAlerts, computeKPIs, competitors, hotelProfile, type DailyForecast, type Alert } from "@/data/mockData";
import { simulateRevenue, runBacktest, getStoredHistoricalData, computeHistoricalStats, calculateForecastAccuracy, buildForecastRecords } from "@/pricing-engine";
import ExplainPrice from "@/components/ExplainPrice";

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
  const offset = circumference - (value / 100) * circumference;
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
        <div className="text-2xl font-bold">{value}%</div>
        <div className="text-[10px] text-muted-foreground">Confidence</div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────
export default function Dashboard() {
  const historicalData = useMemo(() => getStoredHistoricalData(), []);
  const historicalStats = useMemo(() => computeHistoricalStats(historicalData), [historicalData]);

  const forecasts = useMemo(() => generateForecasts(
    hotelProfile.rooms,
    hotelProfile.basePrice,
    hotelProfile.avgOccupancy,
    historicalStats.hasData ? {
      dataPointCount: historicalStats.totalRecords,
      occupancyVolatility: historicalStats.occupancyVolatility,
      weekdayAvgOccupancy: historicalStats.weekdayAvgOccupancy,
      rolling7DayTrend: historicalStats.rolling7DayTrend,
      rolling30DaySeasonality: historicalStats.rolling30DaySeasonality,
      weekdayBookingPace: historicalStats.weekdayBookingPace,
    } : undefined
  ), [historicalStats]);

  const kpiData = useMemo(() => computeKPIs(forecasts), [forecasts]);
  const alerts = useMemo(() => generateAlerts(forecasts), [forecasts]);
  const [selectedDay, setSelectedDay] = useState<DailyForecast>(forecasts[0]);
  const [manualPrice, setManualPrice] = useState(selectedDay.recommendedPrice);
  const [showExplain, setShowExplain] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);

  // Backtest results
  const backtestResult = useMemo(() => {
    if (!showBacktest || historicalData.length === 0) return null;
    return runBacktest(historicalData, {
      baseOccupancy: hotelProfile.avgOccupancy,
      basePrice: hotelProfile.basePrice,
      totalRooms: hotelProfile.rooms,
    });
  }, [showBacktest, historicalData]);

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
    totalRooms: hotelProfile.rooms,
    predictedOccupancy: selectedDay.predictedOccupancy,
    recommendedPrice: selectedDay.recommendedPrice,
    staticPrice: selectedDay.staticPrice,
    manualPrice,
  }), [manualPrice, selectedDay]);

  const chartData = forecasts.map((f) => ({
    name: f.dayLabel,
    occupancy: f.predictedOccupancy,
    aiPrice: f.recommendedPrice,
    staticPrice: f.staticPrice,
    aiRevenue: f.aiRevenue,
    staticRevenue: f.staticRevenue,
  }));

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
            <span className="hidden sm:inline text-sm text-muted-foreground">/ {hotelProfile.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/data-import">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                <Database className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Import Data</span>
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="h-8 w-8"><Bell className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><Settings className="h-4 w-4" /></Button>
            <Link to="/"><Button variant="ghost" size="icon" className="h-8 w-8"><LogOut className="h-4 w-4" /></Button></Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6 space-y-6">
        {/* Welcome + Data Status */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Revenue Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {hotelProfile.name} · {hotelProfile.rooms} rooms · {hotelProfile.city}
              {historicalStats.hasData && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs text-success font-medium">
                  <Database className="h-3 w-3" />
                  {historicalStats.totalRecords} days of data
                </span>
              )}
            </p>
          </div>
          {historicalData.length > 0 && (
            <Button
              variant={showBacktest ? "default" : "outline"}
              size="sm"
              onClick={() => setShowBacktest(!showBacktest)}
              className="gap-2"
            >
              <FlaskConical className="h-4 w-4" />
              {showBacktest ? "Hide Backtest" : "Backtest Mode"}
            </Button>
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
                <div className="text-lg font-bold mt-1">€{backtestResult.actualTotalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <div className="text-xs text-muted-foreground">AI Projected Revenue</div>
                <div className="text-lg font-bold text-primary mt-1">€{backtestResult.aiTotalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <div className="text-xs text-muted-foreground">Revenue Difference</div>
                <div className={`text-lg font-bold mt-1 ${backtestResult.revenueDifference >= 0 ? "text-success" : "text-destructive"}`}>
                  {backtestResult.revenueDifference >= 0 ? "+" : ""}€{backtestResult.revenueDifference.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <div className="text-xs text-muted-foreground">Uplift</div>
                <div className={`text-lg font-bold mt-1 ${backtestResult.revenueUpliftPercent >= 0 ? "text-success" : "text-destructive"}`}>
                  {backtestResult.revenueUpliftPercent >= 0 ? "+" : ""}{backtestResult.revenueUpliftPercent}%
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <div className="text-xs text-muted-foreground">Forecast MAE</div>
                <div className="text-lg font-bold mt-1">{backtestResult.meanAbsoluteError} pts</div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-success/10 p-3 text-center">
                <div className="text-2xl font-bold text-success">{backtestResult.winDays}</div>
                <div className="text-xs text-muted-foreground">Win Days</div>
              </div>
              <div className="rounded-lg bg-destructive/10 p-3 text-center">
                <div className="text-2xl font-bold text-destructive">{backtestResult.lossDays}</div>
                <div className="text-xs text-muted-foreground">Loss Days</div>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <div className="text-2xl font-bold">{backtestResult.avgConfidence}%</div>
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
                    <div className={`text-lg font-bold mt-1 ${forecastAccuracy.accuracy >= 85 ? "text-success" : forecastAccuracy.accuracy >= 70 ? "text-warning" : "text-destructive"}`}>
                      {forecastAccuracy.accuracy}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">MAE</div>
                    <div className="text-lg font-bold mt-1">{forecastAccuracy.mae} pts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">MAPE</div>
                    <div className="text-lg font-bold mt-1">{forecastAccuracy.mape}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">30-Day Accuracy</div>
                    <div className={`text-lg font-bold mt-1 ${forecastAccuracy.rolling30.accuracy >= 85 ? "text-success" : forecastAccuracy.rolling30.accuracy >= 70 ? "text-warning" : "text-destructive"}`}>
                      {forecastAccuracy.rolling30.accuracy}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">{forecastAccuracy.rolling30.days} days</div>
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
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="actualRevenue" fill="hsl(var(--muted-foreground))" radius={[2, 2, 0, 0]} name="Actual Revenue" />
                  <Bar dataKey="aiProjectedRevenue" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} name="AI Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Avg. Predicted Occupancy"
            value={`${kpiData.avgOccupancy}%`}
            icon={Percent}
            trend={{ value: `+€${kpiData.avgRecommendedPrice - hotelProfile.basePrice}`, positive: kpiData.avgRecommendedPrice > hotelProfile.basePrice }}
            sub="vs static pricing"
          />
          <KPICard
            title="Avg. Recommended Price"
            value={`€${kpiData.avgRecommendedPrice}`}
            icon={DollarSign}
            trend={{ value: `+€${kpiData.avgRecommendedPrice - hotelProfile.basePrice}`, positive: true }}
            sub={`above base €${hotelProfile.basePrice}`}
          />
          <KPICard
            title="AI Confidence Score"
            value={`${kpiData.avgConfidence}%`}
            icon={Zap}
            sub={historicalStats.hasData ? `Based on ${historicalStats.totalRecords} data points` : "30-day average"}
          />
          <KPICard
            title="Projected Revenue Lift"
            value={`+${kpiData.revenueLift}%`}
            icon={TrendingUp}
            trend={{ value: `+€${(kpiData.projectedRevenue - kpiData.staticRevenue).toLocaleString()}`, positive: true }}
            sub="this month"
          />
        </div>

        {/* Charts */}
        <Tabs defaultValue="occupancy">
          <TabsList>
            <TabsTrigger value="occupancy">Occupancy Forecast</TabsTrigger>
            <TabsTrigger value="pricing">Price Comparison</TabsTrigger>
            <TabsTrigger value="revenue">Revenue Impact</TabsTrigger>
          </TabsList>

          <TabsContent value="occupancy" className="rounded-xl border border-border bg-card p-5 mt-3">
            <h3 className="text-sm font-medium mb-4">Predicted Occupancy – Next 30 Days</h3>
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
          </TabsContent>

          <TabsContent value="pricing" className="rounded-xl border border-border bg-card p-5 mt-3">
            <h3 className="text-sm font-medium mb-4">AI Price vs Static Price</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `€${v}`} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="aiPrice" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="AI Price" />
                  <Line type="monotone" dataKey="staticPrice" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Static Price" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="revenue" className="rounded-xl border border-border bg-card p-5 mt-3">
            <h3 className="text-sm font-medium mb-4">Revenue: AI vs Static Pricing</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="staticRevenue" fill="hsl(var(--muted))" radius={[2, 2, 0, 0]} name="Static Revenue" />
                  <Bar dataKey="aiRevenue" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} name="AI Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
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
                      className={`border-b border-border hover:bg-muted/30 cursor-pointer transition-colors ${selectedDay.date === f.date ? "bg-accent/50" : ""}`}
                      onClick={() => { setSelectedDay(f); setManualPrice(f.recommendedPrice); setShowExplain(false); }}
                    >
                      <td className="px-4 py-3 font-medium">{f.dayLabel}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`${f.predictedOccupancy >= 80 ? "text-success" : f.predictedOccupancy < 60 ? "text-destructive" : ""}`}>
                          {f.predictedOccupancy}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">€{f.recommendedPrice}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">€{f.minPrice}–€{f.maxPrice}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          f.confidence >= 85 ? "bg-success/10 text-success" : f.confidence >= 70 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
                        }`}>
                          {f.confidence}%
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
                            setManualPrice(f.recommendedPrice);
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
            {showExplain && (
              <ExplainPrice
                forecast={selectedDay}
                basePrice={hotelProfile.basePrice}
                onClose={() => setShowExplain(false)}
              />
            )}

            {/* Confidence Gauge */}
            {!showExplain && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-medium mb-4">Price Confidence – {selectedDay.dayLabel}</h3>
                <div className="flex justify-center my-4">
                  <ConfidenceGauge value={selectedDay.confidence} />
                </div>
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Data completeness</span>
                    <span className="font-medium">{Math.round(selectedDay.dataCompleteness * 100)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Event signal</span>
                    <span className="font-medium">{Math.round(selectedDay.eventSignalStrength * 100)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Trend consistency</span>
                    <span className="font-medium">{Math.round(selectedDay.trendConsistency * 100)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Data volume</span>
                    <span className="font-medium">{Math.round(selectedDay.dataVolumeScore * 100)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Volatility score</span>
                    <span className="font-medium">{Math.round(selectedDay.volatilityScore * 100)}%</span>
                  </div>
                  <div className="border-t border-border my-2" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Underpricing risk</span>
                    <span className={`font-medium ${selectedDay.predictedOccupancy > 75 ? "text-warning" : "text-success"}`}>{selectedDay.predictedOccupancy > 75 ? "High" : "Low"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Overpricing risk</span>
                    <span className={`font-medium ${selectedDay.predictedOccupancy < 60 ? "text-destructive" : "text-success"}`}>{selectedDay.predictedOccupancy < 60 ? "High" : "Low"}</span>
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
                {alerts.map((a) => <AlertItem key={a.id} alert={a} />)}
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
            <p className="text-xs text-muted-foreground mb-5">Adjust price for {selectedDay.dayLabel} and see projected impact</p>

            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Manual Price</span>
                  <span className="text-lg font-bold">€{manualPrice}</span>
                </div>
                <Slider
                  value={[manualPrice]}
                  onValueChange={([v]) => setManualPrice(v)}
                  min={selectedDay.minPrice}
                  max={selectedDay.maxPrice}
                  step={1}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>€{selectedDay.minPrice}</span>
                  <span>€{selectedDay.maxPrice}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted p-3 text-center">
                  <div className="text-xs text-muted-foreground">Occupancy</div>
                  <div className="text-lg font-bold">{simulation.manualOccupancy}%</div>
                </div>
                <div className="rounded-lg bg-muted p-3 text-center">
                  <div className="text-xs text-muted-foreground">Revenue</div>
                  <div className="text-lg font-bold">€{simulation.manualRevenue.toLocaleString()}</div>
                </div>
                <div className="rounded-lg bg-muted p-3 text-center">
                  <div className="text-xs text-muted-foreground">vs AI</div>
                  <div className={`text-lg font-bold ${simulation.revenueVsAI >= 0 ? "text-success" : "text-destructive"}`}>
                    {simulation.revenueVsAI >= 0 ? "+" : ""}€{simulation.revenueVsAI.toLocaleString()}
                  </div>
                </div>
              </div>
              {(simulation.underpricingLoss > 0 || simulation.overpricingLoss > 0) && (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  {simulation.underpricingLoss > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-warning">Underpricing loss</span>
                      <span className="font-medium text-warning">-€{simulation.underpricingLoss.toLocaleString()}</span>
                    </div>
                  )}
                  {simulation.overpricingLoss > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-destructive">Overpricing loss</span>
                      <span className="font-medium text-destructive">-€{simulation.overpricingLoss.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Competitor Comparison */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Competitor Comparison
            </h3>
            <div className="space-y-4">
              {competitors.map((c) => (
                <div key={c.name} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">Rating: {c.rating}/5 · Occ: {c.occupancy}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">€{c.avgPrice}</div>
                    <div className="text-xs text-muted-foreground">avg/night</div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-lg border-2 border-primary/30 bg-accent/50 p-4">
                <div>
                  <div className="text-sm font-medium text-primary">{hotelProfile.name} (You)</div>
                  <div className="text-xs text-muted-foreground">AI Recommended</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">€{kpiData.avgRecommendedPrice}</div>
                  <div className="text-xs text-muted-foreground">avg/night</div>
                </div>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <span className="text-xs text-muted-foreground">Market Average: </span>
                <span className="text-sm font-semibold">€{Math.round(competitors.reduce((s, c) => s + c.avgPrice, 0) / competitors.length)}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
