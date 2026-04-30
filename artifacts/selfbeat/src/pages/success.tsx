import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { CheckCircle2, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCredits } from "@/lib/credits-context";

type VerifyState = "loading" | "done" | "already_done" | "error";

export default function SuccessPage() {
  const [, navigate] = useLocation();
  const { refresh } = useCredits();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const search = useSearch();
  const params = new URLSearchParams(search);
  const sessionId = params.get("session_id");

  const [state, setState] = useState<VerifyState>("loading");
  const [creditsAdded, setCreditsAdded] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setState("done");
      refresh().catch(() => {});
      return;
    }

    fetch("/api/stripe/verify-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sessionId }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Verification failed");
        setCreditsAdded(data.creditsAdded ?? 0);
        setState(data.alreadyProcessed ? "already_done" : "done");
        refresh().catch(() => {});
      })
      .catch((err) => {
        setErrorMsg(err.message || "Could not verify payment");
        setState("error");
        refresh().catch(() => {});
      });
  }, [sessionId, refresh]);

  if (state === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Confirming your payment…</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-yellow-500/10 p-5">
              <AlertCircle className="h-14 w-14 text-yellow-500" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Payment received — syncing your account
            </h1>
            <p className="text-muted-foreground text-sm">
              Your payment went through. Your credits or plan will appear within a minute. If they don't, please contact support.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">{errorMsg}</p>
          </div>
          <Button className="gap-2" onClick={() => navigate(`${base}/`)}>
            Go to home <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-500/10 p-5">
            <CheckCircle2 className="h-14 w-14 text-green-500" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Payment successful!
          </h1>
          {creditsAdded > 0 ? (
            <p className="text-muted-foreground text-base">
              <span className="text-primary font-semibold">+{creditsAdded} credits</span> have been added to your account.
            </p>
          ) : (
            <p className="text-muted-foreground text-base">
              Your account has been upgraded. Unlimited AI comparisons, self-critiques, and the full verdict are now available.
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button
            className="gap-2"
            onClick={() => navigate(`${base}/`)}
          >
            Start asking questions
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`${base}/pricing`)}
          >
            View your plan
          </Button>
        </div>
      </div>
    </div>
  );
}
