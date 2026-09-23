import { Router } from 'express';
import { requireRole } from '../auth.js';
import { ROLES } from '../config.js';
import { listUsers, getUser, createUser, setRole, setPassword, deleteUser, MIN_PASSWORD_LENGTH } from '../users.js';
import { readStatus } from '../read-tracker.js';

const router = Router();
router.use(requireRole('admin'));

function renderUsers(req, res, { status = 200, error = null, success = null } = {}) {
  res.status(status).render('admin-users', { title: 'Manage users', users: listUsers(), roles: ROLES, minPassword: MIN_PASSWORD_LENGTH, error, success });
}

router.get('/users', (req, res) => renderUsers(req, res));

router.post('/users', async (req, res) => {
  const { username = '', password = '', role = 'viewer' } = req.body;
  try {
    await createUser(username.trim(), password, role);
    renderUsers(req, res, { success: `User "${username.trim()}" created.` });
  } catch (err) {
    renderUsers(req, res, { status: 400, error: err.message });
  }
});

router.post('/users/:username/role', (req, res) => {
  try {
    setRole(req.params.username, req.body.role);
    renderUsers(req, res, { success: `Updated role for "${req.params.username}".` });
  } catch (err) {
    renderUsers(req, res, { status: 400, error: err.message });
  }
});

router.post('/users/:username/password', async (req, res) => {
  try {
    await setPassword(req.params.username, req.body.password);
    renderUsers(req, res, { success: `Password reset for "${req.params.username}".` });
  } catch (err) {
    renderUsers(req, res, { status: 400, error: err.message });
  }
});

router.post('/users/:username/delete', (req, res) => {
  try {
    if (req.params.username.toLowerCase() === req.user.username.toLowerCase()) throw new Error('You cannot delete your own account.');
    deleteUser(req.params.username);
    req.app.locals.reads.removeUser(req.params.username);
    renderUsers(req, res, { success: `Deleted "${req.params.username}".` });
  } catch (err) {
    renderUsers(req, res, { status: 400, error: err.message });
  }
});

// --- Reading activity ------------------------------------------------------

function latest(entries) {
  return entries.reduce((max, e) => (e && e.lastViewed > max ? e.lastViewed : max), '');
}

router.get('/activity', (req, res) => {
  const { pages, reads } = req.app.locals;
  const allPages = pages.all();
  const users = listUsers().map((u) => {
    const mine = reads.forUser(u.username);
    const entries = allPages.map((p) => mine[p.slug]);
    const statuses = allPages.map((p, i) => readStatus(p, entries[i]));
    return {
      ...u,
      read: statuses.filter((s) => s === 'read').length,
      updated: statuses.filter((s) => s === 'updated').length,
      lastActive: latest(entries),
    };
  });
  const pageStats = allPages.map((p) => {
    const readers = reads.forPage(p.slug);
    const current = users.filter((u) => readStatus(p, readers[u.username.toLowerCase()]) === 'read').length;
    return { ...p, readers: Object.keys(readers).length, current, lastViewed: latest(Object.values(readers)) };
  });
  res.render('admin-activity', { title: 'Reading activity', users, pageStats, totalPages: allPages.length });
});

router.get('/activity/users/:username', (req, res, next) => {
  const person = getUser(req.params.username);
  if (!person) return next();
  const { pages, reads } = req.app.locals;
  const mine = reads.forUser(person.username);
  const rows = pages.all().map((p) => ({ page: p, entry: mine[p.slug] || null, status: readStatus(p, mine[p.slug]) }));
  res.render('admin-activity-user', { title: `Activity: ${person.username}`, person, rows });
});

router.get('/activity/pages/:slug', (req, res, next) => {
  const { pages, reads } = req.app.locals;
  const page = pages.get(req.params.slug);
  if (!page) return next();
  const readers = reads.forPage(page.slug);
  const rows = listUsers().map((u) => {
    const entry = readers[u.username.toLowerCase()] || null;
    return { person: u, entry, status: readStatus(page, entry) };
  });
  res.render('admin-activity-page', { title: `Activity: ${page.title}`, page, rows });
});

router.get('/activity.csv', (req, res) => {
  const { pages, reads } = req.app.locals;
  // Quote every cell, and neutralise leading = + - @ so spreadsheets don't evaluate them as formulas.
  const cell = (v) => `"${String(v ?? '').replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"`;
  const lines = [['username', 'role', 'page', 'title', 'status', 'first_viewed', 'last_viewed', 'view_count'].join(',')];
  for (const u of listUsers()) {
    const mine = reads.forUser(u.username);
    for (const p of pages.all()) {
      const e = mine[p.slug];
      lines.push([u.username, u.role, p.slug, p.title, readStatus(p, e), e?.firstViewed, e?.lastViewed, e?.count ?? 0].map(cell).join(','));
    }
  }
  res.type('text/csv').attachment(`reading-activity-${new Date().toISOString().slice(0, 10)}.csv`).send(lines.join('\n') + '\n');
});

export default router;
