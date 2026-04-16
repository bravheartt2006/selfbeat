import { useState, useRef } from "react";
import { Mic, Volume2 } from "lucide-react";
import { SelfbeatLogo } from "@/components/SelfbeatLogo";
import { LANGUAGES, LangCode, getLangMeta, translate } from "@/lib/i18n";
import { useLanguage } from "@/lib/language-context";
import { pickVoice, waitForVoices } from "@/lib/voices";

// ── Speech recognition ─────────────────────────────────────────────────────
type SR = typeof SpeechRecognition;
function getSR(): SR | null {
  return (
    (window as unknown as { SpeechRecognition?: SR }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: SR }).webkitSpeechRecognition ||
    null
  );
}

// Words a user might say in any of the 6 languages → language code
const VOICE_ALIASES: Record<string, LangCode> = {
  english: "en", anglais: "en", inglés: "en", ingles: "en", inglese: "en",
  french: "fr", français: "fr", francais: "fr", france: "fr",
  arabic: "ar", arab: "ar", arabe: "ar", arabique: "ar",
  chinese: "zh", mandarin: "zh", china: "zh", chinois: "zh", cinese: "zh", chino: "zh",
  italian: "it", italiano: "it", italia: "it", italy: "it",
  spanish: "es", español: "es", espanol: "es", spain: "es", spagnolo: "es", espagne: "es",
};

// Fire the language-specific greeting (must be called inside a click handler)
function fireGreeting(code: LangCode) {
  if (!window.speechSynthesis) return;
  const meta = getLangMeta(code);

  const doSpeak = async () => {
    await waitForVoices(2500);
    const voice = pickVoice(meta.speechLang);
    const utterance = new SpeechSynthesisUtterance(translate(code, "greeting"));
    utterance.pitch = 1.15;
    utterance.rate = 0.88;
    utterance.volume = 0.95;
    utterance.lang = meta.speechLang;
    if (voice) utterance.voice = voice;
    // Cancel any current speech, then wait 80 ms — Chrome silently drops speak()
    // calls made immediately after cancel().
    window.speechSynthesis.cancel();
    setTimeout(() => window.speechSynthesis.speak(utterance), 80);
  };

  void doSpeak();
}

// ── Component ──────────────────────────────────────────────────────────────
type VoiceState = "idle" | "speaking" | "listening";

export default function LanguageSelect() {
  const { setLang } = useLanguage();
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const voiceSupported = !!getSR() && !!window.speechSynthesis;

  // ── Choose a language (click OR voice) ───────────────────────────────
  const choose = (code: LangCode) => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    window.speechSynthesis?.cancel();
    setVoiceState("idle");
    fireGreeting(code);   // inside click context — bypasses browser autoplay block
    setLang(code);
  };

  // ── Start recognition after prompt finishes ───────────────────────────
  const startRecognition = () => {
    const SR = getSR();
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "";
    recognition.interimResults = false;
    recognition.maxAlternatives = 8;
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const candidates = Array.from(event.results[0]).map(
        (r) => (r as SpeechRecognitionAlternative).transcript.toLowerCase().trim(),
      );
      for (const text of candidates) {
        const words = text.split(/[\s,،.。]+/);
        for (const word of words) {
          const clean = word.replace(/[^\p{L}]/gu, "");
          if (VOICE_ALIASES[clean]) {
            choose(VOICE_ALIASES[clean]);
            return;
          }
        }
      }
      setVoiceState("idle");
    };

    recognition.onerror = () => setVoiceState("idle");
    recognition.onend   = () => setVoiceState("idle");

    setVoiceState("listening");
    recognition.start();
  };

  // ── Speak the prompt — MUST be called inside a click/tap handler ─────
  const speakPrompt = () => {
    if (!window.speechSynthesis) return;
    setVoiceState("speaking");

    const text = "Choose your language — English, Français, Arabic, Chinese, Italiano, Español";
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1.15;
    utterance.rate  = 0.80;
    utterance.volume = 0.95;
    utterance.lang  = "en-US";
    const voice = pickVoice("en-US");
    if (voice) utterance.voice = voice;

    utterance.onend   = () => startRecognition();
    utterance.onerror = () => setVoiceState("idle");

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">

      {/* Logo */}
      <div className="flex flex-col items-center mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="relative mb-5" aria-hidden="true">
          <SelfbeatLogo size={64} className="text-primary" />
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold font-serif tracking-tight mb-3">Selfbeat</h1>
        <p className="text-base text-muted-foreground font-light">Where AI meets its match — itself.</p>
      </div>

      {/* Heading */}
      <div className="text-center mb-6 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-100">
        <h2 className="text-2xl md:text-3xl font-semibold mb-1">Choose your language</h2>
        <p className="text-muted-foreground text-sm">Choisissez / اختر / 选择语言 / Scegli / Elige</p>
      </div>

      {/* Voice guide button — shown when voice is supported and not yet active */}
      {voiceSupported && (
        <div className="mb-8 animate-in fade-in duration-700 delay-150">
          {voiceState === "idle" && (
            <button
              onClick={speakPrompt}
              className="group flex items-center gap-3 px-6 py-3 rounded-full border border-primary/40 bg-primary/10 hover:bg-primary/20 transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {/* Pulsing ring */}
              <span className="relative flex h-5 w-5 items-center justify-center">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary/40 animate-ping" />
                <Volume2 className="relative h-4 w-4 text-primary" />
              </span>
              <span className="text-sm font-medium text-primary">Tap to hear — say your language</span>
            </button>
          )}

          {voiceState === "speaking" && (
            <div className="flex items-center gap-2 px-6 py-3 rounded-full border border-primary/30 bg-primary/10 text-sm text-primary">
              <Volume2 className="h-4 w-4 animate-pulse" />
              Speaking…
            </div>
          )}

          {voiceState === "listening" && (
            <div className="flex items-center gap-3 px-6 py-3 rounded-full border border-amber-400/40 bg-amber-400/10 text-sm text-amber-400">
              <span className="relative flex h-5 w-5 items-center justify-center">
                <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400/40 animate-ping" />
                <Mic className="relative h-3.5 w-3.5 text-amber-400" />
              </span>
              Say your language…
            </div>
          )}
        </div>
      )}

      {/* Language grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-2xl animate-in fade-in slide-in-from-bottom-12 duration-700 delay-200">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => choose(lang.code)}
            className="group relative flex flex-col items-center gap-3 p-6 rounded-2xl border border-border/40 bg-card/40 hover:bg-card hover:border-primary/40 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`Select ${lang.name}`}
          >
            <span className="text-4xl" role="img" aria-hidden="true">{lang.flag}</span>
            <div className="text-center">
              <p className="font-semibold text-base leading-tight">{lang.nativeName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{lang.name}</p>
            </div>
            <p
              className="text-xs text-muted-foreground/60 text-center leading-snug italic"
              dir={lang.dir}
            >
              {lang.taglineInLang}
            </p>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </button>
        ))}
      </div>

    </div>
  );
}
