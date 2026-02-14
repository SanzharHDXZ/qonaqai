import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DailyForecast } from "@/data/mockData";

interface ExplainPriceProps {
  forecast: DailyForecast;
  basePrice: number;
  onClose: () => void;
}

interface FactorRow {
  label: string;
  value: number;
  contribution: number; // percentage contribution to final price
  description: string;
}

export default function ExplainPrice({ forecast, basePrice, onClose }: ExplainPriceProps) {
  // Calculate each factor's contribution to the final price
  const rawProduct = forecast.seasonalityFactor * forecast.weekdayFactor * forecast.eventMultiplier * forecast.trendFactor;
  
  const factors: FactorRow[] = [
    {
      label: "Base Demand",
      value: forecast.predictedOccupancy / 100,
      contribution: (forecast.predictedOccupancy / 100) / (rawProduct * (forecast.predictedOccupancy / 100)) * 100,
      description: `Historical base occupancy rate drives the foundation. Score: ${forecast.predictedOccupancy}%`,
    },
    {
      label: "Seasonality Effect",
      value: forecast.seasonalityFactor,
      contribution: Math.abs(forecast.seasonalityFactor - 1) / Math.max(0.01, Math.abs(rawProduct - 1)) * 100,
      description: `Month-based seasonal pattern. ${forecast.seasonalityFactor > 1 ? "High" : forecast.seasonalityFactor < 0.9 ? "Low" : "Normal"} season (×${forecast.seasonalityFactor.toFixed(2)})`,
    },
    {
      label: "Day-of-Week Effect",
      value: forecast.weekdayFactor,
      contribution: Math.abs(forecast.weekdayFactor - 1) / Math.max(0.01, Math.abs(rawProduct - 1)) * 100,
      description: `Weekend/weekday demand pattern. ${forecast.weekdayFactor > 1 ? "Weekend premium" : "Weekday discount"} (×${forecast.weekdayFactor.toFixed(2)})`,
    },
    {
      label: "Event Impact",
      value: forecast.eventMultiplier,
      contribution: Math.abs(forecast.eventMultiplier - 1) / Math.max(0.01, Math.abs(rawProduct - 1)) * 100,
      description: forecast.event
        ? `"${forecast.event}" is driving demand up (×${forecast.eventMultiplier.toFixed(2)})`
        : `No events detected. Neutral impact (×1.00)`,
    },
    {
      label: "Trend Momentum",
      value: forecast.trendFactor,
      contribution: Math.abs(forecast.trendFactor - 1) / Math.max(0.01, Math.abs(rawProduct - 1)) * 100,
      description: `14-day booking momentum. ${forecast.trendFactor > 1.02 ? "Upward trend" : forecast.trendFactor < 0.98 ? "Downward trend" : "Stable"} (×${forecast.trendFactor.toFixed(3)})`,
    },
  ];

  // Price optimization step
  const priceChange = ((forecast.recommendedPrice - basePrice) / basePrice * 100);
  const pricingTierLabels: Record<string, string> = {
    discount: "Discount tier: demand below 50 → reduce price 10–20%",
    base: "Base tier: demand 50–70 → keep near base (±5%)",
    premium: "Premium tier: demand 70–85 → increase 10–25%",
    surge: "Surge tier: demand >85 → increase 30–50%",
  };

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

      {/* Demand Score Breakdown */}
      <div className="space-y-3 mb-5">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Demand Score Breakdown</div>
        {factors.map((f) => (
          <div key={f.label} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{f.label}</span>
              <span className={`text-sm font-bold ${f.value > 1.02 ? "text-success" : f.value < 0.98 ? "text-destructive" : ""}`}>
                ×{typeof f.value === "number" && f.value < 1 ? f.value.toFixed(3) : f.value.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{f.description}</p>
            {/* Contribution bar */}
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
            forecast.pricingTier === "surge" ? "bg-destructive/10 text-destructive" :
            forecast.pricingTier === "premium" ? "bg-success/10 text-success" :
            forecast.pricingTier === "discount" ? "bg-warning/10 text-warning" :
            "bg-muted text-muted-foreground"
          }`}>
            {forecast.pricingTier}
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
