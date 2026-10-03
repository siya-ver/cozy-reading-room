// Floating save button, injected on pages that look like articles.
// Click it: the whole article (ads and chrome stripped by the server) goes to the table.
// Highlight a sentence first and it becomes the pull quote.
(() => {
  if (window.__cozyRoomButton) return;
  const looksLikeArticle =
    document.querySelector('meta[property="og:type"][content="article"]') ||
    document.querySelector("article") ||
    document.querySelectorAll("p").length > 8;
  if (!looksLikeArticle) return;
  window.__cozyRoomButton = true;

  const host = document.createElement("div");
  host.id = "cozy-room-host";
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .b {
        position: fixed; right: 22px; bottom: 22px; z-index: 2147483646;
        display: flex; align-items: center; gap: 8px;
        height: 42px; padding: 0 14px 0 10px; border-radius: 999px; border: 0; cursor: pointer;
        background: #4b3a52; color: #f3ebdc; font: 600 13px/1 -apple-system, "Nunito", system-ui, sans-serif;
        box-shadow: 0 6px 18px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.08) inset;
        transition: transform .15s, background .2s; opacity: .92;
      }
      .b:hover { transform: translateY(-2px); opacity: 1; }
      .b svg { width: 20px; height: 20px; flex: none; }
      .b .t { max-width: 0; overflow: hidden; white-space: nowrap; transition: max-width .25s; }
      .b:hover .t, .b.busy .t, .b.done .t, .b.err .t { max-width: 220px; }
      .b.done { background: #3f5a4c; }
      .b.err { background: #a8403d; }
      .b.busy { pointer-events: none; }
    </style>
    <button class="b" type="button" title="Save to the reading room">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 11h6M9 15h6"/>
      </svg>
      <span class="t">Put it on the table</span>
    </button>`;
  const btn = shadow.querySelector(".b");
  const label = shadow.querySelector(".t");

  btn.addEventListener("click", () => {
    const sel = window.getSelection()?.toString().trim() || null;
    const meta = (q) => document.querySelector(q)?.getAttribute("content") || null;
    btn.className = "b busy";
    label.textContent = "Folding it up…";
    chrome.runtime.sendMessage(
      {
        type: "save",
        page: {
          url: location.href,
          title: meta('meta[property="og:title"]') || document.title,
          source: meta('meta[property="og:site_name"]') || null,
          highlight: sel ? sel.slice(0, 600) : null,
          html: document.documentElement.outerHTML,
        },
      },
      (res) => {
        if (!res || !res.ok) {
          btn.className = "b err";
          label.textContent = res?.error || "Can't reach the room";
          setTimeout(() => { btn.className = "b"; label.textContent = "Put it on the table"; }, 3000);
          return;
        }
        btn.className = "b done";
        label.textContent = res.alreadySaved ? "Already on the table" : `On the table · ${res.mins} min`;
        setTimeout(() => { btn.className = "b"; label.textContent = "Put it on the table"; }, 2600);
      },
    );
  });

  document.documentElement.appendChild(host);
})();
