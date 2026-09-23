# Windchill Trainer

A searchable, login-protected set of how-to guides for **PTC Windchill**, such as
*How to create a promotion request*, *How to create a WTPart* and *How to change attributes*.

- **Home page lists every guide**, grouped by category, with an instant filter and a *Not read* toggle.
- **Keyword search** with typo tolerance, prefix matching ("promo" finds "promotion") and live suggestions as you type. Titles and tags rank above body text.
- **Read tracking.** Each user sees which guides are **New**, **✓ Read**, or **Updated** since they last opened them. Admins get a report of who has read what, and can download it as CSV.
- **Username and password sign-in** with three roles:

  | Role | Can |
  | --- | --- |
  | `viewer` | Sign in, browse, search and read guides |
  | `editor` | Everything above, plus create, edit and delete pages and upload screenshots |
  | `admin`  | Everything above, plus manage users and view reading activity |

- **Editing in two ways:** in the browser (Markdown editor with live preview, a formatting toolbar, and paste or drag-and-drop screenshots), or as Markdown files in `content/pages/` in any code editor.

## Quick start

Requires Node.js 20 or newer.

```bash
npm install
npm run user -- add admin --role admin     # prompts for a password (min 10 chars)
npm start                                  # http://localhost:3000
```

Sign in as `admin`. Add other people under **Users**, or from the command line.

## Managing users

In the browser, admins use **Users** to add people, change roles, reset passwords and delete accounts.

From the command line:

```bash
npm run user -- add jsmith                 # viewer by default
npm run user -- add mjones --role editor
npm run user -- role jsmith editor
npm run user -- passwd jsmith
npm run user -- remove jsmith
npm run user -- list
```

To script it, set `WT_PASSWORD` instead of typing the password at the prompt.

Passwords are hashed with bcrypt and stored in `data/users.json`. Sign-in is rate-limited to
10 failed attempts per 15 minutes. Users change their own password under their username in the top bar.

## Creating and editing pages

### In the browser (editors and admins)

- Click **+ New page**, or **Edit** on any page.
- Fill in the **Title**, **Category**, **Summary** (shown in search results) and **Keywords / tags**.
  Add synonyms people might search for, e.g. `WTPart, WT Part, part, new part`.
- Write the body in Markdown. The toolbar inserts headings, numbered steps, tips, tables and links.
- To add a screenshot, **paste it** (Ctrl+V), **drag it** into the editor, or use **Image**.
- If a search finds nothing, editors see a button that creates a page with that title.

### As files (developers)

Each guide is one Markdown file in `content/pages/`. The filename is the URL:
`content/pages/create-wtpart.md` → `/pages/create-wtpart`.

```markdown
---
title: How to create a WTPart
summary: Create a new part in a product or library and check it in.
category: Parts & BOMs
tags:
  - WTPart
  - new part
updated: 2026-09-23
---
## Steps

1. Browse to the product's **Folders** page.
2. Click **New Part**.

> **Tip:** Leave the number blank to use auto-numbering.

Link to another guide: [change attributes](/pages/change-attributes)
```

To scaffold a new page from a template:

```bash
npm run new-page -- "How to revise a part" --category "Parts & BOMs"
```

The running server watches `content/pages/`, so edits, new files and `git pull`s appear
immediately without a restart. Images live in `content/images/` and are served at `/images/…`,
and only to signed-in users.

Keep `content/` in git to get history, review and rollback for every guide.
Pages saved in the browser are written to the same files, so commit them regularly.

## How read tracking works

- Opening a page records the first view, the latest view and the view count for that user in `data/reads.json`.
- If a page is saved after the user last opened it, the page shows as **Updated** for that user
  (and as **Needs re-read** in the admin report) until they open it again.
- Users can click **Mark as unread** at the bottom of a page.
- **Activity** (admins only) shows progress for each user and each page. Click a name or a page for detail,
  or use **Download CSV** to export everything.

## Configuration

Set these environment variables as needed:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `SITE_NAME` | `Windchill Trainer` | Name shown in the header and page titles |
| `SESSION_SECRET` | auto-generated in `data/session-secret` | Secret that signs session cookies |
| `SESSION_MAX_AGE_HOURS` | `8` | Signs users out after this long idle |
| `SECURE_COOKIES` | `false` | Set to `true` when served over HTTPS |
| `TRUST_PROXY` | `false` | Set to `true` behind a reverse proxy such as IIS, nginx or a load balancer |
| `DATA_DIR` | `./data` | Users, read history and session secret |
| `CONTENT_DIR` | `./content` | Pages and images |

## Deployment notes

- Serve it over **HTTPS**, e.g. behind nginx or IIS with `SECURE_COOKIES=true TRUST_PROXY=true`.
- Back up `data/`, which holds users and read history, and `content/`, which holds the guides. `data/` is git-ignored.
- Sessions are held in memory, so a restart signs everyone out. This is fine for a single server.
  Run one instance, because the JSON files are not designed for several servers writing at once.
- Run it as a service with a process manager, e.g. systemd, `pm2` or NSSM on Windows.

## Development

```bash
npm run dev    # restarts on code changes
npm test       # end-to-end tests: auth, roles, search, editing, read tracking, admin report
```

```
server.js              entry point
src/app.js             Express app (security headers, sessions, CSRF, routes)
src/pages.js           loads Markdown pages, search index (MiniSearch), saving
src/markdown.js        Markdown → sanitized HTML + table of contents
src/read-tracker.js    per-user read history
src/users.js           user accounts (bcrypt)
src/routes/            login, pages/editor, account, admin
views/                 EJS templates
public/                CSS and browser JS (search suggestions, list filter, editor)
content/pages/         the guides (Markdown)
scripts/               user management and new-page CLIs
```

> The three starter guides are generic. Menu names and steps vary between Windchill versions and site
> configurations, so review them against your own system before rolling them out.
