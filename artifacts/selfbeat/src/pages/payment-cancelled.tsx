import { useLocation } from "wouter";
import { XCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentCancelledPage() {
  const [, navigate] = useLocation();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-5">
            <XCircle className="h-14 w-14 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Payment cancelled
          </h1>
          <p className="text-muted-foreground text-base">
            No charge was made. You can upgrade whenever you're ready.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button className="gap-2" onClick={() => navigate(`${base}/pricing`)}>
            <ArrowLeft className="h-4 w-4" />
            Back to pricing
          </Button>
          <Button variant="outline" onClick={() => navigate(`${base}/`)}>
            Go to home
          </Button>
        </div>
      </div>
    </div>
  );
}
