import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useLanguage } from "@/lib/language-context";
import { getResult, ComparisonResult } from "@/lib/store";
import { getSelfbeatComparison } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Copy, Share2, Stethoscope, Trophy, AlertTriangle, MessageSquareQuote, XCircle, Database, RotateCcw, Square, Mic } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { pickVoice, waitForVoices } from "@/lib/voices";

type ModelKey = "chatgpt" | "claude" | "gemini" | "deepseek" | "grok" | "mistral" | "llama" | "perplexity" | "cohere" | "qwen" | "copilot";

const MODEL_META: Record<ModelKey, { name: string; color: string }> = {
  chatgpt:    { name: "ChatGPT",           color: "#10A37F" },
  claude:     { name: "Claude",            color: "#CC785C" },
  gemini:     { name: "Gemini",            color: "#4285F4" },
  deepseek:   { name: "DeepSeek",          color: "#7B68EE" },
  grok:       { name: "Grok",              color: "#F97316" },
  mistral:    { name: "Mistral Large",     color: "#EF4444" },
  llama:      { name: "Llama 3.3 (Meta)",  color: "#1877F2" },
  perplexity: { name: "Perplexity Sonar",  color: "#06B6D4" },
  cohere:     { name: "Cohere Command R+",  color: "#22C55E" },
  qwen:       { name: "Qwen 2.5",           color: "#A855F7" },
  copilot:    { name: "Microsoft Copilot",  color: "#0078D4" },
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

// ─── Voice helpers (module-level, no hook deps) ────────────────────────────

type AnySR = typeof SpeechRecognition;

function getSR(): AnySR | null {
  return (
    (window as unknown as Record<string, AnySR>).SpeechRecognition ||
    (window as unknown as Record<string, AnySR>).webkitSpeechRecognition ||
    null
  );
}

// ─── Strip markdown so TTS reads clean prose ───────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")           // fenced code blocks
    .replace(/`[^`]*`/g, "")                  // inline code
    .replace(/#{1,6}\s+/gm, "")              // headings
    .replace(/\*\*(.+?)\*\*/g, "$1")          // bold **
    .replace(/__(.+?)__/g, "$1")              // bold __
    .replace(/\*(.+?)\*/g, "$1")              // italic *
    .replace(/_(.+?)_/g, "$1")               // italic _
    .replace(/\[(.+?)\]\([^)]*\)/g, "$1")    // [link](url)
    .replace(/^[-*+]\s+/gm, "")              // unordered list bullets
    .replace(/^\d+\.\s+/gm, "")             // ordered list numbers
    .replace(/^>\s*/gm, "")                  // blockquotes
    .replace(/\|[^\n]*\|/g, "")             // table rows
    .replace(/[-]{3,}/g, "")                // horizontal rules
    .replace(/\n{2,}/g, " ")                 // multiple newlines → space
    .replace(/\n/g, " ")                     // remaining newlines → space
    .trim();
}

// ─── Main component ────────────────────────────────────────────────────────

export default function Results() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { lang, t, speechLang } = useLanguage();
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Voice reading state
  type ReadPhase = "idle" | "winner" | "prompting" | "listening" | "all";
  const [readPhase, setReadPhase] = useState<ReadPhase>("idle");
  const [readingName, setReadingName] = useState<string>("");

  const activeReadRef = useRef(false);
  const stopRecogRef = useRef<SpeechRecognition | null>(null);
  const hasAutoReadRef = useRef(false);

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

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      stopRecogRef.current?.abort();
    };
  }, []);

  // ── Voice: stop everything ─────────────────────────────────────────────
  const stopEverything = useCallback(() => {
    activeReadRef.current = false;
    window.speechSynthesis?.cancel();
    try { stopRecogRef.current?.abort(); } catch {}
    stopRecogRef.current = null;
    setReadPhase("idle");
    setReadingName("");
  }, []);

  // ── Voice: speak one utterance, call onEnd when done ──────────────────
  // Chrome bug: calling speak() inside an onend handler is silently dropped.
  // Fix: always defer via setTimeout so we're never inside the onend call stack.
  // waitForVoices() ensures the browser voice list is fully populated before we
  // try to pick a language-matched voice — critical for non-English languages.
  const speakSingle = useCallback((text: string, onEnd: () => void, cancelFirst = false) => {
    if (!window.speechSynthesis || !activeReadRef.current) return;
    const doSpeak = async () => {
      if (!activeReadRef.current) return;
      await waitForVoices(2500);
      if (!activeReadRef.current) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = speechLang;
      u.rate = 0.88;
      u.pitch = 1.0;
      const voice = pickVoice(speechLang);
      if (voice) u.voice = voice;
      u.onend = () => { if (activeReadRef.current) onEnd(); };
      u.onerror = (e) => {
        if (activeReadRef.current && e.error !== "interrupted" && e.error !== "canceled") onEnd();
      };
      if (cancelFirst) window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    };
    // Always step out of any onend call stack before speaking
    setTimeout(() => { void doSpeak(); }, 60);
  }, [speechLang]);

  // ── Voice: listen for yes/no (5-second timeout) ───────────────────────
  const listenForAnswer = useCallback((onYes: () => void, onNo: () => void) => {
    const SR = getSR();
    if (!SR || !activeReadRef.current) { onNo(); return; }
    const YES = ["yes", "oui", "نعم", "是", "sì", "si", "yeah", "sure", "read", "all", "lire", "tout", "كل"];
    let done = false;
    const r = new SR() as SpeechRecognition;
    r.lang = speechLang;
    r.maxAlternatives = 5;
    r.interimResults = false;
    stopRecogRef.current = r;
    const finish = (isYes: boolean) => {
      if (done) return;
      done = true;
      try { r.abort(); } catch {}
      if (isYes) onYes(); else onNo();
    };
    const timeout = setTimeout(() => finish(false), 5500);
    r.onresult = (e: SpeechRecognitionEvent) => {
      clearTimeout(timeout);
      const texts = Array.from(e.results[0]).map(x => (x as SpeechRecognitionAlternative).transcript.toLowerCase());
      finish(texts.some(t => YES.some(y => t.includes(y))));
    };
    r.onerror = () => { clearTimeout(timeout); finish(false); };
    r.onend = () => {};
    setReadPhase("listening");
    try { r.start(); } catch { clearTimeout(timeout); onNo(); }
  }, [speechLang]);

  // ── Voice: brief stop-check between answers ───────────────────────────
  // Chrome mutes the mic while TTS is playing (echo prevention), so we can
  // only listen for "stop" in the gaps BETWEEN answers. This gives a 1.2-second
  // window after each answer ends to say "stop" before the next one begins.
  const listenForStop = useCallback((onStop: () => void, onContinue: () => void) => {
    const SR = getSR();
    if (!SR || !activeReadRef.current) { onContinue(); return; }
    const STOP = ["stop", "arrêt", "arrêtez", "وقف", "停止", "fermati", "para", "halt", "basta"];
    let done = false;
    const r = new SR() as SpeechRecognition;
    r.lang = speechLang;
    r.maxAlternatives = 3;
    r.interimResults = true;
    stopRecogRef.current = r;
    const finish = (isStop: boolean) => {
      if (done) return;
      done = true;
      try { r.abort(); } catch {}
      if (!activeReadRef.current) return;
      if (isStop) onStop(); else onContinue();
    };
    const timeout = setTimeout(() => finish(false), 1200);
    r.onresult = (e: SpeechRecognitionEvent) => {
      const texts = Array.from(e.results).flatMap(res =>
        Array.from(res).map(alt => (alt as SpeechRecognitionAlternative).transcript.toLowerCase())
      );
      if (texts.some(txt => STOP.some(s => txt.includes(s)))) {
        clearTimeout(timeout);
        finish(true);
      }
    };
    r.onerror = () => { clearTimeout(timeout); finish(false); };
    r.onend = () => {};
    try { r.start(); } catch { clearTimeout(timeout); onContinue(); }
  }, [speechLang]);

  // ── Voice: speak one utterance using ENGLISH voice (for fallback only) ─
  const speakEnglish = useCallback((text: string, onEnd: () => void) => {
    if (!window.speechSynthesis || !activeReadRef.current) return;
    const doSpeak = async () => {
      if (!activeReadRef.current) return;
      await waitForVoices(2500);
      if (!activeReadRef.current) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = 0.88;
      const voice = pickVoice("en-US");
      if (voice) u.voice = voice;
      u.onend = () => { if (activeReadRef.current) onEnd(); };
      u.onerror = () => { if (activeReadRef.current) onEnd(); };
      window.speechSynthesis.speak(u);
    };
    setTimeout(() => { void doSpeak(); }, 60);
  }, []);

  // ── Voice: main orchestration ──────────────────────────────────────────
  const startAutoRead = useCallback(() => {
    if (!result || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    activeReadRef.current = true;
    hasAutoReadRef.current = true;

    const sorted = [...result.responses].sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    const rest = sorted.slice(1);

    setReadPhase("winner");
    setReadingName(winner.displayName || "");

    const doRead = async () => {
      // Always wait for the full voice list before attempting to speak
      await waitForVoices(2500);
      if (!activeReadRef.current) return;

      const langVoice = pickVoice(speechLang);

      // ── No matching voice for this language ───────────────────────────
      // Reading mixed Arabic+English (or other language) text with an English
      // voice produces: English chars are spoken, non-Latin chars silently
      // skipped. The user hears only model names and numbers — confusing for
      // the visually impaired. Instead, announce just the winner in English
      // and show a toast so the user knows to enable the language voice.
      if (!langVoice && lang !== "en") {
        const langNames: Record<string, string> = {
          fr: "French", ar: "Arabic", zh: "Chinese", it: "Italian", es: "Spanish",
        };
        const langName = langNames[lang] || lang;
        const winnerName = winner.displayName || getModelMeta(winner.model).name;
        const fallbackText = `The winner is ${winnerName} with a score of ${winner.score.toFixed(1)} out of 10. The full answer is shown on screen.`;

        toast({
          title: `No ${langName} voice on this device`,
          description: `Install a ${langName} text-to-speech voice in your device settings to hear answers in ${langName}.`,
          duration: 8000,
        });

        speakEnglish(fallbackText, () => {
          activeReadRef.current = false;
          setReadPhase("idle");
          setReadingName("");
        });
        return;
      }

      // ── Full cascade — language voice is available ─────────────────────
      const winnerAnnounce = t("winnerAnnounce")
        .replace("{name}", winner.displayName || getModelMeta(winner.model).name)
        .replace("{score}", winner.score.toFixed(1));
      // Read the announcement and the answer as two separate utterances so
      // a very long answer does not cause Chrome's mid-utterance stall bug.
      speakSingle(winnerAnnounce, () => {
        speakSingle(stripMarkdown(winner.answer), () => {
          setReadPhase("prompting");
          setReadingName("");
          speakSingle(t("askReadMore"), () => {
            listenForAnswer(
              () => {
                setReadPhase("all");
                let i = 0;
                const readNext = () => {
                  if (!activeReadRef.current || i >= rest.length) {
                    if (activeReadRef.current) {
                      setReadPhase("idle");
                      setReadingName("");
                      activeReadRef.current = false;
                    }
                    return;
                  }
                  const card = rest[i++];
                  setReadingName(card.displayName || "");
                  const cardIntro = t("modelScore")
                    .replace("{name}", card.displayName || getModelMeta(card.model).name)
                    .replace("{score}", card.score.toFixed(1));
                  // Intro and answer as separate utterances to avoid Chrome stall
                  speakSingle(cardIntro, () => {
                    speakSingle(stripMarkdown(card.answer), () => {
                      listenForStop(stopEverything, readNext);
                    });
                  });
                };
                readNext();
              },
              () => {
                activeReadRef.current = false;
                setReadPhase("idle");
                setReadingName("");
              }
            );
          });
        });
      });
    };

    void doRead();
  }, [result, lang, speechLang, speakSingle, speakEnglish, listenForAnswer, listenForStop, stopEverything, t, toast]);

  // ── Auto-trigger when result first loads ──────────────────────────────
  useEffect(() => {
    if (!result || hasAutoReadRef.current) return;
    const tid = setTimeout(startAutoRead, 700);
    return () => clearTimeout(tid);
  }, [result, startAutoRead]);

  if (!result) {
    return (
      <div className="container py-20 max-w-3xl text-center">
        <div className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-primary/10 border border-primary/20 text-primary">
          <AlertCircle className="h-4 w-4 animate-pulse" />
          <span className="font-medium">{t("loading")}</span>
        </div>
      </div>
    );
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t("copied"), description: t("copiedDesc"), duration: 2000 });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: t("linkCopied"), description: t("linkCopiedDesc"), duration: 2000 });
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
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            onClick={() => { stopEverything(); setLocation("/"); }}
            className="bg-amber-400 hover:bg-amber-300 text-black font-bold shadow-lg shadow-amber-400/30 border-0"
            aria-label="Start over — go back to the home page to ask a new question"
          >
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("startOver")}
          </Button>
          {readPhase !== "idle" ? (
            <Button
              onClick={stopEverything}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-lg shadow-rose-600/30 border-0 gap-2"
              aria-label="Stop reading"
            >
              <Square className="h-4 w-4 fill-white" aria-hidden="true" />
              {t("stop")}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={startAutoRead}
              className="group"
              aria-label="Read the winner and all answers aloud"
            >
              <Mic className="mr-2 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden="true" />
              {t("listen")}
            </Button>
          )}
          <Button variant="outline" onClick={handleShare} className="group" aria-label="Copy link to share these results">
            <Share2 className="mr-2 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden="true" />
            {t("shareResults")}
          </Button>
        </div>
      </div>

      {/* Reading status bar */}
      {readPhase !== "idle" && (
        <div className="mb-6 flex items-center gap-3 px-5 py-3 rounded-xl border border-primary/20 bg-primary/5 animate-in fade-in duration-300">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
          </span>
          <span className="text-sm text-primary font-medium">
            {readPhase === "winner" && readingName && t("readingWinner").replace("{name}", readingName)}
            {readPhase === "prompting" && t("promptingAll")}
            {readPhase === "listening" && t("listeningYesNo")}
            {readPhase === "all" && readingName && t("readingAll").replace("{name}", readingName)}
          </span>
          <button
            onClick={stopEverything}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors underline"
          >
            {t("stop")}
          </button>
        </div>
      )}

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
                {t("physicianNote")} — AI Generated <AlertTriangle className="h-4 w-4" />
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
              <CardTitle className="font-serif text-2xl">{t("verdictLabel")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <p className="text-lg leading-relaxed text-foreground/90">
              {result.verdictDetails?.summary ?? result.verdict}
            </p>

            {/* Winner answer spotlight */}
            {winner && (
              <div className="relative overflow-hidden rounded-2xl border-2 p-5"
                style={{
                  borderColor: getModelMeta(winner.model).color + "55",
                  background: `linear-gradient(135deg, ${getModelMeta(winner.model).color}10 0%, transparent 60%)`,
                }}>
                {/* Celebration glow */}
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-30"
                  style={{ backgroundColor: getModelMeta(winner.model).color }} />
                <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-20"
                  style={{ backgroundColor: getModelMeta(winner.model).color }} />

                <div className="relative">
                  {/* Winner label */}
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full shadow-lg"
                      style={{ backgroundColor: getModelMeta(winner.model).color + "25", border: `1px solid ${getModelMeta(winner.model).color}40` }}>
                      <Trophy className="h-4 w-4" style={{ color: getModelMeta(winner.model).color }} />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("winner")}</div>
                      <div className="text-sm font-bold leading-none" style={{ color: getModelMeta(winner.model).color }}>
                        {winner.displayName || getModelMeta(winner.model).name}
                        <span className="ml-2 text-[10px] font-mono opacity-70">{winner.score.toFixed(1)}/10</span>
                      </div>
                    </div>
                  </div>

                  {/* Answer text */}
                  <blockquote className="text-sm leading-relaxed text-foreground/90 pl-4"
                    style={{ borderLeft: `3px solid ${getModelMeta(winner.model).color}80` }}>
                    {winner.answer}
                  </blockquote>
                </div>
              </div>
            )}

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
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">{t("agreementPoints")}</div>
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
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">{t("disagreementPoints")}</div>
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

              <CardContent className="pt-4 flex-1 space-y-3">
                {/* Round 1 Answer */}
                <div className="rounded-xl p-3.5 bg-muted/10 border border-muted/30">
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 text-muted-foreground">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-background shrink-0" style={{ backgroundColor: hexColor }}>1</span>
                    {t("round1Label")}
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{res.answer}</p>
                  {res.isGeneric && (
                    <div className="flex items-start gap-2 mt-2 pt-2 border-t border-amber-500/20">
                      <Database className="h-3 w-3 shrink-0 mt-0.5 text-amber-400" />
                      <span className="text-[10px] font-semibold text-amber-400 leading-snug">Response may be cached — not specific to this question</span>
                    </div>
                  )}
                </div>

                {/* Round 2 Self-Criticism */}
                <div className="rounded-xl p-3.5" style={{ border: `1px solid ${borderTint}`, backgroundColor: bgTint }}>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: hexColor }}>
                    <MessageSquareQuote className="h-3 w-3 shrink-0" />
                    {t("round2Label")}
                  </div>
                  {res.declined ? (
                    <div className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                      <div>
                        <p className="text-sm font-semibold text-rose-400 leading-snug">This AI declined to self-evaluate on this question</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">This is a finding, not an error — it tells you something important about how this model handles self-evaluation.</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed italic text-foreground/80">"{res.selfCriticism}"</p>
                  )}
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
                  {t("copyText")}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
