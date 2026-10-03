// The shape of one saved article. Everything the room and the reader need.
export interface Article {
  id: string;
  url: string;
  title: string;
  source: string;          // e.g. "The Atlantic" (derived from the site or the page's own name)
  author: string | null;
  excerpt: string | null;  // first paragraph or the page's own description
  content: string;         // clean article HTML (from Readability)
  textContent: string;     // plain text, for word counts / search later
  wordCount: number;
  leadImage: string | null;
  highlight: string | null; // the text you had selected when you saved it
  note: string | null;      // your one-line take
  tags: string[];
  savedAt: string;          // ISO timestamp
  publishedAt: string | null;
  readAt: string | null;    // null until you finish it
  progress: number;         // 0..1, where your ribbon bookmark sits
  favorite: boolean;        // earns a coffee-mug ring on the table
}

// What the Chrome extension (or a curl) sends when saving.
export interface SaveArticleInput {
  url: string;
  title?: string;
  source?: string;
  author?: string | null;
  excerpt?: string | null;
  content?: string;       // if the extension already ran Readability in-page
  textContent?: string;
  leadImage?: string | null;
  highlight?: string | null;
  note?: string | null;
  tags?: string[];
  publishedAt?: string | null;
}
