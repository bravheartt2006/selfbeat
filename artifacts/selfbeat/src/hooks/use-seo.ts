import { useEffect } from "react";

const SITE_NAME = "Selfbeat";
const DEFAULT_OG_IMAGE = "https://selfbeat.ai/og-image.png";

interface SEOOptions {
  title: string;
  description: string;
  url: string;
  type?: "article" | "website";
  image?: string;
}

function setMetaTag(attr: "name" | "property", value: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${value}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, value);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function useSEO({
  title,
  description,
  url,
  type = "article",
  image = DEFAULT_OG_IMAGE,
}: SEOOptions) {
  useEffect(() => {
    const fullTitle = `${title} | ${SITE_NAME}`;
    document.title = fullTitle;

    setMetaTag("name", "description", description);

    setMetaTag("property", "og:title", fullTitle);
    setMetaTag("property", "og:description", description);
    setMetaTag("property", "og:url", url);
    setMetaTag("property", "og:type", type);
    setMetaTag("property", "og:image", image);
    setMetaTag("property", "og:site_name", SITE_NAME);

    setMetaTag("name", "twitter:card", "summary_large_image");
    setMetaTag("name", "twitter:title", fullTitle);
    setMetaTag("name", "twitter:description", description);
    setMetaTag("name", "twitter:image", image);

    return () => {
      document.title = SITE_NAME;
    };
  }, [title, description, url, type, image]);
}
