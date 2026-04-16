import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useLanguage } from "@/lib/language-context";
import { useCredits } from "@/lib/credits-context";
import { useLocation } from "wouter";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type Plan = {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  priceId: string;
  highlight?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "credits_25",
    name: "25 Credits",
    price: "$4.99",
    period: "one-time",
    description: "Top up your balance",
    features: [
      "25 comparisons",
      "Full access to all rounds",
      "No expiry",
      "All 11 AI models",
    ],
    priceId: "price_credits_25",
  },
  {
    id: "monthly",
    name: "Monthly",
    price: "$9.99",
    period: "per month",
    description: "Unlimited comparisons",
    features: [
      "Unlimited comparisons",
      "Full access to all rounds",
      "Priority response",
      "All 11 AI models",
    ],
    priceId: "price_monthly",
    highlight: true,
  },
  {
    id: "annual",
    name: "Annual",
    price: "$79",
    period: "per year",
    description: "Best value — save 34%",
    features: [
      "Unlimited comparisons",
      "Full access to all rounds",
      "Priority response",
      "All 11 AI models",
    ],
    priceId: "price_annual",
  },
];

export default function PricingPage() {
  const { t } = useLanguage();
  const { isSignedIn } = useAuth();
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
    <div className="max-w-4xl mx-auto px-4 py-12">
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

      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t("pricing_title") ?? "Choose your plan"}
        </h1>
        <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
          {t("pricing_subtitle") ?? "Run unlimited AI comparisons and see how the models truly stack up."}
        </p>
        {isSignedIn && !isUnlimited && (
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            {t("credits_remaining") ?? "Credits remaining"}: <span className="font-bold text-foreground">{credits}</span>
          </p>
        )}
        {isSignedIn && isUnlimited && (
          <p className="mt-2 text-sm font-medium text-green-600">
            {t("unlimited_active") ?? "Unlimited access is active"}
          </p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-2xl border p-6 flex flex-col ${
              plan.highlight
                ? "border-primary shadow-lg bg-primary/5"
                : "border-border bg-card"
            }`}
          >
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                  Most popular
                </span>
              </div>
            )}
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground">{plan.name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>
            </div>
            <div className="mb-6">
              <span className="text-3xl font-bold text-foreground">{plan.price}</span>
              <span className="text-sm text-muted-foreground ml-1">/ {plan.period}</span>
            </div>
            <ul className="space-y-2 flex-1 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                  <CheckIcon className="h-4 w-4 text-green-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              onClick={() => handlePlan(plan)}
              disabled={loading === plan.id}
              variant={plan.highlight ? "default" : "outline"}
              className="w-full"
            >
              {loading === plan.id ? "Loading..." : `Get ${plan.name}`}
            </Button>
          </div>
        ))}
      </div>

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
