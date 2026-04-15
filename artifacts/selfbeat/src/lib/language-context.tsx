import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { LangCode, TranslationKey, translate, getLangMeta, STORAGE_KEY } from "./i18n";

interface LanguageContextValue {
  lang: LangCode;
  setLang: (code: LangCode) => void;
  t: (key: TranslationKey) => string;
  dir: "ltr" | "rtl";
  speechLang: string;
  hasChosen: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const stored = localStorage.getItem(STORAGE_KEY) as LangCode | null;

  const [lang, setLangState] = useState<LangCode>(stored || "en");
  const [hasChosen, setHasChosen] = useState<boolean>(!!stored);

  const setLang = (code: LangCode) => {
    localStorage.setItem(STORAGE_KEY, code);
    setLangState(code);
    setHasChosen(true);
  };

  const meta = getLangMeta(lang);

  useEffect(() => {
    document.documentElement.lang = meta.speechLang;
    document.documentElement.dir = meta.dir;
  }, [meta]);

  const t = (key: TranslationKey) => translate(lang, key);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir: meta.dir, speechLang: meta.speechLang, hasChosen }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
