import { Link, useParams } from "wouter";
import { getPost } from "@/lib/blog-posts";
import { useSEO } from "@/hooks/use-seo";
import { CalendarDays, ArrowLeft, User } from "lucide-react";

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = getPost(slug);

  useSEO(
    post
      ? {
          title: post.title,
          description: post.metaDescription,
          url: `https://selfbeat.ai/blog/${post.slug}`,
          type: "article",
        }
      : {
          title: "Post Not Found",
          description: "This article does not exist or may have been removed.",
          url: "https://selfbeat.ai/blog",
          type: "website",
        }
  );

  if (!post) {
    return (
      <div className="container py-20 max-w-3xl text-center">
        <h1 className="text-3xl font-serif font-bold mb-4">Post not found</h1>
        <p className="text-muted-foreground mb-6">
          This article does not exist or may have been removed.
        </p>
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to blog
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-12 max-w-2xl animate-in fade-in slide-in-from-bottom-6 duration-500">
      {/* Back link */}
      <Link
        href="/blog"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All posts
      </Link>

      {/* Article header */}
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground leading-tight mb-5">
          {post.title}
        </h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {post.date}
          </span>
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            Selfbeat Team
          </span>
        </div>
      </header>

      <hr className="border-border/50 mb-10" />

      {/* Article body */}
      <div
        className="blog-content prose-selfbeat"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      <hr className="border-border/50 mt-14 mb-8" />

      {/* Footer */}
      <Link
        href="/blog"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all posts
      </Link>
    </div>
  );
}
