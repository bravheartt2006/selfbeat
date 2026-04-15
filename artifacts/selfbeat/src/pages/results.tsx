import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { getResult, ComparisonResult } from "@/lib/store";
import { getSelfbeatComparison } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertCircle, Copy, Share2, Stethoscope, Trophy, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MODEL_COLORS = {
  chatgpt: { text: "text-[hsl(165_82%_35%)]", bg: "bg-[hsl(165_82%_35%)]/10", border: "border-[hsl(165_82%_35%)]/20", icon: "bg-[hsl(165_82%_35%)]", name: "ChatGPT" },
  claude: { text: "text-[hsl(15_54%_58%)]", bg: "bg-[hsl(15_54%_58%)]/10", border: "border-[hsl(15_54%_58%)]/20", icon: "bg-[hsl(15_54%_58%)]", name: "Claude" },
  gemini: { text: "text-[hsl(217_89%_61%)]", bg: "bg-[hsl(217_89%_61%)]/10", border: "border-[hsl(217_89%_61%)]/20", icon: "bg-[hsl(217_89%_61%)]", name: "Gemini" },
  deepseek: { text: "text-[hsl(248_80%_67%)]", bg: "bg-[hsl(248_80%_67%)]/10", border: "border-[hsl(248_80%_67%)]/20", icon: "bg-[hsl(248_80%_67%)]", name: "DeepSeek" }
};

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

  // Sort responses by score descending
  const sortedResponses = [...result.responses].sort((a, b) => b.score - a.score);

  return (
    <div className="container py-8 max-w-7xl animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-border/40 pb-6">
        <div>
          <div className="text-sm font-mono text-muted-foreground mb-2 flex items-center gap-2">
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

      {/* Physician Note (Conditional) */}
      {result.isMedical && result.physicianNote && (
        <div className="mb-10 p-6 rounded-xl border border-primary/30 bg-primary/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="flex items-start gap-4 relative z-10">
            <div className="p-3 rounded-full bg-primary/20 text-primary shrink-0">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-primary mb-2 flex items-center gap-2">
                Physician Note <AlertTriangle className="h-4 w-4" />
              </h3>
              <p className="text-foreground/80 leading-relaxed">
                {result.physicianNote}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Round 3: Verdict (Top Level) */}
      <div className="mb-12">
        <Card className="border-primary/40 bg-card shadow-lg shadow-primary/5">
          <CardHeader className="bg-primary/5 border-b border-primary/10">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-primary" />
              <CardTitle className="font-serif text-2xl">Final Verdict</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-lg leading-relaxed text-foreground/90">
              {result.verdict}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grid of Responses */}
      <div className="grid md:grid-cols-2 gap-6 mb-12">
        {sortedResponses.map((res, index) => {
          const styling = MODEL_COLORS[res.model];
          return (
            <Card key={res.model} className="flex flex-col h-full border-border/40 bg-card/40 hover:bg-card/60 transition-colors">
              <CardHeader className={`border-b ${styling.border} bg-background/50 pb-4`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${styling.icon} animate-pulse`} />
                    <CardTitle className={`font-serif text-xl ${styling.text}`}>
                      {res.displayName || styling.name}
                    </CardTitle>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground uppercase tracking-wider text-[10px] font-bold">Honest Score</div>
                    <div className={`font-mono text-xl font-bold ${styling.text}`}>{res.score}/10</div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-6 flex-1">
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 border-b border-border/40 pb-2">Round 1: Initial Answer</div>
                    <p className="text-sm leading-relaxed text-foreground/90">
                      {res.answer}
                    </p>
                  </div>
                  
                  <Accordion type="single" collapsible className="w-full mt-4">
                    <AccordionItem value="critique" className="border-none">
                      <AccordionTrigger className={`py-3 px-4 rounded-lg text-sm font-semibold hover:no-underline transition-all ${styling.bg} ${styling.text} border ${styling.border} data-[state=open]:rounded-b-none`}>
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Selfbeat Analysis
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className={`p-4 rounded-b-lg border border-t-0 ${styling.border} bg-background/50`}>
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 border-b border-border/40 pb-2">Round 2: Selfbeat Analysis</div>
                        <p className="text-sm leading-relaxed italic text-foreground/80">
                          "{res.selfCriticism}"
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </CardContent>
              
              <CardFooter className="pt-4 border-t border-border/40 justify-end">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleCopy(`Prompt: ${result.question}\n\n${styling.name} Answer:\n${res.answer}\n\nSelf-Critique:\n${res.selfCriticism}`)}
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
