import { useEffect } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCredits } from "@/lib/credits-context";

export default function SuccessPage() {
  const [, navigate] = useLocation();
  const { refresh } = useCredits();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

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
          <p className="text-muted-foreground text-base">
            Your account has been upgraded. Unlimited AI comparisons, self-critiques, and the full verdict are now available.
          </p>
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
