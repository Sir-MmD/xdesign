# 14. Milestones

The build of xDesign in two stages (Q-17, D-17): stage 1 is M1 to M6 (release 1.0), stage 2 is
M7 to M11 (release 2.0). Every task row below is unticked; the lead ticks it with the main
commit hashes when it is merged.

## 1. How to work with this document

- A task row is `- [ ] <ID> <title>: <scope> (after <IDs>) [<docs>]`. The scope is the brief's
  starting point; the plan text is in the documents named in brackets.
- Sizes follow claude_optimized_xhigh.md section 3: about 150 steps or fewer, at most about
  three areas and ten files. Tasks marked **(Sonnet)** are read-only research or documentation;
  all others are Opus coding agents at effort xhigh in their own worktree.
- Coding agents never edit 01, 14, 15, CLAUDE.md or docs/status.md; their notes go to
  `.dev/<build>/notes/<TASK>.md`; a Sonnet documentation agent per milestone (DOC-Mn) folds the
  notes into the "As built" section at the end of each area document and into 01 section 11
  and 15.
- **`make sanity`** (built in FND-01, the only check, D-24) runs, in order, and prints one line
  when all pass or the failing check's last 40 lines (full logs in `.dev/gate/latest/`):
  1. `tsc -b` over all packages and apps;
  2. ESLint (in a worktree only the changed files; on main all) and Prettier check;
  3. the web build (Vite) and the server bundle (esbuild);
  4. drift checks: `make gen` into a temporary folder and compare (Drizzle migrations against
     the schema, the export JSON Schema, the TanStack route tree);
  5. `make spec-check`: every fixture design (and in stage 2 every template) validates, its
     checks run, and export then import gives an equal plain model;
  6. `make catalog-check`: every row of the Telegram catalog has a source URL and a Bot API
     version;
  6a. the Go helper: `go build`, `go vet` and golangci-lint in `helper/` (when `helper/`
     changed, in a worktree);
  7. the em-dash check: no U+2014 in tracked files.
  In a worktree it waits for one of two build slots (`flock` on `~/.cache/xdesign/slots/`), as
  in xWriter, so parallel agents do not overload the desktop.
- **Worktree setup** for xDesign briefs (replaces the xWriter setup of the brief template):
  `git merge --ff-only main`, `pnpm install --frozen-lockfile --offline` (the store is shared;
  FND-01 installs every stage 1 dependency so later agents need no network), then `make sanity`
  once in the background to warm the caches. An agent that needs a new package stops with
  PARTIAL and names it; the lead adds it on main. The same for Go: GO-01 adds and downloads
  every Go dependency of the helper once (the module cache is shared), later GO agents build
  with `GOPROXY=off`.
- **Hand tests** run on the owner's desktop with `make dev` (M1 to M5) and on a test VM (M6).

**As built (FND-01; 490ca92, 162f271, 3121f23, 5e36dcb).**

- Tools: `tools/setup/install-tools.sh` (xWriter's, trimmed to the pnpm 12.8.1 shim and
  golangci-lint 2.14.0 with xWriter's SHA-256 values), `make setup-tools` into `.tools/bin`.
- Setup: `make setup-tools`, `make install`, then `make dev`.
- Sanity steps: `SANITY_STEPS` in the Makefile, in order: `typecheck lint build start-check
  gen-check spec-check catalog-check helper-check em-dash-check`. Each is a make target, so `make
  <step>` runs one alone. `start-check` (`tools/sanity/start-check.sh`) starts the built server
  bundle on a free loopback port with an empty data folder, once as a server and once in the
  desktop app's mode, and waits for `GET /api/health` to answer 200.
  To add a check: write its target and add its name to `SANITY_STEPS`. Logs:
  `.dev/gate/latest/<step>.log` and `summary.txt`. The run stops at the first failing step.
- In a worktree (git dir differs from the common dir) sanity.sh re-runs itself under
  `tools/sanity/slot.sh` (flock on `~/.cache/xdesign/slots/1` and `2`, env `XD_SLOT`), and sets
  `LINT_CHANGED=1` and `CHANGED_FILES` (files differing from main, committed or not, plus new files)
  for the lint target. `helper-check` is skipped while `helper/` is missing and, in a worktree, when
  nothing under `helper/` changed.
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

## 2. Overview

| # | Milestone | Result the owner can see | Owner inputs | Done |
|---|---|---|---|---|
| M1 | Foundation | Nothing to click yet: the repository, `make dev`, `make sanity`, the design model, the Telegram catalog, the export format and the checks exist; an example design passes `make spec-check`. | none | [ ] |
| M2 | Server, accounts and live editing | Sign in, invite a person, create, share and list designs; two browsers on the same design stay in sync (raw, before the editor). | none | [ ] |
| M3 | Editor: map and phone | The editor with the map of steps, arrows, auto-arrange, presence cursors, and the live phone exactly like xWriter's Telegram preview in its five looks (Web A, Web K, Desktop, Android, iOS), light and dark. | O-02 (optional screenshots) | [ ] |
| M4 | Editor: content and logic | Every stage 1 message kind, formatting, buttons with looks and icons, bottom keyboards, clicks with popups and edit/new/replace, questions, logic boxes, start points, bot setup, languages and right to left, variables, reusable parts. | none | [ ] |
| M5 | Try it, checks and export | Try it on the phone, the checks on the map and in the list, the export zip with pictures, the printable page, import. | none | [ ] |
| M6 | The Go helper and release 1.0 | xDesign as one self-installing file like xWriter, installed on a real server with HTTPS in all three modes, backups, update and going back from the website and the command line. | O-01 | [ ] |
| M7 | More messages and payments | Polls, quizzes, dice, paid media; Stars and card invoices, subscriptions, refunds, shipping. | Q-26 | [ ] |
| M8 | Events and broadcasts | Bot reactions, pins, gifts, chat actions, the user blocking or restarting the bot, broadcasts and reminders, payment events. | Q-27 | [ ] |
| M9 | Comments, history, view-only links | Comments with mentions and the bell, version history with compare and restore, view-only links. | none | [ ] |
| M10 | Claude link | Per-design Claude links, personal API keys, the MCP connector, the picture cache. | none | [ ] |
| M11 | Templates and release 2.0 | Starter templates and "Save as template"; the Telegram catalog refreshed; release 2.0. | none | [ ] |

## 3. Milestones in detail

### Lead tasks before the first wave

- [x] LEAD-01 project files: a short `CLAUDE.md` (what xDesign is, the layout of 02 section 2, (740f35d)
  the owner's rules of 01 section 10, how to run `make dev` and `make sanity`, the Compact
  instructions), `.gitignore` (`.dev/`, `node_modules/`, `dist/`), `docs/status.md` kept current,
  and an xDesign version of the brief template (claude_optimized_xhigh.md section 9 with the
  worktree setup of section 1 above and xDesign's rules in place of xWriter's
  mcp/search/apps rules); the lead only, no agent.

### M1. Foundation

**Goal:** the skeleton every later task builds on, and the shared definition of a design.

Tasks:

- [x] FND-01 monorepo and toolchain: pnpm workspace with `packages/spec`, `packages/api`, (490ca92, 162f271, 3121f23, 5e36dcb)
  `packages/preview`, `apps/web`, `apps/server`, `tools/sanity`; exact pins of the stack of 02
  section 3 (every stage 1 dependency installed now); TypeScript project references, ESLint,
  Prettier; Vite app shell with Tailwind and the router; Fastify skeleton serving the built
  SPA; `Makefile` with `dev`, `gen`, `sanity`, `spec-check`, `catalog-check`, `build`, and the
  sanity runner with slots and logs (section 1) [02]
- [x] TG-00 (Sonnet) Telegram research: verify every row of 08 sections 1 to 4 against (research, folded at 89b2c3a)
  core.telegram.org (Bot API changelog and method pages), with the source URL, the current Bot
  API version, and any change or new private-chat feature since 9.4; settle 08 section 2
  (checklists, reactions in private chats); write `.dev/s1/research/telegram.md` (runs beside
  FND-01) [08]
- [x] TG-01 Telegram catalog: `packages/spec/src/telegram/` with message kinds, button kinds, (dfa201c)
  looks, chat actions, effects, limits and the edit matrix as typed data, every row with source
  and Bot API version; `make catalog-check` (after FND-01, TG-00) [08]
- [x] SPEC-01 the plain model: Zod schemas and types of 03 section 2 for every stage 1 kind, (a3846dc)
  the rich text schema (03 section 5.1), ID names with transliteration (03 section 4) (after
  FND-01) [03]
- [x] SPEC-02 texts to Telegram: `toTelegram` (text, entities with UTF-16 offsets, HTML, (444fc48)
  variables) and `fromTelegram` (entities or HTML back to the rich text, for import), length
  counting for the checks (after SPEC-01) [03 section 5]
- [x] SPEC-03 export format v1: `toSpec(design, options)` and `fromSpec(spec)` (import), the (3f51548)
  JSON Schema written by `make gen` to `packages/spec/schema/bot-spec.v1.schema.json`, the
  `telegram` mapping blocks and `cameFrom` (after SPEC-01, SPEC-02, TG-01) [03 section 6]
- [x] SPEC-04 the Yjs document: layout, typed accessors with cascades, `tidy`, `migrate`, (8497a89)
  `readDesign`, `watchDesign`, new design content (after SPEC-01) [03 section 3]
- [x] SPEC-05 the checks: `check(design)` with the stage 1 rules of 03 section 8, limits only (ef42042)
  from the catalog (after SPEC-01, SPEC-02, TG-01) [03 section 8, 08]
- [x] SPEC-06 fixtures and `make spec-check`: an example "Coffee shop" design using every stage (ac7d484)
  1 kind, button action, keyboard, logic box, start point and two languages (English and
  Persian), plus a 300-step generated design for size; validation, checks and the export and
  import round trip (after SPEC-03, SPEC-04, SPEC-05) [03, 06 section 6]
- [x] DOC-M1 (Sonnet) fold the M1 notes [14 section 1] (8364f3f)

**Hand test:** `make dev` opens an empty xDesign page; `make sanity` passes; the owner can open
`packages/spec/fixtures/coffee-shop.export/design.md` (written by `make spec-check`) and read the
example design as a builder would.

As built hand tests:

- FND-01: `make setup-tools`, `make install`, then `make dev`: http://localhost:5173 shows "xDesign"
  centered; http://localhost:5173/api/health answers `{"ok":true,"version":"0.0.0-dev"}`; one Ctrl+C
  stops both.
- FND-01: `make build`, then `XD_WEB_DIR=apps/web/dist node apps/server/dist/server.mjs`:
  http://localhost:5174/any/path shows the same page, /api/health answers.
- FND-01: `make sanity` prints one line; `make help` lists the targets.
- TG-01: Run `make catalog-check`: it prints "catalog-check: 213 rows in 22 tables, all sourced".
- TG-01: In `packages/spec/src/telegram/effects.ts` change the `source` of the fire effect to
  `https://core.telegram.org/bots/api` and run `make catalog-check` again: it fails with "EFFECTS
  fire: source has no anchor: https://core.telegram.org/bots/api". Undo the change.
- SPEC-01, SPEC-02, SPEC-04, SPEC-05: nothing changes in the app yet (they add the design model, the
  converters, the Yjs document and the checks that later tasks read); run `make sanity` in the
  repository: it prints one line saying all checks passed.
- SPEC-03: Run `make gen`, then `git status`: nothing changed, so
  `packages/spec/schema/bot-spec.v1.schema.json` matches the format.
- SPEC-03: Open that file: it describes spec.json format version 1, with definitions such as Button,
  Keyboard, Step and RichText.
- SPEC-03: Run `make sanity`: it prints one line saying all checks passed.
- SPEC-06: Run `make spec-check`: it prints one line for the coffee shop (0 errors, its warnings
  listed below), one for the 300-step design with the times of check and toSpec, and "spec-check: 2
  fixtures passed".
- SPEC-06: Open `packages/spec/fixtures/out/coffee-shop.spec.json`: the "Hazel Coffee" bot with its
  steps, buttons and texts in English and Persian, each step with its Bot API method.
- SPEC-06: Run `make sanity`: it prints one line saying all checks passed.
- SPEC-06: `design.md` of the hand test above is EXP-01's (the markdown writer); until then `make
  spec-check` writes only `coffee-shop.spec.json`.

### M2. Server, accounts and live editing

**Goal:** the website around the editor and the live document behind it.

Tasks:

- [x] SRV-01 server core: config file and environment, SQLite and Drizzle with every stage 1 (7738685, 0eea8d8)
  table of 02 section 5, migrations at start, pino logs, security headers, error format, static
  SPA with fallback, `/api/health`, the route declaration helper in `packages/api` and every
  stage 1 route declared (schemas and roles), listening on a Unix socket when the helper starts
  it (TCP in `make dev`) and trusting forwarded headers only from the socket, the app's own
  commands `app/cli.mjs` with `migrate`, the dev owner printed on first `make dev` (after
  FND-01) [02, 05, 07 section 1]
- [x] AUTH-01 accounts: sign in and out, sessions, argon2id, rate limits, Origin check, (0570b62)
  account (name, password, color, sessions), invites (create, list, revoke, accept), password
  reset links, disable and enable, the activity rows, the app's commands `init-owner`,
  `reset-password` and `list-users` for the helper (after SRV-01) [05 sections 1, 9; 02 section
  8; 07 section 7]
- [x] AUTH-02 designs and sharing: create (with the new-design document from SPEC-04), list (6fadcaa)
  with search and filters, rename, duplicate, Trash and its daily job, roles and the permission
  helper, transfer ownership, the site owner's view (after SRV-01, SPEC-04) [05 sections 2, 3, 5]
- [x] MEDIA-01 uploads: multipart upload, type by content, allowed types per kind, size limit (8a50427)
  from Settings, content-addressed storage, role-checked serving with safe headers, metadata
  (dimensions, duration from the browser's probe) (after SRV-01) [02 sections 6, 8]
- [x] LIVE-01 live editing on the server: Hocuspocus on `/live`, authentication from the (b6b765a)
  session and the role, read-only connections, debounced storage with `doc_version`, the size
  guard, unloading idle documents, closing connections when access is removed (after SRV-01,
  AUTH-02) [02 section 4, 05 section 4]
- [x] WEB-01 web shell and account pages: layout and top bar, the typed API client, sign in, (614ed73, f7f797c, b6d8b1d)
  invite, reset, account page, session expiry handling, toasts (after SRV-01) [04 sections 1, 2]
- [x] WEB-02 designs and members pages: Designs (cards, search, filters, new, rename, (c9e6d17, d3c42e9)
  duplicate, Trash, import button placeholder until EXP-02), the Share dialog, Members (invites,
  reset links, disable, remove with moving designs), Settings (site name, upload limit,
  activity) (after WEB-01, AUTH-01, AUTH-02) [04 section 3, 05]
- [x] DOC-M2 (Sonnet) fold the M2 notes (8972eee)

**Hand test:** sign in with the dev owner; invite a second person in a private window and
accept; create a design, share it as Editor, see it in the other window's list; change the role
to Viewer; disable the person and see them signed out.

As built hand tests:

- Lead, on main at b6d8b1d: migrate, init-owner, sign-in (the Origin must be XD_PUBLIC_URL), create
  and list a design, two live clients see each other's change, the save raises docVersion: all
  passed.
- SRV-01: `make dev`: http://localhost:5173/api/health answers `{"ok":true,"version":"0.0.0-dev"}`,
  http://localhost:5173/api/site answers `{"name":"xDesign"}`, and `.dev/data/xdesign.db` appears.
- SRV-01: http://localhost:5173/api/me answers 401 with
  `{"error":{"code":"not_signed_in","message":"Sign in to continue."}}`;
  http://localhost:5173/api/nothing answers 404 `not_found`.
- SRV-01: `make build`, then `node apps/server/dist/cli.mjs migrate` prints "The database is up to
  date: <path>"; `node apps/server/dist/cli.mjs` lists the commands.
- SRV-01: `XD_WEB_DIR=apps/web/dist node apps/server/dist/server.mjs`:
  http://localhost:5174/any/path shows the app with a Content-Security-Policy header, and the
  terminal shows one JSON line per request.
- AUTH-01: `make dev` on an empty `.dev/data`: the terminal prints "Dev owner: owner@xdesign.local /
  <password>"; sign in with it at http://localhost:5173/sign-in (once WEB-01 is in).
- AUTH-01: A wrong password five times answers "Email or password is wrong." and then "Too many
  tries. Wait 15 minutes or ask the owner to reset your password."
- AUTH-01: `curl -X POST http://localhost:5174/api/auth/sign-out` answers 403 `bad_origin`; with `-H
  'Origin: http://localhost:5173'` it answers `{"ok":true}`.
- AUTH-01: `cd apps/server && XD_DATA_DIR=../../.dev/data node_modules/.bin/tsx src/cli.ts
  list-users` lists the dev owner; `reset-password owner@xdesign.local` prints a new password and
  the old session is signed out.
- AUTH-01: Members and invites have no pages yet (WEB-02): the routes answer under `/api/members`
  and `/api/invites` for the site owner.
- AUTH-02: Once WEB-02 builds the Designs page: "New design" makes a card with 2 steps and its
  languages, owned by you; "Duplicate" makes "<name> (copy)", also yours, with nobody shared.
- AUTH-02: Share a design with a member as Viewer: signed in as them, it shows under "Shared with
  me" with the role Viewer; Rename and Delete are refused, Duplicate works.
- AUTH-02: "Delete" moves it to Trash (only you and the site owner see it there); "Restore" brings
  it back; "Delete forever" removes it.
- AUTH-02: As the site owner, "All" lists every design with its owner's name; transfer one to a
  member: they become its owner and the old owner an Editor. Settings > Activity lists each of these
  actions.
- MEDIA-01: Once sign-in works (AUTH-01, AUTH-02): as the site owner, upload a phone photo to a
  design as `kind=photo` (POST `/api/designs/<id>/media`, a multipart form): the answer has
  `image/jpeg` and the width and height the photo shows; the same upload again answers the same id,
  and `.dev/data/media/` holds one file for it.
- MEDIA-01: Upload an SVG renamed to `.jpg`: "SVG and HTML files are not allowed."; a PNG as
  `kind=voice`: "This type of file cannot be used here. Use OGG (Opus), MP3 or M4A."
- MEDIA-01: PATCH `/api/settings` with `{"uploadLimitMb":1}` and upload a 2 MB file: 413 "This file
  is bigger than 1 MB."; GET `/api/settings` shows the new limit.
- MEDIA-01: Open `/api/media/<id>` in the browser: a photo shows in the page, a PDF uploaded as a
  document downloads under its own name, and a video can be dragged to any point (206 answers in the
  network tab).
- LIVE-01: There is no editor yet (its web task opens the connection); the server side answers
  already.
- LIVE-01: `make dev`, then `curl -i -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H
  'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ=='
  http://localhost:5174/live` answers `403 Forbidden` (no Origin); with `-H 'Origin:
  http://localhost:5173'` it answers `401 Unauthorized` (not signed in); the same on `/other`
  answers `404 Not Found`.
- LIVE-01: Signed in at http://localhost:5173, the browser console's `new
  WebSocket('ws://localhost:5173/live')` opens (status 101 in the Network tab).
- LIVE-01: Stopping `make dev` with Ctrl+C ends at once, without waiting for open sockets.
- WEB-01: `make dev`, open http://localhost:5173: it goes to the sign-in page with the site name
  above "Sign in". A wrong password shows "Email or password is wrong."
- WEB-01: Sign in as the owner: the top bar shows the site name, "Designs", "Members", "Settings",
  "Maintenance" and your avatar; each link shows its "Comes with ..." page; the avatar menu has
  "Account" and "Sign out".
- WEB-01: On Account change the name ("Name saved."), pick a color (the avatar changes), change the
  password, and in a second browser sign in, then "Sign out" that session from the first one.
- WEB-01: Make a phone-sized window (360 px): the top bar has two rows, the links scroll sideways,
  the account and sign-in pages fit without sideways scrolling.
- WEB-01: Sign out in another tab (or delete the `xd_session` cookie) and click a link: the page
  goes to "Sign in" with "Sign in to continue." and returns to that page after signing in.
- WEB-02: `make dev`, sign in as the dev owner: Designs shows "No designs yet." Click "New design",
  type a name, keep English, add Persian under "More languages" (search "farsi"), "Create": the page
  shows the name and "The editor comes next."; back on Designs the card shows "2 steps · English,
  Persian" and "Edited just now by Owner".
- WEB-02: On the card's menu try "Rename", "Duplicate" (a "(copy)" card appears), "Delete" (the
  toast's "Undo" brings it back), then "Delete" again, the "Trash" chip, "Restore" and "Delete
  forever".
- WEB-02: Members: "Invite someone" with a note, "Create invite link", "Copy"; the invite is listed
  as "Waiting" with "Revoke". Open the link in a private window and make an account; the new member
  shows in the list. Try "Make a password reset link", "Disable" and "Enable", and "Remove" with
  "Move their designs to".
- WEB-02: Share a design with that member as Viewer, change the role, "Remove" them; as the site
  owner pick "Owner" in the drop-down to hand the design over.
- WEB-02: Settings: change the site name and "Save" (the top bar changes); Activity lists each of
  the above with filters by person and design. Make the window phone sized (360 px): every page fits
  without sideways scrolling and dialogs open as bottom sheets.

### M3. Editor: map and phone

**Goal:** the editor's frame, the map and the Telegram phone.

Tasks:

- [x] PRV-01 port xWriter's Telegram preview: copy `web/src/preview/` of xWriter (core, the (b6224e5, 98267b7)
  telegram platform with skins, entities, emoji, fonts, bidi, media, albums, keyboards) into
  `packages/preview` as it is, with its fonts, art and their notices; only the input types are
  adapted to xDesign's model; the five looks (Web A, Web K, Desktop, Android, iOS) in light and
  dark must render pixel for pixel as in xWriter (after FND-01, SPEC-01) [04 section 4.4, D-04]
- [x] PRV-02 the private chat frame, built from the same skins, tokens and measures as PRV-01 (e5ed931)
  for each of the five looks: bot header (name, photo, "bot"), bot bubbles on the left
  and user bubbles on the right, the bottom keyboard panel, the input field with its
  placeholder and the menu button, toast and alert overlays, the typing status, the empty chat
  screen and the commands menu; editable slots (text, media, keyboard) for M4 (after PRV-01)
  [04 sections 4.4, 7]
- [x] EDIT-01 the editor frame: route `/d/<id>`, top bar (tabs, presence avatars, save state, (43ad623, 219a140)
  language and look switches, buttons), the three panes, selection shared by the map and the
  phone, the Hocuspocus provider with `y-indexeddb`, read-only mode, the per-person undo
  manager (after WEB-01, LIVE-01, SPEC-04, PRV-02) [04 section 4, 02 section 4]
- [x] MAP-01 the map: React Flow bound to the document, a box per step kind with its summary (372cc40)
  and button dots, arrows derived from their sources, the palette (click and drag), drawing and
  removing arrows, "New step here" on empty drop, delete with cascade, box menu, sections
  (after EDIT-01) [04 sections 4.2, 4.3]
- [x] MAP-02 map tools: auto-arrange with ELK in a worker, multi-select, copy and paste (3a828b1)
  (also between designs), duplicate, search, minimap, zoom and fit, keyboard shortcuts,
  presence cursors and edit outlines, error and warning badges (from SPEC-05) (after MAP-01)
  [04 sections 4.3, 14]
- [x] DOC-M3 (Sonnet) fold the M3 notes (3072fe3)

**Hand test:** open a design in two browsers; add steps, draw arrows, auto-arrange, and watch
the other browser follow with the cursor and name; switch the phone through Web A, Web K,
Desktop, Android and iOS, light and dark, and compare each with the same post in xWriter's
preview and with a real Telegram app.

As built hand tests:

- PRV-01: Nothing new shows in the app yet: the phone comes on screen with PRV-02.
- PRV-01: Run `make sanity`: it prints one line saying all checks passed.
- PRV-02: Nothing new shows in the app yet: the editor's phone pane (M3, M4) will place
  `TelegramChat`, `EmptyChat` and `CommandsMenu`.
- PRV-02: Run `make sanity`: it prints one line saying all checks passed.
- EDIT-01: `make dev`, sign in, "New design", "Create": the editor fills the window with "<
  Designs", the name, "Map", "Bot setup", "Texts", "Saved", "EN", "Android Light", "Checks" with a
  count, "Try it", "Share", "Export" and "...".
- EDIT-01: Click "Main menu" in the step list: the phone shows its message; switch the look to "iOS"
  and "Dark": the phone follows, and after a reload the look is still "iOS Dark".
- EDIT-01: Share the design with another member as Editor and open it in a second browser as them:
  each top bar shows the other's avatar, hover says "Editing Main menu"; change them to Viewer:
  their bar says "Read only" and the palette goes; remove them: their editor goes to Designs with
  "You no longer have access to this design.".
- EDIT-01: Stop `make dev`: the bar says "Reconnecting..."; in the browser's developer tools set the
  network offline: "Offline, your changes are kept on this computer"; start it again: "Saved".
- EDIT-01: Make the window narrower than 900 pixels: the map or the phone with the "Map" and "Phone"
  switch at the bottom and "Editing works on a computer screen".
- MAP-01: `make dev`, open a design: the map shows "/start" and "Main menu" with an arrow between
  them; drag "Main menu" somewhere else, reload: it stays there; Ctrl+Z puts it back.
- MAP-01: Click "Message" in the palette: a box appears in the middle and the phone shows it; drag
  "If" from the palette onto the map: it lands under the pointer with "Yes" and "Otherwise" dots.
- MAP-01: Drag from the "Yes" dot to the new message: an arrow appears; drag from "Otherwise" to an
  empty spot: "New step here" opens, pick "End": an End box is created and connected.
- MAP-01: Click an arrow and press Delete: it goes. Open a box's "..." menu: "Delete" says which
  arrows it clears; "Duplicate" makes a copy; "/start" offers neither.
- MAP-01: Add a "Section", drag a message into it, then drag the section by its title bar: the
  message moves with it; select the section and resize it by a corner.
- MAP-01: Open the design as a Viewer: boxes can be clicked (the phone shows them) but nothing
  moves, no palette and no "..." menu.
- MAP-02: Select two boxes with Shift+click, press Ctrl+C, move the pointer to an empty spot and
  press Ctrl+V: copies appear under the pointer, selected, with the arrow between them; Ctrl+Z takes
  them away in one step. Open another design and press Ctrl+V there: the steps arrive with their
  buttons and texts.
- MAP-02: Press Ctrl+D on a selected box: a copy lands a little down and right. Press the arrow
  keys: the selected boxes move; with Shift, further.
- MAP-02: Press Ctrl+F, type a word from a button: Enter jumps from match to match and selects each.
- MAP-02: Click "Auto-arrange": the boxes line up left to right, sections around their steps; Ctrl+Z
  puts everything back. Try "Fit", the zoom buttons and dragging in the minimap.
- MAP-02: Open the design in a second browser as another member: each sees the other's pointer with
  the name, and a frame with the name around the box the other selected.
- MAP-02: A message with no text shows a red or amber dot; hover it to read why. "..." > "Keyboard
  shortcuts" lists every key.

### M4. Editor: content and logic

**Goal:** everything a stage 1 design can contain, edited on the phone and in the forms.

Tasks:

- [x] TXT-01 texts on the phone: TipTap with the Yjs collaboration per text and language, the (56ec686)
  Telegram marks and blocks, variable chips, custom emoji, text parts, the length counter,
  right to left, "Not translated" state, carets of others (after EDIT-01, SPEC-02) [04 section 5.2]
- [x] BTN-01 buttons and keyboards: inline rows with drag and drop, the button popover (text (d6bdf21)
  per language, the four looks, icon, "When pressed" with go to, link, copy text, login link,
  "Show it by", popup, "Also remember"), bottom keyboard buttons and options, remove keyboard,
  force reply, part rows (use, edit, detach) (after EDIT-01, MAP-01) [04 section 5.3]
- [x] MSG-01 message kinds and media: the kind row, upload, placeholder and reuse, albums, (385bb3a)
  location, venue and contact forms, the options section (silent, protect, link preview,
  effect, chat action, delay, then) (after EDIT-01, MEDIA-01) [04 sections 5.1, 5.4, 5.5]
- [x] LOGIC-01 logic steps: the forms of Question, If, Remember, Wait, Developer step, Go to, (3508f2a)
  End, Note, Section, with their outcome dots on the map and the condition sentences (after
  MAP-01, TXT-01) [04 section 6]
- [x] START-01 start points and bot setup: command, start link and fallback start points, the (03993bf)
  Bot setup tab with counters and previews, the commands menu order (after MAP-01, PRV-02)
  [04 sections 6, 7]
- [x] LANG-01 languages and variables: the design's languages (add, remove, default), the (8e24885, c1b4a03)
  Texts tab (translation table, filters, copy default), the Variables and Test switches panels
  (after EDIT-01, TXT-01) [04 sections 10, 11]
- [x] PARTS-01 reusable parts: the Parts panel, make a part from a box's buttons or a text, (7587284)
  the part editor, uses, detach, delete with detaching (after BTN-01, TXT-01) [04 section 12]
- [x] DOC-M4 (Sonnet) fold the M4 notes (9ba91c7)

**Hand test:** build the owner's own example: a main menu with an inline button "Shop" in
blue that edits the menu into a product list, a "Back" row made a part and used on three steps,
a question asking for a phone number with a "Share phone" bottom button, an "If" on "User is
admin", a Persian translation; check that the phone shows each exactly like Telegram.

As built hand tests:

- TXT-01: `make dev`, open a design, select "Main menu": click the text in the bubble and type;
  select a word and press "Bold", then "Spoiler": the word gets the dots when you click outside the
  text.
- TXT-01: Press "{ } Insert", pick "first_name": a `{first_name}` chip appears; press Ctrl+Z: it
  goes, and Ctrl+Z on the map goes on undoing your earlier changes.
- TXT-01: Paste `<b>Hi</b> <tg-spoiler>secret</tg-spoiler>` as plain text: it arrives bold and as a
  spoiler; under the phone the counter changes with each letter.
- TXT-01: Add a second language, switch to it: the bubble shows the text greyed with "Not
  translated: click to write the ... text"; click and type.
- TXT-01: Open the design in a second browser as another member and click in the same text: each
  sees the other's caret with their name.
- BTN-01: `make dev`, open a design, select "Main menu", click "+ Inline buttons" under the bubble:
  a "Button" appears in the bubble's look with its popover open; type "Coffee", pick "Green", pick a
  step in "Goes to": the map shows the arrow from the button at once.
- BTN-01: Hover the keyboard and press the "+" beside the row and "+ row" a few times, then drag a
  button into another row and onto "+ row": the rows follow, and Ctrl+Z puts them back.
- BTN-01: Switch the look to "iOS" and "Dark": the buttons keep the look; switch the language to a
  second one: the button texts show greyed in the popover's other field.
- BTN-01: On another message click "+ Bottom keyboard": the keyboard appears in the input field's
  place; open "More" and turn on "Fit to buttons" and type a "Hint in the input field": the panel
  shrinks and the field shows the hint. Set a button to "Share phone number" and "Save it as" "+ New
  variable".
- BTN-01: Click a button's pill on the map: its popover opens on the phone; "Delete button" on the
  last button: the keyboard goes and "+ Inline buttons" shows again.
- MSG-01: Select "Main menu", pick "Photo" in the select above the phone: the text stays as the
  caption and a grey box shows; click it, "Use a placeholder", type "photo of the product": the box
  shows the words. Upload a phone photo: a progress bar, then the photo in the bubble.
- MSG-01: Pick "Sticker": it asks "The text will be removed. Change anyway?"; "Change" removes it,
  Ctrl+Z brings the photo and the caption back.
- MSG-01: Pick "Album", click it, add items with "+", drag the thumbnails into another order, mark
  one "Hide under a spoiler"; the bubble follows.
- MSG-01: Pick "Location", click the map card, paste a Google Maps link of a place: the coordinates
  fill in and the card shows them; "Venue" adds a name and an address, "Contact" a name and a phone
  number.
- MSG-01: Under the phone scroll to "Options": switch "Silent (no sound)", choose the 🔥 effect,
  "Show sending a photo... for 3 seconds", "Then" another step; open "Telegram details":
  `sendPhoto`, `disable_notification`, `message_effect_id` and `sendChatAction` are listed.
- MSG-01: Open the design as a Viewer: the cards show, nothing opens and the options are off.
- LOGIC-01: Select a question: under the phone, set "Save the answer as" to "+ New variable" "age",
  "Expects" "Number" and "Between 1 and 120"; type a wrong answer message in the small phone and
  "Try at most 3 times": the box's dot says "Wrong 3 times" and the box "Number, saved as age".
- LOGIC-01: Add an If: "+ Condition", choose "age", "is at least", type 18: the line under it reads
  "If saved answer age is at least 18", and the box shows "Yes" over the same words.
- LOGIC-01: "+ Case", name it "Admin", choose "+ Switch" in its condition and type "User is admin":
  the condition reads "User is admin" "is yes" and the box gets an "Admin" dot.
- LOGIC-01: Add a Remember: "+ Action", choose "Add", type 1 and a variable: the box shows "Add 1 to
  ...". Set a Wait to 2 hours and "Still go on": the box says both.
- LOGIC-01: Open the design as a Viewer: the forms show with every field off.
- START-01: `make dev`, open a design, click "+ Command" in the palette: the right pane shows
  "Command"; type "Help": it becomes "help", the box and the title say "/help"; turn on "Show in the
  commands menu" and write a menu text.
- START-01: Add a start link, type "ref_", choose "Starts with", pick "+ New variable", name it
  "Referrer": the link under it reads `https://t.me/yourbot?start=ref_`; press "Copy".
- START-01: Open "Bot setup", type a username: the link in the start link's form now uses it. Write
  a name and a description: the counters move and the empty chat on the right shows them; click a
  menu text: the preview turns to the commands menu.
- START-01: Drag "/help" above "/start" by its handle: the commands menu preview follows; switch
  "Menu button" to "Commands list": the commands menu preview's input field shows "Menu".
- START-01: "Add a photo", upload a JPEG: the photo shows in the top bar of the previews; "Remove"
  takes it away.
- LANG-01: `make dev`, open a design, "EN" in the top bar, "Languages...": add Persian (search
  "farsi", it shows "RTL"), close; the Texts tab shows an English and a Persian column and a counter
  such as "fa: 1 missing".
- LANG-01: Type a Persian button text or bot name in its cell: the counter drops; click the Main
  menu's text cell: a bubble opens with the editor and its toolbar; type, press "Done".
- LANG-01: "Copy the default language into empty cells": the Persian cells fill in italics; edit one
  and it turns normal; "Only missing" shows the rest.
- LANG-01: In "Languages..." make Persian the default, then make English the default again and
  remove Persian: it asks "Remove Persian? Its texts in this design are deleted."; Ctrl+Z brings it
  back.
- LANG-01: In the palette click "Variables" (once the lead places it): the built-ins are listed
  read-only; "+ Variable", "Remembered value", rename it, set a test value; "Test switches", "+
  Switch", make it "A choice" with two options.
- PARTS-01: `make dev`, open a design, open "Main menu"'s box menu and pick "Make a part from its
  buttons": a sheet opens on the right with "Main menu buttons" and the buttons on a small phone;
  the phone on the right shows them in a dashed outline with the part's name.
- PARTS-01: In the sheet click a button and change its text: the phone and the map change at once.
  Close the sheet, "+ Part", "Text", and type a few words in the bubble.
- PARTS-01: Drag "Main menu buttons" from the palette onto another message's buttons (or under a
  message without buttons): the part shows there, and its "Uses" lists both messages. Drag the text
  part into a message's text: a chip appears where you dropped it.
- PARTS-01: In the sheet press "Detach" beside a use: that message gets its own copy. "Delete part"
  asks "Delete Main menu buttons? Its 1 use gets its own copy."; the message keeps its buttons, and
  Ctrl+Z brings the part back.

### M5. Try it, checks and export

**Goal:** designs can be tried, checked and handed to builders.

Tasks:

- [x] TRY-01 the Try it engine: `packages/spec/src/sim/`, a pure state machine over the plain (3c56378)
  model (start points, messages with edit, new and replace, popups, bottom keyboards, questions
  with checks and wrong answers, If with switches and variables or "ask", developer outcomes,
  remember, waits, go to, back, end, fallback), with step back (after SPEC-01; can start in
  M1's last wave) [04 section 8]
- [x] TRY-02 Try it on the phone: the live chat mode, start picker, test user panel, typing (c082020)
  answers, share buttons with test values, the choice cards, skip waits, path highlight on the
  map, variables list, restart (after TRY-01, BTN-01, LOGIC-01, START-01) [04 section 8]
- [x] CHK-01 checks in the editor: the checks panel with levels, filters, jump, "Ignore here"; (8df89ba, e7d3b57)
  live updates in a worker for big designs (after SPEC-05, MAP-02) [04 section 9]
- [x] EXP-01 the readable doc and the guide: `toMarkdown(design, options)` (design.md with the (951b60e, 58ca89f)
  Mermaid map, sections, steps, tables, checks) and `HOW-TO-READ.md` in `packages/spec/docs/`
  (after SPEC-03) [06 sections 3, 4]
- [x] EXP-02 export, print and import in the web app: the export dialog, the offscreen picture (f76ee1a, 219a140)
  maker, the zip, the printable page with Mermaid, Import on the Designs page (after EXP-01,
  PRV-02, WEB-02, MEDIA-01) [06 sections 1, 2, 5, 6]
- [x] DOC-M5 (Sonnet) fold the M5 notes (1e0b277, 193bd37)

**Hand test:** Try it on the example: press "Shop", see the menu edit in place with the toast,
answer the phone question wrong then right, flip "User is admin" and see the other way; open the
checks and fix one; export, open the zip, read `design.md` with its pictures; give the zip to
Claude and ask it to describe how it would build the bot; import the zip as a new design.

As built hand tests:

- TRY-01: Nothing changes in the app yet: TRY-02 builds the Try it screen on this engine.
- TRY-01: Run `make sanity` in the repository: it prints one line saying all checks passed.
- TRY-02: `make dev`, open a design with /start, a menu with inline buttons (one with a toast, one
  that edits) and a question; click "Try it": the phone shows the empty chat with "Start from";
  click "/start".
- TRY-02: Press the inline buttons: the menu edits in place, the toast shows and goes; the path
  lights up on the map. Click "Step back", then "Restart".
- TRY-02: Answer the question wrong, then right, by typing in the input field and pressing Enter;
  open the clip and "Send a test photo" for a photo question.
- TRY-02: Add a test switch "User is admin" used by an If: flip it in the test user panel and see
  the other way; an If without a switch asks "Which way?".
- TRY-02: Select a message box and press Ctrl+Enter: Try it runs from it. Press Esc: the phone shows
  the step again. Make the window narrow: Try it still works, "Test user" opens the sheet.
- CHK-01: Open a design and add a message step with no text: "Checks" shows a count; click it and
  see the line under "Warnings" with the step's name and the message.
- CHK-01: Click the line: the panel closes, the map centers the step and the phone shows it
  selected. A line naming a button also outlines that button on the phone.
- CHK-01: Open "Checks" again and click "Ignore here" on a warning: it moves under "Ignored",
  greyed, and the count goes down; Ctrl+Z (outside the panel) or "Stop ignoring" brings it back.
- CHK-01: With two languages, pick one in the filter: only that language's lines stay; clicking one
  switches the phone to that language.
- CHK-01: On the Texts tab, click a line: the Map tab opens on its step. A too long bot name line
  opens Bot setup.
- CHK-01: On a design of more than 100 steps (the 300-step fixture imported), type in a text: typing
  stays smooth and the count follows a moment later.
- EXP-01: Open `packages/spec/docs/HOW-TO-READ.md`: the guide for builders, with the Bot API table
  and the checklist at the end.
- EXP-01: Run `make gen`, then `git status`: nothing changed.
- EXP-01: Run `make spec-check` and open `packages/spec/fixtures/out/coffee-shop.md`: the summary,
  bot setup, the Mermaid map, start points, each step with its texts and buttons table, variables,
  parts, media, checks and the glossary.
- EXP-01: Paste its `mermaid` block into a Mermaid viewer: the map draws, with the Persian titles
  and emoji.
- EXP-02: On Designs, open a design's menu, "Export", keep the defaults, "Export": "Making pictures
  n of m" counts up and a `.xdesign.zip` downloads; unzip it and open `design.md`, `spec.json` and
  `pictures/`: each message looks as in the editor's phone, Persian and emoji included.
- EXP-02: Export again with "Default language only" and iOS Dark, then with "No pictures" (faster);
  press "Cancel" during one: it stops.
- EXP-02: Open `/d/<id>/print`, wait for the pictures, check the map is drawn, click "9. Checks" in
  the summary (it jumps), then "Print or save as PDF": each section starts a new page.
- EXP-02: On Designs, "Import", drop the zip: "Import <name>: ... steps, ... languages, ... media
  files", "Import as a new design" opens the copy with its pictures and files.
- EXP-02: Drop a text file or a broken spec.json: "This file cannot be imported:" with the reasons.

### M6. The Go helper: install, HTTPS, backups, updates and release 1.0

**Goal:** xDesign on the owner's server as one self-installing file, installed and updated like
xWriter (D-21, D-29), with the Go helper copied from xWriter and xmtp-panel by the map of 07
section 10. Every GO brief carries the copying rules of 07 section 10. The GO tasks need only
SRV-01 and AUTH-01 of the website,
so they run beside M3 to M5 (section 4).

Tasks:

- [x] GO-01 the helper module: `helper/` (module, Go toolchain and golangci-lint settings as in (ca577ac, 964fd1f)
  xWriter), the command dispatch and build info (from xWriter's `internal/app/app.go` and
  `buildinfo`), `host`, `certs` and `unpack` copied as they are, `release` adapted to the single
  file; `make helper`; go build, go vet and golangci-lint in `make sanity` (after FND-01)
  [07 sections 2, 10]
- [x] GO-02 the front: `xdesign serve` with the child supervisor (start, restart with backoff, (68c06d5)
  logs, clean stop), the Unix-socket reverse proxy with WebSockets and forwarded headers, the
  "xDesign is starting..." answer, plain HTTP on a local port for mode B, the control socket
  with `status`, and `serve --dev` (after GO-01, SRV-01) [07 sections 1, 8, 9]
- [x] GO-03 HTTPS in the helper: xWriter's `ssl/acme`, `domain/ssl`, `tlscert.go`, `port80.go` (c5b8f89)
  and `getCertificate` copied and adapted, the small SSL manager on a JSON state file (methods,
  renewal, backoff, problems), xmtp-panel's pasted-certificate parsing and domain preflight, the
  control-socket endpoints for HTTPS (after GO-02) [07 sections 4.1, 4.3, 4.4, 10]
- [x] GO-04 the release build: `build.sh` from xmtp-panel's (menu, steps) with xWriter's (877b131, ae449e7)
  release checks, `make release`, the pinned Node runtime per CPU with its SHA-256, the payload,
  the embedded payload and the self-writing release folder (from xWriter's
  `cmd_release_files.go`), `version --json`, `SHA256SUMS`, the dormant signature check,
  `docs/release-notes-template.md` (after GO-01, SRV-01) [07 section 2]
- [x] GO-05 the installer: xWriter's install engine copied and cut (engine, steps, progress, (15e9729)
  output, pacman, log, preflight, questions, options, system, files, releases, service,
  installer), the embedded units from xWriter's `deploy/` renamed, the flow of xmtp-panel's
  installer (owner through `app/cli.mjs init-owner`, wait for ready, the final screen), re-run
  repair (after GO-02, GO-04, AUTH-01) [07 sections 1, 3]
- [x] GO-06 installer HTTPS modes and firewall: port detection and the mode proposal, mode A (2650457)
  setup, mode B site configs for nginx, Caddy and Apache with their tests, undo and the printed
  fallback, certbot (xWriter's helper and hook), mode C, ufw and firewalld (xWriter's firewall
  steps), Fedora SELinux (after GO-03, GO-05) [07 section 4]
- [x] GO-07 backups and restore: `helper/internal/backup` on `VACUUM INTO` with xWriter's (aa585ad)
  patterns, the backup timer, `xdesign backup` and `restore FILE`, the restore question of the
  installer, restore through the root helper, control-socket endpoints (list, make, download,
  delete, restore) (after GO-05) [07 section 5]
- [x] GO-08 updates and going back: `maintreq` and xWriter's maintenance upload and check code (e7cc006, 79c476e)
  adapted into the control socket, xWriter's update, update stage 2, rollback, go back and
  releases code cut for xDesign, the maintenance `.path` and `.service` units, xmtp-panel's
  start-count guard, `update FILE [--dry-run]`, `rollback` (after GO-05, GO-07) [07 sections 6, 7]
- [x] GO-09 status, admin, uninstall, the domain change and the restore through the root helper: (f954453)
  `xdesign status`, `admin reset-password` and `admin list-users`, `--uninstall` (xWriter's, cut),
  the domain change (`PUT /https/domain`), the `restore` request kind of the root helper and mode
  B's view in Settings > HTTPS (split from GO-08; after GO-08) [07 sections 4.4, 5, 7]
- [x] WEB-03 Settings > HTTPS and Maintenance in the website: the HTTPS page, Maintenance (aac6e51, 219a140)
  (Backups, Update with the checks and the 4-step tracker, the Go back card), "Confirm it's you"
  with the password, the reload banner, the app's routes that call the control socket (after
  GO-03, GO-07, GO-08, GO-09, WEB-02) [07 sections 4.1, 5.3, 6.2]
- [x] DOC-M6 (Sonnet) fold the M6 notes and write `docs/user-guide.md` (install, every page, (9277aaa, c9255c9, 43fe448)
  Try it, export, update) from the plan and the notes
- [ ] REL-01 release 1.0 (lead): `make sanity` on main, `./build.sh`, release notes, the
  owner's VM hand tests

**Hand test (VM):** copy the single file to a fresh Ubuntu, a Debian and a Fedora VM and run
`sudo ./xdesign --install`: once with free ports (Let's Encrypt), once next to nginx, once next
to a program on 443 (another port); sign in; make a backup and download it; update to a second
build from Maintenance and from the command line; make an update fail on purpose (a build whose
app does not start) and watch it go back by itself; restore a backup; compare each screen of the
installer and of Maintenance > Update with xWriter's.

As built hand tests:

- GO-01: `make helper`, then `dist/dev/xdesign version --json` has the keys version, commit,
  built_at, modified, arch, node_version, payload_sha256, min_upgrade_from, schema_floor, go, os;
  `dist/dev/xdesign help` prints the usage.
- GO-02: `make build`, `make helper`, then from the repository's root `dist/dev/xdesign serve
  --dev`: open https://localhost:8443 (accept the self-signed certificate) and the app opens; `curl
  -s --unix-socket .dev/run/control.sock http://x/status` says state "running".
- GO-02: Stop the node process with `kill <pid>`: the page says "xDesign is starting..." for about a
  second and comes back by itself, and status shows restarts 1. Ctrl-C stops everything and removes
  the sockets in `.dev/run/`.
- GO-03: With `serve --dev`, `curl -s --unix-socket .dev/run/control.sock http://x/https` shows
  method "builtin" and state "active"; a PUT of `letsencrypt_http` for `localhost` answers 400 with
  "give a full domain name such as design.example.com.". On a server with a domain, Settings > HTTPS
  shows "issuing", then "active".
- GO-04: `VERSION=1.0.0 ARCHES=amd64 make release` on a clean tree ends with a summary naming the
  file, its `.tar.gz`, `SHA256SUMS` and `release-notes-1.0.0.md`; with an uncommitted change it
  stops. `dist/xdesign-1.0.0-linux-amd64 release-files /tmp/xd-release`, then
  `/tmp/xd-release/runtime/node --version` prints v26.13.1 (remove the folder afterwards).
- GO-05: On a fresh Debian 13, Ubuntu 24.04 or Fedora 44 VM, `sudo ./xdesign-1.0.0-linux-amd64
  --install`: answer n to the backup question, give a domain, the owner's email and name, then Y;
  the end shows ":: xDesign 1.0.0 is running." with a 32-character password. Run it again:
  "repairing", and "Password: unchanged". `--install --dry-run` as a normal user changes nothing;
  the install log shows the password as [masked].
- GO-06: With ufw active and free ports the proposal says "Ports 80 and 443 are free: xDesign will
  serve HTTPS itself." and the ports open with the comment xDesign. With nginx running and a domain
  that points to the VM, the site opens behind nginx with a trusted certificate; answer n to the
  certbot question and the step prints the config and leaves no `xdesign.conf`. On Fedora with
  SELinux enforcing, the boolean question and `getsebool httpd_can_network_connect` say on.
- GO-07: After an install, `sudo xdesign backup` prints the path; `ls -l /var/lib/xdesign/backups`
  shows the `.tar.zst` and its `.json`; `systemctl list-timers xdesign-backup.timer` shows 03:30.
  Change a design, `sudo xdesign restore <file>`, answer y: the change is gone and a
  `pre-update-...` backup was added. On a fresh VM, `--install` with that backup restores the site
  with the old owner and password.
- GO-08: With 1.0.0 installed, `sudo xdesign update /root/xdesign-1.1.0-linux-amd64 --dry-run`
  changes nothing; without `--dry-run` it ends with ":: xDesign 1.1.0 runs now."; `sudo xdesign
  rollback` goes back to 1.0.0. An update to a build whose app does not start ends, after up to two
  minutes, with "The update went back by itself." and a log in `/var/lib/xdesign/update-failures/`.
- GO-09: `sudo xdesign status` shows the version, address, uptime, database, media, disk, backups
  and the certificate's expiry, and still the sizes after `sudo systemctl stop xdesign`; `sudo
  xdesign admin reset-password <email>` prints a new password. `sudo xdesign --uninstall` with 1
  keeps the data and a new `--install` finds it; `--remove-everything` removes `/var/lib/xdesign`,
  `/etc/xdesign` and the user and closes the firewall ports.
- GO-09: A PUT of `{"domain":"new.example.com"}` to `/https/domain` on the control socket (a domain
  that points to the VM) restarts xDesign and the site opens at the new domain; next to nginx the
  site config names it.
- WEB-03: `make dev`, sign in as the owner: Settings > HTTPS and every Maintenance card say "The
  server helper is not running (development).".
- WEB-03: On the VM, Settings > HTTPS shows the method and "Valid until"; choosing Let's Encrypt
  (port 80) asks the password and the log ends at "Active". Maintenance > Backups: "Make a backup
  now", "Download" (asks the password), "Restore" and "Delete". Maintenance > Update: drop a newer
  file with SHA256SUMS, "Upload and check", "Install and restart"; a second open tab shows "xDesign
  was updated. Reload to use the new version."; Go back: "Roll back to <old version>".
- Lead, trial build 0.9.0 (amd64) on the desktop: all 9 build steps passed; the release folder's
  bundled Node ran migrate, init-owner and the app (sign-in, a design, live sync between two
  clients); `serve --dev` served HTTPS with the CSP and HSTS headers and passed live sync over wss
  through the front.

### M7. More messages and payments

**Goal:** the remaining message kinds and every payment flow.

Tasks:

- [x] MSG-02 stage 2 message kinds in the model: poll, quiz, dice, paid media (and checklist (42ccafc)
  only if Q-26 says to keep it), with checks E20 to E22, export and the Try it engine (after
  M6) [03 sections 2.4, 7.2; 08]
- [x] MSG-03 stage 2 kinds in the editor: phone rendering and editing for poll, quiz, dice and (3a9dbc4)
  paid media, Try it answering and rolling (after MSG-02) [04 sections 5.1, 8]
- [x] RICH-01 rich messages and drafts: the "Rich message" content kind (blocks, tables, (e736ff2, 3f93124)
  lists, details, buttons inside; Bot API 10.1 to 10.3) in the model, checks, export, the phone
  (port xWriter's rich content parts if they fit) and editing; the message option "Write it out
  like a draft" (`sendMessageDraft`) with its Try it animation (after MSG-03) [08 section 7]
- [x] PAY-01 invoices in the model: the invoice step, prices, Stars and cards, subscriptions, (872f8a6)
  physical goods and shipping, pre-checkout outcome, paid, refund action, the pay button, the
  payment start points, `hasPaid` and `subscribed` conditions, checks E23 to E25, export and
  Try it engine (after MSG-02) [03 section 7.1, 08]
- [x] PAY-02 invoices in the editor: the invoice form and phone rendering (invoice card, pay (ff511f3, 4083d28)
  button), the payment sheet mock in Try it with "Pay (test)" and "Cancel", shipping options
  (after PAY-01, MSG-03) [04 sections 6, 8]
- [x] DOC-M7 (Sonnet) fold the M7 notes (6507fcd (one pass with M8 and M11))

**Hand test:** design a Stars shop: a product with a photo, an invoice for 50 Stars, a
pre-checkout developer step, a thank-you message, a monthly subscription; try paying and
cancelling in Try it; export and read the invoice part of `design.md`.

As built hand tests:

- MSG-02: Run `make spec-check`, then open `packages/spec/fixtures/out/coffee-shop.md`: Favorite
  roast, Coffee quiz, Lucky roll and Secret recipe are described in words (question, options table,
  right answer, explanation, price).
- MSG-02: In `packages/spec/fixtures/out/coffee-shop.spec.json` the same steps have
  `telegram.method` sendPoll, sendDice and sendPaidMedia with their `params`.
- MSG-03: Select a message step, choose "Poll" in the kind row: the bubble shows the question,
  "Anonymous Poll", two empty options and "No votes". Type the question and the options in the
  bubble; add a third with "Add an option" under the phone and move it up.
- MSG-03: Choose "Quiz", tick "Right" on an option: its mark turns green with a check. Add an
  explanation and write it in the small bubble.
- MSG-03: Turn off "Anonymous voting", pick "+ New variable" in "Save the vote as". Turn it back on:
  the checks show an error about the anonymous poll.
- MSG-03: Make a message "Dice" (pick 🎯) and one "Paid media" (50 Stars): the dice shows big without
  a bubble, the paid media blurred with "Unlock for ⭐ 50".
- MSG-03: Try it: vote in the poll (the bar and "1 vote" show), answer the quiz wrong (red cross,
  the explanation as a toast), set "Dice value" 6 in the test user panel before the dice, press
  "Unlock for ⭐ 50", then "Pay (test)": the media shows clear. Switch the looks: each draws them.
- RICH-01: Select a message step and choose "Rich message" in the kind row: the bubble shows the
  text as a paragraph.
- RICH-01: Under the phone, "Add a block": a Heading (size 1), a List (write two items, turn on
  "Numbered"), a Table (write the cells, "Add a column", "First row is a header"), a Details block
  (title and text). The bubble shows each as Telegram draws a rich message; move a block up and
  remove one.
- RICH-01: Turn on "Write it out like a draft" in Options, then run Try it: the message appears
  block by block before it shows whole; a text message with the option is written out letter by
  letter.
- RICH-01: In the checks, a table with 21 columns or a heading size outside 1 to 6 shows E28.
- RICH-01: Export: the step's `telegram.method` is sendRichMessage and `telegram.draftMethod`
  sendRichMessageDraft; design.md describes each block.
- RICH-02: Select a rich message, "Add a block" > "Buttons": a button appears under the phone with
  its popover; name it, set "Goes to" a step. The map box shows the button as a pill with an arrow
  to that step; "+" adds a second button; "Delete button" on both removes the row.
- RICH-02: "Add a block" > "Media", then "Upload a file" with a photo: the bubble shows it.
- RICH-02: Run Try it on that message and press the button inside the bubble: the chat goes to its
  step.
- RICH-02: On a text message turn on "Write it out like a draft", "Let the user stop it" and "Keep
  what was written", and pick a step in "If the user stops it" (the box gets that dot). In Try it
  press "Stop" while it is written: the half-written text stays and the chat goes to that step;
  without pressing, the whole message arrives.
- PAY-01: Run `make spec-check`, then open `packages/spec/fixtures/out/coffee-shop.md`: Coffee club
  (⭐️250 every 30 days, createInvoiceLink), Hazel beans (12.00 USD and a -1.20 USD discount, name,
  phone and address, Post and Courier shipping, the pre-checkout check), Refund the club, and the
  start points Club renewed and Club refunded are described in words.
- PAY-01: In `packages/spec/fixtures/out/coffee-shop.spec.json` the same steps have
  `telegram.method` sendInvoice, createInvoiceLink and refundStarPayment with their `params` and
  `payment` lists.
- PAY-02: Click "Invoice" in the palette: the box shows "No title yet · ⭐️1", a "Pay" pill and
  "Paid". The phone shows the card with "Pay"; type an invoice title and a description in the form
  and see them on the card; add a photo: the price shows over it.
- PAY-02: Turn on "Subscription (every 30 days)": the line about the invoice link shows and the
  phone's pay button gets the link mark. Switch to "Card", type EUR, add a second price line with
  -100: the total follows.
- PAY-02: Turn on "Physical goods" and "Flexible shipping", add two shipping options; turn on the
  pre-checkout check and write a refusal message.
- PAY-02: Add an "If", choose "The user", then "has paid" and the invoice. Add "+ Payment done" and
  an "Action" and pick the invoice in each.
- PAY-02: Try it: press the pay button, choose a shipping option, "Pay (test)", answer "OK": the
  path goes on through "Paid". Try again with "Refuse": the refusal shows as an alert. Switch the
  looks: each draws the card and the sheet.

### M8. Events and broadcasts

Tasks:

- [x] EVT-01 events in the model: action steps (react, pin, unpin, delete, gift, chat action, (5e3303b)
  refund), start points (payment done, refunded, user blocks, user restarts, broadcast; user
  reacts only if Q-27 says to keep it), reminders as Wait with "Stop waiting", checks W20, W21,
  I20, I21, export and Try it engine (after PAY-01) [03 sections 2.3, 7.3; 08]
- [x] EVT-02 events in the editor: palette and forms for actions and new start points, phone (722766b)
  rendering (reaction on a bubble, the pinned message bar, the gift message), Try it's events
  menu ("User blocks the bot", "Time passes") (after EVT-01, PAY-02) [04 sections 4.2, 8]
- [x] DOC-M8 (Sonnet) fold the M8 notes (6507fcd)

**Hand test:** a reminder: after the cart is left for 1 hour, the bot writes "Still want your
latte?" unless the user paid; a broadcast to users with the switch "Wants news"; the bot reacts
with 👍 to the user's answer; try each in Try it.

As built hand tests:

- EVT-01: Run `make spec-check`, then open `packages/spec/fixtures/out/coffee-shop.md`: section 4
  lists Club renewal failed, User left, User came back and New roast news in words; Remind in 1 hour
  says it stops once the user has paid Hazel beans; Like the feedback, Pin the news, Unpin the news,
  Delete the news, Typing and Welcome gift are described.
- EVT-01: In `packages/spec/fixtures/out/coffee-shop.spec.json` those start points have
  `telegram.update` `subscription` (status `failed`), `my_chat_member` (status `kicked` or `member`)
  and none for the broadcast; the actions have `telegram.method` setMessageReaction, pinChatMessage,
  unpinChatMessage, deleteMessage, sendChatAction and sendGift.
- EVT-02: In the palette click "+ Broadcast": the box says "The bot writes first to everyone" and
  "When: not given yet"; type "Every Monday at 9:00" under When, then choose "Some users" and pick a
  switch: the box follows.
- EVT-02: Click "Action", choose "Set a reaction" in Does, pick 🔥 and a message: the box says "React
  🔥 to ..."; choose "Send a gift": a gift card shows in the form, type its text there and see the
  counter.
- EVT-02: Open Try it on the coffee shop design, start from /start, open "Events" and click "User
  blocks the bot": Restart replaces the input field; click it.
- EVT-02: With the test switch "Wants news" on yes, fire "New roast news" from Events: the pinned
  bar shows the news at the chat's top. "User restarts the bot" runs "User came back": the welcome
  message, then the gift card "Gift from ..." with its text.
- EVT-02: Put a Wait after an action "Show a chat action" and try it: the top bar shows "typing" for
  5 seconds.

### M9. Comments, history, view-only links

Tasks:

- [x] CMT-01 comments on the server: tables, API, live notices, mentions, unread counts (after (a2afb2d)
  M6) [05 section 6]
- [x] CMT-02 comments in the editor: comment mode, pins on the map and the phone, the panel, (a44706a)
  threads, resolve, the bell, "Open questions" in `design.md` (after CMT-01) [04 section 15, 06
  section 3]
- [x] HIST-01 version history on the server: automatic and named versions, thinning, list, get, (b5f1a56)
  compare data, restore with "Before restore", export of a version (after M6) [05 section 7]
- [x] HIST-02 history in the editor: the panel, viewing a version, compare view, restore, "Name (4b782b2)
  this version", the export dialog's version choice (after HIST-01) [04 section 15]
- [x] VIEW-01 view-only links: tokens with expiry and revoke, the read-only live connection and (266c663, 1b6c83b, 4b494e0)
  media for a token, the `/v/<token>` page with map, phone, Try it and Export, the Share dialog
  section (after M6) [05 section 8]
- [x] DOC-M9 (Sonnet) fold the M9 notes (299b62c)

**Hand test:** two people comment on a button and mention each other; resolve it; name a
version, change three steps, compare, restore; send a view-only link to a phone and try the bot
there without an account; revoke it.

As built hand tests:

- CMT-01: Two people with the design open comment on a button; the other sees it within a second,
  and the bell shows it as unread until the Comments panel is opened.
- CMT-01: Mention the other person with "@": their bell marks the comment as mentioning them.
- CMT-01: Resolve the thread, then Reopen it; Settings > Activity lists "Commented" and "Resolved a
  comment" with the design.
- CMT-01: As a Viewer, comments can be read but not written; as the design owner, someone else's
  comment can be deleted but not edited.
- CMT-02: Open a design as its owner, press C (or "Comment"), click a box: the Comments panel opens
  with a box to write; type "@" and pick a person, then "Comment". A pin with 1 shows on the box.
- CMT-02: In comment mode click a button on the phone and a button's pill on the map: threads start
  on those buttons, with pins on the phone's button and on the box.
- CMT-02: In a second browser, signed in as the mentioned person, the bell shows a count with "@"
  within a second of the comment if the design is open, else within a minute; click the comment in
  the bell: the design opens with the panel on the thread, and the bell clears.
- CMT-02: "Resolve" the thread: its pin goes, it moves to "Resolved"; "Reopen" brings it back.
  Delete the step: the thread shows "On a deleted step: <title>".
- CMT-02: Export with "Include open comments": `design.md` lists the open threads under their steps
  as "Open questions".
- CMT-02: As a Viewer: no "Comment" button, C does nothing, the panel and the pins show.
- HIST-01: Open a design and edit for more than 10 minutes, or edit and close the tab: in the
  browser console, `await (await fetch('/api/designs/<id>/versions')).json()` lists "auto" versions.
- HIST-01: `await fetch('/api/designs/<id>/versions', { method: 'POST', headers: { 'Content-Type':
  'application/json' }, body: JSON.stringify({ name: 'v1 approved' }) })`, change three steps, then
  POST to `/api/designs/<id>/versions/<that id>/restore`: the open editor shows the old steps at
  once, and the list has "before_restore" and "restore" rows.
- HIST-01: Settings > Activity shows "Named a version" and "Restored a version".
- HIST-02: Open a design as an Editor, change a few steps, then "..." > "Name this version", type
  "v1 approved", "Save".
- HIST-02: Change two texts, delete a step and add one; "..." > "History": "v1 approved" is in bold
  at the top. Click it: the map and phone show the old steps, read-only, under "You are looking at
  v1 approved."
- HIST-02: "Compare with now": the added, removed and changed steps, with the old and new texts side
  by side. Close it and "Restore this version", "Restore": the design is back as it was, and a
  second browser on the same design shows the old steps and "This design was restored to an earlier
  version.".
- HIST-02: "Export": under "Version" pick "v1 approved" and export; spec.json has `"versionName":
  "v1 approved"`. Or keep "Now", type a name under "Name this version" and export: the name appears
  in History.
- VIEW-01: Open a design you own, "Share", under "View-only link" pick "7 days" and "Create link",
  then "Copy".
- VIEW-01: Open the link in a private window (no account): the map, the phone, "Try it", the
  language and look switches and "Export" work; nothing can be changed and nobody's name shows but
  the owner's.
- VIEW-01: Change a step in the editor: the private window shows the change within a second.
- VIEW-01: Back in "Share", the link shows "Last used just now"; press "Revoke": the private window
  shows "This link no longer works. Ask the person who sent it for a new one."
- VIEW-01: Settings, Activity lists "Made a view-only link" and "Revoked a view-only link".

### M10. Claude link

Tasks:

- [x] CL-01 links, keys and server export: Claude links per design, personal API keys, the (61a597d)
  `/api/link/<token>/...` routes with versions and languages, the server-side export cache per
  `doc_version`, the picture cache storage and serving (after HIST-01) [06 section 7]
- [x] CL-02 the MCP connector: `/mcp` with Streamable HTTP and bearer keys, the tools of 06 (3559330)
  section 7.2, activity rows (after CL-01) [06 section 7.2]
- [x] CL-03 Claude link in the web app: the Share dialog's Claude link section, API keys on (413c28f)
  the Account page with the connect instructions, uploading pictures on export, "Refresh
  pictures for Claude" (after CL-01, EXP-02) [06 section 7]
- [x] DOC-M10 (Sonnet) fold the M10 notes (c193a23)

**Hand test:** create a key, add xDesign to Claude Code with the shown command, ask Claude to
list the designs and summarize one; give a Claude link to a fresh Claude session and ask it to
plan the bot's code.

As built hand tests:

- CL-01: in a design's browser console as its owner: `await (await fetch('/api/designs/<id>/claude-links', { method: 'POST' })).json()` gives three addresses; open the `design.md` one in a private window: the design as Markdown, with "Pictures: export from xDesign to get them" in the summary.
- CL-01: open the `spec.json` address with `?languages=en` and with `?version=<a named version's name>`: the JSON of the export, the version's when asked.
- CL-01: Settings > Activity shows "Made a Claude link" and "A Claude link" rows "Read design.md".
- CL-01: revoke it with `fetch('/api/designs/<id>/claude-links/<link id>', { method: 'DELETE' })`: the addresses answer "This link was revoked or does not exist."
- CL-02: on the Account page, "API keys", "Create key" named "Claude Code" and copy the key and the "In Claude Code run:" line (in `make dev` the address is `http://localhost:5173/mcp`).
- CL-02: run that line in a terminal, start Claude Code and type `/mcp`: xdesign is connected with 8 tools.
- CL-02: ask Claude "List my xDesign designs", then "Read the design <name> and tell me what its first step shows": it calls `list_designs` and `get_doc` or `get_step`.
- CL-02: Settings > Activity shows "Used the API key Claude Code for list_designs" and the other tools, with the design.
- CL-02: revoke the key: Claude Code's next call fails.
- CL-03: open a design you own, "Share": under "Claude link" press "Create link"; three addresses show, each with "Copy". Open the design.md one in a private window: it ends its summary with "Pictures: export from xDesign to get them".
- CL-03: close Share, "Export" the design with pictures; open the design.md address again: the steps have picture lines, and a picture address opens the phone picture.
- CL-03: on Designs, a card's menu, "Refresh pictures for Claude": a toast counts the pictures, then says "Refreshed the pictures of <name> for Claude.".
- CL-03: Account page, "API keys": type "Claude Code on my laptop", "Create key"; the key shows once and the "In Claude Code run:" command holds it. "Revoke" removes it from the list.
- CL-03: back in "Share", the Claude link shows "Last used just now"; "Revoke" it and the private window's address answers that the link was revoked.

### M11. Templates and release 2.0

Tasks:

- [x] TPL-01 templates: four starter templates as fixture designs (shop with Stars, support (69e7182)
  desk, quiz, sign-up form) in English with a Persian version, validated by `make spec-check`;
  the gallery, "Use this template", "Save as template" (after M7, M8) [04 section 15]
- [x] TG-REFRESH (Sonnet) recheck the Telegram catalog against the current Bot API, list what (research, no catalog change)
  changed with sources; the lead folds it into the catalog and 08 [08]
- [x] DOC-M11 (Sonnet) fold the M11 notes and update `docs/user-guide.md` for stage 2 (6507fcd, 631babc (user guide))
- [ ] REL-02 release 2.0 (lead): `make sanity`, `./build.sh`, release notes, the owner's
  update test from 1.x

**Hand test:** start a design from the shop template, change the products, try it, export;
update the server from 1.x to 2.0 from the website.

As built hand tests:

- TPL-01: On Designs, click "New from template": the gallery shows four starter templates with
  pictures and descriptions. Click "Use this template" on "Shop with Stars": the editor opens a
  design "Shop with Stars" that is yours; change a product's price and name, try it in Try it (buy
  and pay with test Stars), export it.
- TPL-01: Open a design you own, "..." > "Save as template", type a description, "Save as template":
  the toast's "Templates" shows it under "This site's templates" with "Saved by <you>".
- TPL-01: Signed in as another member, the same template is in the gallery; "Use this template"
  makes their own copy. Only you and the site owner see "Remove" on it.
- TPL-01: Settings > Activity lists "Saved the design as the template ...", "Made the design from
  the starter template ..." and "Removed the template ...".

### M12. Flags and the installer like xWriter's (the owner's list of 2026-11-23)

The plan is `16-owner-list-2026-11-23.md`; built only on the owner's "start", before REL-01.

Tasks:

- [x] FLAG-01 a country flag before every language name in every list, menu, label, chip and (e176363)
  column: xWriter's `flag` codes in `languages.ts`, flag-icons with the generated CSS, the
  `LanguageFlag` component, the 13 places [16 section 3]
- [x] PATH-01 the site under a secret path in the server: `XD_BASE_PATH`, every route under it, (efb92d6)
  the empty page outside it, the cookie path, `index.html`'s base, `publicUrl` with port and
  path [16 section 4]
- [x] PATH-02 the web app under the path: every address built from the page's base (router, (ddb6446)
  API, live socket, media, links), the relative build, `make dev BASE_PATH=` [16 section 4]
- [x] GO-10a one HTTPS way: modes A and B removed (helper, Settings > HTTPS, uninstall), the (b15bc72, 3311f37)
  installer's "Site port" and "Web base path" questions, `--port`, `--base-path`,
  `config.toml`'s `base_path`, the summary and the end block [16 sections 5 and 6]
- [x] GO-10b the helper under the path: `XD_BASE_PATH` for the app, the front's empty page (07676b3)
  outside the path, port 80 without its redirect, health checks and status with the path (after
  GO-10a) [16 sections 4 and 5]
- [x] GO-11 `xdesign admin set-port` and `xdesign admin set-path PATH | --random` (after GO-10b) (2d544b8)
  [16 section 7]
- [x] BAK-LOCK (found by GO-11) root gives the backups' lock file to the service user, so the daily backup keeps working after `sudo xdesign backup` (7ceed3e)
- [x] DOC-M12 (Sonnet) fold the M12 notes: 07 sections 3, 4 and 7, 02's security notes, the user
  guide, "As built (M12)", status (0dd8d9a)

**Hand test:** 16 section 10: the flags everywhere; the site under a path with `make dev
BASE_PATH=...`; on a VM, the install's random port and path, the empty page outside it, and
moving the port and path with the commands.

### M13. HTTPS, two-factor sign-in, the site address, a theme switch and Claude with full access (the owner's second list of 2026-11-23)

The plan is `17-second-owner-list-2026-11-23.md`; built only on the owner's "start", before
REL-01.

Tasks:

- [x] SSL-01 the HTTPS card's error: the helper's bare `at` times in milliseconds (the HTTPS log, (60f97b7)
  the maintenance progress and result) and any other helper answer that does not match its
  schema; "Renew now" for a working Let's Encrypt certificate [17 sections 3 and 4]
- [x] SSL-02 the installer's "HTTPS certificate" question, `--https` and `--cloudflare-token`, (d0cb380)
  step 13 always built-in, the new step "certificate" that gets it through the control socket
  and reports it [17 section 5]
- [x] ADDR-01 the helper's maintenance request `address` and the control socket's `PUT /address`, (2721c58)
  run by the maintenance service with GO-11's change [17 section 6]
- [x] ADDR-02 `PUT /api/address` and the "Site address" card in Settings (beside ADDR-01, on the (378c574)
  control socket's contract) [17 section 6]
- [x] TFA-01 two-factor sign-in in the server: the migration, TOTP, recovery codes, the sign-in (5491abb)
  step, the routes, "Confirm it's you" with the code, the owner's reset, the server command
  `reset-2fa`, Activity [17 section 7]
- [x] TFA-02 two-factor sign-in in the web: the Account card and dialogs, the sign-in step, (3e6d62b)
  "Confirm it's you", the Members item (after TFA-01) [17 section 7]
- [x] GO-12 `xdesign admin reset-2fa`, and the front answering the OAuth metadata addresses with (800e7d8, 8347d6d)
  the path (after TFA-01) [17 sections 7 and 13.5]
- [x] THEME-01 the top bar's light and dark switch, saved for the person (after TFA-01) (583a2bd)
  [17 section 8]
- [x] FIX-01 the confirm before deleting a design; the Blue swatch and pill in Telegram's blue (b78a73c)
  [17 sections 9 and 10]
- [x] FIX-02 button labels take their direction from their first letter; the Android look's (39f02d9)
  Persian bold [17 sections 11 and 12]
- [x] MCP-01a the action list from the route table (summaries, areas, marks, the sanity check), (f37ccb4)
  the five action tools, routes run as the key's person, sessions, Activity's "via", the
  limits (after TFA-01 and ADDR-02) [17 sections 13.2 and 13.4]
- [x] MCP-02a opening a design as a person, `xdesign_edit_design` and the edits in the action (2cb2984)
  list [17 section 13.3]
- [x] MCP-01b "Ask first": elicitation, tickets, `ask_first` on keys, the switches on the Account (807120a)
  page and the Settings card (after MCP-01a and THEME-01) [17 section 13.4]
- [x] MCP-02b `xdesign_try_it`, `xdesign_upload_picture`, `xdesign_import_design`, the guide (241af67)
  (after MCP-01a and MCP-02a) [17 section 13.2]
- [x] MCP-03a OAuth for the Claude app and claude.ai in the server, the metadata outside the path, (48ef8e6)
  connected apps with "Ask first" (after MCP-01b) [17 section 13.5]
- [x] MCP-03b the "Allow" page and "Connected apps" in the web (after MCP-03a) (f109cd2)
  [17 sections 13.5 and 13.6]
- [x] DOC-M13 (Sonnet, split into DOC-M13a and DOC-M13b) fold the M13 notes: 07, 06, 04 and 05, the user guide, "As built (M13)", (2dcfcad, 39d3d6b)
  status

**Hand test:** 17 section 16: the delete confirm, the blue, right to left buttons and Android
bold, the theme switch, two-factor sign-in and Claude building a design on the desktop; the
HTTPS card, "Renew now", the site address, the two-factor reset command and the Claude app on
the owner's server; the certificate at install on a VM.

### M14. Usernames, the slow big design, the map's lines, Activity in pages and the HTTPS card (the owner's third list of 2026-11-23)

The plan is `18-third-owner-list-2026-11-23.md`; built only on the owner's "start".

Tasks:

- [x] USER-01a usernames in the server: the migration (`username`, no `email`, no invites and (2b002e8)
  resets), usernames made from Names at start with Activity, sign-in by username, the owner's
  username in `PATCH /api/me`, the app commands, the two-factor label [18 sections 3.1 to 3.3, 3.7]
- [x] USER-01b `addMember`, `setMemberPassword`, `changeUsername`, the invite and reset routes (9ab7df8)
  removed, the search, "People with access", Activity, the action list and the guide (after
  USER-01a) [18 sections 3.4, 3.6]
- [x] USER-02 usernames in the web: sign-in, Members and its dialogs, the Account page, the old (e966e10)
  links' pages, the Share search, the mention picker, the top bar (after USER-01b) [18 sections
  3.3 to 3.6]
- [x] USER-03 the installer's owner username and the `admin` commands' usernames [18 section 3.7] (b224f81)
- [x] PERF-01 the big design's slow open: boxes render once per change, batched measuring, menus (74f050c)
  mounted when first opened [18 section 4]
- [x] MAP-10 the selected step's lines bold with labels, the rest faded (after PERF-01) [18 (0f3c379)
  section 5.1]
- [x] MAP-11 short tags, "N come here", "Back", the Lines switch with `users.map_lines` (after (a5641ba)
  MAP-10 and USER-01a) [18 sections 5.2, 5.3]
- [x] ACT-01 Activity in pages with xWriter's pager [18 section 6] (436c2ce)
- [x] SSL-04 wildcard through Cloudflare and the HTTPS view's new fields [18 section 7.5] (folded into SSL-03, bd82788)
- [x] SSL-03 the HTTPS card in xmtp-panel's look: the row, the Issue and Upload windows, Remove (bd82788)
  (after SSL-04) [18 sections 7.1 to 7.4]
- [x] DOC-M14 (Sonnet, split into DOC-M14a and DOC-M14b) fold the M14 notes: 05, 04, 07, the user guide, "As built (M14)", status (1a1b97e, b3c5625)

**Hand test:** 18 section 13, 1 to 6: usernames, Add member and Set password, the big design
opening, the map's lines, Activity's pages and the HTTPS card on the owner's server; the
installer's username on a VM.

### M15. The Windows server and `build.sh`'s platform menu (the owner's third list of 2026-11-23)

The plan is `18-third-owner-list-2026-11-23.md` section 8 and 10; built only on the owner's
"start", in waves with M14 and M16.

Tasks:

- [x] BUILD-01 `build.sh`'s menu (what to build, server systems, desktop systems, CPUs) and flags, (3532094)
  `make release` [18 section 10]
- [x] WIN-01 the helper's build tags and `internal/platform`, `make helper-check` for Windows [18 (9fe4fd5)
  section 8.8]
- [x] WIN-02 the app channel on Windows: loopback ports and secrets, the job object, stopping by (0dd4bbe)
  standard input, in the helper and the server (after WIN-01) [18 section 8.2]
- [x] WIN-03 `serve` as a Windows service, the log files and `xdesign logs`, the daily backup in (fbb7c55)
  `serve` (after WIN-01) [18 section 8.2]
- [x] WIN-06 backups, restore and `status` on Windows (after WIN-01) [18 section 8.5] (2ab78c6)
- [x] WIN-04 the installer and `--uninstall` on Windows (after WIN-02 and WIN-03) [18 sections (0bc41f1, e9cd324)
  8.3, 8.7]
- [x] WIN-05 the maintenance service, updates, the junction switch, the guard, rollback and the (442743d, 297c556)
  address and domain moves on Windows; the "System" check row (after WIN-04) [18 sections 8.6,
  8.7]
- [x] WIN-07 the Windows server target in `build.sh` (after BUILD-01 and WIN-01) [18 section 10] (197470f)
- [x] DOC-M15 (Sonnet) fold the M15 notes: 07's Windows part, the user guide, "As built (M15)", (2dfc79e, 810e6f7)
  status

**Hand test:** 18 section 13, 7: install, restart, backup, update, rollback, logs and uninstall
on Windows Server 2022 and Windows 11 (O-03).

### M16. The desktop app (the owner's third list of 2026-11-23)

The plan is `18-third-owner-list-2026-11-23.md` section 9 and 10; built only on the owner's
"start", in waves with M14 and M15.

Tasks:

- [x] DESK-01 the server's desktop mode: the one person, the key and `/api/desktop/enter`, the (23ec6b8)
  refused routes, `mode`, the port [18 sections 9.3, 9.6]
- [x] DESK-02 the desktop backups in the server (after DESK-01) [18 section 9.5] (14c49de)
- [x] DESK-03 desktop mode in the web: what it hides, the Account page, the Backups page, the (4d54037)
  Claude card's address (after DESK-01 and DESK-02) [18 sections 9.4 to 9.6]
- [x] DESK-04 the Electron shell in `apps/desktop` (after DESK-01) [18 sections 9.2, 9.7] (3a24f91)
- [x] DESK-05 the desktop targets in `build.sh`: electron-builder, the portable exe, the AppImage, (46499ed)
  the macOS zip (after BUILD-01 and DESK-04) [18 section 10]
- [x] DOC-M16 (Sonnet) fold the M16 notes: 02, 07, 04, the user guide's desktop chapter, D-01's (9bb9a8f, 58c109a)
  note, "As built (M16)", status

**Hand test:** 18 section 13, 8 and 9: the portable exe on Windows 11, the AppImage on the
desktop, the Mac zip if a Mac is at hand (O-04).

### M17. Uninstall from the panel (the owner's request of 2026-11-24)

The plan is `19-uninstall-2026-11-24.md`; started at once on the owner's request.

Tasks:

- [x] UNINST-01 (c1a96a6) the helper: the uninstall request from the panel and its detached run on
  Linux and Windows; xDesign in Windows' list of installed apps; `--uninstall` asking for
  Administrator on Windows [19 sections 3, 5]
- [x] UNINST-02 (15a7165) Maintenance > "Uninstall xDesign": the route, the server, the card,
  Activity [19 section 4]
- [x] DOC-M17 (Sonnet) fold the M17 notes: "As built (M17)", 07's uninstall, the user guide, status
  (292ef14)

**Hand test:** 19 section 7.

### M18. A setup file for the Windows desktop app (the owner's request of 2026-11-24)

The plan is `20-desktop-setup-2026-11-24.md`; started at once on the owner's request.

Tasks:

- [x] SETUP-01 (fb9bd8a) `build.sh` makes the Windows desktop app as a portable file, a setup file or both:
  the menu question, `--windows-desktop`, `WINDOWS_DESKTOP`, electron-builder's NSIS target with
  Wine, the uninstaller's question, the proof [20 sections 2 to 4]
- [x] DOC-M18 (Sonnet) fold the M18 notes: "As built (M18)", 18 sections 9.7 and 10, the user
  guide, status (1fccbf0)

**Hand test:** 20 section 6.

## 4. Waves and agents

The lead plans the waves at build time (claude_optimized_xhigh.md section 8.2); this is the
expected order for stage 1, at most 8 agents at once:

| Wave | Tasks |
|---|---|
| 1 | FND-01, TG-00 (Sonnet) |
| 2 | TG-01, SPEC-01, SRV-01, GO-01 |
| 3 | SPEC-02, SPEC-04, AUTH-01, MEDIA-01, WEB-01, PRV-01, GO-02, GO-04 |
| 4 | SPEC-03, SPEC-05, AUTH-02, PRV-02, TRY-01, GO-03, GO-05 |
| 5 | SPEC-06, LIVE-01, WEB-02, EXP-01, GO-06, GO-07 |
| 6 | EDIT-01, GO-08 |
| 7 | MAP-01, TXT-01, MSG-01, WEB-03 |
| 8 | MAP-02, BTN-01, LOGIC-01, START-01, LANG-01 |
| 9 | PARTS-01, CHK-01, EXP-02, TRY-02 |

Files several agents of one wave touch (named in their briefs): `packages/api` route list
(SRV-01 declares all stage 1 routes so later agents only implement), the editor's phone slots
(PRV-02 defines them; TXT-01, BTN-01 and MSG-01 each own one slot file), the map's box
renderers (MAP-01 defines one file per kind; LOGIC-01 and START-01 fill theirs), the palette
list (MAP-01).

**Agent count.** Stage 1: 41 Opus coding runs (32 for the website, 9 for the Go helper and
its pages), 7 Sonnet runs (TG-00 and six DOC-Mn), and a few Sonnet lookups; with the usual
PARTIAL continuations (most likely in GO-05 and GO-08, the biggest copies) about 46 to 50 Opus
runs. M12: 6 Opus coding runs and 1 Sonnet run. M13: 16 Opus coding runs (no continuations) and 2 Sonnet runs. M14 to M16 (18 section 12): 23 Opus coding runs and 3 Sonnet runs, about 26 to 29 Opus runs with continuations. Stage 2: 15 Opus
coding runs and 6 Sonnet runs (TG-REFRESH and five DOC-Mn); about 17 to 19 Opus runs in all.
