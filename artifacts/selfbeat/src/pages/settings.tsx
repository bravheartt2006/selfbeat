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
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppAuth } from "@/lib/auth-context";

interface EmailPrefs {
  weeklyDigest: boolean;
  streakReminders: boolean;
  creditWarnings: boolean;
  promotional: boolean;
  unsubscribedAt: string | null;
}

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

export default function SettingsPage() {
  const { user, isSignedIn, isLoaded } = useAppAuth();
  const [, setLocation] = useLocation();
  const [prefs, setPrefs] = useState<EmailPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchPrefs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/email-preferences", { credentials: "include" });
      if (r.ok) setPrefs(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && isSignedIn) fetchPrefs();
    else if (isLoaded && !isSignedIn) setLoading(false);
  }, [isLoaded, isSignedIn, fetchPrefs]);

  const handleToggle = async (key: keyof EmailPrefs, val: boolean) => {
    if (!prefs) return;
    const updated = { ...prefs, [key]: val, unsubscribedAt: null };
    setPrefs(updated);
    setSaving(true);
    setSaved(false);
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
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded || loading) {
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
          <p className="text-sm text-muted-foreground">Sign in to manage your email preferences.</p>
          <Button onClick={() => setLocation("/sign-in")}>Sign In</Button>
        </div>
      </div>
    );
  }

  const isGloballyUnsubscribed = !!prefs?.unsubscribedAt;

  return (
    <div className="container max-w-2xl py-10 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLocation("/")}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-serif font-bold">Email Preferences</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{user?.email}</p>
        </div>
        {saving && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Saving…
          </div>
        )}
        {saved && !saving && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-green-400">
            <CheckCircle className="h-3.5 w-3.5" />
            Saved
          </div>
        )}
      </div>

      {/* Global unsubscribe notice */}
      {isGloballyUnsubscribed && (
        <div className="border border-amber-500/30 bg-amber-500/5 rounded-xl px-5 py-4 flex items-start gap-3">
          <BellOff className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-300">All emails paused</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You unsubscribed from all Selfbeat emails.
              Enable any toggle below to re-subscribe.
            </p>
          </div>
        </div>
      )}

      {/* Email preference toggles */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Email Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-0 divide-y divide-border/20">
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
                  disabled={saving}
                  className="shrink-0 mt-0.5"
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Info note */}
      <p className="text-xs text-muted-foreground text-center leading-relaxed px-4">
        Changes are saved automatically. You can also unsubscribe via the link at the bottom of any Selfbeat email.
        We will always send important account and security emails regardless of these settings.
      </p>
    </div>
  );
}
