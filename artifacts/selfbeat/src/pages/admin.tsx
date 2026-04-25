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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppAuth } from "@/lib/auth-context";

interface Stats {
  totalUsers: number;
  newSignupsToday: number;
  activeProSubscribers: number;
  questionsToday: number | null;
  totalRevenueCents: number | null;
}

interface AdminUser {
  id: string;
  email: string | null;
  displayName: string | null;
  pictureUrl: string | null;
  credits: number;
  isUnlimited: boolean;
  subscriptionStatus: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
  lastSignInAt: string | null;
}

interface QotdData {
  questions: {
    id: number;
    question: string;
    isActive: boolean;
    sortOrder: number;
    addedAt: string;
  }[];
  todayQuestionId: number | null;
  tomorrowQuestionId: number | null;
}

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
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
              {label}
            </p>
            <p className={`text-2xl font-bold font-serif ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-muted/40 ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const { user, isLoaded, isSignedIn } = useAppAuth();
  const [, setLocation] = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean | "denied" | null>(null);
  const [accessDeniedReason, setAccessDeniedReason] = useState("");

  // Stats
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // QOTD
  const [qotd, setQotd] = useState<QotdData | null>(null);
  const [qotdLoading, setQotdLoading] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [addingQ, setAddingQ] = useState(false);
  const [qotdMsg, setQotdMsg] = useState("");

  // User management
  const [searchEmail, setSearchEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<AdminUser | null | "not-found">(null);
  const [creditDelta, setCreditDelta] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [creditMsg, setCreditMsg] = useState("");

  // ── Auth check ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setIsAdmin("denied");
      setAccessDeniedReason("You must be signed in to access the admin panel.");
      return;
    }
    fetch("/api/admin/check", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.isAdmin) {
          setIsAdmin("denied");
          setAccessDeniedReason(
            `${user?.email ?? "This account"} does not have admin privileges.`
          );
        } else {
          setIsAdmin(true);
        }
      })
      .catch(() => {
        setIsAdmin("denied");
        setAccessDeniedReason("Could not verify admin access. Please try again.");
      });
  }, [isLoaded, isSignedIn, user, setLocation]);

  // ── Data loaders ────────────────────────────────────────────────────────────

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
      if (res.ok) setQotd(await res.json());
    } finally {
      setQotdLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadStats();
      loadQotd();
    }
  }, [isAdmin, loadStats, loadQotd]);

  // ── User search ─────────────────────────────────────────────────────────────

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;
    setSearching(true);
    setFoundUser(null);
    setCreditMsg("");
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

  // ── QOTD helpers ────────────────────────────────────────────────────────────

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
        setQotdMsg("Question added!");
        loadQotd();
      }
    } finally {
      setAddingQ(false);
    }
  };

  // ── Loading / auth guard ─────────────────────────────────────────────────────

  if (!isLoaded || isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAdmin === "denied") {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md w-full border border-destructive/30 bg-destructive/5 rounded-2xl p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <h1 className="text-xl font-serif font-bold">Access Denied</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{accessDeniedReason}</p>
          {isSignedIn && (
            <p className="text-xs text-muted-foreground">
              Signed in as <span className="font-mono font-medium text-foreground">{user?.email}</span>
            </p>
          )}
          <Button variant="outline" size="sm" onClick={() => setLocation("/")}>
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  const formatCurrency = (cents: number | null) => {
    if (cents === null) return "N/A";
    return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const activeCount = qotd?.questions.filter((q) => q.isActive).length ?? 0;

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
                Admin Access Granted
              </span>
              <span className="text-xs text-muted-foreground font-mono">{user?.email}</span>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            loadStats();
            loadQotd();
          }}
          disabled={statsLoading || qotdLoading}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${statsLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
          Stats Dashboard
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            icon={Users}
            label="Total Users"
            value={stats?.totalUsers ?? "—"}
            color="text-blue-400"
          />
          <StatCard
            icon={TrendingUp}
            label="New Today"
            value={stats?.newSignupsToday ?? "—"}
            sub="signups"
            color="text-green-400"
          />
          <StatCard
            icon={MessageSquare}
            label="Questions Today"
            value={stats?.questionsToday ?? "—"}
            color="text-purple-400"
          />
          <StatCard
            icon={Users}
            label="Pro Subscribers"
            value={stats?.activeProSubscribers ?? "—"}
            sub="active"
            color="text-amber-400"
          />
          <StatCard
            icon={DollarSign}
            label="Total Revenue"
            value={formatCurrency(stats?.totalRevenueCents ?? null)}
            color="text-emerald-400"
          />
        </div>
      </section>

      {/* User Management */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
          User Management
        </h2>
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
              <Button type="submit" disabled={searching || !searchEmail.trim()} className="gap-1.5">
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
              <div className="border border-border/40 rounded-xl p-5 space-y-4 bg-card/30">
                {/* User header */}
                <div className="flex items-center gap-3">
                  {foundUser.pictureUrl ? (
                    <img
                      src={foundUser.pictureUrl}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                      {(foundUser.displayName || foundUser.email || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{foundUser.displayName || "—"}</p>
                    <p className="text-sm text-muted-foreground truncate">{foundUser.email}</p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                      foundUser.isUnlimited
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : foundUser.subscriptionStatus.startsWith("Trial")
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          : "bg-muted/40 text-muted-foreground border-border/30"
                    }`}
                  >
                    {foundUser.subscriptionStatus}
                  </span>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/20 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">User ID</p>
                    <p className="font-mono text-xs truncate">{foundUser.id}</p>
                  </div>
                  <div className="bg-muted/20 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Joined</p>
                    <p className="font-medium">{new Date(foundUser.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="bg-muted/20 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Last Sign In</p>
                    <p className="font-medium">
                      {foundUser.lastSignInAt
                        ? new Date(foundUser.lastSignInAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                  <div className="bg-muted/20 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Stripe Customer</p>
                    <p className="font-mono text-xs truncate">
                      {foundUser.stripeCustomerId || "—"}
                    </p>
                  </div>
                </div>

                {/* Credits */}
                <div className="border border-border/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Credits</span>
                    <span className="text-2xl font-bold font-serif text-primary">
                      {foundUser.credits}
                    </span>
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
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 border-green-500/40 text-green-400 hover:bg-green-500/10"
                      disabled={adjusting || !creditDelta}
                      onClick={() => handleAdjustCredits(Number(creditDelta))}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                      disabled={adjusting || !creditDelta}
                      onClick={() => handleAdjustCredits(-Number(creditDelta))}
                    >
                      <Minus className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                  {creditMsg && (
                    <p className="text-xs text-green-400 flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5" />
                      {creditMsg}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Daily Question Management */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
          Question of the Day
        </h2>

        {/* Today / Tomorrow */}
        {qotd && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-widest mb-1.5">
                  <Calendar className="h-3 w-3" />
                  Today
                </div>
                <p className="text-sm font-medium leading-snug">
                  {qotd.questions.find((q) => q.id === qotd.todayQuestionId)?.question ?? "—"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/30">
              <CardContent className="pt-4 pb-4">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                  Tomorrow
                </div>
                <p className="text-sm font-medium leading-snug text-muted-foreground">
                  {qotd.questions.find((q) => q.id === qotd.tomorrowQuestionId)?.question ?? "—"}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add question */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Add New Question</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={addQuestion} className="flex gap-2">
              <Input
                placeholder="Enter a debate question…"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={addingQ || !newQuestion.trim()} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </form>
            {qotdMsg && (
              <p className="text-xs text-green-400 mt-2 flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" />
                {qotdMsg}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Question rotation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-400" />
                Rotation Schedule
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {activeCount} active
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {qotdLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                {qotd?.questions.map((q, i) => {
                  const isToday = q.id === qotd.todayQuestionId;
                  const isTomorrow = q.id === qotd.tomorrowQuestionId;
                  return (
                    <div
                      key={q.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        !q.isActive
                          ? "opacity-40 bg-muted/10 border-border/20"
                          : isToday
                            ? "border-amber-500/40 bg-amber-500/5"
                            : "border-border/20 bg-card/20"
                      }`}
                    >
                      <span className="text-[10px] font-mono text-muted-foreground w-5 shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-sm flex-1 leading-snug">{q.question}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isToday && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            TODAY
                          </span>
                        )}
                        {isTomorrow && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-border/30 text-muted-foreground border border-border/40">
                            NEXT
                          </span>
                        )}
                        <button
                          onClick={() => toggleActive(q.id, q.isActive)}
                          className={`h-6 w-6 rounded flex items-center justify-center transition-colors ${
                            q.isActive
                              ? "hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                              : "hover:bg-green-500/10 text-muted-foreground hover:text-green-400"
                          }`}
                          title={q.isActive ? "Deactivate" : "Activate"}
                        >
                          {q.isActive ? (
                            <XCircle className="h-3.5 w-3.5" />
                          ) : (
                            <CheckCircle className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Quick links */}
      <section className="border-t border-border/20 pt-6">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <a
            href="/admin/qotd"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Legacy QOTD Admin
            <ChevronRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>
    </div>
  );
}
