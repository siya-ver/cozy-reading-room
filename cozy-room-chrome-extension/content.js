// Runs inside the page when you save. Grabs what the server needs:
// the full HTML (so paywalled pages you're logged into still work) and your selection.
(() => {
  const sel = window.getSelection()?.toString().trim() || null;
  const meta = (q) => document.querySelector(q)?.getAttribute("content") || null;
  return {
    url: location.href,
    title: meta('meta[property="og:title"]') || document.title,
    source: meta('meta[property="og:site_name"]') || null,
    highlight: sel && sel.length <= 600 ? sel : sel ? sel.slice(0, 600) + "…" : null,
    html: document.documentElement.outerHTML,
  };
})();
