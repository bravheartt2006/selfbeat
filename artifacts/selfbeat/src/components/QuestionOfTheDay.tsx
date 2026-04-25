import { useState, useEffect, useCallback } from "react";
import { Flame, Users, Timer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useAppAuth } from "@/lib/auth-context";

interface DailyQuestionData {
  questionId: number;
  question: string;
  runCount: number;
  userHasRunToday: boolean;
  nextResetMs: number;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export default function QuestionOfTheDay() {
  const { isSignedIn } = useAppAuth();
  const [, setLocation] = useLocation();
  const [data, setData] = useState<DailyQuestionData | null>(null);
  const [msLeft, setMsLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [alreadyRun, setAlreadyRun] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/daily-question");
      if (res.ok) {
        const d: DailyQuestionData = await res.json();
        setData(d);
        setMsLeft(d.nextResetMs);
        if (d.userHasRunToday) setAlreadyRun(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (msLeft <= 0) return;
    const id = setInterval(() => {
      setMsLeft((prev) => {
        if (prev <= 1000) {
          fetchData();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [msLeft, fetchData]);

  const handleRun = async () => {
    if (!isSignedIn) {
      setLocation("/sign-in");
      return;
    }
    if (!data || isRunning) return;
    setIsRunning(true);
    try {
      const res = await fetch("/api/daily-question/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const result = await res.json();
        setAlreadyRun(true);
        if (!result.alreadyRun) {
          setLocation(`/stream?q=${encodeURIComponent(data.question)}&free=1`);
        }
      }
    } finally {
      setIsRunning(false);
    }
  };

  if (!data) return null;

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-600">
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/8 via-card/80 to-card/50 shadow-xl shadow-amber-500/5">
        {/* Decorative glows */}
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-amber-500/8 blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

        <div className="relative px-5 py-4 md:px-6 md:py-5">
          {/* Top row: badges + timer */}
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30">
                <Flame className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
                  Question of the Day
                </span>
              </div>
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-wide">
                <Sparkles className="h-2.5 w-2.5 shrink-0" />
                Free today
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <Timer className="h-3 w-3 shrink-0" />
              <span className="hidden sm:inline">Resets in:</span>
              <span className="font-mono font-bold text-foreground/80 tabular-nums">
                {formatCountdown(msLeft)}
              </span>
            </div>
          </div>

          {/* Question text */}
          <p className="text-lg md:text-2xl font-serif font-semibold leading-snug text-foreground mb-4 pr-2">
            {data.question}
          </p>

          {/* Bottom row: run count + CTA */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-semibold text-foreground/80">
                  {data.runCount.toLocaleString()}
                </span>{" "}
                people ran this today
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {alreadyRun ? (
                <>
                  <span className="text-xs text-muted-foreground italic hidden sm:inline">
                    Come back tomorrow for a new question!
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs border-border/50"
                    onClick={() => setLocation("/pricing")}
                  >
                    Ask your own →
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={handleRun}
                  disabled={isRunning}
                  className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold border-0 shadow-md shadow-amber-500/30 transition-all hover:scale-105 active:scale-95 px-5"
                >
                  {isRunning
                    ? "Starting…"
                    : isSignedIn
                      ? "See Today's Battle →"
                      : "Sign in to run free →"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
