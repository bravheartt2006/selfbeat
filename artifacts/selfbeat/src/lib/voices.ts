// Shared voice cache — Chrome returns an empty array on the first getVoices()
// call. We listen for voiceschanged so we always have the full list ready.

let _voices: SpeechSynthesisVoice[] = [];

function _load() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    _voices = window.speechSynthesis.getVoices();
  }
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  _load();
  window.speechSynthesis.addEventListener("voiceschanged", _load);
}

export function getVoices(): SpeechSynthesisVoice[] {
  if (!_voices.length) _load();
  return _voices;
}

export function pickVoice(speechLang: string): SpeechSynthesisVoice | null {
  const voices = getVoices();
  if (!voices.length) return null;

  const base = speechLang.split("-")[0].toLowerCase();

  // Preferred high-quality voices per language
  const preferred = [
    "Google US English Female",
    "Google UK English Female",
    "Google français",
    "Google Arabic",
    "Google 普通话（中国大陆）",
    "Google italiano",
    "Google español de Estados Unidos",
    "Google español",
    "Microsoft Zira",
    "Microsoft Hoda",   // Arabic
    "Microsoft Huihui", // Chinese
    "Microsoft Elsa",   // Italian
    "Microsoft Helena", // Spanish
    "Samantha", "Karen", "Victoria", "Moira", "Fiona",
  ];

  return (
    // 1. Preferred name + matching language
    voices.find(v => preferred.some(p => v.name.includes(p)) && v.lang.toLowerCase().startsWith(base)) ||
    // 2. Any non-local (usually higher quality) voice matching the language
    voices.find(v => v.lang.toLowerCase().startsWith(base) && !v.localService) ||
    // 3. Any voice matching the language
    voices.find(v => v.lang.toLowerCase().startsWith(base)) ||
    null
  );
}
