import path from 'node:path';
import express from 'express';
import session from 'express-session';
import createMemoryStore from 'memorystore';
import helmet from 'helmet';
import { config } from './config.js';
import { PageStore } from './pages.js';
import { ReadTracker } from './read-tracker.js';
import { loadUser, requireLogin, verifyCsrf } from './auth.js';
import authRoutes from './routes/auth.js';
import pageRoutes from './routes/pages.js';
import accountRoutes from './routes/account.js';
import adminRoutes from './routes/admin.js';
import { highlight, fmtDate } from './view-helpers.js';
import { sectionFor } from './sections.js';

const MemoryStore = createMemoryStore(session);

export function createApp({ pages = new PageStore(), reads = new ReadTracker() } = {}) {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(config.rootDir, 'views'));
  if (config.trustProxy) app.set('trust proxy', 1);

  app.locals.siteName = config.siteName;
  app.locals.highlight = highlight;
  app.locals.fmtDate = fmtDate;
  app.locals.pages = pages;
  app.locals.reads = reads;
  // Link target + display name for a page's category.
  app.locals.sectionLink = (category) => {
    const s = sectionFor(category);
    return s ? { href: `/sections/${s.slug}`, name: s.name } : { href: `/categories/${encodeURIComponent(category)}`, name: category };
  };
  // Defaults for views rendered before the session is loaded; res.locals override these.
  app.locals.user = null;
  app.locals.csrfToken = '';
  app.locals.can = () => false;

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:'],
          'upgrade-insecure-requests': config.secureCookies ? [] : null,
        },
      },
    }),
  );
  app.use(express.static(path.join(config.rootDir, 'public'), { maxAge: '1h' }));
  app.use(express.urlencoded({ extended: false, limit: '2mb' }));
  app.use(express.json({ limit: '2mb' }));
  app.use(
    session({
      name: 'wt.sid',
      secret: config.sessionSecret,
      store: new MemoryStore({ checkPeriod: 60 * 60 * 1000 }),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.secureCookies,
        maxAge: config.sessionMaxAgeHours * 60 * 60 * 1000,
      },
    }),
  );
  app.use(loadUser);
  app.use(verifyCsrf);

  // Public: sign-in only. Everything registered after requireLogin needs a session.
  app.use(authRoutes);
  app.use(requireLogin);
  app.use('/images', express.static(config.imagesDir, { maxAge: '1h' }));
  app.use(accountRoutes);
  app.use('/admin', adminRoutes);
  app.use(pageRoutes);

  app.use((req, res) => {
    res.status(404).render('error', { title: 'Not found', message: "We couldn't find that page." });
  });
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render('error', { title: 'Something went wrong', message: 'An unexpected error occurred.' });
  });

  return app;
}
