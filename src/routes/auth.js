import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyCredentials } from '../users.js';
import { safeNext } from '../auth.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).render('login', { title: 'Sign in', error: 'Too many failed attempts. Please wait 15 minutes and try again.', next: safeNext(req.body?.next), username: '' }),
});

router.get('/login', (req, res) => {
  if (req.user) return res.redirect(safeNext(req.query.next));
  res.render('login', { title: 'Sign in', error: null, next: safeNext(req.query.next), username: '' });
});

router.post('/login', loginLimiter, async (req, res, next) => {
  const { username = '', password = '' } = req.body;
  const target = safeNext(req.body.next);
  const user = await verifyCredentials(username.trim(), password);
  if (!user) {
    return res.status(401).render('login', { title: 'Sign in', error: 'Incorrect username or password.', next: target, username });
  }
  // New session id on sign-in prevents session fixation.
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.username = user.username;
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
    req.session.save((err2) => (err2 ? next(err2) : res.redirect(target)));
  });
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('wt.sid');
    res.redirect('/login');
  });
});

export default router;
