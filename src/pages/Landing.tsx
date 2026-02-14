import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Brain, TrendingUp, Shield, Zap, Building2, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const Navbar = () => (
  <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
    <div className="container mx-auto flex h-16 items-center justify-between px-6">
      <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <BarChart3 className="h-4 w-4 text-primary-foreground" />
        </div>
        RevPilot
      </Link>
      <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
        <a href="#features" className="hover:text-foreground transition-colors">Features</a>
        <a href="#roi" className="hover:text-foreground transition-colors">ROI</a>
        <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
      </div>
      <div className="flex items-center gap-3">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm">Log in</Button>
        </Link>
        <Link to="/dashboard">
          <Button size="sm">Start Free Trial <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button>
        </Link>
      </div>
    </div>
  </nav>
);

const stats = [
  { value: "23%", label: "Average Revenue Lift" },
  { value: "94%", label: "Forecast Accuracy" },
  { value: "< 2min", label: "Daily Setup Time" },
  { value: "500+", label: "Hotels Optimized" },
];

const features = [
  {
    icon: Brain,
    title: "AI Demand Forecasting",
    description: "Predict occupancy with 94% accuracy using time-series ML models trained on your historical data, local events, and seasonality.",
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
    description: "For small boutique hotels getting started with dynamic pricing.",
    features: ["Up to 30 rooms", "30-day forecasting", "Basic pricing engine", "Email alerts", "1 user"],
  },
  {
    name: "Professional",
    price: "349",
    description: "For mid-sized hotels serious about revenue optimization.",
    features: ["Up to 100 rooms", "90-day forecasting", "Advanced AI pricing", "Event detection", "Competitor tracking", "5 users", "API access"],
    popular: true,
  },
  {
    name: "Enterprise",
    price: "749",
    description: "For hotel groups and chains requiring multi-property management.",
    features: ["Unlimited rooms", "365-day forecasting", "Custom ML models", "PMS integration", "Unlimited users", "Dedicated support", "Multi-property"],
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="container relative mx-auto px-6 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground shadow-card">
              <Zap className="h-3.5 w-3.5 text-primary" />
              AI-powered revenue optimization for hotels
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Stop leaving revenue
              <span className="text-gradient"> on the table</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              RevPilot uses AI demand forecasting to recommend optimal daily room prices.
              Hotels using RevPilot see an average <strong className="text-foreground">23% revenue increase</strong> within
              the first 90 days.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/dashboard">
                <Button size="lg" className="px-8">
                  Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button variant="outline" size="lg" className="px-8">
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-8 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-primary">{stat.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold">Everything you need to maximize revenue</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Built specifically for independent hotels with 20–150 rooms. No complex setup, no revenue management degree required.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-6 shadow-card hover:shadow-elevated transition-shadow">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                  <f.icon className="h-5 w-5 text-accent-foreground" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI Section */}
      <section id="roi" className="py-20 border-t border-border bg-card">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold">The ROI is clear</h2>
            <p className="mt-3 text-muted-foreground">For an 85-room hotel at €120 base rate</p>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-background p-6">
                <div className="text-sm text-muted-foreground">Static Pricing Revenue</div>
                <div className="mt-2 text-2xl font-bold">€306,000</div>
                <div className="mt-1 text-xs text-muted-foreground">/month</div>
              </div>
              <div className="rounded-xl border-2 border-primary bg-background p-6 shadow-elevated">
                <div className="text-sm text-primary font-medium">AI-Optimized Revenue</div>
                <div className="mt-2 text-2xl font-bold text-primary">€378,420</div>
                <div className="mt-1 text-xs text-muted-foreground">/month</div>
              </div>
              <div className="rounded-xl border border-success/30 bg-background p-6">
                <div className="text-sm text-success font-medium">Revenue Lift</div>
                <div className="mt-2 text-2xl font-bold text-success">+€72,420</div>
                <div className="mt-1 text-xs text-muted-foreground">+23.7% increase</div>
              </div>
            </div>
            <p className="mt-8 text-sm text-muted-foreground">
              RevPilot pays for itself within the first week. Average ROI: <strong className="text-foreground">48x</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold">Simple, transparent pricing</h2>
            <p className="mt-3 text-muted-foreground">No hidden fees. Cancel anytime. Start with a 14-day free trial.</p>
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
                    Most Popular
                  </div>
                )}
                <h3 className="font-semibold text-lg">{tier.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold">${tier.price}</span>
                  <span className="text-muted-foreground text-sm">/month</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
                <Link to="/dashboard" className="block mt-6">
                  <Button className="w-full" variant={tier.popular ? "default" : "outline"} size="sm">
                    Start Trial <ChevronRight className="ml-1 h-3.5 w-3.5" />
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
      <section className="py-20 border-t border-border bg-card">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold">Ready to optimize your revenue?</h2>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
            Join 500+ hotels already using RevPilot to maximize their revenue with AI-powered dynamic pricing.
          </p>
          <Link to="/dashboard" className="inline-block mt-8">
            <Button size="lg" className="px-8">
              Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <BarChart3 className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            RevPilot
          </div>
          <p className="text-sm text-muted-foreground">© 2026 RevPilot. AI Revenue Engine for Independent Hotels.</p>
        </div>
      </footer>
    </div>
  );
}
