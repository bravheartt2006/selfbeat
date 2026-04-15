import { Activity } from "lucide-react";
import { LANGUAGES, LangCode } from "@/lib/i18n";
import { useLanguage } from "@/lib/language-context";

export default function LanguageSelect() {
  const { setLang } = useLanguage();

  const choose = (code: LangCode) => {
    setLang(code);
  };

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

      {/* Prompt */}
      <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-100">
        <h2 className="text-2xl md:text-3xl font-semibold mb-2">Choose your language</h2>
        <p className="text-muted-foreground text-sm">Choisissez / اختر / 选择语言 / Scegli / Elige</p>
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
