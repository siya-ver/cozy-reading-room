// Per-issue layout: the editor's choices for one issue of the paper.
// Issues themselves are derived (every N finished articles); this only stores how you arranged them.
import { Router } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface IssueLayout {
  order: string[];            // article ids, front page order; first is the lead
  style: {
    face: "classic" | "modern";
    columns: 2 | 3;
    paper: "cream" | "white" | "rose";
  };
}

const FILE = path.resolve(process.cwd(), "data", "issues.json");
const DEFAULT_STYLE: IssueLayout["style"] = { face: "classic", columns: 3, paper: "cream" };

async function readAll(): Promise<Record<string, IssueLayout>> {
  try { return JSON.parse(await fs.readFile(FILE, "utf8")); } catch { return {}; }
}
async function writeAll(all: Record<string, IssueLayout>) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

export const issues = Router();

issues.get("/", async (_req, res) => res.json(await readAll()));

issues.get("/:no", async (req, res) => {
  const all = await readAll();
  res.json(all[req.params.no] ?? { order: [], style: DEFAULT_STYLE });
});

issues.patch("/:no", async (req, res) => {
  const all = await readAll();
  const cur = all[req.params.no] ?? { order: [], style: { ...DEFAULT_STYLE } };
  if (Array.isArray(req.body.order)) cur.order = req.body.order.filter((x: unknown) => typeof x === "string").slice(0, 50);
  const s = req.body.style ?? {};
  if (s.face === "classic" || s.face === "modern") cur.style.face = s.face;
  if (s.columns === 2 || s.columns === 3) cur.style.columns = s.columns;
  if (["cream", "white", "rose"].includes(s.paper)) cur.style.paper = s.paper;
  all[req.params.no] = cur;
  await writeAll(all);
  res.json(cur);
});
