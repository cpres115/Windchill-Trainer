#!/usr/bin/env node
// Scaffold a new guide in content/pages from the command line.
//   npm run new-page -- "How to revise a part" [--category "Change Management"]
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { config } from '../src/config.js';
import { slugify } from '../src/pages.js';

const args = process.argv.slice(2);
const ci = args.indexOf('--category');
const category = ci === -1 ? 'General' : args[ci + 1];
const title = args.filter((_, i) => ci === -1 || (i !== ci && i !== ci + 1)).join(' ').trim();

if (!title) {
  console.error('Usage: npm run new-page -- "Page title" [--category "Category"]');
  process.exit(1);
}

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
