import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Users,
  MessageSquare,
  DollarSign,
  TrendingUp,
  Search,
  Plus,
  Minus,
  Calendar,
  Flame,
  Shield,
  RefreshCw,
  CheckCircle,
  XCircle,
  ChevronRight,
  ShieldOff,
  ShieldCheck,
  Ban,
  Coins,
  Clock,
  BarChart3,
  CalendarDays,
  AlertTriangle,
  Star,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppAuth } from "@/lib/auth-context";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Stats {
  totalUsers: number;
  newSignupsToday: number;
  newSignupsThisWeek: number;
  activeProMonthly: number;
  activeProAnnual: number;
  activeTeam: number;
  totalQuestionsAllTime: number | null;
  questionsToday: number | null;
  totalRevenueCents: number | null;
  revenueTodayCents: number | null;
  revenueThisMonthCents: number | null;
}

interface AdminUser {
  id: string;
  email: string | null;
  displayName: string | null;
  pictureUrl: string | null;
  credits: number;
  isUnlimited: boolean;
  isBanned: boolean;
  planType: string | null;
  subscriptionStatus: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  streakCount: number;
  totalQotdRuns: number;
  trialUsed: boolean;
  trialEndDate: string | null;
}

interface QotdQuestion {
  id: number;
  question: string;
  isActive: boolean;
  sortOrder: number;
  addedAt: string;
}

interface QotdData {
  questions: QotdQuestion[];
  todayQuestionId: number | null;
  tomorrowQuestionId: number | null;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-primary",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1 pr-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1 leading-tight">
              {label}
            </p>
            <p className={`text-2xl font-bold font-serif ${color} truncate`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-muted/40 ${color} shrink-0`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(cents: number | null) {
  if (cents === null) return "N/A";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

const EPOCH_START = new Date("2025-01-01T00:00:00Z");
function getDayIndex(date: Date = new Date()) {
  return Math.floor((date.getTime() - EPOCH_START.getTime()) / (1000 * 60 * 60 * 24));
}

function computeSchedule(questions: QotdQuestion[], days = 30): { date: string; question: QotdQuestion }[] {
  const active = questions.filter((q) => q.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  if (!active.length) return [];
  const today = new Date();
  const todayIdx = getDayIndex(today);
  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const q = active[(todayIdx + i) % active.length];
    result.push({ date: dateStr, question: q });
  }
  return result;
}

// ── Admin Page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAppAuth();
  const [, setLocation] = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean | "denied" | null>(null);
  const [deniedReason, setDeniedReason] = useState<"not_signed_in" | "wrong_email" | "error">("error");
  const [serverUserEmail, setServerUserEmail] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // QOTD
  const [qotd, setQotd] = useState<QotdData | null>(null);
  const [qotdLoading, setQotdLoading] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [addingQ, setAddingQ] = useState(false);
  const [qotdMsg, setQotdMsg] = useState("");
  const [tomorrowOverride, setTomorrowOverride] = useState<number | "">("");
  const [settingOverride, setSettingOverride] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  // User management
  const [searchEmail, setSearchEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<AdminUser | null | "not-found">(null);
  const [creditDelta, setCreditDelta] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [creditMsg, setCreditMsg] = useState("");
  const [banning, setBanning] = useState(false);
  const [banMsg, setBanMsg] = useState("");

  // ── Auth check ───────────────────────────────────────────────────────────────

  const runAdminCheck = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/check", { credentials: "include" });
      const d = await r.json();
      setServerUserEmail(d.userEmail ?? null);
      if (d.isAdmin) {
        setIsAdmin(true);
      } else {
        setIsAdmin("denied");
        setDeniedReason(d.reason ?? "error");
      }
    } catch {
      setIsAdmin("denied");
      setDeniedReason("error");
    }
  }, []);

  useEffect(() => { runAdminCheck(); }, [runAdminCheck]);

  // ── Data loaders ─────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (res.ok) setStats(await res.json());
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadQotd = useCallback(async () => {
    setQotdLoading(true);
    try {
      const res = await fetch("/api/admin/daily-questions", {
        headers: { "x-admin-key": "selfbeat-admin-2025" },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setQotd(data);
        // Pre-fill tomorrow override selector
        if (data.tomorrowQuestionId) setTomorrowOverride(data.tomorrowQuestionId);
      }
    } finally {
      setQotdLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin === true) {
      loadStats();
      loadQotd();
    }
  }, [isAdmin, loadStats, loadQotd]);

  // ── User search ──────────────────────────────────────────────────────────────

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;
    setSearching(true);
    setFoundUser(null);
    setCreditMsg("");
    setBanMsg("");
    try {
      const res = await fetch(
        `/api/admin/user-search?email=${encodeURIComponent(searchEmail.trim())}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const d = await res.json();
        setFoundUser(d.user ?? "not-found");
      }
    } finally {
      setSearching(false);
    }
  };

  const handleAdjustCredits = async (delta: number) => {
    if (!foundUser || foundUser === "not-found") return;
    setAdjusting(true);
    setCreditMsg("");
    try {
      const res = await fetch("/api/admin/adjust-credits", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: foundUser.id, delta }),
      });
      if (res.ok) {
        const d = await res.json();
        setFoundUser({ ...foundUser, credits: d.newCredits });
        setCreditMsg(`Credits updated to ${d.newCredits}`);
      }
    } finally {
      setAdjusting(false);
    }
  };

  const handleBan = async (ban: boolean) => {
    if (!foundUser || foundUser === "not-found") return;
    setBanning(true);
    setBanMsg("");
    try {
      const res = await fetch("/api/admin/ban-user", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: foundUser.id, ban }),
      });
      if (res.ok) {
        setFoundUser({ ...foundUser, isBanned: ban });
        setBanMsg(ban ? "User has been banned." : "User has been unbanned.");
      }
    } finally {
      setBanning(false);
    }
  };

  // ── QOTD helpers ─────────────────────────────────────────────────────────────

  const toggleActive = async (id: number, current: boolean) => {
    await fetch(`/api/admin/daily-questions/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", "x-admin-key": "selfbeat-admin-2025" },
      body: JSON.stringify({ isActive: !current }),
    });
    loadQotd();
  };

  const addQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    setAddingQ(true);
    setQotdMsg("");
    try {
      const res = await fetch("/api/admin/daily-questions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-admin-key": "selfbeat-admin-2025" },
        body: JSON.stringify({ question: newQuestion.trim() }),
      });
      if (res.ok) {
        setNewQuestion("");
        setQotdMsg("Question added to rotation!");
        loadQotd();
      }
    } finally {
      setAddingQ(false);
    }
  };

  const setTomorrowQuestion = async () => {
    if (!tomorrowOverride) return;
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    setSettingOverride(true);
    try {
      const res = await fetch("/api/admin/set-qotd-override", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: tomorrowStr, questionId: Number(tomorrowOverride) }),
      });
      if (res.ok) {
        setQotdMsg("Tomorrow's question has been set!");
        loadQotd();
      }
    } finally {
      setSettingOverride(false);
    }
  };

  // ── Loading / Access Denied ──────────────────────────────────────────────────

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAdmin === "denied") {
    const notSignedIn = deniedReason === "not_signed_in";
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md w-full border border-destructive/30 bg-destructive/5 rounded-2xl p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <h1 className="text-xl font-serif font-bold">{notSignedIn ? "Sign In Required" : "Access Denied"}</h1>
          {notSignedIn ? (
            <p className="text-sm text-muted-foreground">Sign in with the admin account to continue.</p>
          ) : deniedReason === "wrong_email" ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">This account does not have admin access.</p>
              <div className="text-xs bg-muted/30 rounded-lg px-3 py-2 font-mono text-left">
                <span className="text-muted-foreground">Your email: </span>
                <span>{serverUserEmail ?? user?.email ?? "unknown"}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Could not verify admin access. Please try again.</p>
          )}
          <div className="flex gap-2 justify-center flex-wrap">
            {notSignedIn && (
              <Button size="sm" onClick={() => {
                const w = window.open("/api/auth/google", "_blank", "width=500,height=600");
                const t = setInterval(() => { if (w?.closed) { clearInterval(t); runAdminCheck(); } }, 500);
              }}>
                Sign In with Google
              </Button>
            )}
            {!notSignedIn && <Button variant="outline" size="sm" onClick={runAdminCheck}>Retry</Button>}
            <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="text-muted-foreground">Go to Home</Button>
          </div>
        </div>
      </div>
    );
  }

  const schedule = qotd ? computeSchedule(qotd.questions) : [];
  const todayQ = qotd?.questions.find((q) => q.id === qotd.todayQuestionId);
  const tomorrowQ = qotd?.questions.find((q) => q.id === qotd.tomorrowQuestionId);
  const activeQuestions = qotd?.questions.filter((q) => q.isActive) ?? [];

  return (
    <div className="container max-w-5xl py-10 space-y-10">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold">Admin Panel</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/25 px-2 py-0.5 rounded-full">
                <CheckCircle className="h-3 w-3" />
                Admin Access
              </span>
              <span className="text-xs text-muted-foreground font-mono">{user?.email}</span>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { loadStats(); loadQotd(); }} disabled={statsLoading || qotdLoading} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${statsLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* ── STATS DASHBOARD ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Stats Dashboard</h2>

        {/* Users row */}
        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">Users</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard icon={Users} label="Total Users" value={stats?.totalUsers ?? "—"} color="text-blue-400" />
          <StatCard icon={TrendingUp} label="New Today" value={stats?.newSignupsToday ?? "—"} sub="signups" color="text-green-400" />
          <StatCard icon={CalendarDays} label="New This Week" value={stats?.newSignupsThisWeek ?? "—"} sub="signups" color="text-teal-400" />
          <StatCard icon={Activity} label="Questions Today" value={stats?.questionsToday ?? "—"} color="text-purple-400" />
        </div>

        {/* Questions + subscriptions row */}
        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">Questions & Subscriptions</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard icon={MessageSquare} label="Questions All Time" value={stats?.totalQuestionsAllTime ?? "—"} color="text-violet-400" />
          <StatCard icon={Star} label="Pro Monthly" value={stats?.activeProMonthly ?? "—"} sub="active" color="text-amber-400" />
          <StatCard icon={Star} label="Pro Annual" value={stats?.activeProAnnual ?? "—"} sub="active" color="text-orange-400" />
          <StatCard icon={Users} label="Team Plan" value={stats?.activeTeam ?? "—"} sub="active" color="text-pink-400" />
        </div>

        {/* Revenue row */}
        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">Revenue</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard icon={DollarSign} label="Total Revenue" value={fmt$(stats?.totalRevenueCents ?? null)} color="text-emerald-400" />
          <StatCard icon={DollarSign} label="Revenue Today" value={fmt$(stats?.revenueTodayCents ?? null)} color="text-emerald-400" />
          <StatCard icon={BarChart3} label="Revenue This Month" value={fmt$(stats?.revenueThisMonthCents ?? null)} color="text-emerald-400" />
        </div>
      </section>

      {/* ── DAILY QUESTION MANAGEMENT ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Question of the Day</h2>

        {/* Today / Tomorrow cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-widest mb-1.5">
                <Calendar className="h-3 w-3" />
                Today — {new Date().toISOString().slice(0, 10)}
              </div>
              <p className="text-sm font-medium leading-snug">{todayQ?.question ?? "—"}</p>
            </CardContent>
          </Card>
          <Card className="border-border/30">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                <Clock className="h-3 w-3" />
                Tomorrow — {(() => { const d = new Date(); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })()}
              </div>
              <p className="text-sm font-medium leading-snug text-muted-foreground">{tomorrowQ?.question ?? "—"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Set tomorrow's question */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Override Tomorrow's Question
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-2">
              <select
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={tomorrowOverride}
                onChange={(e) => setTomorrowOverride(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">— Select a question —</option>
                {activeQuestions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.question.length > 80 ? q.question.slice(0, 80) + "…" : q.question}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={setTomorrowQuestion} disabled={!tomorrowOverride || settingOverride} className="shrink-0">
                Set
              </Button>
            </div>
            {qotdMsg && (
              <p className="text-xs text-green-400 mt-2 flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" />{qotdMsg}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Add new question */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Add New Question to Rotation
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={addQuestion} className="flex gap-2">
              <Input
                placeholder="Enter a debate question…"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={addingQ || !newQuestion.trim()} className="gap-1.5 shrink-0">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Rotation schedule */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                Rotation Schedule
                <span className="text-xs font-normal text-muted-foreground">
                  ({activeQuestions.length} active questions)
                </span>
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowSchedule((v) => !v)} className="text-xs gap-1">
                {showSchedule ? "Hide" : "Show 30 days"}
                <ChevronRight className={`h-3 w-3 transition-transform ${showSchedule ? "rotate-90" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          {showSchedule && (
            <CardContent className="pt-0">
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {schedule.map(({ date, question }, i) => (
                  <div key={date} className={`flex gap-3 items-start py-1.5 px-2 rounded-lg text-sm ${i === 0 ? "bg-amber-500/10 border border-amber-500/20" : i === 1 ? "bg-muted/20" : ""}`}>
                    <span className="text-xs font-mono text-muted-foreground shrink-0 pt-0.5 w-24">{date}</span>
                    <span className={`leading-snug ${i === 0 ? "text-amber-300 font-medium" : "text-foreground/80"}`}>{question.question}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          )}

          {/* Full question pool */}
          <CardContent className="pt-0 border-t border-border/30 mt-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3 pt-3">Full Question Pool ({qotd?.questions.length ?? 0} total)</p>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {qotd?.questions.map((q) => (
                <div key={q.id} className="flex items-center gap-2 group">
                  <button
                    onClick={() => toggleActive(q.id, q.isActive)}
                    className={`shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      q.isActive ? "bg-green-500/20 border-green-500/60 hover:bg-red-500/20 hover:border-red-500/60" : "bg-muted/30 border-border/40 hover:bg-green-500/10 hover:border-green-500/30"
                    }`}
                    title={q.isActive ? "Click to deactivate" : "Click to activate"}
                  >
                    {q.isActive ? <CheckCircle className="h-3 w-3 text-green-400" /> : <XCircle className="h-3 w-3 text-muted-foreground" />}
                  </button>
                  <span className={`text-xs leading-snug flex-1 ${q.isActive ? "text-foreground" : "text-muted-foreground line-through"}`}>
                    {q.question}
                  </span>
                  {q.id === qotd?.todayQuestionId && (
                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full shrink-0">Today</span>
                  )}
                  {q.id === qotd?.tomorrowQuestionId && (
                    <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full shrink-0">Tomorrow</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── USER MANAGEMENT ───────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">User Management</h2>
        <Card>
          <CardContent className="pt-6 space-y-5">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Search by email address…"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                type="email"
                className="flex-1"
              />
              <Button type="submit" disabled={searching || !searchEmail.trim()} className="gap-1.5 shrink-0">
                <Search className="h-4 w-4" />
                {searching ? "Searching…" : "Search"}
              </Button>
            </form>

            {foundUser === "not-found" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-3 border border-border/30 rounded-lg px-4">
                <XCircle className="h-4 w-4 text-destructive" />
                No user found with that email.
              </div>
            )}

            {foundUser && foundUser !== "not-found" && (
              <div className={`border rounded-xl p-5 space-y-4 ${foundUser.isBanned ? "border-destructive/40 bg-destructive/5" : "border-border/40 bg-card/30"}`}>

                {/* User header */}
                <div className="flex items-center gap-3">
                  {foundUser.pictureUrl ? (
                    <img src={foundUser.pictureUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                      {(foundUser.displayName || foundUser.email || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{foundUser.displayName || "—"}</p>
                      {foundUser.isBanned && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-destructive bg-destructive/10 border border-destructive/30 px-1.5 py-0.5 rounded-full shrink-0">
                          <Ban className="h-2.5 w-2.5" />
                          Banned
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{foundUser.email}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${
                    foundUser.isUnlimited
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      : foundUser.subscriptionStatus.includes("Trial")
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                        : "bg-muted/40 text-muted-foreground border-border/30"
                  }`}>
                    {foundUser.subscriptionStatus}
                  </span>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div className="bg-muted/20 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Signed Up</p>
                    <p className="font-medium">{fmtDate(foundUser.createdAt)}</p>
                  </div>
                  <div className="bg-muted/20 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Last Active</p>
                    <p className="font-medium">{fmtDate(foundUser.lastSignInAt)}</p>
                  </div>
                  <div className="bg-muted/20 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1"><Flame className="h-3 w-3 text-orange-400" />Streak</p>
                    <p className="font-bold text-orange-400">{foundUser.streakCount} day{foundUser.streakCount !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="bg-muted/20 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1"><MessageSquare className="h-3 w-3" />QOTD Runs</p>
                    <p className="font-medium">{foundUser.totalQotdRuns}</p>
                  </div>
                  <div className="bg-muted/20 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Plan Type</p>
                    <p className="font-medium capitalize">{foundUser.planType ?? "Free"}</p>
                  </div>
                  <div className="bg-muted/20 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Stripe Customer</p>
                    <p className="font-mono text-xs truncate">{foundUser.stripeCustomerId || "—"}</p>
                  </div>
                </div>

                {/* Credits */}
                <div className="border border-border/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-1.5"><Coins className="h-4 w-4 text-amber-400" />Credits</span>
                    <span className="text-2xl font-bold font-serif text-primary">{foundUser.credits}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Amount (e.g. 25)"
                      value={creditDelta}
                      onChange={(e) => setCreditDelta(e.target.value)}
                      className="flex-1 h-9"
                      min="1"
                    />
                    <Button size="sm" variant="outline" className="gap-1 border-green-500/40 text-green-400 hover:bg-green-500/10 shrink-0"
                      disabled={adjusting || !creditDelta} onClick={() => handleAdjustCredits(Number(creditDelta))}>
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0"
                      disabled={adjusting || !creditDelta} onClick={() => handleAdjustCredits(-Number(creditDelta))}>
                      <Minus className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                  {creditMsg && (
                    <p className="text-xs text-green-400 flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5" />{creditMsg}
                    </p>
                  )}
                </div>

                {/* Ban / Unban */}
                <div className="border border-border/30 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <ShieldOff className="h-4 w-4 text-destructive" />
                    Account Control
                  </p>
                  <div className="flex items-center gap-3">
                    {foundUser.isBanned ? (
                      <Button size="sm" variant="outline" className="gap-1.5 border-green-500/40 text-green-400 hover:bg-green-500/10"
                        disabled={banning} onClick={() => handleBan(false)}>
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Unban User
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                        disabled={banning} onClick={() => handleBan(true)}>
                        <Ban className="h-3.5 w-3.5" />
                        Ban User
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {foundUser.isBanned ? "This user is currently banned from the platform." : "Banning prevents this user from accessing the platform."}
                    </p>
                  </div>
                  {banMsg && (
                    <p className={`text-xs flex items-center gap-1.5 ${foundUser.isBanned ? "text-destructive" : "text-green-400"}`}>
                      <AlertTriangle className="h-3.5 w-3.5" />{banMsg}
                    </p>
                  )}
                </div>

              </div>
            )}
          </CardContent>
        </Card>
      </section>

    </div>
  );
}
