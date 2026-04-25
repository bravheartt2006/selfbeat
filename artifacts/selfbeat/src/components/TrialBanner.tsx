import { useEffect, useState, useCallback } from "react";
import { X, Zap, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCredits } from "@/lib/credits-context";
import { useAppAuth } from "@/lib/auth-context";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0h 0m";
  const totalSecs = Math.floor(ms / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);

  if (days > 0) {
    return `${days} day${days !== 1 ? "s" : ""} and ${hours} hour${hours !== 1 ? "s" : ""}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours !== 1 ? "s" : ""} and ${mins} minute${mins !== 1 ? "s" : ""}`;
  }
  return `${mins} minute${mins !== 1 ? "s" : ""}`;
}

export default function TrialBanner() {
  const { isOnActiveTrial, trialEndDate, trialExpiredRecently } = useCredits();
  const { isSignedIn } = useAppAuth();
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Real-time countdown tick every 10s
  useEffect(() => {
    if (!isOnActiveTrial) return;
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, [isOnActiveTrial]);

  const handleSubscribe = useCallback(async () => {
    setIsCheckingOut(true);
    try {
      const PRO_MONTHLY_PRICE = import.meta.env.VITE_STRIPE_PRO_MONTHLY_PRICE_ID || "";
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: PRO_MONTHLY_PRICE,
          applyTrialDiscount: trialExpiredRecently,
        }),
      });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch {
      // ignore
    } finally {
      setIsCheckingOut(false);
    }
  }, [trialExpiredRecently]);

  if (!isSignedIn || dismissed) return null;

  // ── Active trial banner ────────────────────────────────────────────────────
  if (isOnActiveTrial && trialEndDate) {
    const msLeft = new Date(trialEndDate).getTime() - now;
    if (msLeft <= 0) return null;

    return (
      <div className="relative bg-gradient-to-r from-violet-600/90 to-purple-700/90 text-white text-sm py-2 px-4 flex items-center justify-center gap-3 flex-wrap">
        <Zap className="h-3.5 w-3.5 shrink-0 text-yellow-300" />
        <span className="font-medium">
          Pro Trial: <strong>{formatCountdown(msLeft)}</strong> remaining
          <span className="hidden sm:inline"> — Subscribe to keep access</span>
        </span>
        <Button
          size="sm"
          onClick={() => window.location.href = "/pricing"}
          className="h-6 px-3 text-xs bg-white/20 hover:bg-white/30 border border-white/30 text-white font-semibold rounded-full ml-1"
        >
          Subscribe
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-1"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // ── Trial expired — welcome back offer (24h window) ────────────────────────
  if (trialExpiredRecently) {
    return (
      <div className="relative bg-gradient-to-r from-amber-500/90 to-orange-500/90 text-white text-sm py-2 px-4 flex items-center justify-center gap-3 flex-wrap">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium">
          Your free trial has ended.
          <span className="hidden sm:inline"> Welcome back offer: </span>
          <strong className="hidden sm:inline">Get Pro Monthly for $7.99 your first month</strong>
        </span>
        <Button
          size="sm"
          onClick={handleSubscribe}
          disabled={isCheckingOut}
          className="h-6 px-3 text-xs bg-white/20 hover:bg-white/30 border border-white/30 text-white font-semibold rounded-full ml-1"
        >
          {isCheckingOut ? "Loading..." : "Claim $7.99 offer"}
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-1"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return null;
}
