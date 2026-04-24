import { useEffect, useState, useRef, useCallback } from "react";
import { useSearch, useLocation } from "wouter";
import { saveResult } from "@/lib/store";
import { useLanguage } from "@/lib/language-context";
import { useCredits } from "@/lib/credits-context";
import { useAppAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Share2, Trophy, MessageSquareQuote, XCircle, Database, X,
  Stethoscope, AlertTriangle, Copy, ChevronRight, Zap, Clock, Hourglass, Square, Lock,
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
  const { t } = useLanguage();
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
      </CardHeader>
      <CardContent className="pt-4 flex-1 space-y-3">
        <div className="rounded-xl p-3.5 bg-muted/10 border border-muted/30">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-background shrink-0" style={{ backgroundColor: hex }}>1</span>
            {t("round1Label")}
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">{card.answer}</p>
          {card.isGeneric && (
            <div className="flex items-start gap-2 mt-2 pt-2 border-t border-amber-500/20">
              <Database className="h-3 w-3 shrink-0 mt-0.5 text-amber-400" />
              <span className="text-[10px] font-semibold text-amber-400 leading-snug">Response may be cached — not specific to this question</span>
            </div>
          )}
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
      <div className="px-4 pb-3 pt-2 border-t border-border/30 flex justify-end">
        <CardShareButton aiName={card.displayName} answer={card.answer} />
      </div>
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
  const { t } = useLanguage();
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

      <CardContent className="pt-4 flex-1 space-y-3">
        {/* Answer box */}
        <div className="rounded-xl p-3.5 bg-muted/10 border border-muted/30">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-background shrink-0" style={{ backgroundColor: hex }}>1</span>
            {t("round1Label")}
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">{card.answer}</p>
          {card.isGeneric && (
            <div className="flex items-start gap-2 mt-2 pt-2 border-t border-amber-500/20">
              <Database className="h-3 w-3 shrink-0 mt-0.5 text-amber-400" />
              <span className="text-[10px] font-semibold text-amber-400 leading-snug">Response may be cached — not specific to this question</span>
            </div>
          )}
        </div>

        {/* Self-Critique box */}
        <div className="rounded-xl p-3.5 animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ border: `1px solid ${borderTint}`, backgroundColor: bgTint }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: hex }}>
            <MessageSquareQuote className="h-3 w-3 shrink-0" />
            {t("round2Label")}
          </div>
          {card.declined ? (
            <div className="flex items-start gap-2">
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
        <CardShareButton aiName={card.displayName} answer={card.answer} selfCriticism={card.selfCriticism} />
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
              All 11 AIs have answered. Now watch them judge themselves.
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

// ─── Share ────────────────────────────────────────────────────────────────────

const SHARE_URL = "https://selfbeat.ai";

interface SharePlatform {
  id: string;
  label: string;
  bg: string;
  icon: React.ReactNode;
  href: (text: string) => string;
}

const PLATFORMS: SharePlatform[] = [
  {
    id: "x", label: "X (Twitter)", bg: "#000000",
    href: (text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.631L18.244 2.25zM17.083 19.77h1.833L7.084 4.126H5.117L17.083 19.77z" /></svg>,
  },
  {
    id: "reddit", label: "Reddit", bg: "#FF4500",
    href: () => `https://reddit.com/submit?url=${encodeURIComponent(SHARE_URL)}&title=${encodeURIComponent("AI judged itself on Selfbeat — the result was surprising!")}`,
    icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" /></svg>,
  },
  {
    id: "linkedin", label: "LinkedIn", bg: "#0077B5",
    href: () => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SHARE_URL)}`,
    icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>,
  },
  {
    id: "whatsapp", label: "WhatsApp", bg: "#25D366",
    href: (text) => `https://wa.me/?text=${encodeURIComponent(text)}`,
    icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" /></svg>,
  },
  {
    id: "facebook", label: "Facebook", bg: "#1877F2",
    href: () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_URL)}`,
    icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>,
  },
];

// ─── Share modal (used by both per-card and full-results buttons) ──────────────

function ShareModal({
  isOpen, onClose, shareText, copyText, heading,
}: {
  isOpen: boolean;
  onClose: () => void;
  shareText: string;
  copyText: string;
  heading: string;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onMouse = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePlatform = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer,width=620,height=520");
    onClose();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => { setCopied(false); onClose(); }, 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={heading}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={modalRef}
        className="relative w-full max-w-xs rounded-2xl border border-border bg-card shadow-2xl p-5 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-foreground">{heading}</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors rounded-md p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePlatform(p.href(shareText))}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-accent transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span
                className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 text-white"
                style={{ backgroundColor: p.bg }}
              >
                {p.icon}
              </span>
              <span className="text-foreground">{p.label}</span>
            </button>
          ))}

          <div className="border-t border-border/40 pt-1.5 mt-0.5">
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-accent transition-colors text-left text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-muted shrink-0">
                <Copy className="h-3.5 w-3.5" />
              </span>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Per-card share button ────────────────────────────────────────────────────

function CardShareButton({ aiName, answer, selfCriticism }: {
  aiName: string;
  answer?: string;
  selfCriticism?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const shareText = `I just saw this AI answer on Selfbeat — and then judge itself! Try it free at selfbeat.ai`;
  const copyText = [
    `${aiName} on Selfbeat:`,
    "",
    answer ?? "",
    selfCriticism ? `\nSelf-critique:\n${selfCriticism}` : "",
    `\nTry it free: ${SHARE_URL}`,
  ].join("\n");

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-foreground h-7 px-2 gap-1.5"
        aria-label={`Share ${aiName}'s answer`}
      >
        <Share2 className="h-3 w-3" />
        Share
      </Button>
      <ShareModal
        isOpen={open}
        onClose={close}
        shareText={shareText}
        copyText={copyText}
        heading={`Share ${aiName}'s Answer`}
      />
    </>
  );
}

// ─── Full-results share button ────────────────────────────────────────────────

function ShareResultButton() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const shareText = `I just made AIs judge themselves on Selfbeat and the results were wild! See which AI won 👀 Try it free at selfbeat.ai`;
  const copyText = `${shareText}\n\n${SHARE_URL}`;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        className="gap-2 h-10 border-primary/40 hover:border-primary/70 hover:bg-primary/5"
      >
        <Share2 className="h-4 w-4 text-primary" />
        Share Results
      </Button>
      <ShareModal
        isOpen={open}
        onClose={close}
        shareText={shareText}
        copyText={copyText}
        heading="Share Results"
      />
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StreamingResults() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const params = new URLSearchParams(search);
  const question = params.get("q") ?? "";

  const { t, lang } = useLanguage();
  const { isSignedIn } = useAppAuth();
  const { deductCredit } = useCredits();
  const [phase, setPhase] = useState<Phase>("connecting");
  const [cards, setCards] = useState<ModelCard[]>(initialCards);
  const [verdict, setVerdict] = useState<VerdictPayload | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRound2, setShowRound2] = useState(false);
  const [isLimited, setIsLimited] = useState(false);

  const streamStartRef = useRef<number>(Date.now());
  const round2DataRef = useRef<ModelCard[]>([]);
  const verdictRef = useRef<VerdictPayload | null>(null);
  const streamControllerRef = useRef<AbortController | null>(null);

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
    streamControllerRef.current = controller;

    async function run() {
      try {
        const response = await fetch("/api/selfbeat/comparisons/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: question.trim(), mode: "live", lang }),
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
              case "meta":
                if (data.limited) {
                  setIsLimited(true);
                } else {
                  // Full comparison — will use 1 credit
                  deductCredit();
                }
                break;

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

                // Limited result — show upgrade overlay, don't redirect
                if (data.limited) {
                  setIsLimited(true);
                  break;
                }

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
  const round1AllDone = answeredCount === cards.length && cards.length > 0;

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
            <span>{answeredCount}/{cards.length || 11} answered</span>
            {showRound2 && (
              <>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span>{critiquedCount}/{cards.length || 11} self-critiqued</span>
              </>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground leading-tight max-w-3xl">
            "{question}"
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {phase !== "done" && (
            <Button
              onClick={() => {
                streamControllerRef.current?.abort();
                setLocation("/");
              }}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-lg shadow-rose-600/30 border-0 gap-2"
              aria-label="Stop searching and go home"
            >
              <Square className="h-4 w-4 fill-white" aria-hidden="true" />
              {t("stopSearch")}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => { navigator.clipboard.writeText(SHARE_URL); toast({ title: "Link copied!", duration: 2000 }); }}
            className="group"
          >
            <Share2 className="mr-2 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            Share
          </Button>
        </div>
      </div>

      {/* Round 1 progress bar — hidden once all answered */}
      {!round1AllDone && (
        <div className="mb-8 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {phase === "connecting" ? "Connecting to 11 AI models..." : "Round 1: querying all 11 models simultaneously..."}
            </span>
            <span className="text-primary font-mono text-xs">{answeredCount}/11</span>
          </div>
          <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: phase === "connecting" ? "2%" : `${5 + (answeredCount / (cards.length || 11)) * 90}%` }}
            />
          </div>
        </div>
      )}

      {/* Speed strip — after all round 1 done */}
      {round1AllDone && <SpeedStrip cards={cards} />}

      {/* Upgrade gate — shown after Round 1 completes when user has no credits */}
      {round1AllDone && isLimited && phase === "done" && (
        <div className="my-8 relative">
          {/* Blurred preview of Round 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 blur-md pointer-events-none select-none opacity-60" aria-hidden="true">
            {cards.map((card) => (
              <div key={card.key} className="rounded-xl border border-border/30 bg-card p-4 min-h-[160px]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: card.color }} />
                  <span className="font-semibold text-sm" style={{ color: card.color }}>{card.displayName}</span>
                </div>
                <div className="space-y-2">
                  {[90, 75, 60, 80].map((w, i) => (
                    <div key={i} className="h-2.5 rounded-full bg-muted/60" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/70 backdrop-blur-sm rounded-2xl">
            <div className="text-center max-w-md px-6 py-10">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 border border-primary/20 mx-auto mb-4">
                <Lock className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                {t("upgrade_to_unlock") ?? "Subscribe to see AIs judge themselves"}
              </h2>
              <p className="text-sm text-muted-foreground mb-1 leading-relaxed">
                {t("upgrade_description") ?? "You've used all your free comparisons. Upgrade to unlock Round 2 self-critiques, scores, and the final verdict."}
              </p>
              <div className="flex flex-col gap-1 text-xs text-muted-foreground mb-6">
                <span>Starter Credits: <strong className="text-foreground">$4.99</strong> for 25 comparisons</span>
                <span>Pro Monthly: <strong className="text-foreground">$9.99/month</strong> unlimited</span>
                <span>Pro Annual: <strong className="text-amber-500 font-bold">$79/year</strong> — Save 34% vs monthly</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={() => setLocation("/pricing")}
                  className="font-semibold bg-amber-400 hover:bg-amber-300 text-amber-950 border-0"
                >
                  {t("see_plans") ?? "See all plans"}
                </Button>
                {!isSignedIn && (
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/sign-in")}
                  >
                    {t("sign_in") ?? "Sign in"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share button — limited users (round 1 done, no credits) */}
      {round1AllDone && isLimited && phase === "done" && (
        <div className="flex flex-col items-center gap-2 mb-8 animate-in fade-in duration-500">
          <p className="text-xs text-muted-foreground">Enjoyed the result? Spread the word.</p>
          <ShareResultButton />
        </div>
      )}

      {/* Round 2 CTA — after all answered, before user clicks reveal */}
      {round1AllDone && !showRound2 && !isLimited && (
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
      {!isLimited && verdict?.isMedical && verdict.physicianNote && (
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
      {!isLimited && verdict && showRound2 && (
        <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-600">
          <Card className="border-primary/40 bg-card shadow-lg shadow-primary/5">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
              <div className="flex items-center gap-3">
                <Trophy className="h-6 w-6 text-primary" />
                <CardTitle className="font-serif text-2xl">{t("verdictLabel")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-lg leading-relaxed text-foreground/90">{verdict.verdictDetails.summary}</p>

              {/* Winner answer spotlight */}
              {winnerCard?.answer && (() => {
                const hex = winnerCard.color;
                return (
                  <div className="relative overflow-hidden rounded-2xl border-2 p-5 animate-in fade-in duration-500"
                    style={{ borderColor: hex + "55", background: `linear-gradient(135deg, ${hex}10 0%, transparent 60%)` }}>
                    <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-30" style={{ backgroundColor: hex }} />
                    <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-20" style={{ backgroundColor: hex }} />
                    <div className="relative">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full shadow-lg"
                          style={{ backgroundColor: hex + "25", border: `1px solid ${hex}40` }}>
                          <Trophy className="h-4 w-4" style={{ color: hex }} />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("winner")}</div>
                          <div className="text-sm font-bold leading-none" style={{ color: hex }}>
                            {winnerCard.displayName}
                            <span className="ml-2 text-[10px] font-mono opacity-70">{winnerCard.score?.toFixed(1)}/10</span>
                          </div>
                        </div>
                      </div>
                      <blockquote className="text-sm leading-relaxed text-foreground/90 pl-4"
                        style={{ borderLeft: `3px solid ${hex}80` }}>
                        {winnerCard.answer}
                      </blockquote>
                    </div>
                  </div>
                );
              })()}

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

      {/* Share button — full result (verdict shown) */}
      {!isLimited && verdict && showRound2 && phase === "done" && (
        <div className="flex flex-col items-center gap-2 mb-8 animate-in fade-in duration-700">
          <p className="text-xs text-muted-foreground">Enjoyed the verdict? Spread the word.</p>
          <ShareResultButton />
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
