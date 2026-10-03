# Cozy Reading Room

A treehouse for the articles you love. Save them from Chrome with one click, read them on a coffee table, and every ten you finish get bound into an issue of your own newspaper.

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

## The nook

- **Coffee table** holds what you haven't finished. Papers go sepia the longer they sit. A red ribbon means you're partway through; a mug ring means you marked it "keep near."
- **Click a paper** and it lifts into a reading sheet. The ribbon bookmark follows your scroll and remembers your spot. The margin note at the bottom saves itself.
- **The editor's desk** under the lamp holds the issue in progress. Click the stack to see the draft front page. Click the nameplate to name your reader.
- **Every 10 finished articles** bind into an issue of your paper and land on the rack. Click the masthead to rename the paper. Your favorite (or the longest read) becomes the lead story; your highlights become pull quotes; your margin notes become letters to the editor.
- **Window** cycles the time of day (it follows your clock by default). **Lamp** toggles.
- **Rooms** of the treehouse unlock as you read. Only the nook is open for now.

## API

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/health` | counts + where your library file lives |
| `GET` | `/api/articles` | the whole library, minus body text. `?unread=1` for the pile |
| `GET` | `/api/articles/:id` | one article with full clean HTML |
| `POST` | `/api/articles` | save (see below) |
| `PATCH` | `/api/articles/:id` | `progress` (0..1), `favorite`, `note`, `tags`, `readAt` |
| `POST` | `/api/articles/:id/read` | mark finished |
| `DELETE` | `/api/articles/:id` | remove |
| `GET` / `PATCH` | `/api/settings` | `readerName`, `paperName`, `issueSize` |

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
  seed.ts              sample essays
public/
  index.html           the nook
  room.css             the look
  room.js              pile, rack, desk, reader, newspaper
cozy-room-chrome-extension/   Chrome extension (Manifest V3)
data/samples.json      sample essays for `npm run seed`
data/articles.json     your library (gitignored)
IDEAS.md               the running wishlist
```
