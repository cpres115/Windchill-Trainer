import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// The main topic groups shown on the home page. Edit content/sections.json to
// add, rename or reorder them. A page belongs to a section when its
// `category` front matter matches the section's name or slug.

const FILE = () => path.join(config.contentDir, 'sections.json');

let cache = { mtimeMs: -1, sections: [] };

export function loadSections() {
  let stat;
  try {
    stat = fs.statSync(FILE());
  } catch {
    return [];
  }
  if (stat.mtimeMs !== cache.mtimeMs) {
    const list = JSON.parse(fs.readFileSync(FILE(), 'utf8'));
    cache = {
      mtimeMs: stat.mtimeMs,
      sections: list.map((s) => ({ slug: s.slug, name: s.name, description: s.description || '', icon: s.icon || 'document' })),
    };
  }
  return cache.sections;
}

/** The section a page's category refers to, or null if it matches none. */
export function sectionFor(category) {
  const key = String(category || '').trim().toLowerCase();
  return loadSections().find((s) => s.name.toLowerCase() === key || s.slug === key) || null;
}

export const OTHER_SECTION = { slug: 'other', name: 'Other', description: 'Guides not assigned to one of the main topics.', icon: 'document' };

/** Groups pages by section in configured order. Unmatched pages go into "Other" (only if any). */
export function groupBySection(pages) {
  const groups = loadSections().map((s) => ({ ...s, pages: [] }));
  const other = { ...OTHER_SECTION, pages: [] };
  for (const page of pages) {
    const s = sectionFor(page.category);
    (s ? groups.find((g) => g.slug === s.slug) : other).pages.push(page);
  }
  return other.pages.length ? [...groups, other] : groups;
}
