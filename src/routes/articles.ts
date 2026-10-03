import { Router } from "express";
import { nanoid } from "nanoid";
import { store } from "../lib/store.js";
import { countWords, extractFromHtml, extractFromUrl, hostToSource } from "../lib/extract.js";
import type { Article, SaveArticleInput } from "../types.js";

export const articles = Router();

// GET /api/articles  -> the whole library (lightweight: no body text)
// ?unread=1 filters to things you haven't finished.
articles.get("/", async (req, res) => {
  let list = await store.all();
  if (req.query.unread === "1") list = list.filter((a) => !a.readAt);
  res.json(list.map(summary));
});

// GET /api/articles/:id -> one article, full text included (for the reading view)
articles.get("/:id", async (req, res) => {
  const article = await store.get(req.params.id);
  if (!article) return res.status(404).json({ error: "Not found" });
  res.json(article);
});

// POST /api/articles
// Two ways to save:
//   1. { url }                     -> server fetches the page and extracts it (works for public pages)
//   2. { url, title, content, ... } -> extension already extracted it in-browser (works behind paywalls you're logged into)
// Optionally { html } -> raw page HTML the extension grabbed; server runs Readability on it.
articles.post("/", async (req, res) => {
  const body = req.body as SaveArticleInput & { html?: string };
  if (!body?.url) return res.status(400).json({ error: "url is required" });

  const existing = await store.findByUrl(body.url);
  if (existing) {
    return res.status(200).json({ ...summary(existing), alreadySaved: true });
  }

  try {
    let extracted;
    if (body.content) {
      // Extension did the work; trust it.
      const textContent = body.textContent ?? stripTags(body.content);
      extracted = {
        title: body.title ?? body.url,
        source: body.source ?? hostToSource(body.url),
        author: body.author ?? null,
        excerpt: body.excerpt ?? textContent.slice(0, 480),
        content: body.content,
        textContent,
        wordCount: countWords(textContent),
        leadImage: body.leadImage ?? null,
        publishedAt: body.publishedAt ?? null,
      };
    } else if (body.html) {
      extracted = extractFromHtml(body.html, body.url);
    } else {
      extracted = await extractFromUrl(body.url);
    }

    const article: Article = {
      id: nanoid(10),
      url: body.url,
      ...extracted,
      // explicit fields from the save beat anything we guessed
      title: body.title ?? extracted.title,
      source: body.source ?? extracted.source,
      highlight: body.highlight ?? null,
      note: body.note ?? null,
      tags: body.tags ?? [],
      savedAt: new Date().toISOString(),
      readAt: null,
      progress: 0,
      favorite: false,
    };

    await store.insert(article);
    res.status(201).json(summary(article));
  } catch (err: any) {
    res.status(422).json({ error: err.message ?? "Could not save that page" });
  }
});

// PATCH /api/articles/:id -> bookmark progress, mark read, favorite, note, tags
const PATCHABLE = ["progress", "readAt", "favorite", "note", "highlight", "tags", "title"] as const;
articles.patch("/:id", async (req, res) => {
  const patch: Partial<Article> = {};
  for (const key of PATCHABLE) {
    if (key in req.body) (patch as any)[key] = req.body[key];
  }
  if (typeof patch.progress === "number") {
    patch.progress = Math.max(0, Math.min(1, patch.progress));
    // finishing the article stamps readAt automatically
    if (patch.progress >= 0.95 && !("readAt" in patch)) patch.readAt = new Date().toISOString();
  }
  const updated = await store.update(req.params.id, patch);
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(summary(updated));
});

// POST /api/articles/:id/read -> shortcut: mark finished
articles.post("/:id/read", async (req, res) => {
  const updated = await store.update(req.params.id, { readAt: new Date().toISOString(), progress: 1 });
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(summary(updated));
});

articles.delete("/:id", async (req, res) => {
  const ok = await store.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

// Everything except the heavy body fields.
function summary(a: Article) {
  const { content, textContent, ...rest } = a;
  return rest;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
