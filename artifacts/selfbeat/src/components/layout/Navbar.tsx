import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Globe, Check, Coins, LogOut, ChevronDown, ShieldCheck, Mail } from "lucide-react";
import { SelfbeatLogo } from "@/components/SelfbeatLogo";
import { useLanguage } from "@/lib/language-context";
import { useCredits } from "@/lib/credits-context";
import { useAppAuth } from "@/lib/auth-context";
import { LANGUAGES } from "@/lib/i18n";

export default function Navbar() {
  const [location] = useLocation();
  const { t, lang, setLang } = useLanguage();
  const { credits, isUnlimited, isLoaded } = useCredits();
  const { isSignedIn, user, signOut } = useAppAuth();
  const [langOpen, setLangOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const navItems = [
    { href: "/",            label: t("navHome") },
    { href: "/leaderboard", label: t("navLeaderboard") },
    { href: "/blog",        label: "Blog" },
    { href: "/about",       label: t("navAbout") },
    { href: "/pricing",     label: t("navPricing") ?? "Pricing" },
  ];

  const currentLang = LANGUAGES.find((l) => l.code === lang)!;

  const firstName = user?.displayName?.split(" ")[0] ?? null;

  return (
    <nav className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between">

        {/* Logo + nav */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <SelfbeatLogo size={26} className="text-primary" />
            <span className="font-serif font-bold text-xl tracking-tight">Selfbeat</span>
          </Link>
          <div className="hidden md:flex gap-5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  (item.href === "/" ? location === "/" : location.startsWith(item.href))
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">

          {/* Credits badge (signed-in only) */}
          {isSignedIn && isLoaded && (
            <Link
              href="/pricing"
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Coins className="h-4 w-4 text-amber-500" />
              {isUnlimited ? (
                <span className="text-green-600 font-semibold">Unlimited</span>
              ) : (
                <span>
                  <span className="font-bold text-foreground">{credits}</span>
                  <span className="text-muted-foreground ml-0.5 hidden sm:inline"> credits</span>
                </span>
              )}
            </Link>
          )}

          {/* Language switcher */}
          <div className="relative">
            <button
              onClick={() => { setLangOpen((v) => !v); setUserOpen(false); }}
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
                <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
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

          {/* Auth */}
          {!isSignedIn ? (
            <Link
              href="/sign-in"
              className="text-sm font-medium px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {t("sign_in") ?? "Sign in"}
            </Link>
          ) : (
            <div className="relative">
              <button
                onClick={() => { setUserOpen((v) => !v); setLangOpen(false); }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/40 bg-card/50 hover:bg-card transition-all text-sm"
                aria-expanded={userOpen}
              >
                {user?.pictureUrl ? (
                  <img
                    src={user.pictureUrl}
                    alt={user.displayName ?? "User"}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {firstName?.[0] ?? "?"}
                  </div>
                )}
                <span className="hidden sm:inline max-w-[100px] truncate text-muted-foreground">
                  {firstName ?? user?.email?.split("@")[0] ?? ""}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>

              {userOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 min-w-[180px] rounded-xl border border-border/50 bg-popover shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-3 border-b border-border/40">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {user?.displayName ?? firstName ?? "User"}
                        </p>
                        {user?.isAdmin && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                            <ShieldCheck className="h-2.5 w-2.5" />
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {user?.email}
                      </p>
                    </div>
                    {user?.isAdmin && (
                      <Link
                        href="/admin"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-primary font-medium"
                        onClick={() => setUserOpen(false)}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Admin Panel
                      </Link>
                    )}
                    <Link
                      href="/pricing"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-foreground"
                      onClick={() => setUserOpen(false)}
                    >
                      <Coins className="h-4 w-4 text-amber-500" />
                      {isUnlimited ? "Unlimited" : `${credits} credit${credits !== 1 ? "s" : ""}`}
                    </Link>
                    <Link
                      href="/settings"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-foreground"
                      onClick={() => setUserOpen(false)}
                    >
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      Email Preferences
                    </Link>
                    <button
                      onClick={() => { signOut(); setUserOpen(false); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-foreground text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      {t("sign_out") ?? "Sign out"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

      </div>
    </nav>
  );
}
