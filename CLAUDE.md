# xDesign

A private website to design Telegram bots without code (codename `xdesign`). The plan is in
`docs/plan/` (start at its README); where the build stands is `docs/status.md` (the lead reads
it, agents do not need it).

## Layout

- `packages/spec`: the design model (Zod), Yjs document layout and accessors, ID names, texts
  to Telegram, checks, the Try it engine, export and import, the Telegram catalog. Runs in the
  browser and in Node: no browser-only or Node-only imports.
- `packages/api`: the API contract (every route with its Zod schemas and role).
- `packages/preview`: the Telegram phone, ported from xWriter's preview (React only).
- `apps/web`: the SPA (Vite, React 19, TanStack Router and Query, Base UI, Tailwind 4).
- `apps/server`: Fastify and Hocuspocus, SQLite with Drizzle, the app's commands.
- `helper/`: the Go helper `xdesign` (install, update, backups, HTTPS front), copied from
  xWriter and xmtp-panel (docs/plan/07 section 10).
- `tools/`: setup, sanity runner, release. `.dev/`: git-ignored scratch (briefs, notes, logs).

## Commands

- `make setup-tools`: pinned pnpm shim and golangci-lint into `.tools/bin` (on PATH in make).
- `make dev`: server and Vite on localhost (data in `.dev/data/`).
- `make gen`: generated files (migrations, export JSON Schema, route tree).
- `make sanity`: the only check; run it before every commit (after `make gen` when the schema,
  the export format or the routes changed). It prints one line when everything passes.

## Rules

- No em-dash (U+2014) anywhere: code, comments, texts, docs, commit messages.
- Interface texts in English exactly as written in the plan documents.
- Follow the style, naming and comment density of the code around you.
- No test suites or test tools; `make sanity` is the only check.
- Git: commits by `Sir-MmD <27060102+Sir-MmD@users.noreply.github.com>` (set in the repo
  config); no attribution lines of any kind; never push; never rewrite history on main.
- Never use sudo or run anything as root; never run the installer or an update on this desktop.

## Compact instructions

A summary must keep: the build name and wave, which agents run (task IDs) and which are merged
(commit hashes), the paths of briefs (`.dev/<build>/briefs/`), notes (`.dev/<build>/notes/`)
and the lead notes (`.dev/<build>/lead-notes.md`), open decisions, and the owner's last words.
After a compaction, re-read your brief (agents) or the lead notes (lead) before going on.
