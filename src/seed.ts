// Fills your library with a few sample essays so the room isn't empty on day one.
// Run: npm run seed
// The samples are short original pieces bundled in data/samples.json (no network needed).
import { promises as fs } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { store } from "./lib/store.js";
import { countWords } from "./lib/extract.js";
import type { Article } from "./types.js";

const samples = JSON.parse(
  await fs.readFile(path.resolve(process.cwd(), "data/samples.json"), "utf8"),
) as Array<Partial<Article> & { url: string; title: string; content: string }>;

let added = 0;
for (const s of samples) {
  if (await store.findByUrl(s.url)) {
    console.log("skip (already saved):", s.title);
    continue;
  }
  const textContent = s.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const article: Article = {
    id: nanoid(10),
    url: s.url,
    title: s.title,
    source: s.source ?? "Sample",
    author: s.author ?? null,
    excerpt: textContent.slice(0, 480),
    content: s.content,
    textContent,
    wordCount: countWords(textContent),
    leadImage: null,
    highlight: s.highlight ?? null,
    note: null,
    tags: s.tags ?? [],
    // stagger save dates so the pile has some age to it
    savedAt: new Date(Date.now() - added * 2 * 86_400_000).toISOString(),
    publishedAt: s.publishedAt ?? null,
    readAt: null,
    progress: 0,
    favorite: false,
  };
  await store.insert(article);
  added++;
  console.log(`saved: "${article.title}" (${article.wordCount} words) from ${article.source}`);
}
console.log(`\n${added} added. Library: ${store.dataFile}`);
