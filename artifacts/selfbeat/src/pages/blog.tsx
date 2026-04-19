import { Link } from "wouter";
import { BLOG_POSTS } from "@/lib/blog-posts";
import { ArrowRight, CalendarDays } from "lucide-react";

export default function BlogPage() {
  const sorted = [...BLOG_POSTS].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="container py-14 max-w-3xl animate-in fade-in slide-in-from-bottom-6 duration-500">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-serif font-bold tracking-tight text-foreground mb-3">
          Blog
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Thoughts on AI evaluation, model performance, and the science of making AI
          answer for itself.
        </p>
      </div>

      {/* Post list */}
      <div className="space-y-0 divide-y divide-border/50">
        {sorted.map((post) => (
          <article key={post.slug} className="py-8 group">
            <Link href={`/blog/${post.slug}`}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <CalendarDays className="h-3.5 w-3.5" />
                <time>{post.date}</time>
                <span className="text-border">·</span>
                <span>Selfbeat Team</span>
              </div>
              <h2 className="text-xl font-semibold font-serif text-foreground mb-2 group-hover:text-primary transition-colors leading-snug">
                {post.title}
              </h2>
              <p className="text-muted-foreground leading-relaxed text-sm mb-4">
                {post.excerpt}
              </p>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary/80 group-hover:text-primary transition-colors">
                Read more
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
