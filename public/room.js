// The room: fetches your library, lays the unread pile on the table,
// shelves the finished ones, and opens a reading sheet on click.

const API = "/api/articles";
const $ = (id) => document.getElementById(id);

const state = { articles: [], open: null, saveTimer: null };

/* ---------- helpers ---------- */
const api = async (path, opts = {}) => {
  const res = await fetch(API + path, { headers: { "content-type": "application/json" }, ...opts });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.status === 204 ? null : res.json();
};
const patch = (id, body) => api(`/${id}`, { method: "PATCH", body: JSON.stringify(body) });

// a stable color per source so the shelf reads like a real one
const hue = (str) => { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const spineColor = (source) => `hsl(${hue(source)} 32% 38%)`;

const daysSince = (iso) => (Date.now() - new Date(iso).getTime()) / 86_400_000;
const readingMins = (words) => Math.max(1, Math.round(words / 230));

/* ---------- time of day ---------- */
function autoTime() {
  if (document.body.dataset.timeLocked) return;
  const h = new Date().getHours();
  document.body.dataset.time = h < 6 ? "night" : h < 11 ? "morning" : h < 17 ? "day" : h < 21 ? "evening" : "night";
}
$("window").addEventListener("click", () => {
  const order = ["morning", "day", "evening", "night"];
  const next = order[(order.indexOf(document.body.dataset.time) + 1) % order.length];
  document.body.dataset.time = next;
  document.body.dataset.timeLocked = "1";
});
$("lamp").addEventListener("click", () => document.body.classList.toggle("lamp-off"));

/* ---------- render ---------- */
function render() {
  const unread = state.articles.filter((a) => !a.readAt);
  const read = state.articles.filter((a) => a.readAt);

  // the pile: newest on top, fanned out a little
  const pile = $("pile");
  pile.innerHTML = "";
  unread.slice().reverse().forEach((a, i, arr) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "paper" + (a.favorite ? " fav" : "");
    // lay papers out in loose rows of four so every title stays readable;
    // anything past the first eight tucks underneath as a stack
    const n = arr.length;
    const col = i % 4, row = Math.floor(i / 4);
    const perRow = Math.min(4, n - row * 4);
    // second row tucks under the first (lower z, peeking out below)
    const x = perRow === 1 ? 40 : (col / Math.max(1, perRow - 1)) * 72 + ((row % 2) * 8);
    const y = row === 0 ? ((i * 37) % 10) : 40 + ((i * 37) % 8);
    const rot = ((i * 53) % 11) - 5;
    const age = Math.min(1, daysSince(a.savedAt) / 45); // papers go sepia over ~6 weeks
    el.style.setProperty("--x", `${x}%`);
    el.style.setProperty("--y", `${y}px`);
    el.style.setProperty("--r", `${rot}deg`);
    el.style.setProperty("--sepia", (age * 0.5).toFixed(2));
    el.style.zIndex = 10 - row;
    el.innerHTML = `
      ${a.progress > 0 ? '<span class="bookmark" title="You left off partway"></span>' : ""}
      <p class="src">${esc(a.source)}</p>
      <p class="ttl">${esc(a.title)}</p>
      <span class="meta">${readingMins(a.wordCount)} min</span>`;
    el.addEventListener("click", () => open(a.id, el));
    pile.appendChild(el);
  });

  // the shelf
  const shelf = $("shelf");
  shelf.innerHTML = "";
  read.slice().sort((a, b) => a.readAt.localeCompare(b.readAt)).forEach((a) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "book" + (a.favorite ? " fav" : "");
    el.title = `${a.title} (${a.source})`;
    el.textContent = a.title;
    el.style.setProperty("--c", spineColor(a.source));
    el.style.setProperty("--h", `${90 + Math.min(40, a.wordCount / 80)}px`);
    el.style.setProperty("--w", `${22 + (a.wordCount > 1500 ? 10 : a.wordCount > 700 ? 5 : 0)}px`);
    el.addEventListener("click", () => open(a.id));
    shelf.appendChild(el);
  });

  $("shelf-label").textContent = read.length
    ? `${read.length} finished`
    : "Finished articles end up here";
  $("hud-status").textContent = unread.length
    ? `${unread.length} on the table · about ${unread.reduce((s, a) => s + readingMins(a.wordCount), 0)} min of reading`
    : "Nothing waiting";
  $("empty").hidden = state.articles.length > 0;
  $("btn-random").disabled = unread.length === 0;
}

/* ---------- reader ---------- */
async function open(id, fromEl) {
  if (fromEl) { fromEl.classList.add("lifting"); await wait(300); }
  const a = await api(`/${id}`);
  state.open = a;

  $("r-source").textContent = a.source;
  $("r-title").textContent = a.title;
  $("r-byline").textContent = [a.author, a.publishedAt && new Date(a.publishedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }), `${readingMins(a.wordCount)} min`].filter(Boolean).join(" · ");
  $("r-highlight").hidden = !a.highlight;
  $("r-highlight").textContent = a.highlight ?? "";
  $("r-body").innerHTML = a.content;
  $("r-note").value = a.note ?? "";
  $("r-link").href = a.url;
  $("btn-fav").classList.toggle("on", a.favorite);
  $("btn-fav").textContent = a.favorite ? "Kept near" : "Keep near";
  $("btn-done").hidden = !!a.readAt;

  const reader = $("reader");
  reader.hidden = false;
  reader.scrollTop = 0;
  // jump to the ribbon
  requestAnimationFrame(() => {
    if (a.progress > 0 && a.progress < 0.95) reader.scrollTop = a.progress * (reader.scrollHeight - reader.clientHeight);
  });
  $("reader-close").focus();
}

function close() {
  flushProgress();
  $("reader").hidden = true;
  state.open = null;
  load();
}
$("reader-close").addEventListener("click", close);
$("reader-close-bg").addEventListener("click", close);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("reader").hidden) close(); });

// ribbon follows your scroll; progress saved shortly after you stop
let pendingProgress = null;
$("reader").addEventListener("scroll", () => {
  const r = $("reader");
  const max = r.scrollHeight - r.clientHeight;
  const p = max > 0 ? r.scrollTop / max : 1;
  $("ribbon").style.height = `${90 + p * 160}px`;
  if (state.open && !state.open.readAt) {
    pendingProgress = Math.max(state.open.progress, p);
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(flushProgress, 800);
  }
});
async function flushProgress() {
  clearTimeout(state.saveTimer);
  if (!state.open || pendingProgress == null) return;
  const p = pendingProgress; pendingProgress = null;
  state.open.progress = p;
  try { await patch(state.open.id, { progress: p }); } catch {}
}

// margin note, saved on blur
$("r-note").addEventListener("blur", async () => {
  if (!state.open) return;
  const note = $("r-note").value.trim() || null;
  if (note === state.open.note) return;
  state.open.note = note;
  try { await patch(state.open.id, { note }); } catch {}
});

$("btn-fav").addEventListener("click", async () => {
  if (!state.open) return;
  const favorite = !state.open.favorite;
  state.open.favorite = favorite;
  $("btn-fav").classList.toggle("on", favorite);
  $("btn-fav").textContent = favorite ? "Kept near" : "Keep near";
  try { await patch(state.open.id, { favorite }); } catch {}
});

$("btn-done").addEventListener("click", async () => {
  if (!state.open) return;
  const id = state.open.id;
  pendingProgress = null;
  try { await api(`/${id}/read`, { method: "POST" }); } catch {}
  $("reader").hidden = true;
  state.open = null;
  await load();
  // the new book lands on the shelf
  const books = $("shelf").querySelectorAll(".book");
  books[books.length - 1]?.classList.add("landing");
});

$("btn-random").addEventListener("click", () => {
  const unread = state.articles.filter((a) => !a.readAt);
  if (!unread.length) return;
  const pick = unread[Math.floor(Math.random() * unread.length)];
  open(pick.id);
});

/* ---------- boot ---------- */
async function load() {
  try {
    state.articles = await api("");
  } catch {
    $("hud-status").textContent = "Can't reach the server. Is `npm run dev` running?";
    state.articles = [];
  }
  render();
}
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

autoTime();
setInterval(autoTime, 60_000);
load();
