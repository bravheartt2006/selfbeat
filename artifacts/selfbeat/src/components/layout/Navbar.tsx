import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Activity, Globe, Check } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { LANGUAGES } from "@/lib/i18n";

export default function Navbar() {
  const [location] = useLocation();
  const { t, lang, setLang } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);

  const navItems = [
    { href: "/",            label: t("navHome") },
    { href: "/leaderboard", label: t("navLeaderboard") },
    { href: "/about",       label: t("navAbout") },
  ];

  const currentLang = LANGUAGES.find((l) => l.code === lang)!;

  return (
    <nav className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <Activity className="h-6 w-6 text-primary" />
            <span className="font-serif font-bold text-xl tracking-tight">Selfbeat</span>
          </Link>
          <div className="flex gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  location === item.href ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Language switcher */}
        <div className="relative">
          <button
            onClick={() => setLangOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/40 bg-card/50 hover:bg-card hover:border-primary/30 transition-all text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Change language"
            aria-expanded={langOpen}
          >
            <Globe className="h-4 w-4" />
            <span>{currentLang.flag}</span>
            <span className="hidden sm:inline">{currentLang.nativeName}</span>
          </button>

          {langOpen && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
              {/* Dropdown */}
              <div className="absolute right-0 top-full mt-2 z-50 min-w-[180px] rounded-xl border border-border/50 bg-popover shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => { setLang(l.code); setLangOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-left ${
                      l.code === lang ? "text-primary font-medium" : "text-foreground"
                    }`}
                    dir={l.dir}
                  >
                    <span className="text-base">{l.flag}</span>
                    <span className="flex-1">{l.nativeName}</span>
                    {l.code === lang && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

      </div>
    </nav>
  );
}
