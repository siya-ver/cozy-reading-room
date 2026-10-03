# Cozy Reading Room

A little room for the articles you love. Save them from Chrome with one click, and they land on a coffee table you can actually sit down with.

**Status:** backend and room UI done. Chrome extension next.

## Run it

```bash
npm install
npm run seed     # optional: a few short sample essays so the table isn't empty
npm run dev      # then open http://localhost:4321
```

## The room

- **Coffee table** holds everything you haven't finished. Papers slowly go sepia the longer they sit. A red ribbon means you're partway through; a mug ring means you marked it "keep near."
- **Shelf** holds what you've finished, as book spines colored by source and sized by length.
- **Click a paper** and it lifts into a reading sheet. The ribbon bookmark follows your scroll and remembers your spot.
- **Margin note** at the bottom of each article saves on its own.
- **Window** cycles the time of day (it follows your clock by default). **Lamp** toggles on and off.
- **Draw one from the pile** picks for you when you can't.

Your library is a single file at `data/articles.json`. Back it up, move it, open it in a text editor. No accounts, no database server.

## API

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/health` | counts + where your library file lives |
| `GET` | `/api/articles` | the whole library, minus body text. `?unread=1` for the pile |
| `GET` | `/api/articles/:id` | one article with full clean HTML (reading view) |
| `POST` | `/api/articles` | save an article (see below) |
| `PATCH` | `/api/articles/:id` | update `progress` (0..1), `favorite`, `note`, `tags`, `readAt` |
| `POST` | `/api/articles/:id/read` | mark finished |
| `DELETE` | `/api/articles/:id` | remove it |

### Saving

Three ways to save, in order of how much work the server does:

```bash
# 1. Just a URL. Server fetches and extracts. Works for public pages.
curl -X POST localhost:4321/api/articles -H 'content-type: application/json' \
  -d '{"url":"https://paulgraham.com/greatwork.html"}'

# 2. Raw page HTML. The extension grabs document.documentElement.outerHTML
#    (so paywalled pages you're logged into work) and the server runs Readability.
curl -X POST localhost:4321/api/articles -H 'content-type: application/json' \
  -d '{"url":"https://...","html":"<html>...</html>","highlight":"the line I loved"}'

# 3. Already-extracted. The extension runs Readability itself and sends clean content.
curl -X POST localhost:4321/api/articles -H 'content-type: application/json' \
  -d '{"url":"https://...","title":"...","content":"<p>...</p>","source":"The Atlantic"}'
```

Saving the same URL twice returns the existing article with `alreadySaved: true`.

Extraction uses [Mozilla Readability](https://github.com/mozilla/readability), the engine behind Firefox Reader View.

## Project shape

```
src/
  server.ts          express app
  types.ts           the Article shape
  lib/store.ts       JSON-file store (atomic writes, in-memory cache)
  lib/extract.ts     Readability wrapper
  routes/articles.ts the API
  seed.ts            starter articles
public/
  index.html         the room
  room.css           the look
  room.js            pile, shelf, reader, API calls
data/samples.json    sample essays for `npm run seed`
data/articles.json   your library (gitignored)
```

## Roadmap

- [x] The room: coffee table, unread pile, reading view with a ribbon bookmark
- [ ] Chrome extension: one-click save with the text you had highlighted
- [ ] Collectibles: finish articles, find little objects, decorate the room
- [ ] Sunday edition: your week's saves as a front page
