import express from "express";
import cors from "cors";
import { articles } from "./routes/articles.js";
import { store } from "./lib/store.js";

const app = express();
const PORT = Number(process.env.PORT ?? 4321);

// The Chrome extension and the room UI both talk to this server from other origins.
app.use(cors());
// Articles can be long; allow generous bodies for in-browser extraction.
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", async (_req, res) => {
  const all = await store.all();
  res.json({
    ok: true,
    articles: all.length,
    unread: all.filter((a) => !a.readAt).length,
    dataFile: store.dataFile,
  });
});

app.use("/api/articles", articles);

// Later: the room UI gets served from here too.
app.use(express.static("public"));

app.listen(PORT, () => {
  console.log(`cozy reading room  ->  http://localhost:${PORT}`);
  console.log(`library file       ->  ${store.dataFile}`);
});
