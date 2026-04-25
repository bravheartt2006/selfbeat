import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  Star,
  Clock,
  Zap,
  Sun,
  Search,
  ChevronDown,
  ExternalLink,
  Trophy,
  Eye,
  ThumbsUp,
  Sparkles,
  ArrowRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppAuth } from "@/lib/auth-context";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeaturedResult {
  id: string;
  comparisonId: string;
  question: string;
  winner: string | null;
  highlightQuote: string | null;
  voteCount: number;
  surpriseScore: number;
  viewCount: number;
  isTodayFeatured: boolean;
  createdAt: string;
  featuredAt: string | null;
}

type SortMode = "voted" | "recent" | "surprising" | "today";

const SORT_TABS: { key: SortMode; label: string; icon: React.ElementType }[] = [
  { key: "voted",      label: "Most Voted",      icon: ThumbsUp },
  { key: "recent",     label: "Most Recent",      icon: Clock },
  { key: "surprising", label: "Most Surprising",  icon: Zap },
  { key: "today",      label: "Today's Featured", icon: Sun },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function FeaturedPage() {
  const { isSignedIn } = useAppAuth();
  const [sort, setSort] = useState<SortMode>("voted");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [results, setResults] = useState<FeaturedResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchResults = useCallback(async (newSort: SortMode, newSearch: string, newPage: number, append = false) => {
    if (newPage === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ sort: newSort, page: String(newPage) });
      if (newSearch) params.set("search", newSearch);
      const r = await fetch(`/api/featured?${params}`);
      if (r.ok) {
        const d = await r.json();
        setResults(prev => append ? [...prev, ...d.results] : d.results);
        setHasMore(d.hasMore);
        setPage(newPage);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Refetch when sort/search changes
  useEffect(() => {
    fetchResults(sort, search, 1, false);
  }, [sort, search, fetchResults]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearch("");
  };

  const loadMore = () => {
    fetchResults(sort, search, page + 1, true);
  };

  return (
    <div className="container max-w-5xl py-10 space-y-8">

      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
          <Star className="h-3.5 w-3.5" />
          Community Picks
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold">Featured Results</h1>
        <p className="text-muted-foreground max-w-lg mx-auto text-sm leading-relaxed">
          The most insightful, surprising, and revealing AI self-critiques — curated by the community.
        </p>
      </div>

      {/* CTA banner for non-signed-in visitors */}
      {!isSignedIn && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-primary/10 to-amber-500/10 border border-primary/20 rounded-2xl px-6 py-4">
          <div>
            <p className="font-semibold text-foreground text-sm">Try Selfbeat free</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ask any question. Watch 11 AIs answer, self-critique, and decide who won.</p>
          </div>
          <Link href="/sign-in">
            <Button size="sm" className="gap-1.5 shrink-0">
              Get 25 free credits <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Sort tabs */}
        <div className="flex gap-1 bg-muted/30 p-1 rounded-xl flex-wrap">
          {SORT_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sort === key
                  ? "bg-background text-foreground shadow-sm border border-border/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by keyword…"
              className="pl-8 pr-8 h-9 text-sm"
            />
            {searchInput && (
              <button type="button" onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button type="submit" variant="outline" size="sm" className="h-9">Search</Button>
        </form>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/30 bg-card/50 h-52 animate-pulse" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <Sparkles className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="text-muted-foreground font-medium">
            {search ? `No results matching "${search}"` : "No featured results yet"}
          </p>
          {search && (
            <Button variant="ghost" size="sm" onClick={clearSearch}>Clear search</Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {results.map((result) => (
              <FeaturedCard key={result.id} result={result} />
            ))}
          </div>

          {hasMore && (
            <div className="text-center pt-4">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="gap-2">
                {loadingMore ? (
                  <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Card component ────────────────────────────────────────────────────────────

function FeaturedCard({ result }: { result: FeaturedResult }) {
  return (
    <div className={`group flex flex-col rounded-2xl border bg-card/60 hover:bg-card hover:border-primary/30 transition-all duration-200 overflow-hidden ${
      result.isTodayFeatured ? "border-amber-500/40 ring-1 ring-amber-500/20" : "border-border/40"
    }`}>
      {result.isTodayFeatured && (
        <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/10 px-4 py-1.5 flex items-center gap-1.5 border-b border-amber-500/20">
          <Sun className="h-3 w-3 text-amber-400" />
          <span className="text-xs font-semibold text-amber-400">Today's Featured</span>
        </div>
      )}

      <div className="flex-1 p-5 space-y-3">
        {/* Question */}
        <p className="font-medium text-sm text-foreground leading-snug line-clamp-2">
          {result.question}
        </p>

        {/* Winner */}
        {result.winner && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
            <Trophy className="h-3.5 w-3.5" />
            {result.winner} won
          </div>
        )}

        {/* Highlight quote */}
        {result.highlightQuote && (
          <blockquote className="text-xs text-muted-foreground leading-relaxed italic border-l-2 border-primary/30 pl-3 line-clamp-3">
            "{result.highlightQuote}"
          </blockquote>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />
            {result.voteCount.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {result.viewCount.toLocaleString()}
          </span>
          <span>{new Date(result.featuredAt ?? result.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        </div>
        <Link href={`/featured/${result.id}`}>
          <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs gap-1 group-hover:border-primary/40 group-hover:text-primary transition-colors">
            View <ExternalLink className="h-3 w-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
