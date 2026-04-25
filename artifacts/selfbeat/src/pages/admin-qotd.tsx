import { useState, useEffect, useCallback } from "react";
import { Plus, Check, X, Calendar, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Question {
  id: number;
  question: string;
  isActive: boolean;
  sortOrder: number;
  addedAt: string;
}

interface AdminData {
  questions: Question[];
  todayQuestionId: number | null;
  tomorrowQuestionId: number | null;
}

export default function AdminQotd() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("sb_admin_key") ?? "");
  const [isAuthed, setIsAuthed] = useState(false);
  const [data, setData] = useState<AdminData | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async (key: string) => {
    try {
      const res = await fetch("/api/admin/daily-questions", {
        headers: { "x-admin-key": key },
      });
      if (res.status === 401) {
        setIsAuthed(false);
        setError("Invalid admin key");
        return;
      }
      if (res.ok) {
        setData(await res.json());
        setIsAuthed(true);
        setError("");
      }
    } catch {
      setError("Failed to connect");
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("sb_admin_key", adminKey);
    fetchData(adminKey);
  };

  useEffect(() => {
    if (adminKey) fetchData(adminKey);
  }, []);

  const toggleActive = async (id: number, current: boolean) => {
    await fetch(`/api/admin/daily-questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ isActive: !current }),
    });
    fetchData(adminKey);
  };

  const addQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/admin/daily-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ question: newQuestion.trim() }),
      });
      setNewQuestion("");
      fetchData(adminKey);
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthed) {
    return (
      <div className="container max-w-md py-20">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif">
              <Flame className="h-5 w-5 text-amber-400" />
              Admin — Question of the Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-3">
              <Input
                type="password"
                placeholder="Admin key"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full">
                Access Admin
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeQuestions = data?.questions.filter((q) => q.isActive) ?? [];

  return (
    <div className="container max-w-3xl py-10 space-y-8">
      <div className="flex items-center gap-3">
        <Flame className="h-6 w-6 text-amber-400" />
        <h1 className="text-2xl font-serif font-bold">Question of the Day — Admin</h1>
      </div>

      {/* Today / Tomorrow */}
      {data && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">
                <Calendar className="h-3 w-3" />
                Today
              </div>
              <p className="text-sm font-medium leading-snug">
                {data.questions.find((q) => q.id === data.todayQuestionId)?.question ?? "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/30">
            <CardContent className="pt-4">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                Tomorrow
              </div>
              <p className="text-sm font-medium leading-snug text-muted-foreground">
                {data.questions.find((q) => q.id === data.tomorrowQuestionId)?.question ?? "—"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add question */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Question</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addQuestion} className="flex gap-2">
            <Input
              placeholder="Enter a new debate question…"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={saving || !newQuestion.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Question list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Question Rotation ({activeQuestions.length} active)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
          {data?.questions.map((q, i) => {
            const isToday = q.id === data.todayQuestionId;
            const isTomorrow = q.id === data.tomorrowQuestionId;
            return (
              <div
                key={q.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  !q.isActive
                    ? "opacity-40 bg-muted/10 border-border/20"
                    : isToday
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "border-border/30 bg-card/30"
                }`}
              >
                <span className="text-[10px] font-mono text-muted-foreground w-5 shrink-0 mt-0.5">
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
                      TOMORROW
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
                    {q.isActive ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Questions rotate deterministically by day — same question for all users on the same day.
      </p>
    </div>
  );
}
