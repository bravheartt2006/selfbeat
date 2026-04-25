import { useEffect, useRef, useState } from "react";

type Stats = {
  totalQuestions: number;
  questionsToday: number;
  totalUsers: number;
  comparisonsCompleted: number;
};

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function useCountUp(target: number, duration = 2000, delay = 0): number {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const startValueRef = useRef(0);

  useEffect(() => {
    if (target === 0) return;

    const timeout = setTimeout(() => {
      startRef.current = null;
      startValueRef.current = current;

      function step(timestamp: number) {
        if (!startRef.current) startRef.current = timestamp;
        const elapsed = timestamp - startRef.current;
        const progress = Math.min(elapsed / duration, 1);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(startValueRef.current + (target - startValueRef.current) * eased);
        setCurrent(value);
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(step);
        }
      }

      rafRef.current = requestAnimationFrame(step);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return current;
}

function StatItem({
  value,
  label,
  delay,
}: {
  value: number;
  label: string;
  delay: number;
}) {
  const animated = useCountUp(value, 2000, delay);

  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3">
      <span className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums tracking-tight">
        {formatNumber(animated)}
      </span>
      <span className="text-xs sm:text-sm text-muted-foreground/70 text-center leading-snug">
        {label}
      </span>
    </div>
  );
}

export default function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);

  async function fetchStats() {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        const data = await res.json() as Stats;
        setStats(data);
      }
    } catch {
      // silently ignore
    }
  }

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!stats) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-10 mb-2">
        <div className="flex justify-center gap-6 sm:gap-10">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="h-8 w-20 rounded bg-muted/30 animate-pulse" />
              <div className="h-3 w-24 rounded bg-muted/20 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-4xl mx-auto mt-10 mb-2 animate-in fade-in duration-700"
      aria-label="Selfbeat platform statistics"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/30 rounded-2xl border border-border/25 bg-card/30 backdrop-blur-sm overflow-hidden">
        <StatItem value={stats.totalQuestions} label="questions asked" delay={0} />
        <StatItem value={stats.questionsToday} label="questions today" delay={150} />
        <StatItem value={stats.totalUsers} label="users joined" delay={300} />
        <StatItem value={stats.comparisonsCompleted} label="comparisons completed" delay={450} />
      </div>
    </div>
  );
}
