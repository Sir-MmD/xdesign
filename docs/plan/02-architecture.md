# 02. Architecture

How xDesign is built: the parts, where each lives in the repository, the stack, how live editing
flows, the database and the security model. The design model and the export format are 03; the
screens are 04; accounts and teamwork 05; export and Claude link 06; install and update 07.

## 1. The parts

```
 Browser (apps/web)                                   Server (apps/server, one Node.js process)
 +--------------------------------------+            +-------------------------------------------+
 | Pages: sign in, designs, members,    |  REST/JSON | Fastify: /api/*  (accounts, designs,      |
 | settings, maintenance                | ---------> |   sharing, media, comments, history,      |
 |                                      |            |   links, keys, maintenance)               |
 | Editor:                              |            |                                           |
 |  map (React Flow)  phone (preview)   |  WebSocket | Hocuspocus: /live (one Yjs doc per design,|
 |  Try it, checks, export              | <========> |   roles checked per connection, saved     |
 |  Yjs doc + y-indexeddb (offline)     |            |   to SQLite, awareness for cursors)       |
 |                                      |            |                                           |
 | packages/spec: model, checks,        |            | packages/spec: same code for exports,     |
 |   Try it engine, export              |            |   Claude link, MCP (stage 2)              |
 | packages/preview: Telegram phone     |            | /mcp (stage 2), /v/<token> view links     |
 +--------------------------------------+            | Jobs: backups, history thinning, trash    |
                                                     | SQLite file + data folder (media, backups)|
                                                     +-------------------------------------------+
```

In front of the server sits the **Go helper** (07, D-29): the one file `xdesign` that serves
HTTPS, proxies every request to the Node app over a Unix socket, starts and watches the app as
its child, and does install, updates, going back and backups. One systemd service, one SQLite
file, one data folder; no other service.

## 2. Repository layout

```
xdesign/
  package.json, pnpm-workspace.yaml, Makefile, build.sh, VERSION
  CLAUDE.md
  docs/            plan/, status.md, user-guide.md, release-notes-template.md
  packages/
    spec/          the design model (Zod), Yjs layout and accessors, ID names, checks,
                   Try it engine, export (spec.json, design.md, HOW-TO-READ.md, schema),
                   import, Telegram catalog (src/telegram/), fixtures/ (example designs)
    api/           the API contract: Zod schemas of every request and response, route list
    preview/       the Telegram phone: ported from xWriter, skins, entities, keyboards, chat frame
  apps/
    web/           the SPA (Vite): routes, pages, editor (map, phone editing, Try it, panels)
    server/        Fastify + Hocuspocus, SQLite + Drizzle, jobs, CLI (install, update, admin)
    desktop/       the desktop app's Electron shell: the main process only (18 section 9), with
                   `electron-builder.config.ts` and `build/` (xDesign's icon) for the desktop files
  helper/          the Go helper (module github.com/Sir-MmD/xdesign/helper, 07 section 10):
    cmd/xdesign/   the single self-installing file
    internal/      app, cli, host, install, release, unpack, maintreq, maintenance, backup,
                   certs, ssl (acme, domain, manager), front (TLS, port 80, proxy, child),
                   control, guard
    deploy/        systemd units, reverse-proxy templates (embedded)
  tools/
    sanity/        the `make sanity` runner (logs in .dev/gate/latest/)
  .dev/            git-ignored: briefs, notes, lead notes, gate logs, local dev data
```

Rules: the helper and the app talk only through the control socket and the app's own
commands (`app/cli.mjs`); `packages/*` never import from `apps/*`; `packages/spec` has no browser-only or
Node-only dependencies (it runs in both); `packages/preview` is React only (no editor logic);
the web app imports the server only through `packages/api`.

## 3. Stack

Exact versions are pinned in FND-01 to the current stable releases on the day (exact pins, no
ranges, one lockfile). Majors as planned:

| Area | Choice | Notes |
|---|---|---|
| Runtime | Node.js, the current Active LTS (24 or 26) | Shipped inside the release (D-22). |
| Package manager | pnpm (same major as xWriter) | Workspaces. |
| Language | TypeScript, strict | `tsc -b` project references. |
| Validation | Zod 4 | Model, API contract, JSON Schema via Zod's own JSON Schema output. |
| Web build | Vite, `@vitejs/plugin-react` | |
| UI | React 19, Base UI, Tailwind CSS 4, class-variance-authority, tailwind-merge, lucide-react, sonner | Same as xWriter (D-03). |
| Routing and data | TanStack Router (file routes), TanStack Query | |
| Forms | react-hook-form with the Zod resolver | Pages and logic step forms. |
| Drag and drop | dnd-kit | Button rows, lists. |
| Rich text | TipTap 3 with the Collaboration and Collaboration Caret extensions | One Yjs fragment per text per language. |
| Map | `@xyflow/react` (React Flow 12), `elkjs` | Auto-arrange in a web worker. |
| Live editing | `yjs`, `@hocuspocus/provider`, `@hocuspocus/server`, `y-indexeddb`, `y-protocols` (awareness) | |
| Zip | `fflate` | In the browser and on the server. |
| Pictures | `modern-screenshot` (DOM to PNG) | Offscreen phone renderer. |
| Server | Fastify 5 with `@fastify/cookie`, `@fastify/rate-limit`, `@fastify/multipart`, `@fastify/static`, `@fastify/helmet`, `fastify-type-provider-zod` | |
| Database | SQLite through `better-sqlite3` (WAL), Drizzle ORM and drizzle-kit migrations | |
| Passwords | argon2id through `@node-rs/argon2` (prebuilt, no compiler) | |
| HTTPS | In the Go helper: xWriter's certificate code with lego (Let's Encrypt HTTP-01 and Cloudflare DNS-01) | 07 section 4. The Node app serves plain HTTP on a Unix socket. |
| Go helper | Go (the same toolchain as xWriter, 1.27), lego v5, klauspost/compress (zstd), ulikunitz/xz, modernc.org/sqlite (backups), golang.org/x/sys | Copied from xWriter and xmtp-panel (07 section 10). |
| MCP | `@modelcontextprotocol/sdk` (Streamable HTTP) | Stage 2. |
| Logs | pino, to the journal | |
| Fonts | `@fontsource-variable/*` as in xWriter, including Vazirmatn for Persian | Embedded in the release; no font CDN. |

No CDN, no analytics, no external calls at run time except Let's Encrypt (and Cloudflare when
chosen) for certificates.

## 4. Live editing flow

1. The editor opens `/d/<designId>`: the web app asks `/api/designs/<id>` for the design's
   header and the person's role, then opens a Hocuspocus connection to `/live` with the document
   name `design:<id>` (through the helper's front, which passes the WebSocket upgrade to the
   app's Unix socket).
2. The server authenticates the WebSocket upgrade from the session cookie and the Origin header,
   loads the person's role for the design, and sets the connection read-only for Commenter and
   Viewer (Hocuspocus `connection.readOnly`). No role, no connection. A view-only link's page (05
   section 8) connects to `/live?view=<token>` without a session: the upgrade and each document
   check the link instead, the connection is read-only and opens the link's design only, and the
   people's presence reaches it emptied.
3. The server loads the document state from `design_docs.state` (a Yjs update blob) and syncs
   it; every change is applied in memory and stored debounced (2 seconds, at most 10 seconds
   after the first unsaved change) in one transaction that also bumps `designs.doc_version` and
   `designs.updated_at`.
4. The browser keeps a copy in IndexedDB (`y-indexeddb`, the database `xdesign-<designId>-<userId>`
   per design and person; Commenter and Viewer keep none): editing works offline; when the
   connection returns, Yjs merges both ways. The top bar shows "Saved", "Saving...", "Offline, your
   changes are kept on this computer", "Reconnecting..." or "Read only".
5. Awareness (not stored) carries each person's name, color, cursor on the map, selected step and
   the text they are typing in; avatars and cursors come from it.
6. Undo and redo: a `Y.UndoManager` per person that tracks only that person's local changes.
7. Stateless messages on the same connection carry JSON `{ type, ... }`: `serverVersion` when a
   connection opens (the editor's reload banner); stage 2 adds `commentsChanged` (after any change to a design's comments) and "a version
   was restored" so open editors refresh their panels.

Limits: a design document is refused above 20 MB of Yjs state (the writer's connection closes, a
warning is logged from 10 MB); the server keeps at most 200 documents in memory and unloads a
document 5 minutes after its last connection closed.

Document layout, typed accessors and the conversion to the plain design model are in 03
section 3; every reader (checks, Try it, export) works on the plain model, never on raw Yjs.

## 5. Database

SQLite in WAL mode at `/var/lib/xdesign/xdesign.db` (dev: `.dev/data/xdesign.db`), Drizzle
schema in `apps/server/src/db/schema.ts`, migrations in `apps/server/migrations/` run at start
and by the updater. Times are UTC milliseconds. IDs are random 21-character nanoid strings.

| Table | Columns (main) | Stage |
|---|---|---|
| `users` | id, username (unique ignoring case, lower case; USER-01a), name, password_hash, is_site_owner, disabled_at, created_at, last_seen_at, color, totp_secret, totp_pending, totp_pending_at, totp_last_step, recovery_codes (JSON: SHA-256 hashes), theme (null follows the computer, light or dark; THEME-01) | 1 |
| `sessions` | id (SHA-256 of the token), user_id, created_at, expires_at, last_used_at, user_agent, ip, confirmed_until | 1 |
| `sign_in_steps` | id (SHA-256 of the token), user_id, created_at, expires_at, ip, attempts | 2 |
| `designs` | id, name, owner_id, created_at, updated_at, updated_by, deleted_at, doc_version, step_count, languages, is_template, template_meta | 1 |
| `design_members` | design_id, user_id, role (editor, commenter, viewer), added_by, added_at | 1 |
| `design_docs` | design_id, state (BLOB, Yjs update), state_bytes, saved_at | 1 |
| `media` | id, design_id, sha256, kind, mime, bytes, width, height, duration_ms, original_name, uploaded_by, uploaded_at | 1 |
| `settings` | key, value (JSON) | 1 |
| `audit` | id, at, user_id, action, design_id, detail (JSON) | 1 |
| `comments` | id, design_id, thread_id, anchor (JSON: a step, a button, a text or a spot on the map), author_id, body, mentions (JSON: user IDs), created_at, edited_at, resolved_at, resolved_by | 2 |
| `comment_reads` | user_id, design_id, last_read_at | 2 |
| `versions` | id, design_id, kind (auto, named, restore, before_restore), name, state (BLOB), doc_version, created_by, created_at, via | 2 |
| `view_links` | id, design_id, token_hash, created_by, created_at, expires_at, revoked_at, last_used_at | 2 |
| `claude_links` | id, design_id, token_hash, created_by, created_at, revoked_at, last_used_at | 2 |
| `api_keys` | id, user_id, name, token_hash, created_at, revoked_at, last_used_at, ask_first, cannot_ask | 2 |
| `oauth_clients` | id (the client_id), kind (metadata, registered), name, redirect_uris, auth_method, secret_hash, created_at, used_at, fresh_until | 2 |
| `oauth_requests` | id, handle_hash, client_id, redirect_uri, state, code_challenge, resource, ip, created_at, expires_at, user_id, session_id | 2 |
| `oauth_grants` | id, user_id, client_id, name, resource, created_at, last_used_at, expires_at, ask_first, cannot_ask | 2 |
| `oauth_codes` | hash, client_id, user_id, redirect_uri, code_challenge, resource, created_at, expires_at, used_at, grant_id | 2 |
| `oauth_tokens` | hash, grant_id, kind (access, refresh), created_at, expires_at, used_at | 2 |
| `pictures` | design_id, step_id, language, look, doc_version, media_id, created_at | 2 |

`pictures` rows point at media rows of the kind `picture` (the PNG files kept like uploads); `pictures.step_id` is the step's ID or `bot-profile`, `empty-chat`, `commands-menu`; the primary key is design, step and language. A new upload replaces a design's set.

`versions.kind`: `auto` (made by the server), `named`, `before_restore` (the document just before a
restore), `restore` (the document a restore made, named after the restored version when it had a
name). `versions.state` is the whole Yjs state, `doc_version` the design's doc_version of it.

A template (`is_template`) is a copy of a design saved with "Save as template"; `template_meta`
holds `{ "description" }`. Templates are listed only in the gallery and no one has a role on them.

Secret tokens (sessions, invites, resets, links, keys) are 32 random bytes, shown once, stored as
SHA-256 hashes.

## 6. Files

```
/var/lib/xdesign/
  xdesign.db (+ -wal, -shm)
  media/<sha256 first 2>/<sha256>        uploads, content-addressed, deduplicated per server
  backups/xdesign-<UTC time>.tar.zst     daily and pre-update backups (07 section 5)
  certs/                                 HTTPS certificates and the ACME account (07)
  maintenance/                           requests to the root helper (07 section 6)
  maintenance/uploads/<id>/              update uploads waiting for their checks
  update-failures/                       journals of updates that went back by themselves
/etc/xdesign/config.toml                 listen address, domain, data path (07 section 3)
/opt/xdesign/releases/<version>/         xdesign (the helper), runtime/node, app/ (its payload)
/opt/xdesign/current -> releases/<v>
/run/xdesign/app.sock, control.sock      the app's socket and the helper's control socket
```

Media is served only through `/api/media/<id>` after a role check (or a valid view link).

## 7. API style

- JSON over HTTPS under `/api/`; every route is declared once in `packages/api` (method, path,
  Zod request and response schemas, required role) and both sides use that declaration: the
  server registers it with the Zod type provider, the web app's typed client calls it.
- Errors: `{ "error": { "code": "not_found", "message": "Plain-words text for the screen" } }`.
- Codes: `bad_request`, `not_signed_in`, `no_access`, `confirm_needed`, `bad_origin`, `not_found`,
  `conflict`, `too_large`, `too_many_tries`, `server_error`, `not_in_desktop` (404, "Not in the
  desktop app.", a route the desktop app does not have, 18 section 9.3).
- Auth: the session cookie `xd_session` (HttpOnly, Secure, SameSite=Lax, 30 days, renewed on
  use). Changing requests check the Origin header against the site's address (CSRF).
- Stage 2 machine access (Claude link, MCP): bearer tokens, never cookies. `/mcp` requests without an Origin header skip the Origin check; one with an Origin must have the site's.

## 8. Security

1. Members are added by the site owner (USER-01a); sign-in rate limit per IP and per username (5
   tries per 15 minutes, then wait); the same message for an unknown username and a wrong
   password. The site owner's "Set password" of a member makes that member's sign-in limit start
   afresh (USER-02).
2. Passwords: argon2id, at least 10 characters, checked against a short built-in list of the
   most common passwords.
3. Sessions revocable from the account page ("Sign out everywhere"); disabling a member ends
   their sessions and live connections at once.
4. Every API route and every live connection checks the role (05 section 3); the site owner
   passes every role check.
5. Uploads: type detected from the content (magic bytes) and checked against the kind's allowed
   types; no SVG or HTML; one file per content on the server, one row per design, file and kind;
   served with `Content-Type` from the check, `X-Content-Type-Options: nosniff`,
   `Content-Disposition: inline` for media the phone shows and `attachment` for files.
6. Headers: a strict Content Security Policy (self only; styles also inline, which TipTap, sonner
   and mermaid add at run time; `blob:` and `data:` for images and media), `frame-ancestors
   'none'`, HSTS when HTTPS is on.
7. Texts from designs are rendered as text, never as HTML; links in designs open with
   `rel="noopener noreferrer"` and only `http`, `https` and `tg` schemes.
8. Audit rows for sign-ins, invites, role changes, link and key creation, deletes, restores,
   backups and updates (Settings, "Activity" list for the site owner).
9. The server never contacts Telegram or any service other than certificate issuers.
10. The site answers only under its secret web base path and on its own port; every other address
    and port 80 (apart from a waiting Let's Encrypt check) show an empty page that names nothing
    (16 section 4, D-611, D-613, D-615).

## 9. Performance targets

- Opening a 300-step design: server sync under 1 second on a LAN, first paint of the map under
  3 seconds; React Flow renders only visible boxes (`onlyRenderVisibleElements`).
- The map renders a box again only when its own step, selection, place, measured size or what it
  shows of the rest of the design changes (PERF-01): nodes are kept per unchanged step, boxes are
  memoized and read the design through picks (`useShown`), and each box's menu, note dialog and
  check tooltip are made the first time they open.
- The plain design model is derived from the Yjs document incrementally per step (changed steps
  only) so the phone follows each change at once and the checks run 200 ms after the last one.
- Checks run in a web worker for designs above 100 steps. As built: one run per open design, 200 ms
  after the last change (CHK-01).
- Auto-arrange (ELK) runs in a web worker.

## 10. Development

- `make dev`: the server (watch mode, data in `.dev/data/`, HTTP on `localhost:5174`) and Vite
  (`localhost:5173`, proxying `/api`, `/live` and `/mcp`); the first run prints the dev owner's
  email and password. `make dev BASE_PATH=/k3v9x2m1q8wz7r4t/` serves the whole site under that web
  base path (16 section 4): the server gets it as `XD_BASE_PATH`, Vite serves the page under it and
  proxies `<base>api/`, `<base>live` and `<base>mcp` with the path unchanged.
- `make gen`: Drizzle migration generation, the JSON Schema of the export format, the route tree,
  the builders' guide as a module and the language flags' stylesheet
  (`apps/web/src/styles/flags.gen.css`, from the `flag` fields of `apps/web/src/lib/languages.ts`,
  FLAG-01).
- `make helper`: the Go helper with a dev payload; `xdesign serve --dev` puts the front with a
  self-signed certificate in front of `make dev` (07 section 9).
- `make build-desktop` (part of `make build`): the desktop app's main process into
  `apps/desktop/dist/main.mjs`; with Electron's binary, `electron apps/desktop` runs it on the
  repository's build (`XD_DESKTOP_NODE`, `XD_DESKTOP_APP`).
- `make sanity`: typecheck, ESLint, Prettier check, builds, the helper's go build, go vet and
  golangci-lint, the drift checks of `make gen`'s outputs, `make spec-check`, and the catalog
  source check (14 section 1).
- `make release` (wrapped by `./build.sh`, which asks for the version and the CPUs): 07 section 2.

## As built (M1)

**FND-01** (490ca92, 162f271, 3121f23, 5e36dcb).

Code: Tools: `tools/setup/install-tools.sh` (xWriter's, trimmed to the pnpm 12.8.1 shim and
golangci-lint 2.14.0 with xWriter's SHA-256 values), `make setup-tools` into `.tools/bin`;
Workspace: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`,
`tsconfig.json`, `tsconfig.node.json`, `eslint.config.js`, `prettier.config.js`, `.prettierignore`,
`.editorconfig`; Packages: `packages/spec`, `packages/api`, `packages/preview` (each `package.json`,
`tsconfig.json`, one-line `src/index.ts`), `tools/sanity/package.json`; Web shell:
`apps/web/vite.config.ts`, `tsr.config.json`, `index.html`, `src/main.tsx`, `src/routes/__root.tsx`,
`src/routes/index.tsx`, `src/routeTree.gen.ts`, `src/styles/index.css`, `tsconfig*.json`; Server
skeleton: `apps/server/src/main.ts`, `src/version.ts`, `build.ts` (esbuild), `tsconfig.json`;
Makefile and sanity: `Makefile`, `tools/sanity/sanity.sh`, `tools/sanity/slot.sh`,
`tools/sanity/gen-check.sh`.

Versions (exact pins; xWriter's version where xWriter pins the package, otherwise the newest release
at least 7 days old):

| Package | Version | Package | Version |
|---|---|---|---|
| typescript | 6.0.3 | fastify | 5.12.8 |
| react, react-dom | 19.3.0 | @fastify/cookie | 11.1.5 |
| vite | 8.3.1 | @fastify/rate-limit | 11.2.2 |
| @vitejs/plugin-react | 6.1.1 | @fastify/multipart | 10.1.8 |
| tailwindcss, @tailwindcss/vite | 4.3.3 | @fastify/static | 10.1.11 |
| @tanstack/react-router | 1.170.39 | @fastify/helmet | 13.2.0 |
| @tanstack/router-plugin | 1.168.40 | fastify-type-provider-zod | 7.0.0 |
| @tanstack/router-cli | 1.167.38 | better-sqlite3 (@types 9.6.0) | 13.2.0 |
| @tanstack/react-query | 5.103.2 | drizzle-orm | 0.45.4 |
| @base-ui/react | 1.8.0 | drizzle-kit | 0.31.11 |
| zod | 4.6.5 | @node-rs/argon2 | 2.2.2 |
| @tiptap/* (with collaboration, collaboration-caret) | 3.31.3 | pino | 10.4.0 |
| @tiptap/y-tiptap | 3.3.0 | @modelcontextprotocol/sdk | 1.32.2 |
| yjs | 13.6.33 | esbuild | 0.28.2 |
| y-protocols | 1.0.7 | tsx | 4.23.15 |
| y-indexeddb | 9.0.12 | eslint | 10.11.0 |
| @hocuspocus/provider, @hocuspocus/server | 4.8.0 | typescript-eslint | 8.70.1 |
| @xyflow/react | 12.12.1 | prettier | 3.9.9 |
| elkjs | 0.12.1 | @types/node | 24.13.6 |
| mermaid | 12.3.0 | nanoid | 6.0.2 |
| fflate | 0.8.3 | modern-screenshot | 4.7.0 |

- One yjs (13.6.33) and one y-protocols across the workspace; every @tiptap package is 3.31.3.
  Runtime zod is 4.6.5 everywhere (zod 4.6.7 only inside the router generator and the hooks lint
  plugin, dev tools).
- packages/preview: react and react-dom as peer and dev (19.3.0); emoji-regex 11.0.0, linkify-it
  6.1.0, lucide-react 1.48.0, @fontsource-variable/inter, noto-sans, open-sans, roboto, vazirmatn
  5.3.0; emoji-datasource-apple 16.0.0 (dev, as in xWriter).
- Root dev also has eslint-plugin-react-refresh 0.5.7, globals 17.12.0 and
  prettier-plugin-tailwindcss 0.8.1, which the copied ESLint and Prettier configs use.
- Peers auto-installed: @fastify/swagger 9.9.4 and openapi-types (fastify-type-provider-zod 7
  requires them).
- Workspace packages are consumed as source: `exports` is `./src/index.ts`, dependents use
  `workspace:*` and reference the package in their tsconfig. tsc -b writes declarations and build
  info only into each project's `node_modules/.cache/tsc`.
- Sanity steps: `SANITY_STEPS` in the Makefile, in order: `typecheck lint build start-check
  gen-check spec-check catalog-check helper-check em-dash-check`. Each is a make target, so `make
  <step>` runs one alone. `start-check` (`tools/sanity/start-check.sh`) starts the built server
  bundle on a free loopback port with an empty data folder, once as a server and once in the
  desktop app's mode, and waits for `GET /api/health` to answer 200, so a bundle that builds but
  does not start fails here.
  To add a check: write its target and add its name to `SANITY_STEPS`. Logs:
  `.dev/gate/latest/<step>.log` and `summary.txt`. The run stops at the first failing step.
- In a worktree (git dir differs from the common dir) sanity.sh re-runs itself under
  `tools/sanity/slot.sh` (flock on `~/.cache/xdesign/slots/1` and `2`, env `XD_SLOT`), and sets
  `LINT_CHANGED=1` and `CHANGED_FILES` (files differing from main, committed or not, plus new files)
  for the lint target. `helper-check` is skipped while `helper/` is missing and, in a worktree, when
  nothing under `helper/` changed. `helper-check` builds and vets the helper for linux/amd64,
  linux/arm64, windows/amd64 and windows/arm64 (`HELPER_TARGETS` in the Makefile) and runs
  golangci-lint with `GOOS=linux` and `GOOS=windows`.
- Gen outputs: `GEN_STEPS` (targets, run in order by `make gen`) and `GEN_OUTPUTS` (files or
  folders) in the Makefile. To add one: write its target, add it to `GEN_STEPS` and its output paths
  to `GEN_OUTPUTS`. `gen-check` copies the tree into `.dev/tmp/gen-check.*` (node_modules and .tools
  linked), runs `make gen` there and diffs `GEN_OUTPUTS`.
- Ports and env: Vite 127.0.0.1:5173 (proxies `^/api/` and `^/live` with WebSocket to
  127.0.0.1:5174); server `XD_PORT` (default 5174, host 127.0.0.1), `XD_SOCKET` (Unix socket
  instead, a stale file is removed first), `XD_DATA_DIR` (default `.dev/data` of the cwd; `make dev`
  passes the absolute `.dev/data`), `XD_WEB_DIR` (built SPA, with fallback to index.html for GETs
  outside /api and /live). The Makefile exports `TMPDIR=~/.cache/xdesign/tmp` and puts `.tools/bin`
  then `node_modules/.bin` first on PATH.
- `make build`: `apps/web/dist` and `apps/server/dist/server.mjs` (ESM, require shim banner, linked
  source map; better-sqlite3 and @node-rs/argon2 external).

## As built (M2)

**SRV-01** (7738685, 0eea8d8).

Code: Database: `apps/server/src/db/schema.ts` (the ten stage 1 tables), `src/db/index.ts` (open,
pragmas, migrations at start), `apps/server/drizzle.config.ts`,
`apps/server/migrations/0000_stage1.sql` with `meta/`; Config and logs: `src/config.ts` (one typed
object from the environment), `src/log.ts` (pino); Server: `src/app.ts` (Fastify, the request log
line, helmet with the CSP, HSTS on HTTPS, the Zod compilers, the SPA with its fallback),
`src/errors.ts` (`ApiError` and the one error handler), `src/main.ts` (database, routes of every
area, Unix socket or TCP), `src/settings.ts` (site settings with defaults); Route helper:
`src/route.ts` (`addRoute`, the auth check), `src/auth/context.ts` (`getSessionUser`,
`getDesignRole`, both null for now),
`src/routes/{site,auth,invites,members,designs,media,settings}.ts` (each a `register`; only site.ts
has routes); API contract: `packages/api/src/route.ts` (`defineRoute`, roles, request and response
types), `src/common.ts` (shared fields, the error format),
`src/routes/{site,auth,invites,members,designs,media,settings}.ts`, `src/index.ts` (`routes`);
Commands: `src/cli.ts` (the table), `src/commands/command.ts`, `src/commands/migrate.ts`;
`apps/server/build.ts` bundles `dist/server.mjs` and `dist/cli.mjs` and copies `dist/migrations/`;
Makefile: `gen-migrations` (drizzle-kit generate) in `GEN_STEPS`, `apps/server/migrations` in
`GEN_OUTPUTS`; `.prettierignore` skips the migrations; `.gitignore` also ignores the `.tools`
symlink of worktrees.

- Tables as 02 section 5, plus `invites.email` (the optional email the owner types, pre-filled on
  the invite page) and `designs.updated_by` ("Edited <time> by <name>" on the cards). Users' email
  is unique through an index on `lower(email)`. Extra indexes: `designs_owner`,
  `design_members_user`. Token hashes of invites and resets are unique.
- Foreign keys: sessions, password resets and design memberships go with their user; a design's
  document, memberships and media rows go with the design; `designs.owner_id` refuses removing a
  member who still owns designs; the created by, used by, added by, uploaded by and updated by
  columns become null; `audit` has none.
- Pragmas `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`. The first migration is
  `0000_stage1`; later ones get drizzle-kit's random names unless `--name` is given.
- Logs: one pino line per request (`method`, `url`, `status`, `ms`, `ip`, message "request");
  Fastify's own request lines are off; a route with `:token` in its path logs the pattern, not the
  token; cookie, authorization and set-cookie headers are redacted.
- Headers: @fastify/helmet with `default-src 'none'; script-src 'self'; style-src 'self'; img-src
  'self' blob: data:; media-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src
  'self'; manifest-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';
  frame-src 'none'; object-src 'none'`, `X-Frame-Options: DENY` and helmet's other defaults; HSTS
  (`max-age=31536000; includeSubDomains`) only on requests that came over HTTPS.
- Socket: a stale file is removed, the socket gets mode 0660 after listen. Over the socket Fastify
  trusts exactly one hop (the front): the client's address is the last X-Forwarded-For entry, the
  scheme the last X-Forwarded-Proto entry. On TCP nothing is trusted.
- Errors: codes `bad_request` 400, `not_signed_in` 401, `no_access` 403, `not_found` 404, `conflict`
  409, `too_large` 413, `too_many_tries` 429, `server_error` 500 (`errorCodes`, `apiError` in
  packages/api). Handlers throw `new ApiError(code, message?)`. A Zod problem (a request schema, or
  a ZodError a handler throws) answers `bad_request` with "<field>: <message>". Fastify's own errors
  map by status; 5xx are logged with the error. Paths without a route answer `not_found`; with
  `XD_WEB_DIR`, GET and HEAD outside `/api` and `/live` get index.html.
- Contract: `defineRoute({ key, method, path, params?, query?, body?, multipart?, response, auth
  })`; `multipart: true` marks the upload route (no JSON body). `response` is the 200 answer; routes
  that only report success answer `{ ok: true }`; `mediaFile` declares `z.instanceof(Uint8Array)` (a
  file, not JSON). `routes` is one flat object by key; a key that differs from its name fails to
  compile. Types `RouteRequest<R>` (what a client sends), `RouteInput<R>` (what a handler gets),
  `RouteResponse<R>`; `designRoles` and `hasRole(role, min)` (viewer, commenter, editor, owner).
- Auth check: `addRoute(app, route, handler, { designOf? })` checks in an onRequest hook, before the
  body is read: public routes skip it; otherwise `getSessionUser` (401 `not_signed_in`), `siteOwner`
  (403 `no_access` for others), a design route takes `:id` (or `designOf(params)`, which the media
  file route passes) and `getDesignRole` (403 `no_access` below the minimum). The site owner gets
  role `owner` on every design. Handlers get `{ req, reply, params, query, body, user, role }`.
- Answers beyond the plan's lists: sign-out is public; sessions carry `current`; invites carry
  `status` (waiting, used, expired, revoked) and `usedBy`; members carry `designCount`; cards carry
  `deletedAt`; a design's `role` is the effective one; the design members list includes the owner
  with role `owner`; `createDesign.languages` lists every language, the default included (checked);
  the activity answers `{ entries, more }` with `before` as a time; GET and PATCH settings answer `{
  siteName, uploadLimitMb }` (defaults "xDesign" and 20, limit 1 to 2000 MB).
- Bundles: `dist/server.mjs`, `dist/cli.mjs` and `dist/migrations/` (the payload's `app/` layout);
  `src/db/index.ts` finds the migrations beside the bundle, or two folders up when it runs as
  source.

**MEDIA-01** (8a50427).

Code: Contract: `packages/api/src/routes/media.ts` (`uploadKinds`, `uploadKind`, `uploadFields`;
`media.kind` is now the upload kind); Detection: `apps/server/src/media/detect.ts` (type from the
first 4096 bytes, refused types, allowed types per kind from the catalog, the refusal messages);
Image sides: `apps/server/src/media/image.ts` (PNG, GIF and WebP from the first bytes, JPEG from its
frame header with the Exif orientation); Storage: `apps/server/src/media/store.ts` (temporary file
hashed while streaming, moved to `media/<first 2>/<sha256>`); Routes:
`apps/server/src/routes/media.ts` (`POST /api/designs/:id/media`, `GET /api/media/:mediaId` with
`designOf` and byte ranges); Settings: `apps/server/src/routes/settings.ts` (`addSiteSettings`: GET
and PATCH `/api/settings`), `writeSettings` in `apps/server/src/settings.ts`; App:
`apps/server/src/app.ts` (@fastify/multipart registered; CSP `style-src 'self' 'unsafe-inline'`).

- Upload form: the fields `kind` (photo, livePhoto, video, animation, audio, voice, document,
  videoNote, sticker, botPhoto) and optional `width`, `height` (positive whole numbers) and
  `durationMs` (0 or more), before or after one file part under any name; at most 10 fields of 1000
  bytes each.
- Detected types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`; `video/mp4` (an ISO file of
  any brand but M4A, M4B, M4P, `qt  ` and the HEIF and AVIF brands), `video/quicktime` (brand `qt
  `, or an older file starting with a moov, mdat or wide box), `video/webm` (EBML with the DocType
  webm); `audio/ogg` (an Ogg file with an Opus header only), `audio/mpeg` (ID3 or an MPEG audio
  frame), `audio/mp4` (M4A), `audio/aac` (ADTS); `application/pdf`, `application/zip`,
  `application/gzip` (TGS); `text/plain` (UTF-8 without binary bytes); `application/octet-stream`
  for anything else. SVG (a text starting with `<svg`, `<!doctype svg` or `<?xml`) and HTML (the
  WHATWG sniffing patterns, `<!--` included) are refused for every kind.
- Allowed per kind: photo JPEG, PNG, WebP; livePhoto MP4, MOV, JPEG, PNG, WebP; video and videoNote
  MP4; animation GIF, MP4; audio MP3, M4A; voice OGG (Opus), MP3, M4A; sticker WebP, TGS, WebM;
  document every type but SVG and HTML, unrecognized files included; botPhoto JPEG, MP4. `detect.ts`
  maps each format name of the catalog's `MEDIA_FORMATS` to types: a new name fails to compile until
  it is mapped.
- Messages: "Choose a file to upload.", "This file is empty.", "SVG and HTML files are not
  allowed.", "This type of file cannot be used here. Use <types>." (for example "Use JPEG, PNG or
  WebP."), and 413 `too_large` "This file is bigger than <n> MB." with n the `uploadLimitMb` setting
  (1 MB is 1,048,576 bytes). Bad fields answer `bad_request` with Zod's message for the field.
- The file part is stopped at the limit (nothing more is written) and its temporary file removed. A
  design that does not exist or is deleted answers 404 `not_found` before the form is read.
- Rows: one per design, file (sha256) and kind; the same file uploaded again for the same design and
  kind answers the row it made. `original_name` is the browser's file name (at most 255 characters)
  or null. Width and height: images from their header (a JPEG with Exif orientation 5 to 8 has its
  sides swapped); video from the browser's probe; audio keeps only `durationMs`; other files none.
- Storage: temporary files in `<data>/media/tmp/<random id>`; when the content file exists already
  it is kept and the temporary one removed.
- Serving: `Content-Type` is the detected type (`text/plain; charset=utf-8` for text);
  `Content-Disposition: inline` for every kind but document, `attachment; filename*=UTF-8''<name>`
  for documents (plain `attachment` without a name); `Content-Length`, `Accept-Ranges: bytes` and
  one byte range for every file (206 with `Content-Range`; 416 with `bytes */<size>` past the end;
  several ranges or a range that is not valid get the whole file). A missing row or file answers 404
  to the site owner; everyone else gets 403 from the role check.
- Settings: GET answers `{ siteName, uploadLimitMb }`; PATCH saves the keys given, one settings row
  each in one transaction, and answers both. No audit row (settings are not in the audit list).
- CSP: `style-src 'self' 'unsafe-inline'`; `script-src 'self'` and the `blob:` and `data:` sources
  of `img-src` and `media-src` as before.

**LIVE-01** (b6b765a).

Code: Server: `apps/server/src/live/server.ts` (Hocuspocus 4.8 on the app's HTTP server at `/live`,
the hooks, saving, the size guard, unloading, the access listener, the shutdown, `attachLive`,
`sendToDesign`, `renameLiveDesign`), attached from `src/main.ts`; Access: `src/live/access.ts` (the
upgrade's Origin and session check, the session and role per document, `recheck` after access
changes, `LiveRefusal`); Rows: `src/live/docs.ts` (document names `design:<id>`, `loadDoc` with
SPEC-04's `decodeDoc`, `saveDoc` in one transaction with `refreshDesignSummary`); Origin rule
shared: `siteOrigins(config)` in `src/auth/http.ts`; Rename: `src/routes/designs.ts` calls
`renameLiveDesign` after `renameDesign`.

- Upgrades: the app's HTTP server takes WebSocket upgrades on `<XD_BASE_PATH>live` only (also with a
  last slash and with a query); any other path answers the empty page (404) of 16 section 4, a missing or foreign Origin 403 (AUTH-01's rule:
  `XD_PUBLIC_URL`'s origin, with `XD_DEV=1` also Vite's), no live `xd_session` 401, during
  shutdown 503. Hocuspocus's own `Server` object is created but never listens: the accepted
  upgrade is handed to its HTTP server object, whose crossws handler takes the socket over.
- Per document (Hocuspocus `onAuthenticate`): the session again and `getDesignRole`; refusals reach
  the editor as the provider's "authentication failed" with reason `not_signed_in` (the session
  ended), `no_access` (no role, a design in Trash, a name other than `design:<id>`, a design without
  a document) or `busy` (200 documents loaded and every one open). Commenter and Viewer connect with
  `readOnly`; Hocuspocus drops their document changes, their awareness (presence) passes.
- Connection context: `userId`, `sessionId`, `designId`.
- Access changes: on every `onUserAccessChanged` the person's connections (to that design, or to all
  without `designId`) are checked again with `findSessionUser` and `getDesignRole`, and every 30
  seconds every connection is (a `reset-password` from the command line has no event in the server).
  No session or no role: the document connection closes with the reason "You no longer have access
  to this design.". A role that now allows more or less than the connection (Editor to Viewer or
  Commenter, or back): the connection turns read-only at once and its socket closes with code 4205
  reason `role_changed`; the provider connects again and gets the new scope.
- Saving: Hocuspocus's debounce, 2 seconds after the last change and at most 10 seconds after the
  first unsaved one (checked when a change comes in), and at once when the last connection closes.
  One transaction writes `design_docs.state`, `state_bytes` and `saved_at`, adds 1 to
  `designs.doc_version`, sets `updated_at` and `updated_by` (the person of the last change; kept as
  it was when that person is no longer on the site) and calls `refreshDesignSummary`; a document
  that does not read as a design (development builds) logs "the card summary of a live document was
  not updated" and keeps the last summary, the document is still saved.
- Size guard: each document keeps an upper bound of its state, its last saved or measured size plus
  every writer message since; a message that would take the bound above 20 MB has the document
  measured exactly, and a change that still would is refused: the writer's document connection
  closes with reason `too_big` and the server logs "a live change over 20 MB was refused". "a live
  document is over 10 MB" is logged once per load from 10 MB. A single WebSocket message over 21 MB
  closes the socket.
- Memory: a document stays loaded 5 minutes after its last connection closed (a sweep every 30
  seconds unloads it), so a reload or a reconnect finds it; at most 200 loaded, a new one first
  unloads the ones idle longest.
- Stateless messages: JSON in Hocuspocus's stateless messages; `sendToDesign(designId, message)`
  sends to everyone with the design open; each connection gets `{ "type": "serverVersion",
  "version": "<version>" }` when it is set up. Clients cannot broadcast stateless messages
  (Hocuspocus refuses it).
- Rename: `renameLiveDesign(designId, name, userId)` sets `meta.name` in a loaded or loading
  document, saved like an edit by the person who renamed it.
- Trash: a design in Trash has no role, so it cannot open; moving it to Trash closes its connections
  through AUTH-02's access changes.
- Shutdown (Fastify `preClose`): every connection closes, pending saves run and are awaited, the
  upgraded sockets are destroyed; then the database closes. Editors keep their changes in the
  browser and connect again.


## As built (M9)

**CMT-01** (a2afb2d).

Tables: `comments` and `comment_reads` at the end of `apps/server/src/db/schema.ts` (the `// CMT-01`
block), `migrations/0003_comments.sql`; `comments.mentions` (JSON: user IDs) is kept beside the
plan's columns, and a thread is its first comment (its `thread_id` is its own id; the anchor,
`resolved_at` and `resolved_by` are kept on that row only). The comment and comment read rows
cascade with the design, so "Delete forever" and the Trash job needed no change. Live: `{ type:
'commentsChanged' }` is a new `LiveMessage` of `src/live/server.ts`, sent with `sendToDesign` to
everyone with the design open after every change (start, reply, edit, delete, resolve, reopen);
"mark read" sends nothing, and the bell outside an open design gets no live notice (it polls `GET
/api/comments/unread` or reloads on focus). The routes and rules are in 05 As built (M9).

**HIST-01** (b5f1a56).

Table: `versions` at the end of the schema (the `// HIST-01` block), `migrations/0004_versions.sql`,
index `versions_design` on design_id and created_at; deleting a design forever deletes its versions
(foreign key cascade). Each version holds the whole Yjs state and the design's `doc_version` of it.
`saveDoc` in `src/live/docs.ts` calls `versionOnSave` in its transaction, and `versionsJob`
(thinning, hourly) starts beside `trashJob` in `src/main.ts`. Live: `{ type: 'versionRestored' }` is
a new `LiveMessage` of `src/live/server.ts`, sent to open editors after a restore; a version is also
made when no connection that may write is left on the design (`onDisconnect`), after the pending
save runs (`flushLiveDesign`, which uses Hocuspocus's debouncer by its internal id
`onStoreDocument-<name>`, as Hocuspocus's `flushPendingStores` does; the version is pinned at
4.8.0). A restore is one Yjs change on the design's own document (`restoreLiveDesign`,
`src/live/revert.ts`), never a replaced document: browsers keep offline copies in IndexedDB and
merge them on reconnect, so a change on the same history merges and can be undone by restoring
"Before restore". The routes and rules are in 05 As built (M9).

**VIEW-01** (266c663, 1b6c83b, 4b494e0).

Table: `view_links` at the end of the schema (the `// VIEW-01` block),
`migrations/0005_view_links.sql`; deleting a design forever deletes its links. The view socket:
`/live?view=<token>` (not Hocuspocus's token field), so the upgrade in
`apps/server/src/live/access.ts` can check the link before the socket opens, as it checks the
session for people; `LiveContext` is a person or a view link, each document must be the link's
design, and the connection is read-only. `src/live/view.ts` holds the token of a socket and empties
the presence on it: every awareness message to a view link's socket becomes an update with no
clients (not dropped, because the provider reconnects after 30 seconds without a message), and its
own awareness reaches the others as an empty state, so the viewer sees nobody and nobody sees the
viewer. It depends on Hocuspocus's message layout (address, then type) and is one small file to
check on each Hocuspocus update (`beforeHandleAwareness` in `src/live/server.ts`). Revoking a link
closes its open pages at once with LIVE-01's close code 4403 and the link's sentence; an expired
link closes them at the next 30-second check; moving the design to Trash calls
`recheckDesign(designId)` at once. Media files take the token as `?view=<token>` and only for the
link's design. The rules are in 05 As built (M9).

## As built (M10)

**CL-01** (61a597d).

New tables `claude_links`, `api_keys` and `pictures` (the `// CL-01` block at the end of `apps/server/src/db/schema.ts`, `apps/server/migrations/0006_claude_links.sql`; deleting a design forever deletes its links and picture rows by foreign keys). Pictures are media rows of the kind `picture` (the file at `media/<2>/<sha256>` as every upload, deduplicated) with a `pictures` row each (primary key design, step, language): the files are then kept, backed up and deleted with the design like every upload; `removeUnusedFiles` was split out of `deleteForever` in `apps/server/src/designs/trash.ts`, and a duplicate leaves the picture rows out (`apps/server/src/designs/store.ts`). The routes are `apps/server/src/routes/claude.ts` (links, keys, the picture upload, the link's public files, which need no session and answer 404 for a wrong or revoked token), registered from `src/main.ts`, and the contract `packages/api/src/routes/claude.ts`. The server's export is in `apps/server/src/claude/export.ts`: it reads the stored document (`design_docs.state`, with its `doc_version` read together) and keeps the plain design, its checks and the files made from it in memory per design and `doc_version` (a version per its ID), at most 16 exports and about 64 MB; `readThreads` of `src/routes/comments.ts` is exported for the open questions. `mediaFiles` and `specChecks` moved from `apps/web/src/export/exportZip.ts` to `packages/spec/src/export/files.ts`, so the link's spec.json is the browser export's, by the same code. API keys are used through `apps/server/src/claude/keys.ts` (`bearerOf`, `keyUserOf`, `auditKeyUse`); the picture cache is `apps/server/src/claude/pictures.ts`.

**CL-02** (3559330).

`POST /mcp` is `apps/server/src/routes/mcp.ts`, registered from `apps/server/src/main.ts`; the tools are `apps/server/src/claude/mcp.ts`. It uses `@modelcontextprotocol/sdk` 1.32.2 (a dependency of apps/server as section 3 lists it; no hand-made protocol) with the web-standard Streamable HTTP transport, without sessions, answering JSON, one server per request. The route hands the transport a Request made from Fastify's and sends its answer through Fastify, not the Node transport on the raw response, so the request keeps Fastify's error format, security headers and request log, and the body is read once. The Origin check lets `/mcp` requests without an Origin through (`apps/server/src/auth/http.ts`); one with an Origin must have the site's (403 `bad_origin`). A key, never a cookie, authorizes, so there is no CSRF to stop. The SPA fallback never answers `/mcp` and `/.well-known/` (`apps/server/src/app.ts`): 404 in the API's error format. Vite proxies `/mcp` in `make dev` (`apps/web/vite.config.ts`). `designArrows(design)` in `packages/spec/src/markdown/map.ts` is exported from `packages/spec` for `get_step`.

**CL-03** (413c28f).

Web only: the Share dialog's `apps/web/src/designs/ClaudeLinksSection.tsx`, `ApiKeys` in `apps/web/src/routes/_app/account.tsx`, the picture cache upload `apps/web/src/export/pictureCache.ts` and "Refresh pictures for Claude" (the editor's `MoreMenu.tsx`, the Designs cards). No server change: the web app uploads to CL-01's `POST /api/designs/:id/pictures`. The connect instructions use the browser's own address (`window.location.origin`) for `https://<domain>`, as the web app has no route that answers the configured public address.

## As built (M11)

**TPL-01** (69e7182).

Code:

- Starter templates (English with Persian): `packages/spec/fixtures/templates/shop.ts` ("Shop with
  Stars"), `support.ts` ("Support desk"), `quiz.ts` ("Quiz"), `signup.ts` ("Sign-up form"); their
  shared builders `kit.ts`; the list with ID, icon and description `index.ts` (`STARTER_TEMPLATES`),
  exported as `@xdesign/spec/templates` (`packages/spec/package.json`).
- spec-check: every template checked like the coffee shop (no errors, warnings listed,
  `fixtures/out/template-<id>.spec.json` and `.md` written): `packages/spec/scripts/spec-check.ts`.
- API: `packages/api/src/routes/templates.ts` (`templates`, `useTemplate`, `saveAsTemplate`,
  `deleteTemplate`, schemas `template`, `templateId`, `templateDescription`), listed in
  `packages/api/src/index.ts`.
- Server: `apps/server/src/routes/templates.ts` (the gallery list, "Use this template", "Save as
  template", removing a template), registered in `src/main.ts`; `copyDesign` and `TemplateMeta` in
  `src/designs/store.ts` (`duplicateDesign` now calls it); templates hidden from the Designs list
  and 404 on design routes (`src/routes/designs.ts`, `designHeader` and `findDesign` exported), no
  role on a template (`src/auth/context.ts`), left out of the MCP list (`src/claude/mcp.ts`);
  `designs.template_meta` typed (`src/db/schema.ts`, no migration); Activity actions
  `template_saved`, `template_used`, `template_deleted` (`src/audit.ts`).

As built:

- Starter templates, each a whole design in English (default) and Persian with only media
  placeholders, and no errors or warnings in its checks:
  - "Shop with Stars" (bot "My Shop", 17 steps): /start, /help and /paysupport (which Telegram asks
    of bots that take payments); the shop with two products (a photo page with "Buy for ⭐️50" or
    "⭐️120", an invoice in Stars with its pay button, the download after paying); "My purchases" (an
    If on "has paid" for both, either or none); "How to buy"; /paysupport asks what went wrong and a
    developer step sends it to the owner (who refunds with refundStarPayment when needed).
  - "Support desk" (bot "Support desk", 17 steps): /start, /ticket, a fallback and a broadcast
    "Service news" to everyone; the main menu; "Common questions" with two answers; "Office hours";
    a ticket: "Topic" (bottom buttons Payment, Account, Something else, Cancel) and "Describe the
    problem" (10 to 2000 characters), both with the cancel word "Cancel"; the developer step "Open
    the ticket" (sets the ticket number; "Ticket opened" or "Help desk down"); the news message.
  - "Quiz" (bot "Quiz Night", 16 steps): /start, a welcome with "Start the quiz", the score set to
    0, three quizzes (not anonymous) each saving whether the answer was right ("Save the vote as" a
    yes/no variable), an If after each that adds a point, then "Final score" picks "All right" (with
    the party effect), "Two right" or "Try again", each with "Play again".
  - "Sign-up form" (bot "Event sign-up", 16 steps): /start, a welcome with "Sign up" and "About the
    event"; questions for the full name (2 to 64 characters), the email (an email, at most 254), the
    age (a whole number from 1 to 120, then an If: under 18 ends with "Too young"), the phone
    (Telegram's "Share my phone number" contact button or typed, checked as a phone); the cancel
    word "Cancel" on each; a summary with "Confirm" and "Start over"; the developer step "Save the
    sign-up" with "Saved" and "Already signed up"; End.
- The gallery's cards come from `STARTER_TEMPLATES`: the ID (`shop`, `support`, `quiz`, `sign-up`),
  the icon (`shop`, `support`, `quiz`, `signUp`), the description; the name is the design's name.
  The server carries them in its bundle; the web app does not.
- `GET /api/templates` (every member): the built-in templates in their order, then the server's own,
  newest first; each card `{ id, name, description, builtIn, icon, savedBy, savedAt, stepCount,
  languages }`.
- `POST /api/templates/:id/use` (every member), "Use this template": a new design named after the
  template, owned by the person, without sharing; a built-in template is stored as an import is (its
  internal IDs kept), one of the server's copied with its media rows. Answers the design's header;
  the gallery opens it in the editor. An unknown ID: 404 "This template was not found.".
- `POST /api/designs/:id/template` (design owner and site owner) with `name` (1 to 100 characters)
  and `description` (up to 300): saves the open document's pending changes first (as "Name this
  version" does), then copies it. A design in Trash or a template cannot be saved (no role, or 404
  for the site owner).
- `DELETE /api/templates/:id` (the person who saved it, or the site owner; others 403): deletes it
  as "Delete forever" deletes a design; designs made from it stay. A built-in ID: 400 "A built-in
  template cannot be removed.".
