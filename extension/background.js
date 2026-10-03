// Right-click a selection -> "Save to the reading room with this highlight"
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-highlight",
    title: "Save to the reading room with this highlight",
    contexts: ["selection", "page"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "save-highlight" || !tab?.id) return;
  const { server = "http://localhost:4321" } = await chrome.storage.sync.get("server");
  const [{ result: page }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  try {
    const res = await fetch(`${server}/api/articles`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(page),
    });
    const data = await res.json();
    chrome.action.setBadgeText({ tabId: tab.id, text: res.ok ? (data.alreadySaved ? "✓" : "+1") : "!" });
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: res.ok ? "#3f5a4c" : "#a8403d" });
  } catch {
    chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#a8403d" });
  }
  setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: "" }), 2500);
});
