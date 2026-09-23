import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const dataDir = path.resolve(process.env.DATA_DIR || path.join(rootDir, 'data'));
const contentDir = path.resolve(process.env.CONTENT_DIR || path.join(rootDir, 'content'));

// Use SESSION_SECRET when provided; otherwise generate one once and persist it
// so sessions survive restarts.
function loadSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'session-secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

export const config = {
  rootDir,
  dataDir,
  contentDir,
  pagesDir: path.join(contentDir, 'pages'),
  imagesDir: path.join(contentDir, 'images'),
  usersFile: path.join(dataDir, 'users.json'),
  port: Number(process.env.PORT) || 3000,
  siteName: process.env.SITE_NAME || 'FCUS Windchill Training',
  // Set to "true" when served over HTTPS (directly or behind a proxy).
  secureCookies: process.env.SECURE_COOKIES === 'true',
  trustProxy: process.env.TRUST_PROXY === 'true',
  sessionMaxAgeHours: Number(process.env.SESSION_MAX_AGE_HOURS) || 8,
  get sessionSecret() {
    return (this._secret ??= loadSessionSecret());
  },
};

export const ROLES = ['viewer', 'editor', 'admin'];

// Higher number = more privileges. An admin can do everything an editor can.
export const ROLE_RANK = { viewer: 1, editor: 2, admin: 3 };
