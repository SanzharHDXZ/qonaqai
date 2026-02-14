import { Info, X, Zap, Cloud, Calendar, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DailyForecast } from "@/data/mockData";

interface ExplainPriceProps {
  forecast: DailyForecast;
  basePrice: number;
  onClose: () => void;
}

interface FactorRow {
  label: string;
  value: number | string;
  score: number;
  weight: number;
  contribution: number;
  description: string;
}

export default function ExplainPrice({ forecast, basePrice, onClose }: ExplainPriceProps) {
  const components = forecast.demandComponents;
  const weights = {
    weekdayAvg: 0.30,
    trend7Day: 0.20,
    seasonality30Day: 0.20,
    eventStrength: 0.15,
    bookingPace: 0.15,
  };

  const totalWeighted =
    weights.weekdayAvg * components.weekdayAvgScore +
    weights.trend7Day * components.trendScore +
    weights.seasonality30Day * components.seasonalityScore +
    weights.eventStrength * components.eventScore +
    weights.bookingPace * components.bookingPaceScore;

  const factors: FactorRow[] = [
    {
      label: "Historical Weekday Avg",
      value: `×${forecast.weekdayFactor.toFixed(2)}`,
      score: components.weekdayAvgScore,
      weight: weights.weekdayAvg,
      contribution: totalWeighted > 0 ? (weights.weekdayAvg * components.weekdayAvgScore / totalWeighted) * 100 : 0,
      description: `Weekday occupancy pattern. Score: ${components.weekdayAvgScore}/100`,
    },
    {
      label: "7-Day Trend",
      value: `×${forecast.trendFactor.toFixed(3)}`,
      score: components.trendScore,
      weight: weights.trend7Day,
      contribution: totalWeighted > 0 ? (weights.trend7Day * components.trendScore / totalWeighted) * 100 : 0,
      description: `Rolling 7-day trend momentum. ${forecast.trendFactor > 1.02 ? "Upward" : forecast.trendFactor < 0.98 ? "Downward" : "Stable"} trend`,
    },
    {
      label: "30-Day Seasonality",
      value: `×${forecast.seasonalityFactor.toFixed(2)}`,
      score: components.seasonalityScore,
      weight: weights.seasonality30Day,
      contribution: totalWeighted > 0 ? (weights.seasonality30Day * components.seasonalityScore / totalWeighted) * 100 : 0,
      description: `Seasonal demand index. ${forecast.seasonalityFactor > 1 ? "High" : forecast.seasonalityFactor < 0.9 ? "Low" : "Normal"} season`,
    },
    {
      label: "Event Strength",
      value: forecast.event ? `×${forecast.eventMultiplier.toFixed(2)}` : "None",
      score: components.eventScore,
      weight: weights.eventStrength,
      contribution: totalWeighted > 0 ? (weights.eventStrength * components.eventScore / totalWeighted) * 100 : 0,
      description: forecast.event
        ? `"${forecast.event}" driving demand (×${forecast.eventMultiplier.toFixed(2)})`
        : "No events detected",
    },
    {
      label: "Booking Pace Velocity",
      value: forecast.bookingPaceVelocity > 0 ? `+${forecast.bookingPaceVelocity.toFixed(2)}` : forecast.bookingPaceVelocity.toFixed(2),
      score: components.bookingPaceScore,
      weight: weights.bookingPace,
      contribution: totalWeighted > 0 ? (weights.bookingPace * components.bookingPaceScore / totalWeighted) * 100 : 0,
      description: `Booking acceleration vs last month. ${forecast.bookingPaceVelocity > 0.1 ? "Accelerating" : forecast.bookingPaceVelocity < -0.1 ? "Decelerating" : "Normal pace"}`,
    },
  ];

  const priceChange = ((forecast.recommendedPrice - basePrice) / basePrice * 100);
  const pricingTierLabels: Record<string, string> = {
    discount: "Discount tier: demand below 50 → reduce price 10–20%",
    base: "Base tier: demand 50–70 → keep near base (±5%)",
    premium: "Premium tier: demand 70–85 → increase 10–25%",
    surge: "Surge tier: demand >85 → increase 30–50%",
    saturation: "Saturation mode: occupancy >95% → profit-maximizing pricing",
  };

  const hasExternalSignals = forecast.externalSignalScore > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          Price Explanation – {forecast.dayLabel}
        </h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Weighted Demand Score Breakdown */}
      <div className="space-y-3 mb-5">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Weighted Demand Model (Score: {forecast.demandScore}/100)
        </div>
        {factors.map((f) => (
          <div key={f.label} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{f.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">w={f.weight}</span>
                <span className="text-sm font-bold">{f.value}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{f.description}</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, Math.max(2, f.contribution))}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground w-8 text-right">
                {Math.round(f.contribution)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* External Market Signals */}
      <div className="rounded-lg border border-border p-4 mb-5 space-y-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          External Market Signals (+{forecast.externalSignalScore.toFixed(1)} pts)
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" /> Event impact
            </span>
            <span className={`font-medium ${forecast.externalEventImpact > 0 ? "text-success" : ""}`}>
              {forecast.externalEventImpact > 0 ? "+" : ""}{forecast.externalEventImpact.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Cloud className="h-3.5 w-3.5" /> Weather impact
            </span>
            <span className={`font-medium ${forecast.externalWeatherImpact > 0 ? "text-success" : forecast.externalWeatherImpact < 0 ? "text-destructive" : ""}`}>
              {forecast.externalWeatherImpact > 0 ? "+" : ""}{forecast.externalWeatherImpact.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> Competitor position
            </span>
            <span className={`font-medium ${forecast.externalCompetitorImpact > 0 ? "text-success" : forecast.externalCompetitorImpact < 0 ? "text-destructive" : ""}`}>
              {forecast.externalCompetitorImpact > 0 ? "+" : ""}{forecast.externalCompetitorImpact.toFixed(1)}
            </span>
          </div>
          <div className="border-t border-border pt-2 flex items-center justify-between text-sm">
            <span className="font-medium">Total external adjustment</span>
            <span className={`font-bold ${hasExternalSignals ? "text-primary" : ""}`}>
              +{forecast.externalSignalScore.toFixed(1)} pts
            </span>
          </div>
        </div>
      </div>

      {/* Saturation Warning */}
      {forecast.isSaturated && (
        <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 mb-4 flex items-start gap-2">
          <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <div className="text-xs font-medium text-primary">Demand Saturation Active</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Projected occupancy &gt;95%. Switched to profit-maximizing mode with +{Math.round(forecast.saturationBoost * 100)}% price boost.
            </p>
          </div>
        </div>
      )}

      {/* Final Optimization Step */}
      <div className="rounded-lg border-2 border-primary/20 bg-accent/30 p-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Price Optimization
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm">Final Demand Score</span>
          <span className="text-sm font-bold">{forecast.demandScore}/100</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm">Pricing Tier</span>
          <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${
            forecast.pricingTier === "saturation" ? "bg-primary/20 text-primary" :
            forecast.pricingTier === "surge" ? "bg-destructive/10 text-destructive" :
            forecast.pricingTier === "premium" ? "bg-success/10 text-success" :
            forecast.pricingTier === "discount" ? "bg-warning/10 text-warning" :
            "bg-muted text-muted-foreground"
          }`}>
            {forecast.isSaturated ? "🔥 " : ""}{forecast.pricingTier}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {pricingTierLabels[forecast.pricingTier] || "Standard pricing applied."}
        </p>
        <div className="flex items-center justify-between border-t border-border pt-3">
          <div>
            <div className="text-xs text-muted-foreground">Base Price</div>
            <div className="text-sm font-medium">€{basePrice}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Multiplier</div>
            <div className="text-sm font-medium">×{forecast.priceMultiplier}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">AI Price</div>
            <div className="text-lg font-bold text-primary">€{forecast.recommendedPrice}</div>
          </div>
        </div>
        <div className="mt-2 text-center">
          <span className={`text-xs font-medium ${priceChange >= 0 ? "text-success" : "text-warning"}`}>
            {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(1)}% vs base price
          </span>
        </div>
      </div>

      {/* Confidence */}
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>AI Confidence: <span className="font-medium text-foreground">{forecast.confidence}%</span></span>
        <span>Range: €{forecast.minPrice} – €{forecast.maxPrice}</span>
      </div>
    </div>
  );
}
