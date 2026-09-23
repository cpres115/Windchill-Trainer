import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';

// Isolated data + content folders for every test run.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-test-'));
process.env.DATA_DIR = path.join(tmp, 'data');
process.env.CONTENT_DIR = path.join(tmp, 'content');
fs.mkdirSync(path.join(tmp, 'content', 'pages'), { recursive: true });
for (const f of fs.readdirSync('content/pages')) {
  fs.copyFileSync(path.join('content/pages', f), path.join(tmp, 'content', 'pages', f));
}

const { createApp } = await import('../src/app.js');
const { createUser } = await import('../src/users.js');

let app;
const PASSWORD = 'correct-horse-battery';

before(async () => {
  await createUser('alice', PASSWORD, 'admin');
  await createUser('eddie', PASSWORD, 'editor');
  await createUser('vera', PASSWORD, 'viewer');
  app = createApp();
});

after(() => {
  app.locals.pages.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

function csrfFrom(html) {
  return html.match(/name="_csrf" value="([^"]+)"/)[1];
}

async function login(username) {
  const agent = request.agent(app);
  const form = await agent.get('/login');
  const res = await agent.post('/login').type('form').send({ _csrf: csrfFrom(form.text), username, password: PASSWORD, next: '/' });
  assert.equal(res.status, 302);
  const home = await agent.get('/');
  return { agent, csrf: csrfFrom(home.text) };
}

test('redirects anonymous users to the login page', async () => {
  const res = await request(app).get('/pages/create-wtpart');
  assert.equal(res.status, 302);
  assert.match(res.headers.location, /^\/login\?next=%2Fpages%2Fcreate-wtpart/);
  assert.equal((await request(app).get('/api/search?q=part')).status, 401);
  assert.equal((await request(app).get('/images/x.png')).status, 302);
});

test('rejects a wrong password', async () => {
  const agent = request.agent(app);
  const form = await agent.get('/login');
  const res = await agent.post('/login').type('form').send({ _csrf: csrfFrom(form.text), username: 'vera', password: 'nope-nope-nope' });
  assert.equal(res.status, 401);
  assert.match(res.text, /Incorrect username or password/);
});

test('rejects posts without a CSRF token', async () => {
  const { agent } = await login('eddie');
  const res = await agent.post('/new').type('form').send({ title: 'Sneaky', body: 'x' });
  assert.equal(res.status, 403);
});

test('home page lists every guide with read status', async () => {
  const { agent } = await login('vera');
  const res = await agent.get('/');
  assert.equal(res.status, 200);
  for (const title of ['How to create a promotion request', 'How to create a WTPart', 'How to change attributes on an object']) {
    assert.ok(res.text.includes(title), `missing ${title}`);
  }
  assert.match(res.text, /You've opened <strong>0<\/strong> of 3/);
});

test('search finds pages by keyword, tag and fuzzy match', async () => {
  const { agent } = await login('vera');
  const byTitle = await agent.get('/search?q=promotion');
  assert.match(byTitle.text, /href="\/pages\/create-promotion-request"/);
  const byTag = await agent.get('/api/search?q=wt part');
  assert.equal(byTag.body.results[0].slug, 'create-wtpart');
  const fuzzy = await agent.get('/api/search?q=atributes');
  assert.equal(fuzzy.body.results[0].slug, 'change-attributes');
  const none = await agent.get('/search?q=zzzqqq');
  assert.match(none.text, /No guides matched/);
});

test('opening a page marks it read for that user only', async () => {
  const { agent, csrf } = await login('vera');
  const first = await agent.get('/pages/create-wtpart');
  assert.match(first.text, /this is your first visit/);
  const home = await agent.get('/');
  assert.match(home.text, /data-status="read"/);
  assert.match(home.text, /You've opened <strong>1<\/strong> of 3/);

  const other = await login('eddie');
  assert.match((await other.agent.get('/')).text, /You've opened <strong>0<\/strong> of 3/);

  await agent.post('/pages/create-wtpart/unread').type('form').send({ _csrf: csrf });
  assert.match((await agent.get('/')).text, /You've opened <strong>0<\/strong> of 3/);
});

test('viewers cannot edit or reach admin pages', async () => {
  const { agent } = await login('vera');
  assert.equal((await agent.get('/new')).status, 403);
  assert.equal((await agent.get('/pages/create-wtpart/edit')).status, 403);
  assert.equal((await agent.get('/admin/activity')).status, 403);
  assert.equal((await agent.get('/admin/users')).status, 403);
});

test('editors can create, edit and delete pages; HTML is sanitized', async () => {
  const { agent, csrf } = await login('eddie');
  const created = await agent.post('/new').type('form').send({
    _csrf: csrf,
    title: 'How to revise a part',
    category: 'Parts & BOMs',
    tags: 'revise, new revision',
    summary: 'Create a new revision.',
    body: '## Steps\n\n1. Select the part\n2. Choose **Revise**\n\n<script>alert(1)</script><img src=x onerror=alert(1)>',
  });
  assert.equal(created.status, 302);
  assert.equal(created.headers.location, '/pages/how-to-revise-a-part');

  const page = await agent.get('/pages/how-to-revise-a-part');
  assert.match(page.text, /<strong>Revise<\/strong>/);
  assert.doesNotMatch(page.text, /<script>alert/);
  assert.doesNotMatch(page.text, /onerror/);

  const found = await agent.get('/api/search?q=revision');
  assert.equal(found.body.results[0].slug, 'how-to-revise-a-part');

  const file = fs.readFileSync(path.join(process.env.CONTENT_DIR, 'pages', 'how-to-revise-a-part.md'), 'utf8');
  assert.match(file, /^---\ntitle: How to revise a part/);
  assert.match(file, /updatedBy: eddie/);

  // Rename via edit keeps read history attached to the page.
  const renamed = await agent.post('/pages/how-to-revise-a-part/edit').type('form').send({ _csrf: csrf, title: 'How to revise a part', slug: 'revise-part', body: 'Updated' });
  assert.equal(renamed.headers.location, '/pages/revise-part');
  assert.equal(app.locals.reads.get('eddie', 'revise-part').count, 1);
  assert.equal((await agent.get('/pages/how-to-revise-a-part')).status, 404);

  const dup = await agent.post('/new').type('form').send({ _csrf: csrf, title: 'Dup', slug: 'revise-part', body: '' });
  assert.equal(dup.status, 400);
  assert.match(dup.text, /already exists/);

  await agent.post('/pages/revise-part/delete').type('form').send({ _csrf: csrf });
  assert.equal((await agent.get('/pages/revise-part')).status, 404);
  assert.equal(app.locals.reads.get('eddie', 'revise-part'), null);
});

test('pages edited after a read show as updated', async () => {
  const reader = await login('vera');
  await reader.agent.get('/pages/change-attributes');
  // Simulate an older read so the edit is strictly newer.
  app.locals.reads.forUser('vera')['change-attributes'].lastViewed = '2000-01-01T00:00:00.000Z';

  const editor = await login('eddie');
  const original = app.locals.pages.get('change-attributes');
  await editor.agent.post('/pages/change-attributes/edit').type('form').send({ _csrf: editor.csrf, ...original, tags: original.tags.join(', '), slug: original.slug });

  const home = await reader.agent.get('/');
  assert.match(home.text, /data-status="updated"[^>]*data-text="how to change attributes/);
  const page = await reader.agent.get('/pages/change-attributes');
  assert.match(page.text, /updated since you last read it/);
});

test('admins can see who has read what, and export CSV', async () => {
  const vera = await login('vera');
  await vera.agent.get('/pages/create-promotion-request');

  const { agent } = await login('alice');
  const overview = await agent.get('/admin/activity');
  assert.equal(overview.status, 200);
  assert.match(overview.text, /href="\/admin\/activity\/users\/vera"/);

  const byUser = await agent.get('/admin/activity/users/vera');
  assert.match(byUser.text, /How to create a promotion request<\/a>[\s\S]*?✓ Read/);

  const byPage = await agent.get('/admin/activity/pages/create-promotion-request');
  assert.match(byPage.text, /vera<\/a><\/td>\s*<td><span class="status status-read">/);

  const csv = await agent.get('/admin/activity.csv');
  assert.match(csv.headers['content-type'], /text\/csv/);
  assert.match(csv.text, /"vera","viewer","create-promotion-request","How to create a promotion request","read"/);
});

test('admins can manage users', async () => {
  const { agent, csrf } = await login('alice');
  const add = await agent.post('/admin/users').type('form').send({ _csrf: csrf, username: 'newbie', password: 'short', role: 'viewer' });
  assert.equal(add.status, 400);
  const ok = await agent.post('/admin/users').type('form').send({ _csrf: csrf, username: 'newbie', password: 'long-enough-pass', role: 'viewer' });
  assert.match(ok.text, /User &#34;newbie&#34; created|User "newbie" created/);
  const self = await agent.post('/admin/users/alice/delete').type('form').send({ _csrf: csrf });
  assert.match(self.text, /cannot delete your own account/);
  const del = await agent.post('/admin/users/newbie/delete').type('form').send({ _csrf: csrf });
  assert.equal(del.status, 200);
});

test('open redirects are blocked after login', async () => {
  const agent = request.agent(app);
  const form = await agent.get('/login?next=//evil.example.com');
  const res = await agent.post('/login').type('form').send({ _csrf: csrfFrom(form.text), username: 'vera', password: PASSWORD, next: '//evil.example.com' });
  assert.equal(res.headers.location, '/');
});
