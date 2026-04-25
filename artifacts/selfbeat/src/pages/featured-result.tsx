import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  Trophy,
  Eye,
  ThumbsUp,
  ArrowLeft,
  Share2,
  Twitter,
  Linkedin,
  MessageCircle,
  Copy,
  CheckCircle,
  Sun,
  Star,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppAuth } from "@/lib/auth-context";

// Reddit icon (not in lucide)
function RedditIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
    </svg>
  );
}

interface FeaturedDetail {
  id: string;
  comparisonId: string;
  question: string;
  winner: string | null;
  highlightQuote: string | null;
  voteCount: number;
  viewCount: number;
  isTodayFeatured: boolean;
  createdAt: string;
  featuredAt: string | null;
  result: any;
}

export default function FeaturedResultPage() {
  const params = useParams<{ id: string }>();
  const { isSignedIn } = useAppAuth();
  const [data, setData] = useState<FeaturedDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  const id = params?.id;

  useEffect(() => {
    if (!id) return;
    document.title = "Featured Result — Selfbeat";
    (async () => {
      try {
        const r = await fetch(`/api/featured/${id}`);
        if (r.status === 404) { setNotFound(true); return; }
        if (r.ok) {
          const d = await r.json();
          setData(d);
          // Set SEO meta tags
          document.title = `${d.question} — Selfbeat AI Comparison`;
          setMetaTag("description", "See how AI models answered and judged themselves on Selfbeat");
          setMetaTag("og:title", "AI judged itself on Selfbeat — see what happened");
          setMetaTag("og:description", d.question);
          setMetaTag("og:url", window.location.href);
          setMetaTag("twitter:card", "summary_large_image");
          setMetaTag("twitter:title", "AI judged itself on Selfbeat — see what happened");
          setMetaTag("twitter:description", d.question);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareTitle = encodeURIComponent("AI judged itself on Selfbeat — see what happened");
  const shareDesc = encodeURIComponent(data?.question ?? "");
  const shareUrlEnc = encodeURIComponent(shareUrl);

  const shareLinks = [
    {
      name: "X (Twitter)",
      icon: Twitter,
      href: `https://twitter.com/intent/tweet?text=${shareTitle}&url=${shareUrlEnc}`,
      color: "hover:bg-[#1a1a1a] hover:border-[#444]",
    },
    {
      name: "Reddit",
      icon: RedditIcon,
      href: `https://reddit.com/submit?url=${shareUrlEnc}&title=${shareTitle}`,
      color: "hover:bg-orange-900/20 hover:border-orange-500/40",
    },
    {
      name: "LinkedIn",
      icon: Linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrlEnc}`,
      color: "hover:bg-blue-900/20 hover:border-blue-500/40",
    },
    {
      name: "WhatsApp",
      icon: MessageCircle,
      href: `https://wa.me/?text=${shareTitle}%20${shareUrlEnc}`,
      color: "hover:bg-green-900/20 hover:border-green-500/40",
    },
  ];

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(shareUrl); }
    catch { const el = document.createElement("textarea"); el.value = shareUrl; document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="container max-w-2xl py-20 text-center space-y-4">
        <p className="text-4xl">🔍</p>
        <h1 className="text-xl font-bold">Result not found</h1>
        <p className="text-muted-foreground text-sm">This featured result may have been removed.</p>
        <Link href="/featured"><Button variant="outline">Back to Featured</Button></Link>
      </div>
    );
  }

  const responses: any[] = data.result?.responses ?? [];
  const verdictDetails = data.result?.verdictDetails;

  return (
    <div className="container max-w-3xl py-10 space-y-8">

      {/* Back */}
      <div className="flex items-center gap-2">
        <Link href="/featured" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-sm">
          <ArrowLeft className="h-4 w-4" />
          Back to Featured
        </Link>
      </div>

      {/* Hero card */}
      <div className={`rounded-2xl border overflow-hidden ${data.isTodayFeatured ? "border-amber-500/40" : "border-border/40"} bg-card`}>

        {data.isTodayFeatured && (
          <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/10 px-6 py-2 flex items-center gap-2 border-b border-amber-500/20">
            <Sun className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-amber-400">Today's Featured</span>
          </div>
        )}

        <div className="p-6 space-y-5">
          {/* Question */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                <Star className="h-3 w-3" />
                Featured
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(data.featuredAt ?? data.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </span>
            </div>
            <h1 className="text-xl font-serif font-bold leading-snug text-foreground">
              {data.question}
            </h1>
          </div>

          {/* Winner */}
          {data.winner && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <Trophy className="h-4 w-4 text-amber-400 shrink-0" />
              <div>
                <span className="text-xs text-muted-foreground">Overall Winner</span>
                <p className="font-bold text-amber-400">{data.winner}</p>
              </div>
            </div>
          )}

          {/* Highlight quote */}
          {data.highlightQuote && (
            <blockquote className="text-sm text-muted-foreground leading-relaxed italic border-l-2 border-primary/40 pl-4">
              "{data.highlightQuote}"
            </blockquote>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/20">
            <span className="flex items-center gap-1.5"><ThumbsUp className="h-3.5 w-3.5" />{data.voteCount.toLocaleString()} votes</span>
            <span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" />{data.viewCount.toLocaleString()} views</span>
          </div>
        </div>
      </div>

      {/* View full comparison CTA */}
      <div className="flex items-center justify-between gap-3 p-4 bg-muted/20 border border-border/40 rounded-xl">
        <div>
          <p className="text-sm font-medium">View the full comparison</p>
          <p className="text-xs text-muted-foreground mt-0.5">See all 11 AI answers, scores, and self-critiques</p>
        </div>
        <Link href={`/results/${data.comparisonId}`}>
          <Button size="sm" className="gap-1.5 shrink-0">
            Open <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {/* Verdict summary */}
      {verdictDetails && (
        <div className="rounded-2xl border border-border/40 bg-card p-6 space-y-4">
          <h2 className="font-serif font-bold text-lg">Verdict Summary</h2>
          {verdictDetails.summary && (
            <p className="text-sm text-muted-foreground leading-relaxed">{verdictDetails.summary}</p>
          )}
          {verdictDetails.agreementPoints?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Where They Agreed</p>
              <ul className="space-y-1.5">
                {verdictDetails.agreementPoints.slice(0, 3).map((pt: string, i: number) => (
                  <li key={i} className="text-sm text-foreground/70 flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5 shrink-0">+</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {verdictDetails.disagreementPoints?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Where They Differed</p>
              <ul className="space-y-1.5">
                {verdictDetails.disagreementPoints.slice(0, 3).map((pt: string, i: number) => (
                  <li key={i} className="text-sm text-foreground/70 flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5 shrink-0">~</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Model scores preview */}
      {responses.length > 0 && (
        <div className="rounded-2xl border border-border/40 bg-card p-6 space-y-4">
          <h2 className="font-serif font-bold text-lg">Model Scores</h2>
          <div className="space-y-2">
            {[...responses]
              .filter(r => r.score != null && !r.declined)
              .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
              .slice(0, 5)
              .map((r, i) => (
                <div key={r.model} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}.</span>
                  <span className="text-sm font-medium flex-1 truncate">{r.displayName}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(100, ((r.score ?? 0) / 10) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right font-mono">
                      {(r.score ?? 0).toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Share section */}
      <div className="rounded-2xl border border-border/40 bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-serif font-bold text-lg">Share this result</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {shareLinks.map(({ name, icon: Icon, href, color }) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border/40 bg-muted/20 text-xs font-medium text-foreground/80 hover:text-foreground transition-colors ${color}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {name}
            </a>
          ))}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border/40 bg-muted/20 text-xs font-medium text-foreground/80 hover:text-foreground transition-colors hover:bg-primary/10 hover:border-primary/30"
          >
            {copied ? <CheckCircle className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </div>

      {/* Try Selfbeat CTA (non-signed-in) */}
      {!isSignedIn && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-6 text-center space-y-3">
          <p className="font-serif font-bold text-xl">Try Selfbeat free</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Ask your own question. Watch 11 AI models answer, judge themselves, and decide who was most honest.
          </p>
          <Link href="/sign-in">
            <Button className="gap-1.5">
              Get 25 free credits <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}

    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

function setMetaTag(name: string, content: string) {
  const isOg = name.startsWith("og:") || name.startsWith("twitter:");
  const selector = isOg
    ? `meta[property="${name}"]`
    : `meta[name="${name}"]`;
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    if (isOg) el.setAttribute("property", name);
    else el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}
