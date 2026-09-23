import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import MiniSearch from 'minisearch';
import { config } from './config.js';
import { renderMarkdown, markdownToText } from './markdown.js';

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseTags(value) {
  if (Array.isArray(value)) return value.map((t) => String(t).trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function toIsoString(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

/**
 * Holds every page in memory and keeps a full-text search index in sync with
 * the Markdown files on disk. Files can be edited in the browser or directly
 * in the content/pages folder; either way the index is refreshed.
 */
export class PageStore {
  constructor(pagesDir = config.pagesDir) {
    this.pagesDir = pagesDir;
    this.pages = new Map();
    this.index = this.#newIndex();
    fs.mkdirSync(this.pagesDir, { recursive: true });
    this.reload();
  }

  #newIndex() {
    return new MiniSearch({
      idField: 'slug',
      fields: ['title', 'tags', 'summary', 'category', 'text'],
      storeFields: ['slug'],
      extractField: (doc, field) => (field === 'tags' ? doc.tags.join(' ') : doc[field]),
      searchOptions: {
        boost: { title: 4, tags: 3, summary: 2, category: 1.5 },
        prefix: true,
        fuzzy: 0.2,
        combineWith: 'AND',
      },
    });
  }

  #fileFor(slug) {
    if (!SLUG_RE.test(slug)) throw new Error('Invalid page slug.');
    return path.join(this.pagesDir, `${slug}.md`);
  }

  #parse(slug, raw) {
    const { data, content } = matter(raw);
    return {
      slug,
      title: String(data.title || slug),
      summary: String(data.summary || ''),
      category: String(data.category || 'General'),
      tags: parseTags(data.tags),
      updated: toIsoString(data.updated),
      updatedBy: String(data.updatedBy || ''),
      body: content.replace(/^\n+/, ''),
      text: markdownToText(content),
    };
  }

  reload() {
    this.pages.clear();
    this.index = this.#newIndex();
    for (const file of fs.readdirSync(this.pagesDir)) {
      const slug = file.replace(/\.md$/, '');
      if (!file.endsWith('.md') || !SLUG_RE.test(slug)) continue;
      try {
        const page = this.#parse(slug, fs.readFileSync(path.join(this.pagesDir, file), 'utf8'));
        this.pages.set(slug, page);
      } catch (err) {
        console.error(`Skipping ${file}: ${err.message}`);
      }
    }
    this.index.addAll([...this.pages.values()]);
  }

  /** Reload the index when files change on disk (e.g. edited in a code editor or pulled from git). */
  watch() {
    let timer;
    this.watcher = fs.watch(this.pagesDir, () => {
      clearTimeout(timer);
      timer = setTimeout(() => this.reload(), 200);
    });
    return this;
  }

  close() {
    this.watcher?.close();
  }

  get(slug) {
    return this.pages.get(slug) || null;
  }

  exists(slug) {
    return this.pages.has(slug) || fs.existsSync(this.#fileFor(slug));
  }

  all() {
    return [...this.pages.values()].sort((a, b) => a.title.localeCompare(b.title));
  }

  categories() {
    const groups = new Map();
    for (const page of this.all()) {
      if (!groups.has(page.category)) groups.set(page.category, []);
      groups.get(page.category).push(page);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, pages]) => ({ name, pages }));
  }

  tags() {
    const counts = new Map();
    for (const p of this.pages.values()) for (const t of p.tags) counts.set(t, (counts.get(t) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }));
  }

  render(page) {
    return renderMarkdown(page.body);
  }

  search(query, limit = 25) {
    const q = String(query || '').trim();
    if (!q) return [];
    let hits = this.index.search(q);
    // Fall back to "any word" matching when every word together finds nothing.
    if (hits.length === 0) hits = this.index.search(q, { combineWith: 'OR' });
    return hits.slice(0, limit).map((hit) => {
      const page = this.pages.get(hit.id);
      return { ...page, score: hit.score, terms: hit.terms, snippet: makeSnippet(page, hit.terms) };
    });
  }

  suggest(query, limit = 8) {
    return this.search(query, limit).map(({ slug, title, category, summary }) => ({ slug, title, category, summary }));
  }

  save({ slug, title, summary, category, tags, body }, username, originalSlug = null) {
    title = String(title || '').trim();
    if (!title) throw new Error('Title is required.');
    slug = String(slug || '').trim() || slugify(title);
    if (!SLUG_RE.test(slug)) throw new Error('URL name may only contain lowercase letters, numbers and single dashes.');
    if (slug !== originalSlug && this.exists(slug)) throw new Error(`A page with the URL name "${slug}" already exists.`);

    const frontMatter = {
      title,
      summary: String(summary || '').trim(),
      category: String(category || '').trim() || 'General',
      tags: parseTags(tags),
      updated: new Date().toISOString(),
      updatedBy: username,
    };
    const file = this.#fileFor(slug);
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, matter.stringify(String(body || '').replace(/\r\n/g, '\n'), frontMatter));
    fs.renameSync(tmp, file);
    if (originalSlug && originalSlug !== slug) fs.rmSync(this.#fileFor(originalSlug), { force: true });
    this.reload();
    return this.get(slug);
  }

  delete(slug) {
    fs.rmSync(this.#fileFor(slug), { force: true });
    this.reload();
  }
}

function makeSnippet(page, terms, radius = 110) {
  const text = page.text;
  const lower = text.toLowerCase();
  let pos = -1;
  for (const term of terms) {
    const i = lower.indexOf(term.toLowerCase());
    if (i !== -1 && (pos === -1 || i < pos)) pos = i;
  }
  if (pos === -1) return page.summary || text.slice(0, radius * 2) + (text.length > radius * 2 ? '…' : '');
  const start = Math.max(0, pos - radius);
  const end = Math.min(text.length, pos + radius);
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
}
