// The reading nook: unread pile on the table, bound issues on the rack,
// the draft issue on the editor's desk, and a reader who needs a name.

const API = "/api";
const $ = (id) => document.getElementById(id);

const state = {
  articles: [],
  settings: { readerName: "", paperName: "The Nook Gazette", issueSize: 10 },
  open: null,
  saveTimer: null,
};

// rooms of the treehouse and when they open
const ROOMS = [
  { name: "Reading Nook", at: 0, here: true },
  { name: "Print Shop", at: 20 },
  { name: "Darkroom", at: 50 },
  { name: "Observatory", at: 100 },
];

/* ---------- helpers ---------- */
const api = async (path, opts = {}) => {
  const res = await fetch(API + path, { headers: { "content-type": "application/json" }, ...opts });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.status === 204 ? null : res.json();
};
const patch = (id, body) => api(`/articles/${id}`, { method: "PATCH", body: JSON.stringify(body) });
const daysSince = (iso) => (Date.now() - new Date(iso).getTime()) / 86_400_000;
const readingMins = (words) => Math.max(1, Math.round(words / 230));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtDate = (iso, opts = { month: "long", day: "numeric", year: "numeric" }) => new Date(iso).toLocaleDateString(undefined, opts);

// finished articles, oldest first, chunked into issues
function issues() {
  const read = state.articles.filter((a) => a.readAt).sort((a, b) => a.readAt.localeCompare(b.readAt));
  const size = state.settings.issueSize;
  const out = [];
  for (let i = 0; i < read.length; i += size) out.push(read.slice(i, i + size));
  return { bound: out.filter((x) => x.length === size), draft: out.find((x) => x.length < size) ?? [], total: read.length };
}

/* ---------- time of day & lamp ---------- */
function autoTime() {
  if (document.body.dataset.timeLocked) return;
  const h = new Date().getHours();
  document.body.dataset.time = h < 6 ? "night" : h < 11 ? "morning" : h < 17 ? "day" : h < 21 ? "evening" : "night";
}
$("window").addEventListener("click", () => {
  const order = ["morning", "day", "evening", "night"];
  document.body.dataset.time = order[(order.indexOf(document.body.dataset.time) + 1) % 4];
  document.body.dataset.timeLocked = "1";
});
$("lamp").addEventListener("click", () => document.body.classList.toggle("lamp-off"));

/* ---------- render the room ---------- */
function render() {
  const unread = state.articles.filter((a) => !a.readAt);
  const { bound, draft, total } = issues();

  // --- the pile ---
  const pile = $("pile");
  pile.innerHTML = "";
  unread.slice().reverse().forEach((a, i, arr) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "paper" + (a.favorite ? " fav" : "");
    const n = arr.length, col = i % 4, row = Math.floor(i / 4);
    const perRow = Math.min(4, n - row * 4);
    const x = perRow === 1 ? 40 : (col / Math.max(1, perRow - 1)) * 74 + ((row % 2) * 8);
    const y = row === 0 ? ((i * 37) % 10) : 42 + ((i * 37) % 8);
    const rot = ((i * 53) % 11) - 5;
    const age = Math.min(1, daysSince(a.savedAt) / 45);
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
    el.addEventListener("click", () => openArticle(a.id, el));
    pile.appendChild(el);
  });

  // --- the rack of bound issues ---
  const rack = $("rack");
  rack.innerHTML = "";
  bound.forEach((iss, i) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "bound";
    el.title = `Issue No. ${i + 1}`;
    el.innerHTML = `<span class="no">No. ${i + 1}<small>${fmtDate(iss[iss.length - 1].readAt, { month: "short", year: "2-digit" })}</small></span>`;
    el.addEventListener("click", () => openIssue(iss, i + 1, false));
    rack.appendChild(el);
  });
  $("rack-label").textContent = bound.length
    ? `${bound.length} issue${bound.length > 1 ? "s" : ""} of ${state.settings.paperName}`
    : `Issues of ${state.settings.paperName} go here`;

  // --- the draft on the desk ---
  const nextNo = bound.length + 1;
  $("draft-n").textContent = `No. ${nextNo}`;
  $("draft-count").textContent = `${draft.length} of ${state.settings.issueSize}`;
  $("draft").onclick = () => openIssue(draft, nextNo, true);

  // --- name ---
  $("name-text").textContent = state.settings.readerName || "Name me";

  // --- rooms ---
  $("rooms").innerHTML = ROOMS.map((r) => {
    const locked = total < r.at;
    return `<span class="door ${r.here ? "here" : ""} ${locked ? "locked" : ""}" title="${locked ? `Opens after ${r.at} articles` : r.name}">
      ${locked ? "🔒 " : ""}${r.name}${locked ? `<small>${total}/${r.at}</small>` : ""}</span>`;
  }).join("");

  // --- status ---
  $("hud-status").textContent = unread.length
    ? `${unread.length} on the table · about ${unread.reduce((s, a) => s + readingMins(a.wordCount), 0)} min of reading`
    : "Nothing waiting on the table";
  $("empty").hidden = state.articles.length > 0;
  $("btn-random").disabled = unread.length === 0;
}

/* ---------- naming the reader ---------- */
$("nameplate").addEventListener("click", () => {
  if ($("nameplate").querySelector("input")) return;
  const input = document.createElement("input");
  input.value = state.settings.readerName;
  input.placeholder = "her name";
  input.maxLength = 40;
  $("nameplate").replaceChildren(input);
  input.focus();
  const commit = async () => {
    const readerName = input.value.trim();
    $("nameplate").innerHTML = `<span id="name-text">${esc(readerName || "Name me")}</span>`;
    if (readerName !== state.settings.readerName) {
      state.settings.readerName = readerName;
      try { state.settings = await api("/settings", { method: "PATCH", body: JSON.stringify({ readerName }) }); } catch {}
      if (readerName) toast(`${readerName} settles in at the desk.`);
    }
  };
  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); if (e.key === "Escape") { input.value = state.settings.readerName; input.blur(); } });
});

/* ---------- reading sheet ---------- */
async function openArticle(id, fromEl) {
  if (fromEl) { fromEl.classList.add("lifting"); await wait(300); }
  const a = await api(`/articles/${id}`);
  state.open = a;
  $("issue").hidden = true;

  $("r-source").textContent = a.source;
  $("r-title").textContent = a.title;
  $("r-byline").textContent = [a.author, a.publishedAt && fmtDate(a.publishedAt), `${readingMins(a.wordCount)} min`].filter(Boolean).join(" · ");
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
  requestAnimationFrame(() => {
    if (a.progress > 0 && a.progress < 0.95) reader.scrollTop = a.progress * (reader.scrollHeight - reader.clientHeight);
  });
  $("reader-close").focus();
}
function closeArticle() {
  flushProgress();
  $("reader").hidden = true;
  state.open = null;
  load();
}
$("reader-close").addEventListener("click", closeArticle);
$("reader-close-bg").addEventListener("click", closeArticle);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("reader").hidden) closeArticle();
  else if (!$("issue").hidden) closeIssue();
});

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
  const before = issues().bound.length;
  try { await api(`/articles/${id}/read`, { method: "POST" }); } catch {}
  $("reader").hidden = true;
  state.open = null;
  await load();
  $("figure").classList.remove("working"); void $("figure").offsetWidth; $("figure").classList.add("working");
  const { bound, draft } = issues();
  if (bound.length > before) {
    const n = bound.length;
    $("rack").lastElementChild?.classList.add("landing");
    toast(`${state.settings.readerName || "The editor"} bound Issue No. ${n}. Hot off the press.`);
    await wait(900);
    openIssue(bound[n - 1], n, false);
  } else {
    toast(`Sent to the editor. ${draft.length} of ${state.settings.issueSize} for the next issue.`);
  }
});

$("btn-random").addEventListener("click", () => {
  const unread = state.articles.filter((a) => !a.readAt);
  if (!unread.length) return;
  openArticle(unread[Math.floor(Math.random() * unread.length)].id);
});

/* ---------- the newspaper ---------- */
function openIssue(list, no, isDraft) {
  const size = state.settings.issueSize;
  $("p-name").textContent = state.settings.paperName;
  $("p-issue").textContent = `No. ${no}` + (isDraft ? " · in progress" : "");
  $("p-date").textContent = list.length
    ? `${fmtDate(list[0].readAt, { month: "short", day: "numeric" })} to ${fmtDate(list[list.length - 1].readAt, { month: "short", day: "numeric", year: "numeric" })}`
    : "No stories yet";
  $("p-editor").textContent = state.settings.readerName ? `Editor: ${state.settings.readerName}` : "Editor: unnamed";

  // the lead is your favorite if you marked one, otherwise the longest read
  const sorted = list.slice().sort((a, b) => (b.favorite - a.favorite) || (b.wordCount - a.wordCount));
  const [lead, ...rest] = sorted;
  const front = $("front");
  front.innerHTML = "";

  if (isDraft) {
    const flag = document.createElement("div");
    flag.className = "draft-flag";
    flag.textContent = `${list.length} of ${size} stories filed`;
    $("p-name").insertAdjacentElement("afterend", flag);
    document.querySelectorAll(".draft-flag").forEach((f, i) => i && f.remove());
  } else {
    document.querySelectorAll(".draft-flag").forEach((f) => f.remove());
  }

  if (lead) front.appendChild(storyEl(lead, true));
  else front.appendChild(slotEl("Your lead story goes here"));
  rest.forEach((a) => front.appendChild(storyEl(a, false)));
  for (let i = list.length; i < Math.min(size, Math.max(list.length + 1, 5)); i++) front.appendChild(slotEl("Story slot"));

  const letters = list.filter((a) => a.note);
  if (letters.length) {
    const sec = document.createElement("section");
    sec.className = "letters";
    sec.innerHTML = `<h4>Letters to the editor</h4><ul>${letters.map((a) => `<li>${esc(a.note)}<small>on “${esc(a.title)}”</small></li>`).join("")}</ul>`;
    front.appendChild(sec);
  }

  $("issue").hidden = false;
  $("issue").scrollTop = 0;
}
function storyEl(a, isLead) {
  const el = document.createElement("div");
  el.className = isLead ? "lead" : "story";
  const dek = (a.excerpt || "").slice(0, isLead ? 520 : 200).replace(/\s\S*$/, "") + "…";
  el.innerHTML = `
    <p class="kicker">${esc(a.source)}${a.author ? " · " + esc(a.author) : ""}</p>
    <h3>${esc(a.title)}</h3>
    <p class="dek ${dek.length > 300 ? "long" : ""}">${esc(dek)}</p>
    ${a.highlight ? `<p class="pull">${esc(a.highlight)}</p>` : ""}`;
  el.addEventListener("click", () => openArticle(a.id));
  return el;
}
function slotEl(text) {
  const el = document.createElement("div");
  el.className = "slot";
  el.textContent = text;
  return el;
}
function closeIssue() { $("issue").hidden = true; }
$("issue-close").addEventListener("click", closeIssue);
$("issue-close-bg").addEventListener("click", closeIssue);

// rename the paper by clicking the masthead
$("p-name").addEventListener("click", () => {
  const h = $("p-name");
  if (h.isContentEditable) return;
  h.contentEditable = "true";
  h.focus();
  document.execCommand?.("selectAll", false, null);
  const done = async () => {
    h.contentEditable = "false";
    const paperName = h.textContent.trim().slice(0, 60) || state.settings.paperName;
    h.textContent = paperName;
    if (paperName !== state.settings.paperName) {
      state.settings.paperName = paperName;
      try { state.settings = await api("/settings", { method: "PATCH", body: JSON.stringify({ paperName }) }); } catch {}
      render();
    }
  };
  h.addEventListener("blur", done, { once: true });
  h.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); h.blur(); } });
});

/* ---------- toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3200);
}

/* ---------- boot ---------- */
async function load() {
  try {
    [state.articles, state.settings] = await Promise.all([api("/articles"), api("/settings")]);
  } catch {
    $("hud-status").textContent = "Can't reach the server. Is `npm run dev` running?";
    state.articles = [];
  }
  render();
}
autoTime();
setInterval(autoTime, 60_000);
load();
