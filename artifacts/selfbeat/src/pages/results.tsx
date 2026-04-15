import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { getResult, ComparisonResult } from "@/lib/store";
import { getSelfbeatComparison } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Copy, Share2, Stethoscope, Trophy, AlertTriangle, MessageSquareQuote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MODEL_COLORS = {
  chatgpt: { text: "text-[hsl(165_82%_35%)]", bg: "bg-[hsl(165_82%_35%)]/10", border: "border-[hsl(165_82%_35%)]/20", icon: "bg-[hsl(165_82%_35%)]", name: "ChatGPT" },
  claude: { text: "text-[hsl(15_54%_58%)]", bg: "bg-[hsl(15_54%_58%)]/10", border: "border-[hsl(15_54%_58%)]/20", icon: "bg-[hsl(15_54%_58%)]", name: "Claude" },
  gemini: { text: "text-[hsl(217_89%_61%)]", bg: "bg-[hsl(217_89%_61%)]/10", border: "border-[hsl(217_89%_61%)]/20", icon: "bg-[hsl(217_89%_61%)]", name: "Gemini" },
  deepseek: { text: "text-[hsl(248_80%_67%)]", bg: "bg-[hsl(248_80%_67%)]/10", border: "border-[hsl(248_80%_67%)]/20", icon: "bg-[hsl(248_80%_67%)]", name: "DeepSeek" }
};

function ScoreBar({ score, color }: { score: number; color: string }) {
  const pct = Math.round((score / 10) * 100);
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 rounded-full bg-border/40 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
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
        .then((data) => {
          if (active) setResult(data);
        })
        .catch(() => {
          const data = getResult(id);
          if (data && active) {
            setResult(data);
            setLoadError("Loaded from local fallback cache because the server result was not available.");
            return;
          }

          setLocation("/");
        });
    }

    return () => {
      active = false;
    };
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
    toast({
      title: "Copied to clipboard",
      description: "Response text copied successfully.",
      duration: 2000
    });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link copied!",
      description: "Share this comparison with others.",
      duration: 2000
    });
  };

  const sortedResponses = [...result.responses].sort((a, b) => b.score - a.score);
  const winner = sortedResponses[0];

  return (
    <div className="container py-8 max-w-7xl animate-in fade-in duration-500">

      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-border/40 pb-6">
        <div>
          <div className="text-sm font-mono text-muted-foreground mb-2 flex items-center gap-2 flex-wrap">
            <span>ID: {result.id}</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>{new Date(result.timestamp).toLocaleDateString()}</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>{result.source === "live" ? "Live AI" : result.source === "mixed" ? "Mixed live and fallback" : "Mock result"}</span>
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
              <p className="text-foreground/80 leading-relaxed">
                {result.physicianNote}
              </p>
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
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Score Comparison</div>
                  <div className="space-y-3">
                    {sortedResponses.map((res) => {
                      const styling = MODEL_COLORS[res.model];
                      return (
                        <div key={res.model}>
                          <div className="flex justify-between items-center">
                            <span className={`text-sm font-semibold ${styling.text}`}>{res.displayName || styling.name}</span>
                          </div>
                          <div className="mt-0.5">
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="text-[10px] text-muted-foreground w-24">Accuracy</span>
                              <ScoreBar score={res.accuracyScore} color={styling.icon.replace("bg-[", "").replace("]", "")} />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground w-24">Self-Awareness</span>
                              <ScoreBar score={res.selfAwarenessScore} color={styling.icon.replace("bg-[", "").replace("]", "")} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-4">
                  {result.verdictDetails.agreementPoints?.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Where They Agreed</div>
                      <ul className="space-y-1">
                        {result.verdictDetails.agreementPoints.map((pt, i) => (
                          <li key={i} className="text-sm text-foreground/70 flex items-start gap-2">
                            <span className="text-emerald-500 mt-0.5">+</span>
                            <span>{pt}</span>
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
                            <span className="text-amber-500 mt-0.5">~</span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {winner && (
                    <div className="pt-3 border-t border-border/40">
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Overall Winner</div>
                      <div className={`text-base font-bold ${MODEL_COLORS[winner.model]?.text}`}>
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

      {/* Response Cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-12">
        {sortedResponses.map((res) => {
          const styling = MODEL_COLORS[res.model];
          const hexColor = res.color;

          return (
            <Card key={res.model} className="flex flex-col h-full border-border/40 bg-card/40 hover:bg-card/60 transition-colors">
              {/* Card Header */}
              <CardHeader className={`border-b ${styling.border} bg-background/50 pb-4`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${styling.icon} shrink-0`} />
                    <CardTitle className={`font-serif text-xl ${styling.text}`}>
                      {res.displayName || styling.name}
                    </CardTitle>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-0.5">Honest Score</div>
                    <div className={`font-mono text-2xl font-bold leading-none ${styling.text}`}>{res.score.toFixed(1)}</div>
                    <div className="text-[10px] text-muted-foreground">/10</div>
                  </div>
                </div>
                {/* Mini score bars in header */}
                <div className="mt-3 space-y-1.5">
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

              <CardContent className="pt-5 flex-1 space-y-5">
                {/* Round 1 Answer */}
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <span className={`inline-block w-4 h-4 rounded-full text-center leading-4 text-[9px] font-bold text-background ${styling.icon}`}>1</span>
                    Round 1: Initial Answer
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {res.answer}
                  </p>
                </div>

                {/* Round 2 Self-Criticism — always visible */}
                <div className={`rounded-xl p-4 border ${styling.border} ${styling.bg}`}>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 ${styling.text}">
                    <MessageSquareQuote className={`h-3.5 w-3.5 ${styling.text}`} />
                    <span className={styling.text}>Round 2: Selfbeat Analysis</span>
                  </div>
                  <p className="text-sm leading-relaxed italic text-foreground/80">
                    "{res.selfCriticism}"
                  </p>
                </div>
              </CardContent>

              <CardFooter className="pt-4 border-t border-border/40 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(`Prompt: ${result.question}\n\n${res.displayName || styling.name} Answer:\n${res.answer}\n\nSelf-Critique:\n${res.selfCriticism}`)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-3 w-3 mr-2" />
                  Copy Output
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
