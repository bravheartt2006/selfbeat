import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { CheckCircle, XCircle, Mail, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type State = "loading" | "unsubscribed" | "already" | "resubscribed" | "error";

export default function UnsubscribePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [, setLocation] = useLocation();
  const [state, setState] = useState<State>("loading");
  const [resubbing, setResubbing] = useState(false);

  useEffect(() => {
    if (!token) { setState("error"); return; }
    fetch(`/api/unsubscribe/${token}`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const d = await r.json();
        setState(d.alreadyUnsubscribed ? "already" : "unsubscribed");
      })
      .catch(() => setState("error"));
  }, [token]);

  const handleResubscribe = async () => {
    if (!token) return;
    setResubbing(true);
    try {
      const r = await fetch(`/api/resubscribe/${token}`, { method: "POST", credentials: "include" });
      if (r.ok) setState("resubscribed");
    } finally {
      setResubbing(false);
    }
  };

  const content: Record<State, { icon: React.ReactNode; title: string; body: string; accent: string }> = {
    loading: {
      icon: <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin" />,
      title: "Processing…",
      body: "Just a moment.",
      accent: "border-border/30",
    },
    unsubscribed: {
      icon: <CheckCircle className="h-8 w-8 text-green-400" />,
      title: "You have been unsubscribed",
      body: "You will no longer receive weekly digest emails from Selfbeat. You can re-subscribe any time below.",
      accent: "border-green-500/30 bg-green-500/5",
    },
    already: {
      icon: <Mail className="h-8 w-8 text-muted-foreground" />,
      title: "Already unsubscribed",
      body: "This email address has already been unsubscribed from Selfbeat emails.",
      accent: "border-border/30",
    },
    resubscribed: {
      icon: <CheckCircle className="h-8 w-8 text-primary" />,
      title: "You're back!",
      body: "You have been re-subscribed to Selfbeat emails. You can manage your email preferences from your settings at any time.",
      accent: "border-primary/30 bg-primary/5",
    },
    error: {
      icon: <XCircle className="h-8 w-8 text-destructive" />,
      title: "Invalid link",
      body: "This unsubscribe link is invalid or has expired. Please use the link from your most recent Selfbeat email.",
      accent: "border-destructive/30 bg-destructive/5",
    },
  };

  const { icon, title, body, accent } = content[state];

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className={`max-w-md w-full border ${accent} rounded-2xl p-10 text-center space-y-5`}>
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-muted/20 flex items-center justify-center">
            {icon}
          </div>
        </div>

        <div className="text-4xl">🥁</div>

        <div className="space-y-2">
          <h1 className="text-xl font-serif font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
        </div>

        {(state === "unsubscribed" || state === "already") && (
          <Button
            variant="outline"
            onClick={handleResubscribe}
            disabled={resubbing}
            className="gap-2"
          >
            {resubbing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Re-subscribe to emails
          </Button>
        )}

        <div className="pt-2">
          <button
            onClick={() => setLocation("/")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mx-auto"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Selfbeat
          </button>
        </div>
      </div>
    </div>
  );
}
