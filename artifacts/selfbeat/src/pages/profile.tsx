import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Clock,
  Trophy,
  ArrowRight,
  Lock,
  User,
  Coins,
  Star,
  History,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppAuth } from "@/lib/auth-context";
import { useCredits } from "@/lib/credits-context";

type HistoryEntry = {
  id: string;
  comparisonId: string;
  question: string;
  winner: string | null;
  createdAt: string;
};

type HistoryResponse = {
  history: HistoryEntry[];
  isPro: boolean;
  hasMore: boolean;
};

const MODEL_COLORS: Record<string, string> = {
  "ChatGPT": "#10A37F",
  "Claude": "#CC785C",
  "Gemini": "#4285F4",
  "DeepSeek": "#7B68EE",
  "Grok": "#F97316",
  "Mistral Large": "#EF4444",
  "Llama 3.3 (Meta)": "#1877F2",
  "Perplexity Sonar": "#06B6D4",
  "Cohere Command R+": "#22C55E",
  "Qwen 2.5 (Alibaba)": "#A855F7",
  "Microsoft Copilot": "#0078D4",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ProfilePage() {
  const { isSignedIn, isLoaded, user } = useAppAuth();
  const { credits, isUnlimited } = useCredits();
  const [, navigate] = useLocation();

  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate("/sign-in");
    }
  }, [isLoaded, isSignedIn, navigate]);

  useEffect(() => {
    if (!isSignedIn) return;
    setLoading(true);
    fetch(`${base}/api/users/me/history`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setError("Failed to load history."))
      .finally(() => setLoading(false));
  }, [isSignedIn, base]);

  if (!isLoaded || !isSignedIn) return null;

  const firstName = user?.displayName?.split(" ")[0] ?? "User";
  const planLabel = isUnlimited
    ? "Pro"
    : user?.planType
      ? user.planType.charAt(0).toUpperCase() + user.planType.slice(1)
      : "Free";

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Profile card */}
        <div className="rounded-2xl border border-border/60 bg-card p-6 flex items-center gap-5 shadow-sm">
          {user?.pictureUrl ? (
            <img
              src={user.pictureUrl}
              alt={user.displayName ?? "User"}
              className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/20"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
              <User className="h-7 w-7 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">
              {user?.displayName ?? firstName}
            </h1>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            <div className="flex items-center gap-3 mt-2">
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  isUnlimited
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isUnlimited ? <Star className="h-3 w-3" /> : <Coins className="h-3 w-3" />}
                {planLabel} plan
              </span>
              {!isUnlimited && (
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{credits}</span> credits remaining
                </span>
              )}
            </div>
          </div>
          <Link href="/pricing">
            <Button variant="outline" size="sm" className="shrink-0">
              {isUnlimited ? "Manage plan" : "Upgrade"}
            </Button>
          </Link>
        </div>

        {/* History */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Comparison History</h2>
            </div>
            {data && !data.isPro && (
              <span className="text-xs text-muted-foreground">
                Showing last 5 · <Link href="/pricing" className="text-primary hover:underline">Upgrade for full history</Link>
              </span>
            )}
            {data?.isPro && (
              <span className="text-xs text-muted-foreground">
                Showing last {data.history.length} comparisons
              </span>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading history…
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive text-center">
              {error}
            </div>
          )}

          {!loading && !error && data?.history.length === 0 && (
            <div className="rounded-2xl border border-border/50 bg-card p-10 text-center space-y-3">
              <Clock className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-muted-foreground font-medium">No comparisons yet</p>
              <p className="text-sm text-muted-foreground/70">
                Ask your first question and your results will appear here.
              </p>
              <Link href="/">
                <Button size="sm" className="mt-2">Ask a question</Button>
              </Link>
            </div>
          )}

          {!loading && !error && data && data.history.length > 0 && (
            <div className="space-y-3">
              {data.history.map((entry) => {
                const winnerColor = entry.winner ? (MODEL_COLORS[entry.winner] ?? "#6366f1") : "#6366f1";
                return (
                  <Link key={entry.id} href={`/results/${entry.comparisonId}`}>
                    <div className="group rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:bg-accent/30 transition-all p-4 cursor-pointer">
                      <div className="flex items-start gap-3">
                        <div
                          className="mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${winnerColor}15` }}
                        >
                          <Trophy className="h-4 w-4" style={{ color: winnerColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                            {entry.question}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            {entry.winner && (
                              <span
                                className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: `${winnerColor}18`,
                                  color: winnerColor,
                                }}
                              >
                                {entry.winner} won
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {timeAgo(entry.createdAt)}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                      </div>
                    </div>
                  </Link>
                );
              })}

              {/* Upgrade prompt for free users with more history */}
              {!data.isPro && data.hasMore && (
                <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-5 text-center space-y-2">
                  <Lock className="h-5 w-5 text-muted-foreground/60 mx-auto" />
                  <p className="text-sm font-medium text-foreground">You have more history</p>
                  <p className="text-xs text-muted-foreground">
                    Upgrade to Pro to see all your past comparisons (up to 50).
                  </p>
                  <Link href="/pricing">
                    <Button size="sm" className="mt-1">
                      Upgrade to Pro
                    </Button>
                  </Link>
                </div>
              )}

              {/* Free users — always show the limit notice if exactly 5 */}
              {!data.isPro && !data.hasMore && data.history.length >= 5 && (
                <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    Free plan shows last 5 comparisons.{" "}
                    <Link href="/pricing" className="text-primary hover:underline font-medium">
                      Upgrade for full history →
                    </Link>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
