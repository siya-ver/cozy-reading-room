// Tiny settings store: who the reader is, what the paper is called.
import { Router } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface Settings {
  readerName: string;
  paperName: string;
  issueSize: number; // articles per newspaper issue
}

const FILE = path.resolve(process.cwd(), "data", "settings.json");
const DEFAULTS: Settings = { readerName: "", paperName: "The Nook Gazette", issueSize: 10 };

async function read(): Promise<Settings> {
  try {
    return { ...DEFAULTS, ...JSON.parse(await fs.readFile(FILE, "utf8")) };
  } catch {
    return { ...DEFAULTS };
  }
}
async function write(s: Settings) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(s, null, 2));
}

export const settings = Router();

settings.get("/", async (_req, res) => res.json(await read()));

settings.patch("/", async (req, res) => {
  const current = await read();
  const next: Settings = { ...current };
  if (typeof req.body.readerName === "string") next.readerName = req.body.readerName.trim().slice(0, 40);
  if (typeof req.body.paperName === "string") next.paperName = req.body.paperName.trim().slice(0, 60) || DEFAULTS.paperName;
  if (Number.isInteger(req.body.issueSize) && req.body.issueSize >= 3 && req.body.issueSize <= 50) next.issueSize = req.body.issueSize;
  await write(next);
  res.json(next);
});
