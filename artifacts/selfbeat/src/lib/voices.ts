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

// High-quality named voices per language (checked against v.name via includes).
// Both female and non-gendered Google voices are listed; the female preference
// filter below will always pick the female candidate first when both exist.
const PREFERRED_VOICE_NAMES = [
  // Arabic
  "Microsoft Hoda",               // Arabic female (Windows)
  "Google Arabic",
  // Chinese
  "Microsoft Huihui",             // Chinese female (Windows)
  "Google 普通话（中国大陆）",
  // French
  "Microsoft Hortense",           // French female (Windows)
  "Google français",
  // Italian
  "Microsoft Elsa",               // Italian female (Windows)
  "Google italiano",
  // Spanish
  "Microsoft Helena",             // Spanish female (Windows)
  "Google español de Estados Unidos",
  "Google español",
  // English — female-specific names listed before generic ones
  "Google UK English Female",
  "Microsoft Zira",               // English female (Windows)
  "Microsoft Hazel",              // English UK female (Windows)
  "Samantha", "Karen", "Victoria", "Moira", "Fiona",
  "Google US English",
];

// Keywords that identify a voice as female across all TTS engines / platforms.
const FEMALE_VOICE_KEYWORDS = [
  "female", "woman", "girl", "feminine",
  "Hoda",      // ar   - Microsoft Arabic female
  "Huihui",    // zh   - Microsoft Chinese female
  "Hortense",  // fr   - Microsoft French female
  "Elsa",      // it   - Microsoft Italian female
  "Helena",    // es   - Microsoft Spanish female
  "Zira",      // en   - Microsoft English female
  "Hazel",     // en-GB- Microsoft English UK female
  "Samantha",  // en   - macOS English female
  "Karen",     // en-AU- macOS English Australian female
  "Victoria",  // en   - macOS English female
  "Moira",     // en-IE- macOS English Irish female
  "Fiona",     // en-GB- macOS English Scottish female
];

function isFemaleVoice(v: SpeechSynthesisVoice): boolean {
  const name = v.name.toLowerCase();
  return FEMALE_VOICE_KEYWORDS.some((k) => name.includes(k.toLowerCase()));
}

/**
 * From a list of candidate voices, return the female one if available,
 * otherwise return the first candidate (any gender) or null.
 */
function preferFemale(candidates: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!candidates.length) return null;
  return candidates.find(isFemaleVoice) ?? candidates[0];
}

/**
 * Pick the best available voice for the given BCP-47 lang tag.
 * Female voices are always preferred over male/neutral ones at every tier.
 *
 * Tier order (most to least preferred):
 *   1. Named preferred voice  ×  exact lang tag
 *   2. Named preferred voice  ×  base language code
 *   3. Network/cloud voice    ×  base language code
 *   4. Any voice              ×  exact lang tag
 *   5. Any voice              ×  base language code
 */
export function pickVoice(speechLang: string): SpeechSynthesisVoice | null {
  const voices = getVoices();
  if (!voices.length) return null;

  const full = speechLang.toLowerCase();              // e.g. "ar-sa"
  const base = full.split("-")[0];                    // e.g. "ar"

  // 1. Preferred named voice whose lang exactly matches (e.g. "ar-SA")
  const tier1 = voices.filter(
    (v) =>
      PREFERRED_VOICE_NAMES.some((p) => v.name.includes(p)) &&
      v.lang.toLowerCase() === full,
  );
  const pick1 = preferFemale(tier1);
  if (pick1) return pick1;

  // 2. Preferred named voice whose lang starts with base (e.g. "ar")
  const tier2 = voices.filter(
    (v) =>
      PREFERRED_VOICE_NAMES.some((p) => v.name.includes(p)) &&
      v.lang.toLowerCase().startsWith(base),
  );
  const pick2 = preferFemale(tier2);
  if (pick2) return pick2;

  // 3. Any non-local (network/cloud) voice that matches the base language
  const tier3 = voices.filter(
    (v) => v.lang.toLowerCase().startsWith(base) && !v.localService,
  );
  const pick3 = preferFemale(tier3);
  if (pick3) return pick3;

  // 4. Any voice matching the full lang tag
  const tier4 = voices.filter((v) => v.lang.toLowerCase() === full);
  const pick4 = preferFemale(tier4);
  if (pick4) return pick4;

  // 5. Any voice matching just the base language code
  const tier5 = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  const pick5 = preferFemale(tier5);
  if (pick5) return pick5;

  return null;
}
