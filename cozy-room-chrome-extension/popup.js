const $ = (id) => document.getElementById(id);
let page = null;

async function init() {
  const { server = "http://localhost:4321" } = await chrome.storage.sync.get("server");
  $("server").value = server;
  $("open").href = server;
  $("server").addEventListener("change", () => {
    const v = $("server").value.trim().replace(/\/$/, "") || "http://localhost:4321";
    chrome.storage.sync.set({ server: v });
    $("open").href = v;
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/.test(tab.url || "")) {
    $("title").textContent = "Nothing to save here";
    $("save").disabled = true;
    return;
  }
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    page = result;
  } catch {
    $("title").textContent = "Can't read this page";
    $("status").textContent = "Chrome blocks extensions on some pages (its own settings, the Web Store).";
    $("save").disabled = true;
    return;
  }
  $("title").textContent = page.title;
  $("source").textContent = page.source || new URL(page.url).hostname.replace(/^www\./, "");
  if (page.highlight) {
    $("hl-wrap").hidden = false;
    $("hl").textContent = page.highlight;
  }
  $("note").focus();
}

$("save").addEventListener("click", async () => {
  if (!page) return;
  const server = $("server").value.trim().replace(/\/$/, "") || "http://localhost:4321";
  $("save").disabled = true;
  $("status").className = "status";
  $("status").textContent = "Folding it up…";
  try {
    const res = await fetch(`${server}/api/articles`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...page, note: $("note").value.trim() || null }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Server said ${res.status}`);
    $("status").className = "status ok";
    $("status").textContent = data.alreadySaved
      ? "Already on the table."
      : `On the table. About ${Math.max(1, Math.round(data.wordCount / 230))} min of reading.`;
    setTimeout(() => window.close(), 1400);
  } catch (err) {
    $("status").className = "status err";
    $("status").textContent = /Failed to fetch/.test(err.message)
      ? "Can't reach the room. Is `npm run dev` running?"
      : err.message;
    $("save").disabled = false;
  }
});

init();
