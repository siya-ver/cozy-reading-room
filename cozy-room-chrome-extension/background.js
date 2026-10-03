// Background: talks to the reading room server on behalf of the page button
// and the right-click menu (content scripts can't reach localhost from https pages).

async function save(page) {
  const { server = "http://localhost:4321" } = await chrome.storage.sync.get("server");
  try {
    const res = await fetch(`${server}/api/articles`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(page),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || `Server said ${res.status}` };
    return { ok: true, alreadySaved: !!data.alreadySaved, mins: Math.max(1, Math.round((data.wordCount || 0) / 230)) };
  } catch {
    return { ok: false, error: "Can't reach the room. Is `npm run dev` running?" };
  }
}

// from the floating button
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type !== "save") return;
  save(msg.page).then(reply);
  return true; // async reply
});

// right-click menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-highlight",
    title: "Save to the reading room with this highlight",
    contexts: ["selection", "page"],
  });
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "save-highlight" || !tab?.id) return;
  const [{ result: page }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  const r = await save(page);
  chrome.action.setBadgeText({ tabId: tab.id, text: r.ok ? (r.alreadySaved ? "✓" : "+1") : "!" });
  chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: r.ok ? "#3f5a4c" : "#a8403d" });
  setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: "" }), 2500);
});
