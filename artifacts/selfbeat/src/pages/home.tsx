import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, ArrowRight, AlertCircle, Mic, MicOff, X } from "lucide-react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const cancelCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(null);
  }, []);

  const startCountdown = useCallback((q: string) => {
    setCountdown(3);
    let remaining = 3;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        countdownRef.current = null;
        setCountdown(null);
        setLocation(`/stream?q=${encodeURIComponent(q)}`);
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }, [setLocation]);

  const toggleListening = () => {
    const SR = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) return;

    // If counting down, cancel and allow re-record
    cancelCountdown();

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    setVoiceError("");
    transcriptRef.current = "";
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");
      setQuery(transcript);
      transcriptRef.current = transcript;
    };

    recognition.onend = () => {
      setIsListening(false);
      const q = transcriptRef.current.trim();
      if (q) startCountdown(q);
    };

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

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    // Typing cancels the voice countdown so the user can edit freely
    if (countdown !== null) cancelCountdown();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    cancelCountdown();
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
              onChange={handleQueryChange}
              placeholder="Ask anything. Watch AI judge itself."
              className="w-full h-16 pl-6 pr-4 text-lg rounded-xl border-border/50 bg-background/80 backdrop-blur-sm focus-visible:ring-primary/50"
              aria-label="Type or speak your question here"
              aria-describedby="voice-hint"
              autoComplete="off"
            />

            {/* Mic button */}
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleListening}
                aria-label={isListening ? "Stop recording" : countdown !== null ? "Cancel countdown and re-record" : "Start voice input"}
                aria-pressed={isListening}
                className={`
                  shrink-0 h-12 w-12 rounded-xl flex items-center justify-center border transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none
                  ${isListening
                    ? "bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/40 animate-pulse"
                    : countdown !== null
                      ? "bg-amber-500 border-amber-400 text-white"
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
              aria-label="Submit question"
            >
              Start Selfbeat <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </form>

        {/* Status area */}
        <div aria-live="polite" aria-atomic="true" className="mt-3 min-h-[2rem] flex items-center justify-center">
          {isListening && (
            <p className="text-sm text-red-400 font-medium animate-pulse">
              Listening... speak your question now
            </p>
          )}

          {!isListening && countdown !== null && (
            <div className="flex items-center gap-3">
              {/* Countdown ring */}
              <div className="relative w-8 h-8 shrink-0">
                <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32" aria-hidden="true">
                  <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-border/40" />
                  <circle
                    cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeDasharray={`${2 * Math.PI * 13}`}
                    strokeDashoffset={`${2 * Math.PI * 13 * (1 - countdown / 3)}`}
                    className="text-amber-400 transition-all duration-700"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-amber-400">
                  {countdown}
                </span>
              </div>
              <p className="text-sm text-amber-400 font-medium">
                Submitting in {countdown}s — keep speaking or
              </p>
              <button
                type="button"
                onClick={cancelCountdown}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                aria-label="Cancel auto-submit and stay on this page to edit"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </div>
          )}

          {!isListening && countdown === null && !voiceError && voiceSupported && (
            <p id="voice-hint" className="text-xs text-muted-foreground/60">
              Type and press Enter, or tap the microphone to speak — submits after 3 seconds
            </p>
          )}
          {!isListening && countdown === null && !voiceError && !voiceSupported && (
            <p id="voice-hint" className="text-xs text-muted-foreground/60">
              Type your question and press Enter to submit
            </p>
          )}
          {!isListening && countdown === null && voiceError && (
            <p className="text-sm text-amber-400">{voiceError}</p>
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
            onClick={() => { cancelCountdown(); setQuery(q); }}
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
