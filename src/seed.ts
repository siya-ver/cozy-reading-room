// Fills your library with a few public articles so the room isn't empty on day one.
// Run: npm run seed
import { nanoid } from "nanoid";
import { store } from "./lib/store.js";
import { extractFromUrl } from "./lib/extract.js";
import type { Article } from "./types.js";

const SEED_URLS = [
  "https://paulgraham.com/greatwork.html",
  "https://www.gwern.net/Spaced-repetition",
  "https://danluu.com/p95-skill/",
  "https://www.newyorker.com/magazine/2024/01/15/the-vanishing-island",
];

for (const url of SEED_URLS) {
  if (await store.findByUrl(url)) {
    console.log("skip (already saved):", url);
    continue;
  }
  try {
    const extracted = await extractFromUrl(url);
    const article: Article = {
      id: nanoid(10),
      url,
      ...extracted,
      highlight: null,
      note: null,
      tags: [],
      savedAt: new Date().toISOString(),
      readAt: null,
      progress: 0,
      favorite: false,
    };
    await store.insert(article);
    console.log(`saved: "${article.title}" (${article.wordCount} words) from ${article.source}`);
  } catch (err: any) {
    console.log(`failed: ${url} -> ${err.message}`);
  }
}
