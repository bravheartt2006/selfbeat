import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToastAction } from "@/components/ui/toast";
import { ArrowRight, Mic, MicOff, X } from "lucide-react";
import { SelfbeatLogo } from "@/components/SelfbeatLogo";
import StatsBar from "@/components/StatsBar";
import QuestionOfTheDay from "@/components/QuestionOfTheDay";
import { useLanguage } from "@/lib/language-context";
import { useAppAuth } from "@/lib/auth-context";
import { useCredits } from "@/lib/credits-context";
import { useToast } from "@/hooks/use-toast";

type SR = typeof SpeechRecognition;

function getSR(): SR | null {
  return (
    (window as unknown as { SpeechRecognition?: SR }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: SR }).webkitSpeechRecognition ||
    null
  );
}


export default function Home() {
  const { t, speechLang } = useLanguage();
  const { isSignedIn } = useAppAuth();
  const { credits, isUnlimited } = useCredits();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);

  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingIntentRef = useRef<"submit" | "cancel" | "natural">("natural");
  const maxRecordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingSecondsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const exampleQuestions = [
    "Which planet has the most moons and why do scientists keep changing the answer?",
    "Is caffeine actually bad for you or is that a myth?",
    "What really caused the 2008 financial crisis?",
    "Is social media making us more or less connected?",
    "Will AI ever be truly conscious?",
    "What is the healthiest diet according to science?",
  ];

  const cancelCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(null);
  }, []);

  const startCountdown = useCallback(
    (q: string) => {
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
    },
    [setLocation]
  );

  const clearRecordingTimers = useCallback(() => {
    if (maxRecordingTimerRef.current) {
      clearTimeout(maxRecordingTimerRef.current);
      maxRecordingTimerRef.current = null;
    }
    if (recordingSecondsTimerRef.current) {
      clearInterval(recordingSecondsTimerRef.current);
      recordingSecondsTimerRef.current = null;
    }
    setRecordingSeconds(0);
  }, []);

  const startListening = useCallback(() => {
    const SR = getSR();
    if (!SR) return;

    setVoiceError("");
    transcriptRef.current = "";
    recordingIntentRef.current = "natural";
    setRecordingSeconds(0);

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = speechLang;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");
      setQuery(transcript);
      transcriptRef.current = transcript;
    };

    recognition.onend = () => {
      setIsListening(false);
      clearRecordingTimers();

      const intent = recordingIntentRef.current;
      recordingIntentRef.current = "natural";
      const q = transcriptRef.current.trim();

      if (intent === "cancel") {
        setQuery("");
        return;
      }
      if (q) {
        if (intent === "submit") {
          setLocation(`/stream?q=${encodeURIComponent(q)}`);
        } else {
          startCountdown(q);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      clearRecordingTimers();
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setVoiceError("Microphone access was denied. Please allow it in your browser settings.");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);

    // Auto-stop and submit after 60 seconds
    maxRecordingTimerRef.current = setTimeout(() => {
      recordingIntentRef.current = "submit";
      recognition.stop();
    }, 60000);

    // Tick up the recording seconds counter for the UI
    recordingSecondsTimerRef.current = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
  }, [startCountdown, speechLang, setLocation, clearRecordingTimers]);

  useEffect(() => {
    const SR = getSR();
    if (SR) setVoiceSupported(true);
  }, []);

  const stopAndSubmit = useCallback(() => {
    cancelCountdown();
    recordingIntentRef.current = "submit";
    recognitionRef.current?.stop();
  }, [cancelCountdown]);

  const cancelRecording = useCallback(() => {
    cancelCountdown();
    recordingIntentRef.current = "cancel";
    recognitionRef.current?.stop();
  }, [cancelCountdown]);

  const toggleListening = () => {
    cancelCountdown();
    if (isListening) {
      stopAndSubmit();
      return;
    }
    window.speechSynthesis?.cancel();
    startListening();
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (countdown !== null) cancelCountdown();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    cancelCountdown();
    const q = query.trim();
    if (!q) return;
    if (isListening) recognitionRef.current?.stop();
    if (!isSignedIn) {
      setLocation(`/sign-in`);
      return;
    }
    if (!isUnlimited && credits <= 5) {
      const qty = credits;
      toast({
        title: "Running low on credits",
        description: `You have ${qty} question${qty === 1 ? "" : "s"} left — grab 25 more for just $4.99`,
        duration: 8000,
        action: (
          <ToastAction altText="Get more credits" onClick={() => setLocation("/pricing")}>
            Get more
          </ToastAction>
        ),
      });
    }
    setLocation(`/stream?q=${encodeURIComponent(q)}`);
  };

  const statusPhase: "listening" | "countdown" | "idle" =
    isListening ? "listening" : countdown !== null ? "countdown" : "idle";

  return (
    <main className="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)] px-4 py-12">

      {/* Hero */}
      <div className="text-center max-w-4xl mx-auto mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex justify-center mb-6">
          <div className="relative" aria-hidden="true">
            <SelfbeatLogo size={80} className="text-primary" />
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
          </div>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold mb-6 font-serif tracking-tight">
          Selfbeat
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground font-light tracking-wide mb-8">
          {t("tagline")}
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
              {t("inputPlaceholder")}
            </label>
            <Input
              id="question-input"
              value={query}
              onChange={handleQueryChange}
              placeholder={t("inputPlaceholder")}
              className="w-full h-16 pl-6 pr-4 text-lg rounded-xl border-border/50 bg-background/80 backdrop-blur-sm focus-visible:ring-primary/50"
              aria-label={t("inputPlaceholder")}
              aria-describedby="voice-status"
              autoComplete="off"
            />

            {voiceSupported && (
              <button
                type="button"
                onClick={toggleListening}
                aria-label={isListening ? "Stop recording and submit" : "Start voice input"}
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
              aria-label={t("startButton")}
            >
              {t("startButton")} <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </form>

        {/* Status area */}
        <div id="voice-status" aria-live="polite" aria-atomic="true" className="mt-3 min-h-[2rem] flex items-center justify-center">

          {statusPhase === "idle" && voiceSupported && (
            <p className="text-sm text-muted-foreground/60 flex items-center gap-1.5">
              <Mic className="h-3.5 w-3.5" aria-hidden="true" />
              Click to speak
            </p>
          )}

          {statusPhase === "listening" && (
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <span className="relative flex h-3 w-3 shrink-0" aria-hidden="true">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <p className="text-sm text-red-400 font-medium">
                {t("listeningStatus")} · {60 - recordingSeconds}s
              </p>
              <button
                type="button"
                onClick={stopAndSubmit}
                className="flex items-center gap-1.5 text-sm text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded-md transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Stop recording and submit question"
              >
                <span className="h-2.5 w-2.5 rounded-sm bg-white inline-block shrink-0" aria-hidden="true" />
                Stop
              </button>
              <button
                type="button"
                onClick={cancelRecording}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                aria-label="Cancel recording without submitting"
              >
                <X className="h-3.5 w-3.5" />
                {t("cancel")}
              </button>
            </div>
          )}

          {statusPhase === "countdown" && countdown !== null && (
            <div className="flex items-center gap-3">
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
                {t("countdownStatus").replace("{n}", String(countdown))}
              </p>
              <button
                type="button"
                onClick={cancelCountdown}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                aria-label="Cancel auto-submit"
              >
                <X className="h-3.5 w-3.5" />
                {t("cancel")}
              </button>
            </div>
          )}

          {statusPhase === "idle" && !voiceError && voiceSupported && (
            <p className="text-xs text-muted-foreground/60">{t("idleHint")}</p>
          )}
          {statusPhase === "idle" && !voiceError && !voiceSupported && (
            <p className="text-xs text-muted-foreground/60">{t("idleHintNoVoice")}</p>
          )}
          {statusPhase === "idle" && voiceError && (
            <p className="text-sm text-amber-400">{voiceError}</p>
          )}
        </div>
      </div>

      {/* Example question suggestions — visible only when input is empty */}
      {!query.trim() && (
        <section
          className="w-full max-w-4xl mx-auto animate-in fade-in duration-300"
          aria-label="Example questions to try"
        >
          <p className="text-xs text-muted-foreground/50 text-center mb-3 uppercase tracking-widest font-medium">
            Try asking
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {exampleQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => {
                  cancelCountdown();
                  setLocation(`/stream?q=${encodeURIComponent(q)}&free=1`);
                }}
                aria-label={`Try free: ${q}`}
                className={`text-left p-3.5 rounded-xl border border-border/40 bg-card/40 hover:bg-card hover:border-primary/40 hover:shadow-sm transition-all duration-150 text-sm text-muted-foreground hover:text-foreground group focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none${i >= 3 ? " hidden sm:block" : ""}`}
              >
                <div className="flex flex-col gap-2">
                  <span className="inline-flex w-fit items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-green-500/10 text-green-500 border border-green-500/20">
                    Free
                  </span>
                  <span className="line-clamp-2 leading-snug">{q}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Question of the Day */}
      {!query.trim() && <QuestionOfTheDay />}

      {/* Live usage stats */}
      <StatsBar />

      {/* Animated orbit decoration */}
      <div className="mt-16 relative w-64 h-64 opacity-50 pointer-events-none hidden md:block" aria-hidden="true">
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
