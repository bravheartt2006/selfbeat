import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import { createSelfbeatComparison } from "@workspace/api-client-react";
import { saveResult } from "@/lib/store";
import { generateMockResult } from "@/lib/mock-data";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [query, setQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const exampleQuestions = [
    "What causes high blood pressure?",
    "How does cryptocurrency work?",
    "What is the best diet for weight loss?",
    "Will AI replace human jobs?"
  ];

  const loadingSteps = [
    "Round 1: Collecting answers...",
    "Round 2: AIs examining themselves...",
    "Round 3: Calculating verdict..."
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isProcessing) return;

    setIsProcessing(true);
    setLoadingStep(0);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < 3) {
        setLoadingStep(step);
      }
    }, 1500); // 1.5 seconds per step

    try {
      const result = await createSelfbeatComparison({
        question: query,
        mode: "live"
      });
      saveResult(result);
      setLocation(`/results/${result.id}`);
    } catch (error) {
      const result = generateMockResult(query);
      saveResult(result);
      toast({
        title: "Using mock fallback",
        description: "The live comparison could not complete, so Selfbeat showed a local mock result.",
        duration: 4000
      });
      setLocation(`/results/${result.id}`);
    } finally {
      clearInterval(interval);
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)] px-4 py-12">
      
      {/* Hero Section */}
      <div className="text-center max-w-4xl mx-auto mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <Activity className="h-20 w-20 text-primary" />
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
          </div>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold mb-6 font-serif tracking-tight">
          Selfbeat
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground font-light tracking-wide mb-8">
          Where AI meets its match — itself.
        </p>
      </div>

      {/* Input Section */}
      <div className="w-full max-w-3xl mx-auto mb-16 animate-in fade-in slide-in-from-bottom-12 duration-700 delay-150">
        <form onSubmit={handleSubmit} className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-primary/30 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
          <div className="relative flex items-center">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything. Watch AI judge itself."
              className="w-full h-16 pl-6 pr-32 text-lg rounded-xl border-border/50 bg-background/80 backdrop-blur-sm focus-visible:ring-primary/50"
              disabled={isProcessing}
            />
            <Button 
              type="submit" 
              size="lg"
              className="absolute right-2 h-12 px-6 rounded-lg font-semibold transition-all hover:scale-105"
              disabled={!query.trim() || isProcessing}
            >
              {isProcessing ? (
                <Activity className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Start Selfbeat <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Loading State Overlay */}
        {isProcessing && (
          <div className="mt-6 text-center animate-in fade-in duration-300">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary">
              <Sparkles className="h-4 w-4 animate-pulse" />
              <span className="font-medium">{loadingSteps[loadingStep]}</span>
            </div>
          </div>
        )}
      </div>

      {/* Example Questions */}
      {!isProcessing && (
        <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-16 duration-700 delay-300">
          {exampleQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => setQuery(q)}
              className="text-left p-4 rounded-xl border border-border/40 bg-card/30 hover:bg-card/80 hover:border-primary/30 transition-all text-sm text-muted-foreground hover:text-foreground group"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 mt-0.5 text-muted-foreground/50 group-hover:text-primary/70 transition-colors" />
                <span>{q}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Animated Model Logos Orbit */}
      <div className="mt-24 relative w-64 h-64 opacity-50 pointer-events-none hidden md:block">
        <div className="absolute inset-0 border border-border/20 rounded-full animate-[spin_20s_linear_infinite]" />
        <div className="absolute inset-8 border border-border/30 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
        
        {/* Placeholder dots for models */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[hsl(165_82%_35%)] shadow-[0_0_15px_hsl(165_82%_35%)]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-4 h-4 rounded-full bg-[hsl(15_54%_58%)] shadow-[0_0_15px_hsl(15_54%_58%)]" />
        <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[hsl(217_89%_61%)] shadow-[0_0_15px_hsl(217_89%_61%)]" />
        <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[hsl(248_80%_67%)] shadow-[0_0_15px_hsl(248_80%_67%)]" />
      </div>

    </div>
  );
}
