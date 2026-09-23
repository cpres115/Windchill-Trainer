import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { config, ROLES } from './config.js';

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,64}$/;
export const MIN_PASSWORD_LENGTH = 10;

// A hash of a random value, compared against when a username doesn't exist so
// that login timing doesn't reveal which usernames are valid.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password-' + Math.random(), 12);

function readStore() {
  if (!fs.existsSync(config.usersFile)) return { users: [] };
  return JSON.parse(fs.readFileSync(config.usersFile, 'utf8'));
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(config.usersFile), { recursive: true });
  const tmp = config.usersFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, config.usersFile);
}

function publicUser(u) {
  return { username: u.username, role: u.role, createdAt: u.createdAt };
}

export function validateUsername(username) {
  if (!USERNAME_RE.test(username || '')) {
    throw new Error('Username must be 3-64 characters: letters, numbers, dot, dash or underscore.');
  }
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
}

function validateRole(role) {
  if (!ROLES.includes(role)) throw new Error(`Role must be one of: ${ROLES.join(', ')}.`);
}

function find(store, username) {
  const key = String(username || '').toLowerCase();
  return store.users.find((u) => u.username.toLowerCase() === key);
}

export function listUsers() {
  return readStore().users.map(publicUser).sort((a, b) => a.username.localeCompare(b.username));
}

export function getUser(username) {
  const u = find(readStore(), username);
  return u ? publicUser(u) : null;
}

export function countUsers() {
  return readStore().users.length;
}

export async function createUser(username, password, role = 'viewer') {
  validateUsername(username);
  validatePassword(password);
  validateRole(role);
  const store = readStore();
  if (find(store, username)) throw new Error(`User "${username}" already exists.`);
  store.users.push({
    username,
    role,
    passwordHash: await bcrypt.hash(password, 12),
    createdAt: new Date().toISOString(),
  });
  writeStore(store);
  return getUser(username);
}

export async function setPassword(username, password) {
  validatePassword(password);
  const store = readStore();
  const u = find(store, username);
  if (!u) throw new Error(`User "${username}" not found.`);
  u.passwordHash = await bcrypt.hash(password, 12);
  writeStore(store);
}

export function setRole(username, role) {
  validateRole(role);
  const store = readStore();
  const u = find(store, username);
  if (!u) throw new Error(`User "${username}" not found.`);
  if (u.role === 'admin' && role !== 'admin' && adminCount(store) === 1) {
    throw new Error('Cannot demote the last admin.');
  }
  u.role = role;
  writeStore(store);
}

export function deleteUser(username) {
  const store = readStore();
  const u = find(store, username);
  if (!u) throw new Error(`User "${username}" not found.`);
  if (u.role === 'admin' && adminCount(store) === 1) {
    throw new Error('Cannot delete the last admin.');
  }
  store.users = store.users.filter((x) => x !== u);
  writeStore(store);
}

function adminCount(store) {
  return store.users.filter((u) => u.role === 'admin').length;
}

/** Returns the public user record when the credentials are valid, otherwise null. */
export async function verifyCredentials(username, password) {
  const u = find(readStore(), username);
  const ok = await bcrypt.compare(String(password || ''), u ? u.passwordHash : DUMMY_HASH);
  return ok && u ? publicUser(u) : null;
}
