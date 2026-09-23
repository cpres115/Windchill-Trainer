import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

/**
 * Records which user has opened which page, and when. Stored as JSON:
 *   { "<username>": { "<slug>": { firstViewed, lastViewed, count } } }
 */
export class ReadTracker {
  constructor(file = path.join(config.dataDir, 'reads.json')) {
    this.file = file;
    this.data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  }

  #save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  #key(username) {
    return String(username).toLowerCase();
  }

  recordView(username, slug) {
    const now = new Date().toISOString();
    const reads = (this.data[this.#key(username)] ??= {});
    const entry = (reads[slug] ??= { firstViewed: now, lastViewed: now, count: 0 });
    entry.lastViewed = now;
    entry.count += 1;
    this.#save();
    return entry;
  }

  /** Returns { slug: entry } for one user. */
  forUser(username) {
    return this.data[this.#key(username)] || {};
  }

  get(username, slug) {
    return this.forUser(username)[slug] || null;
  }

  /** Returns { username: entry } for everyone who has opened the page. */
  forPage(slug) {
    const out = {};
    for (const [user, reads] of Object.entries(this.data)) if (reads[slug]) out[user] = reads[slug];
    return out;
  }

  markUnread(username, slug) {
    const reads = this.data[this.#key(username)];
    if (reads?.[slug]) {
      delete reads[slug];
      this.#save();
    }
  }

  renamePage(oldSlug, newSlug) {
    let changed = false;
    for (const reads of Object.values(this.data)) {
      if (reads[oldSlug]) {
        reads[newSlug] = reads[oldSlug];
        delete reads[oldSlug];
        changed = true;
      }
    }
    if (changed) this.#save();
  }

  removePage(slug) {
    let changed = false;
    for (const reads of Object.values(this.data)) {
      if (reads[slug]) {
        delete reads[slug];
        changed = true;
      }
    }
    if (changed) this.#save();
  }

  removeUser(username) {
    if (this.data[this.#key(username)]) {
      delete this.data[this.#key(username)];
      this.#save();
    }
  }
}

/**
 * Read status of a page for one user:
 *   "unread"  – never opened
 *   "updated" – opened, but the page has been edited since
 *   "read"    – opened and unchanged since
 */
export function readStatus(page, entry) {
  if (!entry) return 'unread';
  if (page.updated && page.updated > entry.lastViewed) return 'updated';
  return 'read';
}
