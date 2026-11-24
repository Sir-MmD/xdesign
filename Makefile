# xDesign Make targets (docs/plan/02-architecture.md section 10 and docs/plan/14-milestones.md
# section 1). Run `make` or `make help` for the list.
#
# Later tasks extend two lists below: GEN_STEPS with GEN_OUTPUTS (make gen and its drift check)
# and SANITY_STEPS (the checks of make sanity, in order).

SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help
.DELETE_ON_ERROR:
MAKEFLAGS += --no-builtin-rules --no-print-directory

# The pinned tools (make setup-tools) come first, then the workspace's own (tsc, eslint, prettier, tsr).
TOOLS_BIN := $(CURDIR)/.tools/bin
export PATH := $(TOOLS_BIN):$(CURDIR)/node_modules/.bin:$(PATH)

# Scratch files (make sanity's copies, the tools' own) stay out of the small /tmp.
export TMPDIR := $(or $(XDG_CACHE_HOME),$(HOME)/.cache)/xdesign/tmp
$(shell mkdir -p '$(TMPDIR)')

# The Go helper (helper/). -trimpath, as in xWriter's slot script, keeps the folder out of the
# action IDs, so every worktree shares the one Go build cache (~/.cache/go-build) instead of
# compiling everything again; the go command's own scratch files stay on disk too.
export GOFLAGS := -mod=readonly -trimpath
export GOTMPDIR := $(or $(XDG_CACHE_HOME),$(HOME)/.cache)/xdesign/gotmp
$(shell mkdir -p '$(GOTMPDIR)')

.PHONY: help
help: ## Show this list
	@awk 'BEGIN {FS = ":.*## "} /^##@/ {printf "\n%s\n", substr($$0, 5)} /^[a-zA-Z0-9_.-]+:.*## / {printf "  %-16s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

##@ Setup

.PHONY: setup-tools
setup-tools: ## Put the pinned pnpm shim and golangci-lint (SHA-256 checked) into .tools/bin
	tools/setup/install-tools.sh

.PHONY: install
install: ## Install the dependencies exactly as the lockfile pins them
	pnpm install --frozen-lockfile

##@ Development

# Both programs run in the background of one shell: a Ctrl+C (or either one stopping) stops both.
# BASE_PATH (docs/plan/16 section 4) serves the whole site under a web base path, as an install
# does: the server gets it as XD_BASE_PATH, Vite as BASE_PATH (apps/web/vite.config.ts).
BASE_PATH ?= /
.PHONY: dev
dev: ## The server (tsx watch, http://localhost:5174, data in .dev/data) and Vite (http://localhost:5173) together; BASE_PATH=/k3v9x2m1q8wz7r4t/ puts the site under that path
	@mkdir -p .dev/data
	@(cd apps/server && XD_DATA_DIR='$(CURDIR)/.dev/data' XD_DEV=1 XD_BASE_PATH='$(BASE_PATH)' exec node_modules/.bin/tsx watch --clear-screen=false src/main.ts) & server=$$!; \
	(cd apps/web && BASE_PATH='$(BASE_PATH)' exec node_modules/.bin/vite) & web=$$!; \
	trap 'kill $$server $$web 2>/dev/null || true; wait' INT TERM EXIT; \
	wait -n || true

# The keys of `xdesign version --json` that a dev build stamps (docs/plan/07 section 2): the
# version 0.0.0-dev+<commit> (.dirty for uncommitted changes), the commit, its time as the
# build date, and the CPU. They expand only when the helper is built.
HELPER_BUILDINFO = github.com/Sir-MmD/xdesign/helper/internal/buildinfo
HELPER_COMMIT    = $(shell git rev-parse HEAD)
HELPER_VERSION   = 0.0.0-dev+$(shell git rev-parse --short=12 HEAD)$(shell test -z "$$(git status --porcelain)" || echo .dirty)
HELPER_BUILT_AT  = $(shell date -u -d "@$$(git log -1 --format=%ct)" +%Y-%m-%dT%H:%M:%SZ)
# -w drops the DWARF data only: internal/release reads the stamped keys of a file from its
# symbol table, so no build strips it (-s).
HELPER_LDFLAGS   = -w -X $(HELPER_BUILDINFO).Version=$(HELPER_VERSION) -X $(HELPER_BUILDINFO).Commit=$(HELPER_COMMIT) \
	-X $(HELPER_BUILDINFO).BuiltAt=$(HELPER_BUILT_AT) -X $(HELPER_BUILDINFO).Arch=$(shell go env GOARCH)

.PHONY: helper
helper: ## The Go helper with the version keys stamped, into dist/dev/xdesign (no payload yet)
	@mkdir -p dist/dev
	cd helper && CGO_ENABLED=0 go build -trimpath -ldflags "$(HELPER_LDFLAGS)" -o ../dist/dev/xdesign ./cmd/xdesign

##@ Generated files

# make gen runs GEN_STEPS in order. GEN_OUTPUTS names every file or folder they write: the outputs
# are committed, and make sanity's drift check (gen-check) compares them with a fresh make gen.
# A new generator adds its target to GEN_STEPS and its outputs to GEN_OUTPUTS.
GEN_STEPS   := gen-routes gen-migrations gen-schema gen-guide gen-flags
GEN_OUTPUTS := apps/web/src/routeTree.gen.ts apps/server/migrations packages/spec/schema/bot-spec.v1.schema.json \
               packages/spec/src/markdown/how-to-read.gen.ts apps/web/src/styles/flags.gen.css

.PHONY: gen
gen: $(GEN_STEPS) ## Regenerate every generated file (they are committed)

# The CLI loads the same @tanstack/router-generator as the Vite plugin, with the options of
# apps/web/tsr.config.json, so both write the same file. NODE_NO_WARNINGS hides a harmless
# warning of the CLI about a circular import.
.PHONY: gen-routes
gen-routes: ## The TanStack Router route tree, apps/web/src/routeTree.gen.ts
	cd apps/web && NODE_NO_WARNINGS=1 tsr generate

# drizzle-kit compares apps/server/src/db/schema.ts with the last snapshot in migrations/meta and
# writes a new migration only when they differ (apps/server/drizzle.config.ts).
.PHONY: gen-migrations
gen-migrations: ## The Drizzle migrations of the database schema, apps/server/migrations
	cd apps/server && node_modules/.bin/drizzle-kit generate

# Zod 4's own JSON Schema of SpecSchema (packages/spec/src/export/schema.ts), which every export
# copies as bot-spec.schema.json. Plain node, as pnpm refuses gen-check's linked node_modules.
.PHONY: gen-schema
gen-schema: ## The JSON Schema of spec.json version 1, packages/spec/schema/bot-spec.v1.schema.json
	cd packages/spec && node scripts/gen-schema.ts > schema/bot-spec.v1.schema.json

# HOW-TO-READ.md as the string HOW_TO_READ, which every export copies without reading files.
.PHONY: gen-guide
gen-guide: ## The builders' guide as a module, packages/spec/src/markdown/how-to-read.gen.ts
	cd packages/spec && node scripts/gen-guide.ts < docs/HOW-TO-READ.md > src/markdown/how-to-read.gen.ts

# The flag-icons rules of the flags the language list uses (each language's `flag`), not of all
# of them, as xWriter's tools/gen-languages (FLAG-01). Plain node, as gen-schema.
.PHONY: gen-flags
gen-flags: ## The language flags' stylesheet, apps/web/src/styles/flags.gen.css
	cd apps/web && node scripts/gen-flags.ts > src/styles/flags.gen.css

.PHONY: icons
icons: ## Every icon file from the logo apps/desktop/build/icon.svg (the desktop app's, the browser's, the Windows server file's); needs rsvg-convert, icotool and llvm-windres
	tools/icons.sh

##@ Build

.PHONY: build
build: build-web build-server build-desktop ## The SPA (apps/web/dist), the server bundles (apps/server/dist) and the desktop app's main process (apps/desktop/dist)

.PHONY: build-web
build-web: ## The SPA with Vite, into apps/web/dist
	pnpm --filter @xdesign/web run build

.PHONY: build-server
build-server: ## The server and command bundles with esbuild (dist/server.mjs, dist/cli.mjs, dist/migrations)
	pnpm --filter @xdesign/server run build

# The Electron shell only; the desktop files themselves come from build.sh (docs/plan/18 section 10).
.PHONY: build-desktop
build-desktop: ## The desktop app's main process with esbuild (apps/desktop/dist/main.mjs)
	pnpm --filter @xdesign/desktop run build

##@ Release

# The release build of docs/plan/07 section 2 and docs/plan/18 section 10 without build.sh's
# menu: VERSION (for example 1.0.0), SERVERS ("linux" by default; linux, windows, both as
# "linux windows", or none), DESKTOPS ("none" by default; windows, linux, macos, several with
# spaces), WINDOWS_DESKTOP ("portable" by default; installer, the setup file of docs/plan/20,
# which needs Wine, or both) and ARCHES ("amd64 arm64" by default, or one of them). build.sh
# refuses a working tree with uncommitted changes unless ALLOW_DIRTY=1.
.PHONY: release
release: ## The release files into dist/, ./build.sh without the menu (VERSION=1.0.0 SERVERS=linux DESKTOPS=none WINDOWS_DESKTOP=portable ARCHES="amd64 arm64"; ALLOW_DIRTY=1)
	@test -n '$(VERSION)' || { echo 'make release: set VERSION, for example: VERSION=1.0.0 ARCHES="amd64 arm64" make release' >&2; exit 2; }
	ALLOW_DIRTY='$(ALLOW_DIRTY)' ./build.sh --version '$(VERSION)' --servers '$(or $(SERVERS),linux)' \
		--desktops '$(or $(DESKTOPS),none)' --windows-desktop '$(or $(WINDOWS_DESKTOP),portable)' \
		--arches '$(or $(ARCHES),amd64 arm64)'

##@ Checks

# The checks of make sanity, in order (docs/plan/14-milestones.md section 1). Each is a target
# of its own, so `make <step>` runs one alone. A new check adds its target here.
SANITY_STEPS := typecheck lint build start-check gen-check spec-check catalog-check helper-check em-dash-check

.PHONY: sanity
sanity: ## The only check: SANITY_STEPS in order, one line when all pass (logs in .dev/gate/latest/)
	@tools/sanity/sanity.sh $(SANITY_STEPS)

# tsc -b over a fresh worktree's empty cache runs out of Node's default heap (about 2 GB): it gets
# 4 GB, or the larger heap NODE_OPTIONS already asks for (the last --max-old-space-size wins).
.PHONY: typecheck
typecheck: ## tsc -b over every package and app
	@heap=$$(grep -o -e '--max[-_]old[-_]space[-_]size=[0-9]*' <<<"$${NODE_OPTIONS-}" | tail -n 1 | cut -d= -f2 || true); \
	(( $${heap:-0} > 4096 )) || heap=4096; \
	NODE_OPTIONS="$${NODE_OPTIONS-} --max-old-space-size=$$heap" tsc -b

# make sanity in an agent's worktree sets LINT_CHANGED=1 and CHANGED_FILES (the files that differ
# from main, committed or not); ESLint and Prettier then look only at those. Otherwise, and on
# main, they check the whole repository.
ifeq ($(LINT_CHANGED),1)
ESLINT_FILES   := $(filter %.js %.mjs %.cjs %.ts %.tsx,$(CHANGED_FILES))
PRETTIER_FILES := $(CHANGED_FILES)
else
ESLINT_FILES   := .
PRETTIER_FILES := .
endif

.PHONY: lint
lint: ## ESLint and the Prettier check
	$(if $(ESLINT_FILES),eslint --max-warnings 0 --no-warn-ignored $(ESLINT_FILES),@echo "lint: no changed JavaScript or TypeScript files")
	$(if $(PRETTIER_FILES),prettier --check --ignore-unknown $(PRETTIER_FILES),@echo "lint: no changed files")

.PHONY: start-check
start-check: ## Start the built server bundle as a server and in desktop mode; GET /api/health answers 200
	tools/sanity/start-check.sh

.PHONY: gen-check
gen-check: ## Run make gen in a temporary copy and compare GEN_OUTPUTS with the files here
	tools/sanity/gen-check.sh $(GEN_OUTPUTS)

.PHONY: spec-check
spec-check: ## Every fixture design validates, its checks run, export then import gives an equal model
	pnpm --filter @xdesign/spec run spec-check

.PHONY: catalog-check
catalog-check: ## Every row of the Telegram catalog has a source URL and a Bot API version
	pnpm --filter @xdesign/spec run catalog-check

# make sanity skips this step while helper/ does not exist, and in a worktree when nothing under
# helper/ differs from main. The helper runs on Linux and Windows, on amd64 and arm64
# (docs/plan/18-third-owner-list-2026-11-23.md section 8.8): go build and go vet run for the
# four, golangci-lint for each system (its findings do not depend on the CPU).
HELPER_TARGETS := linux/amd64 linux/arm64 windows/amd64 windows/arm64

.PHONY: helper-check
helper-check: ## go build and go vet in helper/ for Linux and Windows on both CPUs, golangci-lint for both systems
	cd helper && for t in $(HELPER_TARGETS); do \
		GOOS=$${t%/*} GOARCH=$${t#*/} go build ./... && GOOS=$${t%/*} GOARCH=$${t#*/} go vet ./... || exit 1; \
	done && GOOS=linux golangci-lint run ./... && GOOS=windows golangci-lint run ./...

# The character is written as its UTF-8 bytes, so this file does not contain it.
EM_DASH := $(shell printf '\342\200\224')

.PHONY: em-dash-check
em-dash-check: ## No em-dash (U+2014) in any tracked or new text file
	@status=0; git grep -I -n --untracked -e '$(EM_DASH)' || status=$$?; \
	case $$status in \
	0) echo "em-dash-check: the lines above contain an em-dash (U+2014); rephrase them"; exit 1 ;; \
	1) echo "em-dash-check: none found" ;; \
	*) exit $$status ;; \
	esac
