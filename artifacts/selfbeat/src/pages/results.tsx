import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { getResult, ComparisonResult } from "@/lib/store";
import { getSelfbeatComparison } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Copy, Share2, Stethoscope, Trophy, AlertTriangle, MessageSquareQuote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ModelKey = "chatgpt" | "claude" | "gemini" | "deepseek" | "grok" | "mistral" | "llama" | "perplexity" | "cohere" | "qwen";

const MODEL_META: Record<ModelKey, { name: string; color: string }> = {
  chatgpt:    { name: "ChatGPT",           color: "#10A37F" },
  claude:     { name: "Claude",            color: "#CC785C" },
  gemini:     { name: "Gemini",            color: "#4285F4" },
  deepseek:   { name: "DeepSeek",          color: "#7B68EE" },
  grok:       { name: "Grok",              color: "#F97316" },
  mistral:    { name: "Mistral Large",     color: "#EF4444" },
  llama:      { name: "Llama 3.3 (Meta)",  color: "#1877F2" },
  perplexity: { name: "Perplexity Sonar",  color: "#06B6D4" },
  cohere:     { name: "Cohere Command R+", color: "#22C55E" },
  qwen:       { name: "Qwen 2.5",          color: "#A855F7" },
};

function getModelMeta(key: string) {
  return MODEL_META[key as ModelKey] ?? { name: key, color: "#888888" };
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 rounded-full bg-border/40 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${(score / 10) * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-8 text-right">{score.toFixed(1)}</span>
    </div>
  );
}

export default function Results() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (id) {
      getSelfbeatComparison(id)
        .then((data) => { if (active) setResult(data); })
        .catch(() => {
          const data = getResult(id);
          if (data && active) {
            setResult(data);
            setLoadError("Loaded from local cache — server result was not available.");
            return;
          }
          setLocation("/");
        });
    }
    return () => { active = false; };
  }, [id, setLocation]);

  if (!result) {
    return (
      <div className="container py-20 max-w-3xl text-center">
        <div className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-primary/10 border border-primary/20 text-primary">
          <AlertCircle className="h-4 w-4 animate-pulse" />
          <span className="font-medium">Loading Selfbeat comparison...</span>
        </div>
      </div>
    );
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard", description: "Response text copied.", duration: 2000 });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link copied!", description: "Share this comparison with others.", duration: 2000 });
  };

  const sortedResponses = [...result.responses].sort((a, b) => b.score - a.score);
  const winner = sortedResponses[0];

  return (
    <div className="container py-8 max-w-[1400px] animate-in fade-in duration-500">

      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-border/40 pb-6">
        <div>
          <div className="text-sm font-mono text-muted-foreground mb-2 flex items-center gap-2 flex-wrap">
            <span>ID: {result.id}</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>{new Date(result.timestamp).toLocaleDateString()}</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>{result.source === "live" ? "Live AI" : result.source === "mixed" ? "Mixed" : "Mock"}</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>{result.responses.length} models</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground leading-tight">
            "{result.question}"
          </h1>
        </div>
        <Button variant="outline" onClick={handleShare} className="shrink-0 group">
          <Share2 className="mr-2 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          Share Results
        </Button>
      </div>

      {loadError && (
        <div className="mb-8 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 text-sm text-foreground/80">
          {loadError}
        </div>
      )}

      {/* Physician Note */}
      {result.isMedical && result.physicianNote && (
        <div className="mb-10 p-6 rounded-xl border border-amber-500/30 bg-amber-500/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="flex items-start gap-4 relative z-10">
            <div className="p-3 rounded-full bg-amber-500/20 text-amber-400 shrink-0">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-amber-400 mb-2 flex items-center gap-2">
                Physician Perspective — AI Generated <AlertTriangle className="h-4 w-4" />
              </h3>
              <p className="text-foreground/80 leading-relaxed">{result.physicianNote}</p>
            </div>
          </div>
        </div>
      )}

      {/* Final Verdict */}
      <div className="mb-12">
        <Card className="border-primary/40 bg-card shadow-lg shadow-primary/5">
          <CardHeader className="bg-primary/5 border-b border-primary/10">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-primary" />
              <CardTitle className="font-serif text-2xl">Final Verdict</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <p className="text-lg leading-relaxed text-foreground/90">
              {result.verdictDetails?.summary ?? result.verdict}
            </p>
            {result.verdictDetails && (
              <div className="pt-4 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Score comparison */}
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Score Ranking</div>
                  <div className="space-y-2.5">
                    {sortedResponses.map((res, i) => {
                      const meta = getModelMeta(res.model);
                      return (
                        <div key={res.model} className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                          <span className="text-xs font-semibold w-28 shrink-0 truncate" style={{ color: meta.color }}>
                            {res.displayName || meta.name}
                          </span>
                          <div className="flex-1 h-1.5 rounded-full bg-border/40 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(res.score / 10) * 100}%`, backgroundColor: meta.color }} />
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground w-7 text-right shrink-0">{res.score.toFixed(1)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Agreement / Disagreement */}
                <div className="space-y-4">
                  {result.verdictDetails.agreementPoints?.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Where They Agreed</div>
                      <ul className="space-y-1">
                        {result.verdictDetails.agreementPoints.map((pt, i) => (
                          <li key={i} className="text-sm text-foreground/70 flex items-start gap-2">
                            <span className="text-emerald-500 mt-0.5 shrink-0">+</span><span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.verdictDetails.disagreementPoints?.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Where They Differed</div>
                      <ul className="space-y-1">
                        {result.verdictDetails.disagreementPoints.map((pt, i) => (
                          <li key={i} className="text-sm text-foreground/70 flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5 shrink-0">~</span><span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {winner && (
                    <div className="pt-3 border-t border-border/40">
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Overall Winner</div>
                      <div className="text-base font-bold" style={{ color: getModelMeta(winner.model).color }}>
                        {winner.displayName || winner.model}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{result.verdictDetails.explanation}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Model Cards — responsive grid: 1 col mobile, 2 col md, 3 col xl */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-12">
        {sortedResponses.map((res, rank) => {
          const meta = getModelMeta(res.model);
          const hexColor = res.color || meta.color;
          const bgTint = hexToRgba(hexColor, 0.07);
          const borderTint = hexToRgba(hexColor, 0.2);

          return (
            <Card
              key={res.model}
              className="flex flex-col h-full bg-card/40 hover:bg-card/60 transition-colors"
              style={{ borderColor: borderTint }}
            >
              {/* Card Header */}
              <CardHeader className="pb-3" style={{ borderBottom: `1px solid ${borderTint}`, background: `${bgTint}` }}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hexColor }} />
                    <CardTitle className="font-serif text-base leading-tight" style={{ color: hexColor }}>
                      {res.displayName || meta.name}
                    </CardTitle>
                    {rank === 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">WINNER</span>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Score</div>
                    <div className="font-mono text-xl font-bold leading-none" style={{ color: hexColor }}>{res.score.toFixed(1)}</div>
                  </div>
                </div>
                <div className="mt-2.5 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-20 shrink-0">Accuracy</span>
                    <div className="flex-1 h-1 rounded-full bg-border/40 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(res.accuracyScore / 10) * 100}%`, backgroundColor: hexColor }} />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{res.accuracyScore.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-20 shrink-0">Self-Awareness</span>
                    <div className="flex-1 h-1 rounded-full bg-border/40 overflow-hidden">
                      <div className="h-full rounded-full opacity-70" style={{ width: `${(res.selfAwarenessScore / 10) * 100}%`, backgroundColor: hexColor }} />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{res.selfAwarenessScore.toFixed(1)}</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4 flex-1 space-y-4">
                {/* Round 1 Answer */}
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-background shrink-0" style={{ backgroundColor: hexColor }}>1</span>
                    Round 1: Initial Answer
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{res.answer}</p>
                </div>

                {/* Round 2 Self-Criticism — always visible */}
                <div className="rounded-xl p-3.5" style={{ border: `1px solid ${borderTint}`, backgroundColor: bgTint }}>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5" style={{ color: hexColor }}>
                    <MessageSquareQuote className="h-3 w-3 shrink-0" style={{ color: hexColor }} />
                    Round 2: Selfbeat Analysis
                  </div>
                  <p className="text-sm leading-relaxed italic text-foreground/80">"{res.selfCriticism}"</p>
                </div>
              </CardContent>

              <CardFooter className="pt-3 border-t border-border/30 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(`Prompt: ${result.question}\n\n${res.displayName || meta.name} Answer:\n${res.answer}\n\nSelf-Critique:\n${res.selfCriticism}`)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-3 w-3 mr-2" />
                  Copy
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
