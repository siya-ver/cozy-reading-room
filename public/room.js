// The treehouse: three rooms side by side. Print Shop (bound issues, the press),
// Reading Nook (table, desk, the reader), Balcony (read outside in the forest).

const API = "/api";
const $ = (id) => document.getElementById(id);

const state = {
  articles: [],
  settings: { readerName: "", paperName: "The Nook Gazette", issueSize: 10 },
  layouts: {},          // issue number -> { order, style }
  open: null,
  openIssue: null,      // { list, no, isDraft }
  editing: false,
  saveTimer: null,
  room: 1,
};

const ROOMS = [
  { name: "Print Shop", at: 20 },
  { name: "Reading Nook", at: 0 },
  { name: "Balcony", at: 5 },
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

const unreadList = () => state.articles.filter((a) => !a.readAt && !a.archivedAt);
const archivedList = () => state.articles.filter((a) => a.archivedAt);
const readCount = () => state.articles.filter((a) => a.readAt && !a.archivedAt).length;

function issues() {
  const read = state.articles.filter((a) => a.readAt && !a.archivedAt).sort((a, b) => a.readAt.localeCompare(b.readAt));
  const size = state.settings.issueSize;
  const out = [];
  for (let i = 0; i < read.length; i += size) out.push(read.slice(i, i + size));
  return { bound: out.filter((x) => x.length === size), draft: out.find((x) => x.length < size) ?? [], total: read.length };
}

/* ---------- camera ---------- */
function unlocked(i) { return readCount() >= ROOMS[i].at; }
function goTo(i) {
  if (i < 0 || i > 2 || !unlocked(i)) { if (i >= 0 && i <= 2) toast(`${ROOMS[i].name} opens after ${ROOMS[i].at} finished articles.`); return; }
  state.room = i;
  document.body.dataset.room = String(i);
  $("hud-room").textContent = ROOMS[i].name;
  renderRooms();
  if (i === 2) spawnFireflies();
}
$("edge-to-nook").onclick = () => goTo(1);
$("edge-back-nook").onclick = () => goTo(1);
$("edge-to-printshop").onclick = () => goTo(0);
$("edge-to-balcony").onclick = () => goTo(2);
$("door-printshop").onclick = () => goTo(0);
$("door-balcony").onclick = () => goTo(2);
document.addEventListener("keydown", (e) => {
  if (!$("reader").hidden || !$("issue").hidden || !$("basket-view").hidden) return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (e.key === "ArrowLeft") goTo(state.room - 1);
  if (e.key === "ArrowRight") goTo(state.room + 1);
});

function renderRooms() {
  const total = readCount();
  $("rooms").innerHTML = ROOMS.map((r, i) => {
    const locked = total < r.at;
    return `<button type="button" class="door-chip ${i === state.room ? "here" : ""} ${locked ? "locked" : ""}" data-i="${i}" title="${locked ? `Opens after ${r.at} finished articles` : r.name}">
      ${locked ? "🔒 " : ""}${r.name}${locked ? `<small>${total}/${r.at}</small>` : ""}</button>`;
  }).join("");
  $("rooms").querySelectorAll(".door-chip").forEach((b) => (b.onclick = () => goTo(Number(b.dataset.i))));
  $("edge-to-printshop").disabled = !unlocked(0);
  $("edge-to-balcony").disabled = !unlocked(2);
  for (const [id, i] of [["door-printshop", 0], ["door-balcony", 2]]) {
    const d = $(id);
    d.classList.toggle("locked", !unlocked(i));
    d.querySelector(".door-label").dataset.lock = `${total}/${ROOMS[i].at}`;
  }
}

function spawnFireflies() {
  const box = $("fireflies");
  if (box.childElementCount) return;
  for (let i = 0; i < 18; i++) {
    const f = document.createElement("i");
    f.style.left = `${8 + Math.random() * 84}%`;
    f.style.top = `${20 + Math.random() * 70}%`;
    f.style.setProperty("--d", `${6 + Math.random() * 8}s`);
    f.style.setProperty("--delay", `${-Math.random() * 10}s`);
    f.style.setProperty("--dx", `${(Math.random() - 0.5) * 120}px`);
    f.style.setProperty("--dy", `${(Math.random() - 0.5) * 80}px`);
    f.style.setProperty("--dy2", `${(Math.random() - 0.5) * 40}px`);
    box.appendChild(f);
  }
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

/* ---------- render ---------- */
function render() {
  const unread = unreadList();
  const { bound, draft, total } = issues();

  // the pile
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

  // the rack (print shop)
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
  $("rack-label").textContent = bound.length ? `${bound.length} issue${bound.length > 1 ? "s" : ""} of ${state.settings.paperName}` : `Issues of ${state.settings.paperName} go here`;
  $("press-label").textContent = `Next run: ${draft.length} of ${state.settings.issueSize} stories`;

  // the draft on the desk
  const nextNo = bound.length + 1;
  $("draft-n").textContent = `No. ${nextNo}`;
  $("draft-count").textContent = `${draft.length} of ${state.settings.issueSize}`;
  $("draft").onclick = () => openIssue(draft, nextNo, true);

  // name, basket, hammock
  $("name-text").textContent = state.settings.readerName || "Name me";
  const arch = archivedList();
  $("basket-count").textContent = arch.length ? String(arch.length) : "";
  const pick = unread[0];
  $("hammock-paper").textContent = pick ? pick.title : "";
  $("hammock-paper").style.display = pick ? "" : "none";
  $("balcony-hint").textContent = pick ? "Take the top of the pile out here" : "Nothing on the pile to bring out";

  renderRooms();
  $("hud-status").textContent = unread.length
    ? `${unread.length} on the table · about ${unread.reduce((s, a) => s + readingMins(a.wordCount), 0)} min of reading`
    : "Nothing waiting on the table";
  $("empty").hidden = state.articles.length > 0 || state.room !== 1;
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
  $("basket-view").hidden = true;

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
  $("btn-archive").hidden = !!a.readAt;
  $("btn-archive").textContent = a.archivedAt ? "Back on the table" : "Put it away";

  const reader = $("reader");
  reader.hidden = false;
  reader.scrollTop = 0;
  requestAnimationFrame(() => { if (a.progress > 0 && a.progress < 0.95) reader.scrollTop = a.progress * (reader.scrollHeight - reader.clientHeight); });
  $("reader-close").focus();
}
function closeArticle() { flushProgress(); $("reader").hidden = true; state.open = null; load(); }
$("reader-close").addEventListener("click", closeArticle);
$("reader-close-bg").addEventListener("click", closeArticle);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("reader").hidden) closeArticle();
  else if (!$("issue").hidden) closeIssue();
  else if (!$("basket-view").hidden) $("basket-view").hidden = true;
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
$("btn-archive").addEventListener("click", async () => {
  if (!state.open) return;
  const id = state.open.id, restoring = !!state.open.archivedAt;
  pendingProgress = null;
  try { await api(`/articles/${id}/${restoring ? "restore" : "archive"}`, { method: "POST" }); } catch {}
  $("reader").hidden = true; state.open = null;
  await load();
  toast(restoring ? "Back on the table." : "Put away in the basket.");
});
$("btn-done").addEventListener("click", async () => {
  if (!state.open) return;
  const id = state.open.id;
  pendingProgress = null;
  const before = issues().bound.length;
  try { await api(`/articles/${id}/read`, { method: "POST" }); } catch {}
  $("reader").hidden = true; state.open = null;
  await load();
  const fig = $("figure"); fig.classList.remove("working"); void fig.getBoundingClientRect(); fig.classList.add("working");
  const { bound, draft } = issues();
  if (bound.length > before) {
    const n = bound.length;
    toast(`${state.settings.readerName || "The editor"} ran the press. Issue No. ${n} is bound.`);
    await wait(700);
    goTo(0);
    $("wheel").classList.add("spin");
    setTimeout(() => $("wheel").classList.remove("spin"), 2600);
    await wait(1000);
    $("rack").lastElementChild?.classList.add("landing");
    await wait(900);
    openIssue(bound[n - 1], n, false);
  } else {
    toast(`Sent to the editor. ${draft.length} of ${state.settings.issueSize} for the next issue.`);
  }
});
$("btn-random").addEventListener("click", () => {
  const unread = unreadList();
  if (!unread.length) return;
  openArticle(unread[Math.floor(Math.random() * unread.length)].id);
});
$("hammock").addEventListener("click", () => { const p = unreadList()[0]; if (p) openArticle(p.id); });

/* ---------- the basket ---------- */
$("basket").addEventListener("click", () => {
  const list = archivedList();
  $("basket-list").innerHTML = list.length
    ? list.map((a) => `<li><div class="t">${esc(a.title)}<small>${esc(a.source)} · put away ${fmtDate(a.archivedAt, { month: "short", day: "numeric" })}</small></div>
        <button class="btn ghost small" type="button" data-open="${a.id}">Peek</button>
        <button class="btn small" type="button" data-restore="${a.id}">Back on the table</button></li>`).join("")
    : `<li class="none">The basket is empty.</li>`;
  $("basket-list").querySelectorAll("[data-restore]").forEach((b) => (b.onclick = async () => {
    try { await api(`/articles/${b.dataset.restore}/restore`, { method: "POST" }); } catch {}
    $("basket-view").hidden = true; await load(); toast("Back on the table.");
  }));
  $("basket-list").querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => openArticle(b.dataset.open)));
  $("basket-view").hidden = false;
});
$("basket-close").onclick = $("basket-close-bg").onclick = () => ($("basket-view").hidden = true);

/* ---------- the newspaper ---------- */
function layoutFor(no) { return state.layouts[no] ?? { order: [], style: { face: "classic", columns: 3, paper: "cream" } }; }
function orderedStories(list, no) {
  const lay = layoutFor(no);
  const byId = new Map(list.map((a) => [a.id, a]));
  const kept = lay.order.map((id) => byId.get(id)).filter(Boolean);
  const rest = list.filter((a) => !lay.order.includes(a.id)).sort((a, b) => (b.favorite - a.favorite) || (b.wordCount - a.wordCount));
  return [...kept, ...rest];
}
function openIssue(list, no, isDraft) {
  state.openIssue = { list, no, isDraft };
  state.editing = false;
  const size = state.settings.issueSize;
  const lay = layoutFor(no);
  const ps = $("paper-sheet");
  ps.classList.remove("editing");
  ps.dataset.face = lay.style.face; ps.dataset.columns = String(lay.style.columns); ps.dataset.paper = lay.style.paper;
  $("editor-tools").hidden = true; $("btn-edit").hidden = false;
  $("editor-bar").hidden = list.length === 0;

  $("p-name").textContent = state.settings.paperName;
  $("p-issue").textContent = `No. ${no}` + (isDraft ? " · in progress" : "");
  $("p-date").textContent = list.length ? `${fmtDate(list[0].readAt, { month: "short", day: "numeric" })} to ${fmtDate(list[list.length - 1].readAt, { month: "short", day: "numeric", year: "numeric" })}` : "No stories yet";
  $("p-editor").textContent = state.settings.readerName ? `Editor: ${state.settings.readerName}` : "Editor: unnamed";
  document.querySelectorAll(".draft-flag").forEach((f) => f.remove());
  if (isDraft) {
    const flag = document.createElement("div");
    flag.className = "draft-flag";
    flag.textContent = `${list.length} of ${size} stories filed`;
    $("p-name").insertAdjacentElement("afterend", flag);
  }
  renderFront();
  $("issue").hidden = false;
  $("issue").scrollTop = 0;
}
function renderFront() {
  const { list, no } = state.openIssue;
  const size = state.settings.issueSize;
  const front = $("front");
  front.innerHTML = "";
  const [lead, ...rest] = orderedStories(list, no);
  if (lead) front.appendChild(storyEl(lead, true)); else front.appendChild(slotEl("Your lead story goes here"));
  rest.forEach((a) => front.appendChild(storyEl(a, false)));
  for (let i = list.length; i < Math.min(size, Math.max(list.length + 1, 5)); i++) front.appendChild(slotEl("Story slot"));
  const letters = list.filter((a) => a.note);
  if (letters.length) {
    const sec = document.createElement("section");
    sec.className = "letters";
    sec.innerHTML = `<h4>Letters to the editor</h4><ul>${letters.map((a) => `<li>${esc(a.note)}<small>on “${esc(a.title)}”</small></li>`).join("")}</ul>`;
    front.appendChild(sec);
  }
}
function storyEl(a, isLead) {
  const el = document.createElement("div");
  el.className = isLead ? "lead" : "story";
  el.dataset.id = a.id;
  el.draggable = state.editing;
  const dek = (a.excerpt || "").slice(0, isLead ? 520 : 200).replace(/\s\S*$/, "") + "…";
  el.innerHTML = `
    <span class="handle">${isLead ? "lead · drag" : "drag"}</span>
    <p class="kicker">${esc(a.source)}${a.author ? " · " + esc(a.author) : ""}</p>
    <h3>${esc(a.title)}</h3>
    <p class="dek ${dek.length > 300 ? "long" : ""}">${esc(dek)}</p>
    ${a.highlight ? `<p class="pull">${esc(a.highlight)}</p>` : ""}`;
  el.addEventListener("click", () => { if (!state.editing) openArticle(a.id); });
  // drag to reorder
  el.addEventListener("dragstart", (e) => { if (!state.editing) return e.preventDefault(); el.classList.add("dragging"); e.dataTransfer.setData("text/plain", a.id); e.dataTransfer.effectAllowed = "move"; });
  el.addEventListener("dragend", () => { el.classList.remove("dragging"); $("front").querySelectorAll(".drop-before").forEach((x) => x.classList.remove("drop-before")); });
  el.addEventListener("dragover", (e) => { if (!state.editing) return; e.preventDefault(); $("front").querySelectorAll(".drop-before").forEach((x) => x.classList.remove("drop-before")); el.classList.add("drop-before"); });
  el.addEventListener("drop", async (e) => {
    if (!state.editing) return;
    e.preventDefault();
    const fromId = e.dataTransfer.getData("text/plain");
    if (!fromId || fromId === a.id) return;
    const order = orderedStories(state.openIssue.list, state.openIssue.no).map((x) => x.id);
    order.splice(order.indexOf(fromId), 1);
    order.splice(order.indexOf(a.id), 0, fromId);
    await saveLayout({ order });
    renderFront();
  });
  return el;
}
function slotEl(text) { const el = document.createElement("div"); el.className = "slot"; el.textContent = text; return el; }
function closeIssue() { $("issue").hidden = true; state.openIssue = null; }
$("issue-close").addEventListener("click", closeIssue);
$("issue-close-bg").addEventListener("click", closeIssue);

async function saveLayout(partial) {
  const no = state.openIssue.no;
  const cur = layoutFor(no);
  const next = { order: partial.order ?? cur.order, style: { ...cur.style, ...(partial.style ?? {}) } };
  state.layouts[no] = next;
  try { state.layouts[no] = await api(`/issues/${no}`, { method: "PATCH", body: JSON.stringify(next) }); } catch {}
}
function syncToolButtons() {
  const lay = layoutFor(state.openIssue.no);
  document.querySelectorAll(".tool-group").forEach((g) => {
    const key = g.dataset.key;
    g.querySelectorAll("button").forEach((b) => b.classList.toggle("on", String(lay.style[key]) === b.dataset.v));
  });
}
$("btn-edit").onclick = () => {
  state.editing = true;
  $("paper-sheet").classList.add("editing");
  $("editor-tools").hidden = false; $("btn-edit").hidden = true;
  syncToolButtons();
  renderFront();
};
$("btn-edit-done").onclick = () => {
  state.editing = false;
  $("paper-sheet").classList.remove("editing");
  $("editor-tools").hidden = true; $("btn-edit").hidden = false;
  renderFront();
  toast("Layout saved.");
};
document.querySelectorAll(".tool-group").forEach((g) => g.querySelectorAll("button").forEach((b) => (b.onclick = async () => {
  const key = g.dataset.key;
  const v = key === "columns" ? Number(b.dataset.v) : b.dataset.v;
  await saveLayout({ style: { [key]: v } });
  $("paper-sheet").dataset[key] = String(v);
  syncToolButtons();
})));

// rename the paper
$("p-name").addEventListener("click", () => {
  const h = $("p-name");
  if (h.isContentEditable) return;
  h.contentEditable = "true"; h.focus();
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
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3200); }

/* ---------- boot ---------- */
async function load() {
  try {
    [state.articles, state.settings, state.layouts] = await Promise.all([api("/articles"), api("/settings"), api("/issues")]);
  } catch {
    $("hud-status").textContent = "Can't reach the server. Is `npm run dev` running?";
    state.articles = [];
  }
  render();
}
autoTime();
setInterval(autoTime, 60_000);
load();
