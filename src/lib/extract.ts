// Turns a URL or raw HTML into a clean article using Mozilla's Readability
// (the same engine behind Firefox Reader View).
import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";

export interface Extracted {
  title: string;
  source: string;
  author: string | null;
  excerpt: string | null;
  content: string;
  textContent: string;
  wordCount: number;
  leadImage: string | null;
  publishedAt: string | null;
}

// Pretend to be a normal browser; many sites serve a blank shell to unknown clients.
const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};

export async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: FETCH_HEADERS, redirect: "follow" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  return res.text();
}

export function extractFromHtml(html: string, url: string): Extracted {
  // jsdom is noisy about CSS it can't parse; mute it.
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(html, { url, virtualConsole });
  const doc = dom.window.document;

  const meta = (sel: string) =>
    doc.querySelector<HTMLMetaElement>(sel)?.content?.trim() || null;

  const parsed = new Readability(doc).parse();
  if (!parsed || !parsed.content) {
    throw new Error("Readability couldn't find an article on that page");
  }

  const textContent = (parsed.textContent ?? "").replace(/\s+/g, " ").trim();

  return {
    title: parsed.title?.trim() || meta('meta[property="og:title"]') || url,
    source: parsed.siteName?.trim() || meta('meta[property="og:site_name"]') || hostToSource(url),
    author: parsed.byline?.trim() || meta('meta[name="author"]') || null,
    excerpt: parsed.excerpt?.trim() || meta('meta[name="description"]') || null,
    content: parsed.content,
    textContent,
    wordCount: textContent ? textContent.split(" ").length : 0,
    leadImage: meta('meta[property="og:image"]'),
    publishedAt:
      meta('meta[property="article:published_time"]') ||
      meta('meta[name="date"]') ||
      null,
  };
}

export async function extractFromUrl(url: string): Promise<Extracted> {
  const html = await fetchHtml(url);
  return extractFromHtml(html, url);
}

// "www.theatlantic.com" -> "theatlantic.com"
export function hostToSource(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export function countWords(text: string): number {
  const t = text.replace(/\s+/g, " ").trim();
  return t ? t.split(" ").length : 0;
}
