import { useEffect, useState, useRef, useCallback } from "react";
import { useSearch, useLocation } from "wouter";
import { saveResult } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Share2, Trophy, MessageSquareQuote, XCircle, Database,
  Stethoscope, AlertTriangle, Copy, ChevronRight, Zap, Clock, Hourglass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────────────────────────────

type Phase = "connecting" | "round1" | "round2" | "verdict" | "done" | "error";

type ModelCard = {
  key: string;
  displayName: string;
  color: string;
  cardPhase: "waiting" | "answered" | "critiqued";
  answer?: string;
  selfCriticism?: string;
  score?: number;
  accuracyScore?: number;
  selfAwarenessScore?: number;
  declined?: boolean;
  isGeneric?: boolean;
  responseTime?: number;   // seconds elapsed when round1 arrived
};

type VerdictPayload = {
  verdictDetails: {
    summary: string;
    bestAnswer: string;
    clearestAnswer: string;
    agreementPoints: string[];
    disagreementPoints: string[];
    overallWinner: string;
    explanation: string;
  };
  isMedical: boolean;
  physicianNote?: string;
  verdict: string;
};

// ─── Model stubs ─────────────────────────────────────────────────────────────

const MODEL_STUBS: Pick<ModelCard, "key" | "displayName" | "color">[] = [
  { key: "chatgpt",    displayName: "ChatGPT",           color: "#10A37F" },
  { key: "claude",     displayName: "Claude",             color: "#CC785C" },
  { key: "gemini",     displayName: "Gemini",             color: "#4285F4" },
  { key: "deepseek",   displayName: "DeepSeek",           color: "#7B68EE" },
  { key: "grok",       displayName: "Grok",               color: "#F97316" },
  { key: "mistral",    displayName: "Mistral Large",      color: "#EF4444" },
  { key: "llama",      displayName: "Llama 3.3 (Meta)",   color: "#1877F2" },
  { key: "perplexity", displayName: "Perplexity Sonar",   color: "#06B6D4" },
  { key: "cohere",     displayName: "Cohere Command R+",  color: "#22C55E" },
  { key: "qwen",       displayName: "Qwen 2.5 (Alibaba)", color: "#A855F7" },
];

const initialCards = (): ModelCard[] =>
  MODEL_STUBS.map((s) => ({ ...s, cardPhase: "waiting" }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function fmtSec(s: number) {
  return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`;
}

// Slowness threshold: top quartile of response time range is "slow"
function computeSpeedMeta(cards: ModelCard[]) {
  const responded = cards.filter((c) => c.responseTime != null);
  if (responded.length === 0) return { fastest: null, slowest: null, slowThreshold: Infinity };
  const times = responded.map((c) => c.responseTime!);
  const min = Math.min(...times);
  const max = Math.max(...times);
  return {
    fastest: responded.find((c) => c.responseTime === min) ?? null,
    slowest: responded.find((c) => c.responseTime === max) ?? null,
    slowThreshold: max - min > 3 ? min + (max - min) * 0.65 : Infinity,
  };
}

// ─── Timer badge ─────────────────────────────────────────────────────────────

function TimerBadge({ responseTime, isSlow }: { responseTime: number; isSlow: boolean }) {
  return (
    <div className={`flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
      isSlow
        ? "bg-orange-500/15 text-orange-400 border border-orange-500/20"
        : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
    }`}>
      {isSlow ? <Hourglass className="h-2.5 w-2.5" /> : <Zap className="h-2.5 w-2.5" />}
      {fmtSec(responseTime)}
    </div>
  );
}

// ─── Elapsed live timer (for waiting cards) ──────────────────────────────────

function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span className="text-[10px] font-mono text-muted-foreground/60">{elapsed}s</span>;
}

// ─── Speed leaderboard strip ─────────────────────────────────────────────────

function SpeedStrip({ cards }: { cards: ModelCard[] }) {
  const { fastest, slowest } = computeSpeedMeta(cards);
  if (!fastest || !slowest || fastest.key === slowest.key) return null;

  return (
    <div className="mb-6 flex items-center gap-4 flex-wrap px-4 py-3 rounded-xl border border-border/30 bg-card/30 text-sm">
      <span className="text-muted-foreground text-xs font-semibold uppercase tracking-widest shrink-0">Speed this round</span>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <Zap className="h-3 w-3 text-emerald-400" />
          <span className="text-xs font-semibold" style={{ color: fastest.color }}>
            {fastest.displayName}
          </span>
          <span className="text-[10px] font-mono text-emerald-400">{fmtSec(fastest.responseTime!)}</span>
        </div>
        <span className="text-muted-foreground/40 text-xs">vs</span>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
          <Hourglass className="h-3 w-3 text-orange-400" />
          <span className="text-xs font-semibold" style={{ color: slowest.color }}>
            {slowest.displayName}
          </span>
          <span className="text-[10px] font-mono text-orange-400">{fmtSec(slowest.responseTime!)}</span>
        </div>
      </div>
      <span className="text-[11px] text-muted-foreground">
        {(slowest.responseTime! / fastest.responseTime!).toFixed(1)}x speed difference
      </span>
    </div>
  );
}

// ─── Thinking card ────────────────────────────────────────────────────────────

function ThinkingCard({ card, streamStart }: { card: ModelCard; streamStart: number }) {
  const hex = card.color;
  const borderTint = hexToRgba(hex, 0.2);
  const bgTint = hexToRgba(hex, 0.05);

  return (
    <Card className="flex flex-col h-full bg-card/40" style={{ borderColor: borderTint }}>
      <CardHeader className="pb-3" style={{ borderBottom: `1px solid ${borderTint}`, background: bgTint }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: hex }} />
            <CardTitle className="font-serif text-base" style={{ color: hex }}>{card.displayName}</CardTitle>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground/60">
            <Clock className="h-3 w-3" />
            <ElapsedTimer startedAt={streamStart} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 flex-1">
        <div className="space-y-2.5">
          {[100, 88, 70, 85, 55].map((w, i) => (
            <div
              key={i}
              className="h-3 rounded-full animate-pulse bg-muted/50"
              style={{ width: `${w}%`, animationDelay: `${i * 0.12}s` }}
            />
          ))}
          <div className="mt-3 flex items-center gap-2 text-muted-foreground">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ backgroundColor: hex, animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <span className="text-xs" style={{ color: hex }}>Thinking...</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Answered card ────────────────────────────────────────────────────────────

function AnsweredCard({
  card, isSlow, showCritiqueSpinner, onCopy,
}: {
  card: ModelCard;
  isSlow: boolean;
  showCritiqueSpinner: boolean;
  onCopy: (text: string) => void;
}) {
  const hex = card.color;
  const borderTint = hexToRgba(hex, 0.2);
  const bgTint = hexToRgba(hex, 0.07);

  return (
    <Card
      className="flex flex-col h-full bg-card/40 animate-in fade-in slide-in-from-bottom-3 duration-500"
      style={{ borderColor: borderTint, opacity: isSlow ? 0.8 : 1 }}
    >
      <CardHeader className="pb-3" style={{ borderBottom: `1px solid ${borderTint}`, background: bgTint }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
            <CardTitle className="font-serif text-base" style={{ color: hex }}>{card.displayName}</CardTitle>
            {isSlow && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 uppercase tracking-wide">
                slower
              </span>
            )}
          </div>
          {card.responseTime != null && (
            <TimerBadge responseTime={card.responseTime} isSlow={isSlow} />
          )}
        </div>
        {card.isGeneric && (
          <div className="mt-2 flex items-start gap-1.5 text-amber-400">
            <Database className="h-3 w-3 shrink-0 mt-0.5" />
            <span className="text-[10px] font-semibold">Response may be cached — not specific to this question</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-4 flex-1 space-y-3">
        <div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-background shrink-0" style={{ backgroundColor: hex }}>1</span>
            Round 1: Initial Answer
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">{card.answer}</p>
        </div>
        {showCritiqueSpinner && (
          <div className="rounded-xl p-3 border border-muted/30 bg-muted/10">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1 h-1 rounded-full animate-bounce bg-current" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-[11px]">Loading self-critique...</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Full card (both rounds visible) ─────────────────────────────────────────

function FullCard({
  card, rank, question, isSlow, onCopy,
}: {
  card: ModelCard;
  rank: number;
  question: string;
  isSlow: boolean;
  onCopy: (text: string) => void;
}) {
  const hex = card.color;
  const borderTint = hexToRgba(hex, 0.2);
  const bgTint = hexToRgba(hex, 0.07);

  return (
    <Card
      className="flex flex-col h-full bg-card/40 animate-in fade-in duration-400"
      style={{ borderColor: borderTint, opacity: isSlow ? 0.85 : 1 }}
    >
      <CardHeader className="pb-3" style={{ borderBottom: `1px solid ${borderTint}`, background: bgTint }}>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
            <CardTitle className="font-serif text-base leading-tight" style={{ color: hex }}>{card.displayName}</CardTitle>
            {rank === 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">WINNER</span>}
            {isSlow && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 uppercase tracking-wide">
                slower
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {card.responseTime != null && (
              <TimerBadge responseTime={card.responseTime} isSlow={isSlow} />
            )}
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Score</div>
              <div className="font-mono text-xl font-bold leading-none" style={{ color: hex }}>{card.score?.toFixed(1)}</div>
            </div>
          </div>
        </div>
        <div className="mt-2.5 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-20 shrink-0">Accuracy</span>
            <div className="flex-1 h-1 rounded-full bg-border/40 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${((card.accuracyScore ?? 0) / 10) * 100}%`, backgroundColor: hex }} />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{card.accuracyScore?.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-20 shrink-0">Self-Awareness</span>
            <div className="flex-1 h-1 rounded-full bg-border/40 overflow-hidden">
              <div className="h-full rounded-full opacity-70 transition-all duration-700" style={{ width: `${((card.selfAwarenessScore ?? 0) / 10) * 100}%`, backgroundColor: hex }} />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{card.selfAwarenessScore?.toFixed(1)}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 flex-1 space-y-4">
        <div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-background shrink-0" style={{ backgroundColor: hex }}>1</span>
            Round 1: Initial Answer
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">{card.answer}</p>
        </div>

        {card.isGeneric && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400">
            <Database className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="text-[11px] font-semibold leading-snug">Response may be cached — not specific to this question</span>
          </div>
        )}

        <div className="rounded-xl p-3.5 animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ border: `1px solid ${borderTint}`, backgroundColor: bgTint }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5" style={{ color: hex }}>
            <MessageSquareQuote className="h-3 w-3 shrink-0" />
            Round 2: Selfbeat Analysis
          </div>
          {card.declined ? (
            <div className="flex items-start gap-2 mt-1">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
              <div>
                <p className="text-sm font-semibold text-rose-400 leading-snug">This AI declined to self-evaluate on this question</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">This is a finding, not an error — it tells you something important about how this model handles self-evaluation.</p>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed italic text-foreground/80">"{card.selfCriticism}"</p>
          )}
        </div>
      </CardContent>

      <div className="px-4 pb-4 pt-2 border-t border-border/30 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCopy(`Prompt: ${question}\n\n${card.displayName} Answer:\n${card.answer ?? ""}\n\nSelf-Critique:\n${card.selfCriticism ?? ""}`)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          <Copy className="h-3 w-3 mr-2" />
          Copy
        </Button>
      </div>
    </Card>
  );
}

// ─── CTA banner: "See how AIs judge themselves" ───────────────────────────────

function Round2CTA({
  critiquedCount,
  onReveal,
}: {
  critiquedCount: number;
  onReveal: () => void;
}) {
  const allLoaded = critiquedCount === 10;

  return (
    <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-600">
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card to-primary/5 p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">Round 1 Complete</div>
            <h2 className="text-lg md:text-xl font-serif font-bold text-foreground">
              All 10 AIs have answered. Now watch them judge themselves.
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {allLoaded
                ? "Self-critiques are ready — reveal instantly."
                : `Loading self-critiques in background… ${critiquedCount}/10 ready`}
            </p>
          </div>
          <Button
            size="lg"
            onClick={onReveal}
            className="shrink-0 gap-2 font-semibold px-6 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-shadow"
          >
            {!allLoaded && critiquedCount > 0 && (
              <span className="text-xs font-mono opacity-70">{critiquedCount}/10</span>
            )}
            See how AIs judge themselves
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {!allLoaded && (
          <div className="mt-4 h-1 rounded-full bg-border/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary/50 transition-all duration-500"
              style={{ width: `${(critiquedCount / 10) * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StreamingResults() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const params = new URLSearchParams(search);
  const question = params.get("q") ?? "";

  const [phase, setPhase] = useState<Phase>("connecting");
  const [cards, setCards] = useState<ModelCard[]>(initialCards);
  const [verdict, setVerdict] = useState<VerdictPayload | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRound2, setShowRound2] = useState(false);

  const streamStartRef = useRef<number>(Date.now());
  const round2DataRef = useRef<ModelCard[]>([]);
  const verdictRef = useRef<VerdictPayload | null>(null);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard", duration: 2000 });
  }, [toast]);

  useEffect(() => {
    if (!question.trim()) {
      setLocation("/");
      return;
    }

    streamStartRef.current = Date.now();
    const controller = new AbortController();

    async function run() {
      try {
        const response = await fetch("/api/selfbeat/comparisons/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: question.trim(), mode: "live" }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Server responded with ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";

          for (const part of parts) {
            const lines = part.split("\n");
            const eLine = lines.find((l) => l.startsWith("event:"));
            const dLine = lines.find((l) => l.startsWith("data:"));
            if (!eLine || !dLine) continue;

            const ev = eLine.slice(7).trim();
            let data: Record<string, unknown>;
            try {
              data = JSON.parse(dLine.slice(5).trim()) as Record<string, unknown>;
            } catch { continue; }

            switch (ev) {
              case "cached":
                setIsCached(true);
                // For cached replays, auto-show round2 since it's all instant
                setShowRound2(true);
                break;

              case "status": {
                const p = data.phase as string;
                if (p === "round1") setPhase("round1");
                else if (p === "round2") setPhase("round2");
                else if (p === "verdict") setPhase("verdict");
                break;
              }

              case "round1": {
                const elapsed = (Date.now() - streamStartRef.current) / 1000;
                setPhase("round1");
                setCards((prev) =>
                  prev.map((c) =>
                    c.key === data.model
                      ? {
                          ...c,
                          cardPhase: "answered",
                          answer: data.answer as string,
                          isGeneric: data.isGeneric as boolean,
                          responseTime: elapsed,
                        }
                      : c,
                  ),
                );
                break;
              }

              case "round2":
                setCards((prev) => {
                  const next = prev.map((c) =>
                    c.key === data.model
                      ? {
                          ...c,
                          cardPhase: "critiqued" as const,
                          selfCriticism: data.selfCriticism as string,
                          score: data.score as number,
                          accuracyScore: data.accuracyScore as number,
                          selfAwarenessScore: data.selfAwarenessScore as number,
                          declined: data.declined as boolean,
                          isGeneric: data.isGeneric as boolean,
                        }
                      : c,
                  );
                  round2DataRef.current = next;
                  return next;
                });
                break;

              case "verdict": {
                const v = data as unknown as VerdictPayload;
                verdictRef.current = v;
                setVerdict(v);
                setPhase("verdict");
                break;
              }

              case "done": {
                setPhase("done");
                const id = data.id as string;

                const finalCards = round2DataRef.current;
                const finalVerdict = verdictRef.current;
                if (finalCards.length > 0 && finalVerdict) {
                  const sorted = [...finalCards].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
                  const compResult = {
                    id,
                    question: question.trim(),
                    timestamp: Date.now(),
                    responses: sorted.map((c) => ({
                      model: c.key,
                      displayName: c.displayName,
                      color: c.color,
                      answer: c.answer ?? "",
                      selfCriticism: c.selfCriticism ?? "",
                      score: c.score ?? 0,
                      accuracyScore: c.accuracyScore ?? 0,
                      selfAwarenessScore: c.selfAwarenessScore ?? 0,
                      status: "success" as const,
                      declined: c.declined,
                      isGeneric: c.isGeneric,
                    })),
                    verdict: finalVerdict.verdict,
                    verdictDetails: finalVerdict.verdictDetails,
                    isMedical: finalVerdict.isMedical,
                    physicianNote: finalVerdict.physicianNote,
                    source: "live" as const,
                    cached: false,
                    providerStatuses: [],
                  };
                  try { saveResult(compResult); } catch {}
                }

                setLocation(`/results/${id}`, { replace: true });
                break;
              }

              case "error":
                setPhase("error");
                setErrorMessage((data.message as string) ?? "An error occurred.");
                break;
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setPhase("error");
        setErrorMessage("Could not connect to the comparison server. Please try again.");
      }
    }

    run();
    return () => controller.abort();
  }, [question]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const answeredCount = cards.filter((c) => c.cardPhase !== "waiting").length;
  const critiquedCount = cards.filter((c) => c.cardPhase === "critiqued").length;
  const round1AllDone = answeredCount === 10;

  const { slowThreshold } = computeSpeedMeta(cards);

  // Sort critiqued cards by score for final verdict view
  const sortedCards = [...cards].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const winnerCard = sortedCards.find((c) => c.cardPhase === "critiqued");

  // Card render order: if verdict arrived, sort by score; otherwise preserve submission order
  const displayCards = verdict ? sortedCards : cards;

  if (phase === "error") {
    return (
      <div className="container py-20 max-w-2xl text-center space-y-4">
        <p className="text-destructive font-semibold text-lg">{errorMessage}</p>
        <Button onClick={() => setLocation("/")}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-[1400px] animate-in fade-in duration-400">

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="text-sm font-mono text-muted-foreground mb-2 flex items-center gap-2 flex-wrap">
            {isCached && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">Cached result</span>}
            <span>{answeredCount}/10 answered</span>
            {showRound2 && (
              <>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span>{critiquedCount}/10 self-critiqued</span>
              </>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground leading-tight max-w-3xl">
            "{question}"
          </h1>
        </div>
        <Button
          variant="outline"
          onClick={() => { navigator.clipboard.writeText(window.location.href); toast({ title: "Link copied!", duration: 2000 }); }}
          className="shrink-0 group"
        >
          <Share2 className="mr-2 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          Share
        </Button>
      </div>

      {/* Round 1 progress bar — hidden once all answered */}
      {!round1AllDone && (
        <div className="mb-8 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {phase === "connecting" ? "Connecting to 10 AI models..." : "Round 1: querying all 10 models simultaneously..."}
            </span>
            <span className="text-primary font-mono text-xs">{answeredCount}/10</span>
          </div>
          <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: phase === "connecting" ? "2%" : `${5 + (answeredCount / 10) * 90}%` }}
            />
          </div>
        </div>
      )}

      {/* Speed strip — after all round 1 done */}
      {round1AllDone && <SpeedStrip cards={cards} />}

      {/* Round 2 CTA — after all answered, before user clicks reveal */}
      {round1AllDone && !showRound2 && (
        <Round2CTA critiquedCount={critiquedCount} onReveal={() => setShowRound2(true)} />
      )}

      {/* Round 2 progress (after reveal, while still loading) */}
      {showRound2 && critiquedCount < 10 && phase !== "done" && (
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {phase === "verdict" ? "Calculating final verdict..." : "Round 2: AIs examining each other..."}
            </span>
            <span className="text-primary font-mono text-xs">{critiquedCount}/10</span>
          </div>
          <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: phase === "verdict" ? "95%" : `${(critiquedCount / 10) * 90}%` }}
            />
          </div>
        </div>
      )}

      {/* Physician note */}
      {verdict?.isMedical && verdict.physicianNote && (
        <div className="mb-8 p-5 rounded-xl border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-full bg-amber-500/20 text-amber-400 shrink-0">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-amber-400 mb-1.5 flex items-center gap-2">
                Physician Perspective — AI Generated <AlertTriangle className="h-3.5 w-3.5" />
              </h3>
              <p className="text-foreground/80 leading-relaxed text-sm">{verdict.physicianNote}</p>
            </div>
          </div>
        </div>
      )}

      {/* Final Verdict */}
      {verdict && showRound2 && (
        <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-600">
          <Card className="border-primary/40 bg-card shadow-lg shadow-primary/5">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
              <div className="flex items-center gap-3">
                <Trophy className="h-6 w-6 text-primary" />
                <CardTitle className="font-serif text-2xl">Final Verdict</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-lg leading-relaxed text-foreground/90">{verdict.verdictDetails.summary}</p>
              <div className="pt-4 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Score Ranking</div>
                  <div className="space-y-2">
                    {sortedCards.filter((c) => c.score !== undefined).map((c, i) => (
                      <div key={c.key} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                        <span className="text-xs font-semibold w-28 shrink-0 truncate" style={{ color: c.color }}>{c.displayName}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-border/40 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${((c.score ?? 0) / 10) * 100}%`, backgroundColor: c.color }} />
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground w-7 text-right shrink-0">{c.score?.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  {verdict.verdictDetails.agreementPoints?.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Where They Agreed</div>
                      <ul className="space-y-1">
                        {verdict.verdictDetails.agreementPoints.map((pt, i) => (
                          <li key={i} className="text-sm text-foreground/70 flex items-start gap-2">
                            <span className="text-emerald-500 mt-0.5 shrink-0">+</span><span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {verdict.verdictDetails.disagreementPoints?.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Where They Differed</div>
                      <ul className="space-y-1">
                        {verdict.verdictDetails.disagreementPoints.map((pt, i) => (
                          <li key={i} className="text-sm text-foreground/70 flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5 shrink-0">~</span><span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {winnerCard && (
                    <div className="pt-3 border-t border-border/40">
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Overall Winner</div>
                      <div className="text-base font-bold" style={{ color: winnerCard.color }}>{winnerCard.displayName}</div>
                      <p className="text-xs text-muted-foreground mt-1">{verdict.verdictDetails.explanation}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Model cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {displayCards.map((card, i) => {
          const isSlow = (card.responseTime ?? 0) > slowThreshold;

          // Waiting: skeleton
          if (card.cardPhase === "waiting") {
            return <ThinkingCard key={card.key} card={card} streamStart={streamStartRef.current} />;
          }

          // Critiqued + round2 revealed: show full card
          if (card.cardPhase === "critiqued" && showRound2) {
            const critiquedSorted = displayCards.filter((c) => c.cardPhase === "critiqued");
            const rank = critiquedSorted.findIndex((c) => c.key === card.key);
            return (
              <FullCard key={card.key} card={card} rank={rank} question={question} isSlow={isSlow} onCopy={handleCopy} />
            );
          }

          // Answered or critiqued-but-hidden
          return (
            <AnsweredCard
              key={card.key}
              card={card}
              isSlow={isSlow}
              showCritiqueSpinner={showRound2 && card.cardPhase === "answered"}
              onCopy={handleCopy}
            />
          );
        })}
      </div>
    </div>
  );
}
