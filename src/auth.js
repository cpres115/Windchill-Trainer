import crypto from 'node:crypto';
import { ROLE_RANK } from './config.js';
import { getUser } from './users.js';

/** Loads the signed-in user onto req.user / res.locals.user and issues a CSRF token. */
export function loadUser(req, res, next) {
  if (req.session.username) {
    // Re-read on each request so role changes and deletions take effect immediately.
    const user = getUser(req.session.username);
    if (user) req.user = user;
    else delete req.session.username;
  }
  req.session.csrfToken ??= crypto.randomBytes(24).toString('hex');
  res.locals.user = req.user || null;
  res.locals.csrfToken = req.session.csrfToken;
  res.locals.can = (role) => Boolean(req.user && ROLE_RANK[req.user.role] >= ROLE_RANK[role]);
  next();
}

export function requireLogin(req, res, next) {
  if (req.user) return next();
  if (req.path.startsWith('/api/') || req.accepts(['html', 'json']) === 'json') {
    return res.status(401).json({ error: 'Not signed in.' });
  }
  const target = req.method === 'GET' ? req.originalUrl : '/';
  res.redirect(`/login?next=${encodeURIComponent(target)}`);
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user && ROLE_RANK[req.user.role] >= ROLE_RANK[role]) return next();
    res.status(403).render('error', { title: 'Access denied', message: `This area requires the "${role}" role.` });
  };
}

/** Rejects state-changing requests that don't carry this session's CSRF token. */
export function verifyCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = req.get('x-csrf-token') || req.body?._csrf || '';
  const expected = req.session.csrfToken || '';
  const ok =
    sent.length === expected.length &&
    expected.length > 0 &&
    crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
  if (ok) return next();
  res.status(403).render('error', { title: 'Session expired', message: 'Your form expired. Please go back, refresh the page and try again.' });
}

/** Only allow redirects to local paths after login. */
export function safeNext(next) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/';
}
