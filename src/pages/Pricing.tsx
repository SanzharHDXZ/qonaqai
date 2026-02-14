import { Link } from "react-router-dom";
import { Check, ArrowRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import QonaqLogo from "@/components/QonaqLogo";

const tiers = [
  {
    name: "Starter",
    price: "149",
    description: "For boutique hotels just getting started with intelligent pricing.",
    features: [
      "Up to 30 rooms",
      "30-day demand forecasting",
      "Basic pricing recommendations",
      "Email alerts",
      "1 user seat",
      "Standard support",
    ],
  },
  {
    name: "Professional",
    price: "349",
    description: "For hotels serious about maximizing revenue.",
    features: [
      "Up to 100 rooms",
      "90-day demand forecasting",
      "Advanced AI pricing engine",
      "Event-aware intelligence",
      "Competitor monitoring",
      "Revenue simulation tool",
      "5 user seats",
      "API access",
      "Priority support",
    ],
    popular: true,
  },
  {
    name: "Enterprise",
    price: "749",
    description: "For hotel groups requiring multi-property management.",
    features: [
      "Unlimited rooms",
      "365-day forecasting",
      "Custom ML models",
      "PMS integration",
      "OTA channel sync",
      "Multi-property dashboard",
      "Unlimited users",
      "Dedicated account manager",
      "SLA guarantee",
      "Custom training",
    ],
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="h-4 w-4" /> Home
            </Link>
          </div>
          <QonaqLogo linkTo="/" size="md" />
          <Link to="/signup">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-16">
        <div className="text-center mb-14">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Transparent Pricing</h1>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
            Start with a 14-day free trial. No credit card required. Upgrade or downgrade anytime.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-xl border p-7 flex flex-col ${
                tier.popular
                  ? "border-primary bg-card shadow-elevated relative"
                  : "border-border bg-card shadow-card"
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-medium text-primary-foreground">
                  Recommended
                </div>
              )}
              <h3 className="font-display text-xl font-semibold">{tier.name}</h3>
              <div className="mt-3">
                <span className="text-4xl font-display font-bold">${tier.price}</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{tier.description}</p>
              <Link to="/signup" className="block mt-6">
                <Button className="w-full" variant={tier.popular ? "default" : "outline"}>
                  Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <ul className="mt-8 space-y-3 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            All plans include SSL encryption, GDPR compliance, and 99.9% uptime SLA.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Need a custom plan? <a href="mailto:hello@qonaq.ai" className="text-primary underline">Contact sales</a>
          </p>
        </div>
      </main>
    </div>
  );
}
