// Shared voice cache — Chrome returns an empty array on the first getVoices()
// call. We listen for voiceschanged so we always have the full list ready.

let _voices: SpeechSynthesisVoice[] = [];
let _voicesReady = false;
const _readyCallbacks: Array<() => void> = [];

function _load() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    const v = window.speechSynthesis.getVoices();
    if (v.length > 0) {
      _voices = v;
      if (!_voicesReady) {
        _voicesReady = true;
        _readyCallbacks.forEach((cb) => cb());
        _readyCallbacks.length = 0;
      }
    }
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

/**
 * Returns a Promise that resolves with the full voice list once Chrome has
 * finished loading voices. Resolves immediately if voices are already loaded.
 * Times out after `ms` milliseconds and resolves with whatever is available.
 */
export function waitForVoices(ms = 3000): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve([]);
  }
  _load();
  if (_voicesReady && _voices.length > 0) return Promise.resolve(_voices);

  return new Promise((resolve) => {
    const done = () => resolve(_voices);

    // Fire when voiceschanged resolves the cache
    _readyCallbacks.push(done);

    // Fallback: poll every 100 ms in case voiceschanged never fires
    const poll = setInterval(() => {
      _load();
      if (_voices.length > 0) {
        clearInterval(poll);
        // Remove from callbacks if it's still there
        const idx = _readyCallbacks.indexOf(done);
        if (idx !== -1) _readyCallbacks.splice(idx, 1);
        resolve(_voices);
      }
    }, 100);

    // Hard timeout
    setTimeout(() => {
      clearInterval(poll);
      const idx = _readyCallbacks.indexOf(done);
      if (idx !== -1) _readyCallbacks.splice(idx, 1);
      resolve(_voices);
    }, ms);
  });
}

// High-quality named voices per language (checked against v.name via includes)
const PREFERRED_VOICE_NAMES = [
  "Google Arabic",
  "Microsoft Hoda",         // Arabic (Windows)
  "Google 普通话（中国大陆）",
  "Microsoft Huihui",       // Chinese (Windows)
  "Google français",
  "Microsoft Hortense",     // French (Windows)
  "Google italiano",
  "Microsoft Elsa",         // Italian (Windows)
  "Google español",
  "Google español de Estados Unidos",
  "Microsoft Helena",       // Spanish (Windows)
  "Google US English",
  "Google UK English Female",
  "Microsoft Zira",
  "Samantha", "Karen", "Victoria", "Moira", "Fiona",
];

export function pickVoice(speechLang: string): SpeechSynthesisVoice | null {
  const voices = getVoices();
  if (!voices.length) return null;

  const full = speechLang.toLowerCase();              // e.g. "ar-sa"
  const base = full.split("-")[0];                    // e.g. "ar"

  // 1. Preferred named voice whose lang exactly matches (e.g. "ar-SA")
  const exact1 = voices.find(
    (v) =>
      PREFERRED_VOICE_NAMES.some((p) => v.name.includes(p)) &&
      v.lang.toLowerCase() === full,
  );
  if (exact1) return exact1;

  // 2. Preferred named voice whose lang starts with base (e.g. "ar")
  const pref = voices.find(
    (v) =>
      PREFERRED_VOICE_NAMES.some((p) => v.name.includes(p)) &&
      v.lang.toLowerCase().startsWith(base),
  );
  if (pref) return pref;

  // 3. Any non-local (network/cloud) voice that matches the base language
  const netBase = voices.find(
    (v) => v.lang.toLowerCase().startsWith(base) && !v.localService,
  );
  if (netBase) return netBase;

  // 4. Any voice matching the full lang tag
  const exactAny = voices.find((v) => v.lang.toLowerCase() === full);
  if (exactAny) return exactAny;

  // 5. Any voice matching just the base language code
  const baseAny = voices.find((v) => v.lang.toLowerCase().startsWith(base));
  if (baseAny) return baseAny;

  return null;
}
