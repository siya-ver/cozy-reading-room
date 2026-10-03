// A tiny JSON-file "database". One file, one array of articles.
// Reads are cached in memory; every write rewrites the file atomically.
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Article } from "../types.js";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, process.env.DATA_FILE ?? "articles.json");

let cache: Article[] | null = null;

async function load(): Promise<Article[]> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    cache = JSON.parse(raw) as Article[];
  } catch (err: any) {
    if (err.code !== "ENOENT") throw err;
    cache = [];
  }
  return cache;
}

async function persist(articles: Article[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(articles, null, 2), "utf8");
  await fs.rename(tmp, DATA_FILE); // atomic swap so a crash mid-write can't corrupt the library
  cache = articles;
}

export const store = {
  async all(): Promise<Article[]> {
    const articles = await load();
    // newest saves first
    return [...articles].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  },

  async get(id: string): Promise<Article | undefined> {
    return (await load()).find((a) => a.id === id);
  },

  async findByUrl(url: string): Promise<Article | undefined> {
    return (await load()).find((a) => a.url === url);
  },

  async insert(article: Article): Promise<Article> {
    const articles = await load();
    articles.push(article);
    await persist(articles);
    return article;
  },

  async update(id: string, patch: Partial<Article>): Promise<Article | undefined> {
    const articles = await load();
    const idx = articles.findIndex((a) => a.id === id);
    if (idx === -1) return undefined;
    articles[idx] = { ...articles[idx], ...patch, id }; // id can never be patched away
    await persist(articles);
    return articles[idx];
  },

  async remove(id: string): Promise<boolean> {
    const articles = await load();
    const next = articles.filter((a) => a.id !== id);
    if (next.length === articles.length) return false;
    await persist(next);
    return true;
  },

  dataFile: DATA_FILE,
};
