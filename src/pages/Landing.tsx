import { Link } from "react-router-dom";
import { useMemo } from "react";
import { ArrowRight, Brain, TrendingUp, Shield, Zap, Building2, ChevronRight, Check, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStoredHistoricalData, computeHistoricalStats } from "@/pricing-engine";
import { generateForecasts, computeKPIs, hotelProfile } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import UserMenu from "@/components/UserMenu";
import QonaqLogo from "@/components/QonaqLogo";

const Navbar = () => {
  const { user } = useAuth();
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <QonaqLogo linkTo="/" size="md" />
        <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#roi" className="hover:text-foreground transition-colors">ROI</a>
          <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link to="/dashboard">
                <Button size="sm">Dashboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button>
              </Link>
              <UserMenu />
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">Log in</Button>
              </Link>
              <Link to="/signup">
                <Button size="sm">Request Early Access <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

const features = [
  {
    icon: Brain,
    title: "AI Demand Forecasting",
    description: "Predict occupancy using time-series models trained on your historical data, local events, and seasonality patterns.",
  },
  {
    icon: TrendingUp,
    title: "Dynamic Pricing Engine",
    description: "Get daily price recommendations with confidence scores. Each suggestion includes minimum safe price and maximum demand price.",
  },
  {
    icon: Zap,
    title: "Event-Aware Intelligence",
    description: "Automatically detects local events, holidays, conferences, and weather patterns that impact demand — and adjusts prices accordingly.",
  },
  {
    icon: Shield,
    title: "Revenue Simulation",
    description: "Simulate different pricing strategies before committing. See projected occupancy changes and revenue curves in real-time.",
  },
  {
    icon: Building2,
    title: "Competitor Monitoring",
    description: "Track competitor pricing and market positioning. Understand where you stand and identify pricing opportunities.",
  },
  {
    icon: BarChart3,
    title: "Smart Alerts",
    description: "Get proactive notifications for demand surges, event-driven opportunities, and low occupancy risks before they happen.",
  },
];

const tiers = [
  {
    name: "Starter",
    price: "149",
    description: "For boutique hotels getting started with intelligent pricing.",
    features: ["Up to 30 rooms", "30-day forecasting", "Basic pricing engine", "Email alerts", "1 user"],
  },
  {
    name: "Professional",
    price: "349",
    description: "For hotels serious about revenue optimization.",
    features: ["Up to 100 rooms", "90-day forecasting", "Advanced AI pricing", "Event detection", "Competitor tracking", "5 users", "API access"],
    popular: true,
  },
  {
    name: "Enterprise",
    price: "749",
    description: "For hotel groups requiring multi-property management.",
    features: ["Unlimited rooms", "365-day forecasting", "Custom ML models", "PMS integration", "Unlimited users", "Dedicated support", "Multi-property"],
  },
];

export default function Landing() {
  const { user } = useAuth();
  const dynamicStats = useMemo(() => {
    const historicalData = getStoredHistoricalData();
    const stats = computeHistoricalStats(historicalData);
    const forecasts = generateForecasts(hotelProfile.rooms, hotelProfile.basePrice, hotelProfile.avgOccupancy);
    const kpis = computeKPIs(forecasts);

    if (stats.hasData) {
      return {
        hasRealData: true,
        revenueLift: `+${kpis.revenueLift}%`,
        dataPoints: `${stats.totalRecords}`,
        avgConfidence: `${kpis.avgConfidence}%`,
        setupTime: "< 2min",
      };
    }
    return {
      hasRealData: false,
      revenueLift: `+${kpis.revenueLift}%`,
      dataPoints: "Demo",
      avgConfidence: `${kpis.avgConfidence}%`,
      setupTime: "< 2min",
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-36 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="container relative mx-auto px-6 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground shadow-card">
              <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
              AI Intelligence Platform for Modern Hotels
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl leading-[1.1]">
              Smarter Revenue Decisions
              <br />
              <span className="text-primary">for Modern Hotels.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              QonaqAI uses real-time market signals, demand forecasting, and AI optimization to maximize hotel profitability.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to={user ? "/dashboard" : "/signup"}>
                <Button size="lg" className="px-8 h-12 text-base">
                  {user ? "Go to Dashboard" : "Request Early Access"} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="mailto:hello@qonaq.ai">
                <Button variant="outline" size="lg" className="px-8 h-12 text-base">
                  Book a Demo
                </Button>
              </a>
            </div>
          </div>

          {/* Trust indicators */}
          <div className="mx-auto mt-20 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> SOC 2 Compliant</span>
            <span className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> GDPR Ready</span>
            <span className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> 99.9% Uptime</span>
            <span className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> No PMS Lock-in</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl font-bold">Built for Revenue Excellence</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Purpose-built for independent hotels. No complex setup, no revenue management degree required.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-6 shadow-card hover:shadow-elevated transition-shadow">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                  <f.icon className="h-5 w-5 text-accent-foreground" />
                </div>
                <h3 className="font-display font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI Section */}
      <section id="roi" className="py-24 border-t border-border bg-card">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-3xl font-bold">Measurable Impact</h2>
            <p className="mt-4 text-muted-foreground">
              {dynamicStats.hasRealData
                ? "Based on your uploaded historical data"
                : "Projected results based on industry benchmarks"
              }
            </p>
            {(() => {
              const forecasts = generateForecasts(hotelProfile.rooms, hotelProfile.basePrice, hotelProfile.avgOccupancy);
              const kpis = computeKPIs(forecasts);
              return (
                <div className="mt-12 grid gap-6 sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-background p-6">
                    <div className="text-sm text-muted-foreground">Static Pricing Revenue</div>
                    <div className="mt-2 text-2xl font-display font-bold">€{kpis.staticRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <div className="mt-1 text-xs text-muted-foreground">/30 days</div>
                  </div>
                  <div className="rounded-xl border-2 border-primary bg-background p-6 shadow-elevated">
                    <div className="text-sm text-primary font-medium">AI-Optimized Revenue</div>
                    <div className="mt-2 text-2xl font-display font-bold text-primary">€{kpis.projectedRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <div className="mt-1 text-xs text-muted-foreground">/30 days</div>
                  </div>
                  <div className="rounded-xl border border-success/30 bg-background p-6">
                    <div className="text-sm text-success font-medium">Projected Uplift</div>
                    <div className="mt-2 text-2xl font-display font-bold text-gold">+€{(kpis.projectedRevenue - kpis.staticRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <div className="mt-1 text-xs text-muted-foreground">+{kpis.revenueLift}%</div>
                  </div>
                </div>
              );
            })()}
            <p className="mt-10 text-sm text-muted-foreground">
              {dynamicStats.hasRealData
                ? "These projections are calculated from your actual hotel performance data."
                : "Upload your historical data to see personalized projections."
              }
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl font-bold">Transparent Pricing</h2>
            <p className="mt-4 text-muted-foreground">No hidden fees. Cancel anytime. Start with a 14-day free trial.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-xl border p-6 ${
                  tier.popular
                    ? "border-primary bg-card shadow-elevated relative"
                    : "border-border bg-card shadow-card"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                    Recommended
                  </div>
                )}
                <h3 className="font-display font-semibold text-lg">{tier.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-display font-bold">${tier.price}</span>
                  <span className="text-muted-foreground text-sm">/month</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
                <Link to={user ? "/dashboard" : "/signup"} className="block mt-6">
                  <Button className="w-full" variant={tier.popular ? "default" : "outline"} size="sm">
                    Get Started <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </Link>
                <ul className="mt-6 space-y-2.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-border bg-card">
        <div className="container mx-auto px-6 text-center">
          <h2 className="font-display text-3xl font-bold">Ready to Maximize Your Revenue?</h2>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
            Join forward-thinking hoteliers using AI to make smarter pricing decisions every day.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to={user ? "/dashboard" : "/signup"} className="inline-block">
              <Button size="lg" className="px-8 h-12 text-base">
                Request Early Access <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="mailto:hello@qonaq.ai" className="inline-block">
              <Button variant="outline" size="lg" className="px-8 h-12 text-base">
                Book a Demo
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <QonaqLogo size="sm" />
          <p className="text-sm text-muted-foreground">© 2026 QonaqAI. AI Intelligence Platform for Modern Hotels.</p>
        </div>
      </footer>
    </div>
  );
}
