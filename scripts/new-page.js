#!/usr/bin/env node
// Scaffold a new guide in content/pages from the command line.
//   npm run new-page -- "How to revise a part" --category wt-parts
// --category takes a section slug or name from content/sections.json.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { config } from '../src/config.js';
import { slugify } from '../src/pages.js';
import { loadSections, sectionFor } from '../src/sections.js';

const args = process.argv.slice(2);
const ci = args.indexOf('--category');
const title = args.filter((_, i) => ci === -1 || (i !== ci && i !== ci + 1)).join(' ').trim();
const section = ci === -1 ? null : sectionFor(args[ci + 1]);

if (!title || !section) {
  console.error('Usage: npm run new-page -- "Page title" --category <section>\n\nSections:');
  for (const s of loadSections()) console.error(`  ${s.slug.padEnd(30)} ${s.name}`);
  process.exit(1);
}
const category = section.name;

const slug = slugify(title);
const file = path.join(config.pagesDir, `${slug}.md`);
if (fs.existsSync(file)) {
  console.error(`Already exists: ${path.relative(process.cwd(), file)}`);
  process.exit(1);
}

const body = `## Overview

Describe what this task is for and when to use it.

## Before you start

- Required permissions or role
- Anything that must already exist

## Steps

1. First step
2. Second step
3. Third step

> **Tip:** Add helpful hints here.

## Troubleshooting

| Problem | Solution |
| --- | --- |
| Something goes wrong | How to fix it |
`;

fs.mkdirSync(config.pagesDir, { recursive: true });
fs.writeFileSync(file, matter.stringify(body, { title, summary: '', category, tags: [], updated: new Date().toISOString().slice(0, 10) }));
console.log(`Created ${path.relative(process.cwd(), file)}  →  /pages/${slug}`);
