import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Mail,
  Flame,
  Coins,
  Megaphone,
  CheckCircle,
  RefreshCw,
  ArrowLeft,
  Bell,
  BellOff,
  Copy,
  Share2,
  Gift,
  Users,
  Link,
  Twitter,
  MessageCircle,
  Linkedin,
  Send,
  ChevronDown,
  AlertCircle,
  CreditCard,
  Zap,
  ExternalLink,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAppAuth } from "@/lib/auth-context";
import { useCredits } from "@/lib/credits-context";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmailPrefs {
  weeklyDigest: boolean;
  streakReminders: boolean;
  creditWarnings: boolean;
  promotional: boolean;
  unsubscribedAt: string | null;
}

interface ReferralInfo {
  code: string;
  referralLink: string;
  totalReferred: number;
  completed: number;
  creditsEarned: number;
}

// ── Email pref items ──────────────────────────────────────────────────────────

const PREF_ITEMS = [
  {
    key: "weeklyDigest" as keyof EmailPrefs,
    icon: Mail,
    label: "Weekly Digest",
    description: "Top AI debates, leaderboard updates, and your personal stats every Monday at 9am.",
    color: "text-blue-400",
  },
  {
    key: "streakReminders" as keyof EmailPrefs,
    icon: Flame,
    label: "Streak Reminders",
    description: "Get a nudge when you're close to losing your debate streak.",
    color: "text-orange-400",
  },
  {
    key: "creditWarnings" as keyof EmailPrefs,
    icon: Coins,
    label: "Credit Warnings",
    description: "Be notified when your question credits are running low.",
    color: "text-amber-400",
  },
  {
    key: "promotional" as keyof EmailPrefs,
    icon: Megaphone,
    label: "Promotional Emails",
    description: "Occasional updates about new features, plan offers, and Selfbeat news.",
    color: "text-purple-400",
  },
];

const GIFT_AMOUNTS = [5, 10, 25];

const APP_URL = typeof window !== "undefined"
  ? `${window.location.protocol}//${window.location.host}`
  : "https://selfbeat.ai";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, isSignedIn, isLoaded } = useAppAuth();
  const { isUnlimited, credits } = useCredits();
  const [, setLocation] = useLocation();

  const [portalLoading, setPortalLoading] = useState(false);

  const handlePortal = useCallback(async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch {
      // silently ignore
    } finally {
      setPortalLoading(false);
    }
  }, []);

  // Email prefs
  const [prefs, setPrefs] = useState<EmailPrefs | null>(null);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState(false);

  // Referral
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [loadingRef, setLoadingRef] = useState(true);
  const [copied, setCopied] = useState(false);

  // Gift
  const [giftEmail, setGiftEmail] = useState("");
  const [giftAmount, setGiftAmount] = useState<number>(10);
  const [sendingGift, setSendingGift] = useState(false);
  const [giftMsg, setGiftMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ── Fetchers ─────────────────────────────────────────────────────────────────

  const fetchPrefs = useCallback(async () => {
    setLoadingPrefs(true);
    try {
      const r = await fetch("/api/email-preferences", { credentials: "include" });
      if (r.ok) setPrefs(await r.json());
    } finally {
      setLoadingPrefs(false);
    }
  }, []);

  const fetchReferral = useCallback(async () => {
    setLoadingRef(true);
    try {
      const r = await fetch("/api/referral", { credentials: "include" });
      if (r.ok) setReferral(await r.json());
    } finally {
      setLoadingRef(false);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchPrefs();
      fetchReferral();
    } else if (isLoaded && !isSignedIn) {
      setLoadingPrefs(false);
      setLoadingRef(false);
    }
  }, [isLoaded, isSignedIn, fetchPrefs, fetchReferral]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleToggle = async (key: keyof EmailPrefs, val: boolean) => {
    if (!prefs) return;
    const updated = { ...prefs, [key]: val, unsubscribedAt: null };
    setPrefs(updated);
    setSavingPrefs(true);
    setSavedPrefs(false);
    try {
      await fetch("/api/email-preferences", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weeklyDigest: updated.weeklyDigest,
          streakReminders: updated.streakReminders,
          creditWarnings: updated.creditWarnings,
          promotional: updated.promotional,
        }),
      });
      setSavedPrefs(true);
      setTimeout(() => setSavedPrefs(false), 2500);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleCopy = async () => {
    if (!referral?.referralLink) return;
    try {
      await navigator.clipboard.writeText(referral.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = referral.referralLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!giftEmail.trim() || !giftAmount) return;
    setSendingGift(true);
    setGiftMsg(null);
    try {
      const r = await fetch("/api/gifts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverEmail: giftEmail.trim(), credits: giftAmount }),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        const isPending = d.status === "pending";
        setGiftMsg({
          type: "success",
          text: isPending
            ? `Gift sent! ${giftEmail} will receive ${giftAmount} credits when they sign up.`
            : `${giftAmount} credits delivered to ${giftEmail}!`,
        });
        setGiftEmail("");
      } else {
        setGiftMsg({ type: "error", text: d.error ?? "Failed to send gift." });
      }
    } catch {
      setGiftMsg({ type: "error", text: "Something went wrong. Please try again." });
    } finally {
      setSendingGift(false);
    }
  };

  // ── Share URLs ───────────────────────────────────────────────────────────────

  const shareText = encodeURIComponent(
    "I've been using Selfbeat to make AIs judge themselves — it's wild! Try it free:"
  );
  const shareUrl = encodeURIComponent(referral?.referralLink ?? "");

  const shareLinks = [
    {
      name: "X (Twitter)",
      icon: Twitter,
      color: "hover:bg-[#1a1a1a] hover:border-[#444]",
      href: `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,
    },
    {
      name: "WhatsApp",
      icon: MessageCircle,
      color: "hover:bg-green-900/30 hover:border-green-500/40",
      href: `https://wa.me/?text=${shareText}%20${shareUrl}`,
    },
    {
      name: "LinkedIn",
      icon: Linkedin,
      color: "hover:bg-blue-900/30 hover:border-blue-500/40",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`,
    },
  ];

  // ── Guards ───────────────────────────────────────────────────────────────────

  if (!isLoaded || loadingPrefs) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-serif font-bold">Sign In Required</h1>
          <p className="text-sm text-muted-foreground">Sign in to access your settings.</p>
          <Button onClick={() => setLocation("/sign-in")}>Sign In</Button>
        </div>
      </div>
    );
  }

  const isGloballyUnsubscribed = !!prefs?.unsubscribedAt;

  return (
    <div className="container max-w-2xl py-10 space-y-10">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLocation("/")}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-serif font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{user?.email}</p>
        </div>
        {savingPrefs && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Saving…
          </div>
        )}
        {savedPrefs && !savingPrefs && (
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <CheckCircle className="h-3.5 w-3.5" />
            Saved
          </div>
        )}
      </div>

      {/* ── PLAN & BILLING SECTION ───────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Plan &amp; Billing
        </h2>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted/60 shrink-0">
                {isUnlimited ? (
                  <Zap className="h-5 w-5 text-violet-400" />
                ) : (
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                {isUnlimited && user?.planType ? (
                  <>
                    <p className="font-semibold text-foreground capitalize">
                      {user.planType === "monthly"
                        ? "Pro Monthly"
                        : user.planType === "annual"
                        ? "Pro Annual"
                        : user.planType === "team"
                        ? "Team Plan"
                        : "Pro"} &mdash; Active
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Unlimited AI comparisons, self-critiques, and the full verdict.
                    </p>
                    <div className="mt-4 flex flex-col sm:flex-row gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={handlePortal}
                        disabled={portalLoading}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {portalLoading ? "Opening..." : "Manage Subscription"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-foreground">Free Plan</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {credits} credit{credits !== 1 ? "s" : ""} remaining.{" "}
                      Upgrade to unlock unlimited comparisons.
                    </p>
                    <div className="mt-4">
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={() => setLocation("/pricing")}
                      >
                        <Zap className="h-3.5 w-3.5" />
                        Upgrade plan
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── REFERRAL SECTION ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Refer a Friend
        </h2>

        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-950/20 to-transparent">
          <CardContent className="pt-6 space-y-5">
            {/* Value prop */}
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-foreground">Share Selfbeat, earn credits</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your friend gets <span className="text-amber-400 font-semibold">+5 bonus credits</span> (30 total) when they sign up.
                You earn <span className="text-amber-400 font-semibold">+10 credits</span> once they ask their first question.
              </p>
            </div>

            {/* Stats */}
            {referral && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold font-serif text-foreground">{referral.totalReferred}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Referred</p>
                </div>
                <div className="bg-muted/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold font-serif text-green-400">{referral.completed}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Completed</p>
                </div>
                <div className="bg-muted/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold font-serif text-amber-400">{referral.creditsEarned}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Credits Earned</p>
                </div>
              </div>
            )}

            {/* Referral link */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your referral link</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-muted/20 border border-border/40 rounded-lg px-3 py-2 text-sm font-mono text-foreground/80 truncate">
                  {loadingRef ? (
                    <span className="text-muted-foreground">Loading…</span>
                  ) : (
                    referral?.referralLink ?? `${APP_URL}/?ref=…`
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  disabled={!referral}
                  className="gap-1.5 shrink-0"
                >
                  {copied ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>

            {/* Share buttons */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Share via</p>
              <div className="flex gap-2 flex-wrap">
                {shareLinks.map(({ name, icon: Icon, color, href }) => (
                  <a
                    key={name}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border/40 bg-muted/20 transition-colors ${color} text-foreground/80 hover:text-foreground`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {name}
                  </a>
                ))}
                <button
                  onClick={handleCopy}
                  disabled={!referral}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border/40 bg-muted/20 transition-colors hover:bg-primary/10 hover:border-primary/30 text-foreground/80 hover:text-foreground"
                >
                  <Link className="h-3.5 w-3.5" />
                  Copy Link
                </button>
              </div>
            </div>

          </CardContent>
        </Card>
      </section>

      {/* ── GIFT CREDITS SECTION ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          <Gift className="h-4 w-4" />
          Gift Credits
        </h2>

        <Card>
          <CardContent className="pt-6 space-y-5">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Send credits to a friend</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Credits are deducted from your account immediately.
                If your friend doesn't have a Selfbeat account yet, they'll receive the credits when they sign up.
              </p>
            </div>

            <form onSubmit={handleGift} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Friend's email</label>
                <Input
                  type="email"
                  placeholder="friend@example.com"
                  value={giftEmail}
                  onChange={(e) => setGiftEmail(e.target.value)}
                  required
                />
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gift amount</label>
                <div className="flex gap-2">
                  {GIFT_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setGiftAmount(amount)}
                      className={`flex-1 py-3 rounded-xl border text-sm font-bold font-serif transition-all ${
                        giftAmount === amount
                          ? "bg-amber-500/15 border-amber-500/50 text-amber-400 shadow-sm"
                          : "bg-muted/20 border-border/40 text-muted-foreground hover:border-border/70"
                      }`}
                    >
                      {amount}
                      <span className="block text-xs font-normal font-sans mt-0.5 opacity-70">credits</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Balance warning */}
              {user && !user.isUnlimited && user.credits < giftAmount && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  You only have {user.credits} credits. You need {giftAmount} to send this gift.
                </div>
              )}

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={
                  sendingGift ||
                  !giftEmail.trim() ||
                  (!user?.isUnlimited && (user?.credits ?? 0) < giftAmount)
                }
              >
                {sendingGift ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Gift className="h-4 w-4" />
                )}
                {sendingGift ? "Sending gift…" : `Gift ${giftAmount} Credits`}
              </Button>
            </form>

            {giftMsg && (
              <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg border ${
                giftMsg.type === "success"
                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}>
                {giftMsg.type === "success"
                  ? <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  : <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                }
                {giftMsg.text}
              </div>
            )}

            {/* Current balance */}
            <div className="border-t border-border/20 pt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your balance</span>
              <span className="font-bold font-serif text-amber-400">
                {user?.isUnlimited ? "Unlimited" : `${user?.credits ?? 0} credits`}
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── EMAIL PREFERENCES SECTION ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Email Preferences
        </h2>

        {isGloballyUnsubscribed && (
          <div className="border border-amber-500/30 bg-amber-500/5 rounded-xl px-5 py-4 flex items-start gap-3 mb-4">
            <BellOff className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-300">All emails paused</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You unsubscribed from all Selfbeat emails. Enable any toggle below to re-subscribe.
              </p>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="pt-4 space-y-0 divide-y divide-border/20">
            {PREF_ITEMS.map(({ key, icon: Icon, label, description, color }) => {
              const checked = prefs ? (prefs[key] as boolean) !== false : true;
              return (
                <div key={key} className="flex items-start gap-4 py-4">
                  <div className={`h-9 w-9 rounded-lg bg-muted/30 flex items-center justify-center shrink-0 ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
                  </div>
                  <Switch
                    checked={checked}
                    onCheckedChange={(val) => handleToggle(key, val)}
                    disabled={savingPrefs}
                    className="shrink-0 mt-0.5"
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center leading-relaxed px-4 mt-4">
          Changes are saved automatically. You can also unsubscribe via the link at the bottom of any Selfbeat email.
        </p>
      </section>

    </div>
  );
}
