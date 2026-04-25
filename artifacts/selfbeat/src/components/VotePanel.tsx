import { useState, useEffect, useCallback } from "react";
import { ThumbsUp, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";

export interface VoteEntry {
  model: string;
  displayName: string;
  color: string;
}

interface VoteData {
  counts: Record<string, number>;
  totalVotes: number;
  myVote: string | null;
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function VotePanel({
  comparisonId,
  responses,
  aiWinnerModel,
}: {
  comparisonId: string;
  responses: VoteEntry[];
  aiWinnerModel?: string;
}) {
  const { isSignedIn } = useAppAuth();
  const [, setLocation] = useLocation();
  const [voteData, setVoteData] = useState<VoteData | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  const fetchVotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/votes/${comparisonId}`);
      if (res.ok) setVoteData(await res.json());
    } catch {}
  }, [comparisonId]);

  useEffect(() => {
    fetchVotes();
  }, [fetchVotes]);

  const handleVote = async (model: string) => {
    if (!isSignedIn) {
      setLocation("/sign-in?redirect=" + encodeURIComponent(window.location.pathname));
      return;
    }
    setIsVoting(true);
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comparisonId, votedForAi: model }),
      });
      if (res.ok) setVoteData(await res.json());
    } finally {
      setIsVoting(false);
    }
  };

  const myVote = voteData?.myVote ?? null;
  const totalVotes = voteData?.totalVotes ?? 0;
  const hasVoted = myVote !== null;

  let crowdWinnerModel: string | null = null;
  if (voteData && totalVotes > 0) {
    let maxVotes = 0;
    for (const [model, cnt] of Object.entries(voteData.counts)) {
      if (cnt > maxVotes) {
        maxVotes = cnt;
        crowdWinnerModel = model;
      }
    }
  }

  const crowdWinner = crowdWinnerModel ? responses.find((r) => r.model === crowdWinnerModel) : null;
  const aiWinner = aiWinnerModel ? responses.find((r) => r.model === aiWinnerModel) : null;
  const crowdMatchesAI = crowdWinnerModel && aiWinnerModel && crowdWinnerModel === aiWinnerModel;
  const userMatchesAI = myVote && aiWinnerModel && myVote === aiWinnerModel;

  return (
    <div className="mb-10 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-xl font-bold text-foreground">Which answer do YOU prefer?</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalVotes > 0
              ? `Based on ${totalVotes.toLocaleString()} user ${totalVotes === 1 ? "vote" : "votes"}`
              : "Your vote helps others find the best answer"}
          </p>
        </div>
        {!isSignedIn && (
          <span className="text-xs text-muted-foreground bg-border/20 px-3 py-1.5 rounded-full border border-border/40 shrink-0">
            Sign in to vote
          </span>
        )}
      </div>

      <div className="space-y-2.5">
        {responses.map((resp) => {
          const cnt = voteData?.counts[resp.model] ?? 0;
          const pct = totalVotes > 0 ? Math.round((cnt / totalVotes) * 100) : 0;
          const isMyVote = myVote === resp.model;
          const isCrowdWinner = crowdWinnerModel === resp.model;
          const bgTint = hexToRgba(resp.color, isMyVote ? 0.12 : 0.05);
          const borderColor = hexToRgba(resp.color, isMyVote ? 0.45 : 0.15);

          return (
            <div
              key={resp.model}
              className="rounded-xl px-4 py-3 border transition-all duration-200"
              style={{ backgroundColor: bgTint, borderColor }}
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: resp.color }} />

                <span className="text-sm font-semibold flex-1 leading-none truncate" style={{ color: resp.color }}>
                  {resp.displayName}
                </span>

                {isMyVote && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0 hidden sm:inline"
                    style={{ backgroundColor: resp.color }}
                  >
                    YOUR PICK
                  </span>
                )}

                {hasVoted && isCrowdWinner && !isMyVote && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 hidden sm:inline"
                    style={{ borderColor: resp.color + "60", color: resp.color, border: "1px solid" }}
                  >
                    CROWD
                  </span>
                )}

                {hasVoted && (
                  <span className="text-xs font-mono text-muted-foreground shrink-0 w-6 text-right">
                    {cnt}
                  </span>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isVoting}
                  onClick={() => handleVote(resp.model)}
                  className="h-8 w-8 p-0 rounded-full shrink-0 transition-all duration-150 hover:scale-110 active:scale-95"
                  style={
                    isMyVote
                      ? {
                          backgroundColor: resp.color + "25",
                          border: `1px solid ${resp.color}60`,
                        }
                      : {}
                  }
                  title={isSignedIn ? (isMyVote ? "Remove vote" : "Vote for this answer") : "Sign in to vote"}
                >
                  <ThumbsUp
                    className="h-3.5 w-3.5"
                    style={
                      isMyVote
                        ? { fill: resp.color, stroke: resp.color }
                        : { color: "var(--muted-foreground)" }
                    }
                  />
                </Button>
              </div>

              {hasVoted && (
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-border/30 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: resp.color }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0 w-8 text-right">
                    {pct}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!hasVoted && (
        <p className="text-center text-xs text-muted-foreground mt-3">
          {isSignedIn
            ? totalVotes > 0
              ? "Vote to see the full breakdown"
              : "Vote to see what others think"
            : "Sign in and vote to see what others think"}
        </p>
      )}

      {hasVoted && aiWinner && crowdWinner && (
        <div className="mt-6 p-4 rounded-xl border border-border/40 bg-card/40 space-y-3 animate-in fade-in duration-400">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Users className="h-3 w-3" />
            AI vs Crowd
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Trophy className="h-3 w-3 text-primary shrink-0" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                  AI Verdict
                </span>
              </div>
              <div className="text-sm font-bold leading-none" style={{ color: aiWinner.color }}>
                {aiWinner.displayName}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                  User Vote
                </span>
              </div>
              <div className="text-sm font-bold leading-none" style={{ color: crowdWinner.color }}>
                {crowdWinner.displayName}
              </div>
            </div>
          </div>

          <div
            className={`text-sm font-semibold px-3 py-2 rounded-lg border ${
              crowdMatchesAI
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
            }`}
          >
            {crowdMatchesAI
              ? "The crowd agreed with the AI verdict!"
              : "The crowd disagreed with the AI verdict!"}
          </div>

          {myVote && aiWinnerModel && (
            <div
              className={`text-xs font-medium px-3 py-2 rounded-lg border ${
                userMatchesAI
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-muted/20 text-muted-foreground border-border/40"
              }`}
            >
              {userMatchesAI
                ? "You agreed with Selfbeat! 🎯"
                : "You disagreed with Selfbeat! Interesting choice 🤔"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
