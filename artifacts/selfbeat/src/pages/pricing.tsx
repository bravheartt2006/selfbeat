import { useState } from "react";
import { useAppAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { useCredits } from "@/lib/credits-context";
import { useLocation } from "wouter";
import { CheckIcon, Sparkles, Users, Zap, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type Plan = {
  id: string;
  name: string;
  label?: string;
  price: string;
  subprice?: string;
  period: string;
  description: string;
  features: string[];
  priceId: string;
  badge?: string;
  badgeStyle?: "gold" | "default" | "blue";
  highlight?: boolean;
  cta: string;
  icon: React.ReactNode;
};

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter Credits",
    price: "$4.99",
    period: "one-time",
    description: "Perfect for casual users",
    features: [
      "25 comparisons",
      "Credits never expire",
      "Full access to all rounds",
      "All 11 AI models",
    ],
    priceId: "price_starter_credits_25",
    cta: "Buy Credits",
    icon: <Zap className="h-5 w-5" />,
  },
  {
    id: "pro_monthly",
    name: "Pro Monthly",
    price: "$14.99",
    period: "per month",
    description: "Unlimited comparisons",
    features: [
      "Unlimited comparisons",
      "Full Selfbeat analysis",
      "Full verdict shown",
      "Leaderboard access",
      "Comparison history saved",
      "Priority speed",
    ],
    priceId: "price_pro_monthly",
    cta: "Start Pro Monthly",
    icon: <Star className="h-5 w-5" />,
  },
  {
    id: "pro_annual",
    name: "Pro Annual",
    label: "Best Value",
    price: "$99",
    subprice: "$8.25 / month",
    period: "per year",
    description: "Save 45% vs monthly",
    features: [
      "Everything in Pro Monthly",
      "Unlimited comparisons",
      "Full Selfbeat analysis",
      "Full verdict shown",
      "Leaderboard access",
      "Comparison history saved",
      "Priority speed",
    ],
    priceId: "price_pro_annual",
    badge: "Most Popular",
    badgeStyle: "gold",
    highlight: true,
    cta: "Start Pro Annual",
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    id: "team",
    name: "Team Plan",
    label: "For Teams",
    price: "$49",
    period: "per month",
    description: "Perfect for research teams, newsrooms, law firms & medical schools",
    features: [
      "Up to 5 team members",
      "Everything in Pro Monthly",
      "Unlimited comparisons",
      "Full verdict shown",
      "Leaderboard access",
      "Comparison history saved",
      "Priority speed",
    ],
    priceId: "price_team_monthly",
    badge: "For Teams",
    badgeStyle: "blue",
    cta: "Start Team Plan",
    icon: <Users className="h-5 w-5" />,
  },
];

export default function PricingPage() {
  const { t } = useLanguage();
  const { isSignedIn } = useAppAuth();
  const { credits, isUnlimited } = useCredits();
  const [loading, setLoading] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const urlParams = new URLSearchParams(window.location.search);
  const success = urlParams.get("success") === "1";
  const canceled = urlParams.get("canceled") === "1";

  const handlePlan = async (plan: Plan) => {
    if (!isSignedIn) {
      navigate(`${base}/sign-in`);
      return;
    }
    setLoading(plan.id);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: plan.priceId }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: "Checkout unavailable",
          description: data.error || "Please connect a Stripe account.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Checkout failed",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const handlePortal = async () => {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch {
      toast({ title: "Portal unavailable", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {success && (
        <div className="mb-8 rounded-lg bg-green-50 border border-green-200 px-5 py-4 text-green-800 text-sm">
          Payment successful. Your account has been updated.
        </div>
      )}
      {canceled && (
        <div className="mb-8 rounded-lg bg-amber-50 border border-amber-200 px-5 py-4 text-amber-800 text-sm">
          Payment canceled. No charges were made.
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Choose your plan
        </h1>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          Watch 11 AI models answer, self-critique, and receive a final verdict. Start free — no credit card needed.
        </p>
        {isSignedIn && !isUnlimited && (
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            Credits remaining: <span className="font-bold text-foreground">{credits}</span>
          </p>
        )}
        {isSignedIn && isUnlimited && (
          <p className="mt-2 text-sm font-medium text-green-600 font-semibold">
            Unlimited access is active
          </p>
        )}
      </div>

      {/* Free tier callout */}
      <div className="mb-10 rounded-2xl border border-border/50 bg-card/60 px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted/60 shrink-0 mt-0.5">
            <CheckIcon className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Free Tier — always free</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              25 credits on signup. No credit card needed. Google Sign-In only. Credits let you run 25 full AI comparisons to get started.
            </p>
          </div>
        </div>
        {!isSignedIn && (
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => navigate(`${base}/sign-in`)}
          >
            Get started free
          </Button>
        )}
      </div>

      {/* Paid plans grid */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-2xl flex flex-col transition-all ${
              plan.highlight
                ? "border-2 border-amber-400 shadow-xl shadow-amber-400/10 bg-card"
                : "border border-border bg-card"
            }`}
          >
            {/* Badge */}
            {plan.badge && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                <span
                  className={`text-xs font-bold px-3.5 py-1 rounded-full whitespace-nowrap ${
                    plan.badgeStyle === "gold"
                      ? "bg-amber-400 text-amber-950"
                      : plan.badgeStyle === "blue"
                      ? "bg-blue-600 text-white"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {plan.badge}
                </span>
              </div>
            )}

            <div className={`p-6 flex flex-col flex-1 ${plan.highlight ? "pt-8" : "pt-6"}`}>
              {/* Plan header */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`${
                      plan.highlight
                        ? "text-amber-400"
                        : plan.badgeStyle === "blue"
                        ? "text-blue-500"
                        : "text-muted-foreground"
                    }`}
                  >
                    {plan.icon}
                  </span>
                  <h2 className="text-base font-bold text-foreground">{plan.name}</h2>
                  {plan.label && (
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        plan.highlight
                          ? "bg-amber-400/15 text-amber-500"
                          : "bg-blue-500/15 text-blue-500"
                      }`}
                    >
                      {plan.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mb-5">
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground mb-0.5">/ {plan.period}</span>
                </div>
                {plan.subprice && (
                  <p className="text-xs text-amber-500 font-semibold mt-0.5">
                    {plan.subprice} billed annually
                  </p>
                )}
                {plan.id === "pro_annual" && (
                  <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20">
                    <span className="text-[10px] font-bold text-amber-500">Save 45% vs monthly</span>
                  </div>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckIcon className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-foreground/90">{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                onClick={() => handlePlan(plan)}
                disabled={loading === plan.id}
                className={`w-full font-semibold ${
                  plan.highlight
                    ? "bg-amber-400 hover:bg-amber-300 text-amber-950 border-0"
                    : ""
                }`}
                variant={plan.highlight ? "default" : "outline"}
              >
                {loading === plan.id ? "Loading..." : plan.cta}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Savings callout for annual */}
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Pro Annual saves you <span className="font-semibold text-foreground">$81 per year</span> compared to the monthly plan.
      </div>

      {/* Manage billing */}
      {isSignedIn && (
        <div className="mt-10 text-center">
          <button
            onClick={handlePortal}
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {t("manage_subscription") ?? "Manage subscription or billing"}
          </button>
        </div>
      )}
    </div>
  );
}
