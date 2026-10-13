# Cozy Reading Room

A treehouse for the articles you love. Save them from Chrome with one click, read them on a coffee table (or out on the balcony), and every ten you finish get bound into an issue of your own newspaper, which you lay out yourself.

**Status:** backend, room, newspaper, and Chrome extension all working. See `IDEAS.md` for what's next.

## Run it

```bash
npm install
npm run seed     # optional: a handful of short sample essays so the room isn't empty
npm run dev      # then open http://localhost:4321
```

Your library is a single file at `data/articles.json`. Back it up, move it, open it in a text editor. No accounts, no database server.

## Install the Chrome extension

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and choose the `cozy-room-chrome-extension/` folder in this repo.
3. Open any article. A small paper button appears bottom-right; click it and the whole piece goes to the table, ads and clutter stripped. Highlight a sentence first and it becomes the pull quote. The toolbar icon, right-click menu, and `Cmd+Shift+S` do the same thing.

The extension grabs the page from inside your browser, so anything you're logged into (NYT, FT, WSJ, the Post, the Economist) saves with full text. It talks to `http://localhost:4321` by default; change that in the popup's Settings if you run the server elsewhere.

## The treehouse

Three rooms side by side. Use the arrows at the screen edges, the chips top-right, or the arrow keys.

**Reading Nook** (start here)
- **Coffee table** holds what you haven't finished. Papers go sepia the longer they sit. A red ribbon means you're partway through; a mug ring means you marked it "keep near."
- **Click a paper** and it lifts into a reading sheet. The ribbon bookmark follows your scroll and remembers your spot. The margin note at the bottom saves itself.
- **Put it away** drops an article you don't want into the **basket** by the table. Basket things never go in the paper; click the basket to bring one back.
- **The editor's desk** under the lamp holds the issue in progress. Click the stack to see the draft front page. Click the nameplate to name your reader.
- **Window** cycles the time of day (it follows your clock by default). **Lamp** toggles.

**Print Shop** (opens after 20 finished articles)
- The rack of bound issues and the press. Every 10 finished articles the press runs and a new issue lands on the rack.

**Balcony** (opens after 5)
- Outside, in the forest. Click the hammock to take the top of the pile out there and read it under the string lights.

**Editing an issue**
- Open any issue and hit **Edit layout**. Drag stories to reorder (first one leads), and pick a typeface, column count, and paper color. Saved per issue. Click the masthead to rename the paper.

## API

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/health` | counts + where your library file lives |
| `GET` | `/api/articles` | the whole library, minus body text. `?unread=1` for the pile |
| `GET` | `/api/articles/:id` | one article with full clean HTML |
| `POST` | `/api/articles` | save (see below) |
| `PATCH` | `/api/articles/:id` | `progress` (0..1), `favorite`, `note`, `tags`, `readAt` |
| `POST` | `/api/articles/:id/read` | mark finished |
| `POST` | `/api/articles/:id/archive` / `restore` | put it away / bring it back |
| `DELETE` | `/api/articles/:id` | remove |
| `GET` / `PATCH` | `/api/settings` | `readerName`, `paperName`, `issueSize` |
| `GET` / `PATCH` | `/api/issues/:no` | per-issue layout: `order` (article ids), `style` (`face`, `columns`, `paper`) |

### Saving

```bash
# 1. Just a URL. Server fetches and extracts. Public pages only.
curl -X POST localhost:4321/api/articles -H 'content-type: application/json' \
  -d '{"url":"https://paulgraham.com/greatwork.html"}'

# 2. Raw page HTML (what the extension sends). Server runs Readability on it.
curl -X POST localhost:4321/api/articles -H 'content-type: application/json' \
  -d '{"url":"https://...","html":"<html>...</html>","highlight":"the line I loved"}'

# 3. Already-extracted content.
curl -X POST localhost:4321/api/articles -H 'content-type: application/json' \
  -d '{"url":"https://...","title":"...","content":"<p>...</p>","source":"The Atlantic"}'
```

Saving the same URL twice returns the existing article with `alreadySaved: true`. Extraction uses [Mozilla Readability](https://github.com/mozilla/readability), the engine behind Firefox Reader View.

## Project shape

```
src/
  server.ts            express app
  types.ts             the Article shape
  lib/store.ts         JSON-file store (atomic writes, in-memory cache)
  lib/extract.ts       Readability wrapper
  routes/articles.ts   the library API
  routes/settings.ts   reader name, paper name
  routes/issues.ts     per-issue layout choices
  seed.ts              sample essays
public/
  index.html           the three rooms
  room.css             the look
  room.js              camera, pile, rack, desk, basket, reader, newspaper editor
cozy-room-chrome-extension/   Chrome extension (Manifest V3)
data/samples.json      sample essays for `npm run seed`
data/articles.json     your library (gitignored)
IDEAS.md               the running wishlist
```
