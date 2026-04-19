import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, AlertCircle, Mic, MicOff, X } from "lucide-react";
import { SelfbeatLogo } from "@/components/SelfbeatLogo";
import { useLanguage } from "@/lib/language-context";
import { useAppAuth } from "@/lib/auth-context";
import { pickVoice, waitForVoices } from "@/lib/voices";

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
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();
  const [isListening, setIsListening] = useState(false);
  const [isGreeting, setIsGreeting] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const greetedRef = useRef(false);

  const exampleQuestions = [t("exQ1"), t("exQ2"), t("exQ3"), t("exQ4")];

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

  const startListening = useCallback(() => {
    const SR = getSR();
    if (!SR) return;

    setVoiceError("");
    transcriptRef.current = "";

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
  }, [startCountdown, speechLang]);

  // cancelFirst=true when the user manually taps the mic (override current speech).
  // cancelFirst=false for auto-play: we queue while language-select is still speaking
  // so Chrome treats it as an allowed queued utterance.
  const speakGreetingThenListen = useCallback((cancelFirst = false) => {
    if (!window.speechSynthesis) {
      startListening();
      return;
    }

    const doSpeak = async () => {
      // Wait for voices to be fully loaded before picking one
      await waitForVoices(2500);

      const utterance = new SpeechSynthesisUtterance(t("greeting"));
      utterance.pitch = 1.15;
      utterance.rate = 0.88;
      utterance.volume = 0.95;
      utterance.lang = speechLang;

      const voice = pickVoice(speechLang);
      if (voice) utterance.voice = voice;

      setIsGreeting(true);

      // Safety net: if onend never fires (Chrome TTS stall), open the mic anyway
      const safetyTimer = setTimeout(() => {
        setIsGreeting(false);
        startListening();
      }, 12000);

      utterance.onend = () => {
        clearTimeout(safetyTimer);
        setIsGreeting(false);
        startListening();
      };

      utterance.onerror = () => {
        clearTimeout(safetyTimer);
        setIsGreeting(false);
        startListening();
      };

      if (cancelFirst) {
        // User-triggered replay: cancel current speech, wait 80 ms, then speak.
        // Chrome silently drops speak() called immediately after cancel().
        window.speechSynthesis.cancel();
        setTimeout(() => window.speechSynthesis.speak(utterance), 80);
      } else {
        // Auto-play: speak without cancelling so Chrome allows it as a queued
        // utterance while the language-select greeting is still active.
        window.speechSynthesis.speak(utterance);
      }
    };

    void doSpeak();
  }, [startListening, t, speechLang]);

  useEffect(() => {
    const SR = getSR();
    if (SR) setVoiceSupported(true);
  }, []);

  // Auto-play greeting then open mic on first mount.
  //
  // Two paths:
  //  A) User just picked a language — the language-select greeting started at
  //     ~80 ms via fireGreeting(). We check at 150 ms so speech is active,
  //     wait for it to finish, then open the mic. Chrome allows this because
  //     the user's tap already unlocked TTS for the session.
  //  B) User returned to home mid-session (Start Over, nav link, etc.) — no
  //     active speech, so we try to queue our own greeting. Chrome permits
  //     this because a recent button click provides user activation.
  useEffect(() => {
    if (greetedRef.current || !window.speechSynthesis) return;

    const tid = setTimeout(() => {
      if (greetedRef.current) return;
      greetedRef.current = true;

      if (window.speechSynthesis.speaking) {
        // Path A: language-select greeting is playing — wait for it, then mic
        setIsGreeting(true);
        const poll = setInterval(() => {
          if (!window.speechSynthesis.speaking) {
            clearInterval(poll);
            setIsGreeting(false);
            startListening();
          }
        }, 100);
      } else {
        // Path B: no active speech — play our own greeting
        speakGreetingThenListen(false);
      }
    }, 150);

    return () => clearTimeout(tid);
  }, [speakGreetingThenListen, startListening]);

  const toggleListening = () => {
    cancelCountdown();
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    speakGreetingThenListen(true); // user tapped — cancel current speech and replay
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
    setLocation(`/stream?q=${encodeURIComponent(q)}`);
  };

  const statusPhase: "greeting" | "listening" | "countdown" | "idle" =
    isGreeting ? "greeting" : isListening ? "listening" : countdown !== null ? "countdown" : "idle";

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
                aria-label={isListening ? "Stop recording" : "Play greeting and start voice input"}
                aria-pressed={isListening}
                className={`
                  shrink-0 h-12 w-12 rounded-xl flex items-center justify-center border transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none
                  ${isGreeting
                    ? "bg-primary/20 border-primary/40 text-primary animate-pulse"
                    : isListening
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

          {statusPhase === "greeting" && (
            <p className="text-sm text-primary/80 font-medium animate-pulse">
              {t("greetingStatus")}
            </p>
          )}

          {statusPhase === "listening" && (
            <p className="text-sm text-red-400 font-medium animate-pulse">
              {t("listeningStatus")}
            </p>
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

      {/* Example questions */}
      <section
        className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-16 duration-700 delay-300"
        aria-label="Example questions to try"
      >
        {exampleQuestions.map((q, i) => (
          <button
            key={i}
            onClick={() => { cancelCountdown(); setQuery(q); }}
            aria-label={q}
            className="text-left p-4 rounded-xl border border-border/40 bg-card/30 hover:bg-card/80 hover:border-primary/30 transition-all text-sm text-muted-foreground hover:text-foreground group focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 mt-0.5 text-muted-foreground/50 group-hover:text-primary/70 transition-colors shrink-0" aria-hidden="true" />
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
