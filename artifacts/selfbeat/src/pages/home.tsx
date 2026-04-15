import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, ArrowRight, AlertCircle, Mic, MicOff } from "lucide-react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const exampleQuestions = [
    "What causes high blood pressure?",
    "How does cryptocurrency work?",
    "What is the best diet for weight loss?",
    "Will AI replace human jobs?",
  ];

  useEffect(() => {
    const SR = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (SR) setVoiceSupported(true);
  }, []);

  const toggleListening = () => {
    const SR = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    setVoiceError("");
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");
      setQuery(transcript);
    };

    recognition.onend = () => setIsListening(false);

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setVoiceError("Microphone access was denied. Please allow it in your browser settings.");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (isListening) recognitionRef.current?.stop();
    setLocation(`/stream?q=${encodeURIComponent(q)}`);
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)] px-4 py-12">

      {/* Hero */}
      <div className="text-center max-w-4xl mx-auto mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex justify-center mb-6">
          <div className="relative" aria-hidden="true">
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

      {/* Input */}
      <div className="w-full max-w-3xl mx-auto mb-6 animate-in fade-in slide-in-from-bottom-12 duration-700 delay-150">
        <form
          onSubmit={handleSubmit}
          className="relative group"
          role="search"
          aria-label="Ask a question to compare AI models"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-primary/30 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" aria-hidden="true" />
          <div className="relative flex items-center gap-2">
            <label htmlFor="question-input" className="sr-only">
              Your question for the AI models
            </label>
            <Input
              id="question-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything. Watch AI judge itself."
              className="w-full h-16 pl-6 pr-4 text-lg rounded-xl border-border/50 bg-background/80 backdrop-blur-sm focus-visible:ring-primary/50"
              aria-label="Type or speak your question here"
              aria-describedby={voiceSupported ? "voice-hint" : undefined}
              autoComplete="off"
            />

            {/* Mic button */}
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleListening}
                aria-label={isListening ? "Stop recording — click to stop voice input" : "Start voice input — click to speak your question"}
                aria-pressed={isListening}
                className={`
                  shrink-0 h-12 w-12 rounded-xl flex items-center justify-center border transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none
                  ${isListening
                    ? "bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/40 animate-pulse"
                    : "bg-card border-border/50 text-muted-foreground hover:text-primary hover:border-primary/50"
                  }
                `}
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
            )}

            <Button
              type="submit"
              size="lg"
              className="shrink-0 h-12 px-6 rounded-lg font-semibold transition-all hover:scale-105"
              disabled={!query.trim()}
              aria-label={`Submit question: ${query.trim() || "Enter a question first"}`}
            >
              Start Selfbeat <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </form>

        {/* Voice status / error */}
        <div aria-live="polite" aria-atomic="true" className="mt-3 min-h-[1.5rem] text-center">
          {isListening && (
            <p id="voice-hint" className="text-sm text-red-400 font-medium animate-pulse">
              Listening... speak your question now
            </p>
          )}
          {!isListening && voiceError && (
            <p className="text-sm text-amber-400">{voiceError}</p>
          )}
          {!isListening && !voiceError && voiceSupported && (
            <p id="voice-hint" className="text-xs text-muted-foreground/60">
              Press the microphone to speak your question instead of typing
            </p>
          )}
        </div>
      </div>

      {/* Example questions */}
      <section
        className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-16 duration-700 delay-300"
        aria-label="Example questions to try"
      >
        {exampleQuestions.map((q, i) => (
          <button
            key={i}
            onClick={() => setQuery(q)}
            aria-label={`Use example question: ${q}`}
            className="text-left p-4 rounded-xl border border-border/40 bg-card/30 hover:bg-card/80 hover:border-primary/30 transition-all text-sm text-muted-foreground hover:text-foreground group focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 mt-0.5 text-muted-foreground/50 group-hover:text-primary/70 transition-colors" aria-hidden="true" />
              <span>{q}</span>
            </div>
          </button>
        ))}
      </section>

      {/* Animated orbit decoration */}
      <div className="mt-24 relative w-64 h-64 opacity-50 pointer-events-none hidden md:block" aria-hidden="true">
        <div className="absolute inset-0 border border-border/20 rounded-full animate-[spin_20s_linear_infinite]" />
        <div className="absolute inset-8 border border-border/30 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#10A37F] shadow-[0_0_15px_#10A37F]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-4 h-4 rounded-full bg-[#CC785C] shadow-[0_0_15px_#CC785C]" />
        <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#4285F4] shadow-[0_0_15px_#4285F4]" />
        <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#F97316] shadow-[0_0_15px_#F97316]" />
      </div>

    </main>
  );
}
