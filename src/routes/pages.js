import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { requireRole } from '../auth.js';
import { config } from '../config.js';
import { SLUG_RE } from '../pages.js';
import { readStatus } from '../read-tracker.js';
import { loadSections, sectionFor, groupBySection } from '../sections.js';

const router = Router();
const canEdit = requireRole('editor');

const IMAGE_TYPES = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(config.imagesDir, { recursive: true });
      cb(null, config.imagesDir);
    },
    filename: (req, file, cb) => {
      const base = path
        .parse(file.originalname)
        .name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50) || 'image';
      cb(null, `${base}-${crypto.randomBytes(4).toString('hex')}${IMAGE_TYPES[file.mimetype]}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, Boolean(IMAGE_TYPES[file.mimetype])),
});

// --- Reading ---------------------------------------------------------------

// Lets every view show the signed-in user's read status for a page.
router.use((req, res, next) => {
  const myReads = req.app.locals.reads.forUser(req.user.username);
  res.locals.statusOf = (page) => readStatus(page, myReads[page.slug]);
  next();
});

router.get('/', (req, res) => {
  const pages = req.app.locals.pages;
  const all = pages.all();
  const sections = groupBySection(all).map((g) => ({ ...g, readCount: g.pages.filter((p) => res.locals.statusOf(p) !== 'unread').length }));
  const readCount = all.filter((p) => res.locals.statusOf(p) !== 'unread').length;
  res.render('home', { title: 'Home', sections, tags: pages.tags().slice(0, 12), total: all.length, readCount });
});

router.get('/search', (req, res) => {
  const q = String(req.query.q || '').slice(0, 200);
  const results = req.app.locals.pages.search(q);
  res.render('search', { title: q ? `Search: ${q}` : 'Search', q, results });
});

router.get('/api/search', (req, res) => {
  res.json({ results: req.app.locals.pages.suggest(String(req.query.q || '').slice(0, 200)) });
});

router.get('/tags/:tag', (req, res) => {
  const tag = req.params.tag.toLowerCase();
  const results = req.app.locals.pages.all().filter((p) => p.tags.some((t) => t.toLowerCase() === tag));
  res.render('list', { title: `Tag: ${req.params.tag}`, heading: `Pages tagged “${req.params.tag}”`, results });
});

router.get('/sections/:slug', (req, res, next) => {
  const slug = req.params.slug;
  const group = groupBySection(req.app.locals.pages.all()).find((g) => g.slug === slug);
  if (!group) return next();
  res.render('section', { title: group.name, section: group, results: group.pages });
});

// Older links and pages whose category isn't one of the main sections.
router.get('/categories/:category', (req, res) => {
  const section = sectionFor(req.params.category);
  if (section) return res.redirect(301, `/sections/${section.slug}`);
  const cat = req.params.category.toLowerCase();
  const results = req.app.locals.pages.all().filter((p) => p.category.toLowerCase() === cat);
  res.render('list', { title: req.params.category, heading: req.params.category, results });
});

router.get('/pages/:slug', (req, res, next) => {
  const page = req.app.locals.pages.get(req.params.slug);
  if (!page) return next();
  const { html, toc } = req.app.locals.pages.render(page);
  const reads = req.app.locals.reads;
  const previous = reads.get(req.user.username, page.slug);
  const status = readStatus(page, previous);
  reads.recordView(req.user.username, page.slug);
  res.render('page', { title: page.title, page, html, toc, previous, status });
});

router.post('/pages/:slug/unread', (req, res, next) => {
  if (!req.app.locals.pages.get(req.params.slug)) return next();
  req.app.locals.reads.markUnread(req.user.username, req.params.slug);
  res.redirect('/');
});

// --- Editing (editor role and above) ---------------------------------------

// Section names offered in the editor, plus any other category already in use.
function categoryNames(pages) {
  const names = loadSections().map((s) => s.name);
  for (const c of pages.categories()) if (!sectionFor(c.name) && !names.includes(c.name)) names.push(c.name);
  return names;
}

router.get('/new', canEdit, (req, res) => {
  const pages = req.app.locals.pages;
  const preset = sectionFor(req.query.section);
  const draft = { slug: '', title: String(req.query.title || ''), summary: '', category: preset ? preset.name : '', tags: [], body: '' };
  res.render('edit', { title: 'New page', page: draft, isNew: true, error: null, categories: categoryNames(pages) });
});

router.post('/new', canEdit, (req, res) => {
  const pages = req.app.locals.pages;
  try {
    const page = pages.save(req.body, req.user.username);
    res.redirect(`/pages/${page.slug}`);
  } catch (err) {
    res.status(400).render('edit', { title: 'New page', page: formPage(req.body), isNew: true, error: err.message, categories: categoryNames(pages) });
  }
});

router.get('/pages/:slug/edit', canEdit, (req, res, next) => {
  const pages = req.app.locals.pages;
  const page = pages.get(req.params.slug);
  if (!page) return next();
  res.render('edit', { title: `Edit: ${page.title}`, page, isNew: false, error: null, categories: categoryNames(pages) });
});

router.post('/pages/:slug/edit', canEdit, (req, res, next) => {
  const pages = req.app.locals.pages;
  const original = pages.get(req.params.slug);
  if (!original) return next();
  try {
    const page = pages.save(req.body, req.user.username, original.slug);
    if (page.slug !== original.slug) req.app.locals.reads.renamePage(original.slug, page.slug);
    res.redirect(`/pages/${page.slug}`);
  } catch (err) {
    res.status(400).render('edit', { title: `Edit: ${original.title}`, page: { ...formPage(req.body), originalSlug: original.slug }, isNew: false, error: err.message, categories: categoryNames(pages) });
  }
});

router.post('/pages/:slug/delete', canEdit, (req, res, next) => {
  if (!SLUG_RE.test(req.params.slug) || !req.app.locals.pages.get(req.params.slug)) return next();
  req.app.locals.pages.delete(req.params.slug);
  req.app.locals.reads.removePage(req.params.slug);
  res.redirect('/');
});

router.post('/api/preview', canEdit, (req, res) => {
  const { html } = req.app.locals.pages.render({ body: String(req.body.body || '') });
  res.json({ html });
});

router.post('/api/images', canEdit, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Please choose a PNG, JPG, GIF or WebP image.' });
    const alt = path.parse(req.file.originalname).name.replace(/[[\]]/g, '');
    res.json({ url: `/images/${req.file.filename}`, markdown: `![${alt}](/images/${req.file.filename})` });
  });
});

function formPage(body) {
  return {
    slug: body.slug || '',
    title: body.title || '',
    summary: body.summary || '',
    category: body.category || '',
    tags: String(body.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
    body: body.body || '',
  };
}

export default router;
