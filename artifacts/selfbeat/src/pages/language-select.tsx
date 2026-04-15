import { useState, useEffect, useRef } from "react";
import { Activity, Mic, Volume2 } from "lucide-react";
import { LANGUAGES, LangCode, getLangMeta, translate } from "@/lib/i18n";
import { useLanguage } from "@/lib/language-context";

// ── Speech recognition helper ──────────────────────────────────────────────
type SR = typeof SpeechRecognition;
function getSR(): SR | null {
  return (
    (window as unknown as { SpeechRecognition?: SR }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: SR }).webkitSpeechRecognition ||
    null
  );
}

// Words a user might say (in any of the 6 languages) → language code
const VOICE_ALIASES: Record<string, LangCode> = {
  // English
  english: "en", anglais: "en", inglés: "en", ingles: "en", inglese: "en", ingilizce: "en",
  // French
  french: "fr", français: "fr", francais: "fr", france: "fr", "françaie": "fr",
  // Arabic
  arabic: "ar", arab: "ar", arabe: "ar", arabique: "ar", arabie: "ar",
  // Chinese
  chinese: "zh", mandarin: "zh", china: "zh", chinois: "zh", cinese: "zh", chino: "zh",
  // Italian
  italian: "it", italiano: "it", italia: "it", italy: "it", italie: "it",
  // Spanish
  spanish: "es", español: "es", espanol: "es", spain: "es", espagne: "es", spagnolo: "es",
};

function pickEnglishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const preferred = [
    "Google US English Female", "Microsoft Zira", "Samantha",
    "Karen", "Victoria", "Fiona", "Moira",
  ];
  return (
    voices.find((v) => preferred.some((p) => v.name.includes(p)) && v.lang.startsWith("en")) ||
    voices.find((v) => preferred.some((p) => v.name.includes(p))) ||
    voices.find((v) => v.lang.startsWith("en")) ||
    voices[0] ||
    null
  );
}

// Fire the language-specific greeting during a click gesture (bypasses autoplay block)
function fireGreeting(code: LangCode) {
  if (!window.speechSynthesis) return;
  const meta = getLangMeta(code);
  const text = translate(code, "greeting");
  const base = meta.speechLang.split("-")[0].toLowerCase();
  const preferred = [
    "Google US English Female", "Google français", "Google Arabic",
    "Google 普通话（中国大陆）", "Google italiano", "Google español",
    "Microsoft Zira", "Samantha", "Karen", "Victoria", "Moira", "Fiona",
  ];
  const voices = window.speechSynthesis.getVoices();
  const voice =
    voices.find((v) => preferred.some((p) => v.name.includes(p)) && v.lang.toLowerCase().startsWith(base)) ||
    voices.find((v) => preferred.some((p) => v.name.includes(p))) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(base)) ||
    voices[0] || null;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.pitch = 1.15;
  utterance.rate = 0.88;
  utterance.volume = 0.95;
  utterance.lang = meta.speechLang;
  if (voice) utterance.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

// ── Component ──────────────────────────────────────────────────────────────
export default function LanguageSelect() {
  const { setLang } = useLanguage();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // ── Choose a language (from click OR voice match) ─────────────────────
  const choose = (code: LangCode) => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    window.speechSynthesis?.cancel();
    setIsListening(false);
    setIsSpeaking(false);
    fireGreeting(code);   // inside click handler — bypasses autoplay policy
    setLang(code);
  };

  // ── Start speech recognition after prompt finishes ────────────────────
  const startListening = () => {
    const SR = getSR();
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "";          // let browser use its best guess
    recognition.interimResults = false;
    recognition.maxAlternatives = 8;
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const candidates = Array.from(event.results[0]).map(
        (r) => (r as SpeechRecognitionAlternative).transcript.toLowerCase().trim(),
      );
      for (const text of candidates) {
        // strip punctuation and try each word
        const words = text.split(/[\s,،.。]+/);
        for (const word of words) {
          const clean = word.replace(/[^\p{L}]/gu, "");
          if (VOICE_ALIASES[clean]) {
            choose(VOICE_ALIASES[clean]);
            return;
          }
        }
      }
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend   = () => setIsListening(false);

    setIsListening(true);
    recognition.start();
  };

  // ── Speak the language-choice prompt ─────────────────────────────────
  const speakPrompt = () => {
    if (!window.speechSynthesis) return;

    const text =
      "Choose your language — English, Français, Arabic, Chinese, Italiano, Español";
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1.15;
    utterance.rate  = 0.80;
    utterance.volume = 0.95;
    utterance.lang  = "en-US";
    const voice = pickEnglishVoice();
    if (voice) utterance.voice = voice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend   = () => { setIsSpeaking(false); startListening(); };
    utterance.onerror = () => { setIsSpeaking(false); };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  // ── Mount: attempt auto-speak; add replay button as fallback ─────────
  useEffect(() => {
    if (getSR()) setVoiceSupported(true);
    if (!window.speechSynthesis) return;

    const run = () => speakPrompt();
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      setTimeout(run, 600);
    } else {
      let done = false;
      window.speechSynthesis.onvoiceschanged = () => {
        if (done) return;
        done = true;
        window.speechSynthesis.onvoiceschanged = null;
        setTimeout(run, 300);
      };
      setTimeout(() => { if (!done) { done = true; run(); } }, 1300);
    }

    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">

      {/* Logo */}
      <div className="flex flex-col items-center mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="relative mb-5" aria-hidden="true">
          <Activity className="h-16 w-16 text-primary" />
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold font-serif tracking-tight mb-3">Selfbeat</h1>
        <p className="text-base text-muted-foreground font-light">Where AI meets its match — itself.</p>
      </div>

      {/* Prompt + voice status */}
      <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-100">
        <h2 className="text-2xl md:text-3xl font-semibold mb-2">Choose your language</h2>
        <p className="text-muted-foreground text-sm">Choisissez / اختر / 选择语言 / Scegli / Elige</p>

        {/* Voice status row */}
        {voiceSupported && (
          <div className="mt-4 flex items-center justify-center gap-3 min-h-[32px]">
            {isSpeaking && (
              <span className="flex items-center gap-2 text-sm text-primary">
                <Volume2 className="h-4 w-4 animate-pulse" />
                Speaking…
              </span>
            )}
            {isListening && (
              <span className="flex items-center gap-2 text-sm text-amber-400">
                {/* Pulsing mic ring */}
                <span className="relative flex h-5 w-5 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400/40 animate-ping" />
                  <Mic className="relative h-3.5 w-3.5 text-amber-400" />
                </span>
                Say your language…
              </span>
            )}
            {!isSpeaking && !isListening && (
              <button
                onClick={speakPrompt}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                aria-label="Replay voice prompt"
              >
                <Volume2 className="h-3.5 w-3.5" />
                Tap to hear
              </button>
            )}
          </div>
        )}
      </div>

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
