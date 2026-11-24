#!/usr/bin/env bash
#
# build.sh - build the xDesign release into dist/ (docs/plan/07-server-install-update.md
# section 2, docs/plan/18-third-owner-list-2026-11-23.md section 10), with output themed to
# look like Arch Linux's pacman / makepkg. Copied from xmtp-panel's build.sh, with the release
# checks of xWriter's tools/release/release.sh.
#
# It builds the chosen servers and desktop apps for each chosen CPU. The Linux server of a CPU
# is dist/xdesign-<version>-linux-<arch>, the single self-installing file, and
# dist/xdesign-<version>-linux-<arch>.tar.gz, the same file alone in a reproducible tar. The
# Windows server of a CPU is dist/xdesign-<version>-windows-<arch>.exe, the same single file
# for Windows, and dist/xdesign-<version>-windows-<arch>.zip, the file alone in a reproducible
# zip. The desktop app of a system and CPU is one file made by electron-builder (apps/desktop):
# dist/xdesign-desktop-<version>-windows-<arch>.exe (portable), -linux-<arch>.AppImage, or
# -macos-<arch>.zip holding xDesign.app signed ad hoc with rcodesign; for Windows the setup
# file dist/xdesign-desktop-<version>-windows-<arch>-setup.exe in its place or beside it
# (docs/plan/20-desktop-setup-2026-11-24.md), whose uninstaller electron-builder makes with Wine.
# Then dist/SHA256SUMS over every release file (signed into SHA256SUMS.sig when a signing key
# is set up) and dist/release-notes-<version>.md from docs/release-notes-template.md.
#
# Steps:
#   1. Checks   : the tools, a clean working tree (ALLOW_DIRTY=1 builds from uncommitted
#                 changes), the version, what to build, the CPUs, tools/release/node.env and
#                 compat.env, what each chosen build needs
#   2. Website  : pnpm install, make build -> apps/web/dist, apps/server/dist
#   then for each CPU of the Linux server:
#   3. Node.js  : the pinned official build from nodejs.org (tools/release/node.env), cached
#                 in .dev/cache/node/ and checked against its pinned SHA-256
#   4. Payload  : runtime/node and app/ (the bundles, the SPA, the migrations, the prebuilt
#                 native modules for the CPU, LICENSES/) -> dist/build/payload-<arch>.tar.zst
#   5. Helper   : go build -tags payload with the payload embedded (CGO_ENABLED=0, -trimpath,
#                 -ldflags "-w -X ...", never -s) -> dist/xdesign-<version>-linux-<arch>
#   6. Tarball  : the file alone, mode 0755, reproducible -> dist/xdesign-<version>-linux-<arch>.tar.gz
#   then for each CPU of the Windows server, the same with Node's Windows build
#   (node-<version>-win-<cpu>.zip: runtime/node.exe), the Windows native modules
#   (dist/build/payload-windows-<arch>.tar.zst), GOOS=windows
#   (dist/xdesign-<version>-windows-<arch>.exe) and a zip in place of the tarball
#   (dist/xdesign-<version>-windows-<arch>.zip); then the desktop app of each chosen system and
#   CPU: Node.js's official build for them and app/ as above in dist/build/desktop-<system>-<arch>/,
#   electron-builder with Electron (cached in .dev/cache/electron/, checked against electron's
#   checksums.json) around them once per file (for Windows the portable file, the setup file or
#   both), for macOS rcodesign's ad hoc signature and a zip; and once:
#   7. Sums     : dist/SHA256SUMS over every release file; SHA256SUMS.sig with .dev/release-signing-key
#   8. Notes    : dist/release-notes-<version>.md
#   9. Proof    : SHA256SUMS, then each release file's own proof: each tar.gz and zip holds
#                 exactly its file; on this computer's CPU the Linux file runs version --json,
#                 and release-files writes the payload it was built with; the Windows file,
#                 which cannot run here, is read: its PE header, the payload it holds byte for
#                 byte, and in that payload node.exe and the native modules for Windows; a
#                 desktop file is unpacked, not run: its header, Electron's program, the runtime
#                 and the app of its system and CPU, the version, for the setup file its app
#                 package and its uninstaller, for macOS rcodesign verify
#
# Usage: ./build.sh [--version <ver>] [--servers <systems>] [--desktops <systems>]
#                   [--windows-desktop <files>] [--arches <cpus>] [-h|--help]
#
# Run in a terminal without options, it asks the version, what to build, the systems, the
# Windows desktop file and the CPUs (the menu); make release passes them all (VERSION, SERVERS,
# DESKTOPS, WINDOWS_DESKTOP, ARCHES) and runs it without the menu.

set -euo pipefail
export LC_ALL=C

# ---------------------------------------------------------------------------
# Resolve the repo root from this script's own location, then work from there
# (so the script runs correctly no matter the caller's current directory).
# ---------------------------------------------------------------------------
SCRIPT_SOURCE="${BASH_SOURCE[0]}"
ROOT="$(cd "$(dirname "$SCRIPT_SOURCE")" >/dev/null 2>&1 && pwd)"
cd "$ROOT"

# The same tools and scratch folders as the Makefile: the pinned pnpm shim first on PATH,
# scratch files out of the small /tmp.
export PATH="$ROOT/.tools/bin:$PATH"
export TMPDIR="${XDG_CACHE_HOME:-$HOME/.cache}/xdesign/tmp"
export GOTMPDIR="${XDG_CACHE_HOME:-$HOME/.cache}/xdesign/gotmp"
mkdir -p "$TMPDIR" "$GOTMPDIR"

# ---------------------------------------------------------------------------
# Configuration / defaults (declared up front for `set -u` safety).
# ---------------------------------------------------------------------------
BUILDINFO="github.com/Sir-MmD/xdesign/helper/internal/buildinfo"
DIST="$ROOT/dist"
# The payloads and the scratch folders of the checks; never shipped.
STAGE="$DIST/build"
CACHE="$ROOT/.dev/cache"
# build.sh copies the payload of each CPU here before go build -tags payload (git-ignored).
PAYLOAD_EMBED="$ROOT/helper/internal/payload/payload.tar.zst"
SIGNING_KEY="$ROOT/.dev/release-signing-key"
SIG_NAMESPACE="xdesign-release"
# The versions of buildinfo.ParseVersion: X.Y.Z with an optional pre-release and build.
SEMVER_RE='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$'
XYZ_RE='^[0-9]+\.[0-9]+\.[0-9]+$'

VERSION_OVERRIDE=""
SERVERS_OVERRIDE=""
DESKTOPS_OVERRIDE=""
WINDOWS_DESKTOP_OVERRIDE=""
ARCHES_OVERRIDE=""
VER=""
# What to build: the server systems (in the order linux windows), the desktop app's systems
# (in the order windows linux macos), the Windows desktop app's files (in the order portable
# installer, docs/plan/20 section 3) and the CPUs (amd64 arm64). CHOICE is the menu's answer.
SERVERS=()
DESKTOPS=()
WINDOWS_FILES=()
ARCHES=()
CHOICE=""
HOST_ARCH=""
COMMIT=""
BUILT_AT=""
SOURCE_DATE_EPOCH=""
GO_VERSION=""
MODIFIED=false
NODE_VERSION=""
MIN_UPGRADE_FROM=""
SCHEMA_FLOOR=""
SIGNING=0
PUBLIC_KEY=""
# The release files in dist/, in build order (add_release_file): each one's kind (file, or pack
# for a release file alone in a .tar.gz or .zip), its word in the summary and its proof.
RELEASE_FILES=()
declare -A FILE_KIND=()
declare -A FILE_LABEL=()
declare -A FILE_PROOF=()
# The payloads for the release notes, one "<system>-<cpu> `<SHA-256>`" each; PAYLOAD_SUM holds
# each server's by the name of its scratch files (server_key: amd64 for the Linux server,
# windows-amd64 for the Windows one).
PAYLOAD_NOTES=()
declare -A PAYLOAD_SUM=()
# The phases of one build for one CPU (the progress bar's step count): its build function
# calls advance exactly this many times. The Windows desktop app's is the staging and one per
# file, set by resolve_targets once the files are known.
declare -A BUILD_PHASES=(
  [server-linux]=3 [server-windows]=3
  [desktop-windows]=2 [desktop-linux]=2 [desktop-macos]=3
)
# The desktop app (apps/desktop): its folder, Electron's version as pnpm installed it (read by
# check_desktop), the macOS signing tool's pins (tools/release/desktop.env) and the path of
# rcodesign once fetched.
DESKTOP="$ROOT/apps/desktop"
# Wine's own folder (WINEPREFIX) for the setup file's uninstaller, never the owner's ~/.wine.
WINE_PREFIX="$CACHE/wine"
ELECTRON_VERSION=""
RCODESIGN_VERSION=""
RCODESIGN=""
# A file being written under a temporary name, removed by the exit trap when the build stops.
PART_FILE=""

# Progress-bar state.
USE_COLOR=false
BAR_ACTIVE=0
PHASE=0
PHASE_TOTAL=10
CUR_LABEL=""

# ANSI codes live in variables so turning color off is a single clean toggle.
BOLD=""
RESET=""
C_BLUE=""
C_GREEN=""
C_RED=""
C_YELLOW=""

# ---------------------------------------------------------------------------
# Color setup: only when stdout is a TTY and NO_COLOR is unset.
# ---------------------------------------------------------------------------
setup_colors() {
  if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
    USE_COLOR=true
    BOLD=$'\033[1m'
    RESET=$'\033[0m'
    C_BLUE=$'\033[34m'
    C_GREEN=$'\033[32m'
    C_RED=$'\033[31m'
    C_YELLOW=$'\033[33m'
  else
    USE_COLOR=false
    BOLD=""
    RESET=""
    C_BLUE=""
    C_GREEN=""
    C_RED=""
    C_YELLOW=""
  fi
}

# ---------------------------------------------------------------------------
# Progress bar (pacman style): a left-aligned label, a [####----] bar and a
# right-aligned NN%, redrawn in place on one line with \r. Text lines printed
# by emit() scroll above it so the bar behaves like a sticky footer.
# When color/TTY is off we print a plain per-phase line instead.
# ---------------------------------------------------------------------------
render_bar() {
  local cols pct pct_str bar_w filled empty fill_str empty_str
  cols=$(tput cols 2>/dev/null || echo 80)
  [[ "$cols" =~ ^[0-9]+$ ]] || cols=80

  pct=$(( PHASE * 100 / PHASE_TOTAL ))
  printf -v pct_str '%3d%%' "$pct"

  local label_w=26
  # bar width = total - label - percent - (space + '[' + ']' + space).
  bar_w=$(( cols - label_w - ${#pct_str} - 4 ))
  (( bar_w < 8 )) && bar_w=8

  filled=$(( bar_w * pct / 100 ))
  (( filled > bar_w )) && filled=$bar_w
  empty=$(( bar_w - filled ))

  printf -v fill_str '%*s' "$filled" ''
  fill_str=${fill_str// /#}
  printf -v empty_str '%*s' "$empty" ''
  empty_str=${empty_str// /-}

  printf '\r%b%-*.*s%b [%b%s%b%s] %s\033[K' \
    "$BOLD" "$label_w" "$label_w" "$CUR_LABEL" "$RESET" \
    "$C_GREEN" "$fill_str" "$RESET" "$empty_str" "$pct_str"
  BAR_ACTIVE=1
}

# Move to the next phase and repaint (or, without color, print a plain line).
advance() {
  CUR_LABEL="$1"
  PHASE=$(( PHASE + 1 ))
  (( PHASE > PHASE_TOTAL )) && PHASE=$PHASE_TOTAL
  if [[ "$USE_COLOR" == true ]]; then
    render_bar
  else
    printf '(%d/%d) %s\n' "$PHASE" "$PHASE_TOTAL" "$CUR_LABEL"
  fi
}

# Erase the bar without repainting (used before running noisy sub-commands so
# their output starts on a clean line).
hide_bar() {
  if [[ "$USE_COLOR" == true && "$BAR_ACTIVE" -eq 1 ]]; then
    printf '\r\033[K'
    BAR_ACTIVE=0
  fi
}

# Close out the bar line for good (leave it on screen, drop to a fresh line).
finish_bar() {
  if [[ "$USE_COLOR" == true && "$BAR_ACTIVE" -eq 1 ]]; then
    printf '\n'
    BAR_ACTIVE=0
  fi
}

# Print one narration line, keeping the sticky bar pinned at the bottom.
emit() {
  if [[ "$USE_COLOR" == true && "$BAR_ACTIVE" -eq 1 ]]; then
    printf '\r\033[K'      # wipe the current bar
    printf '%b\n' "$1"     # print the text where the bar was
    render_bar             # repaint the bar just below
  else
    printf '%b\n' "$1"
  fi
}

# ---------------------------------------------------------------------------
# pacman / makepkg message helpers.
#   action  -> bold-blue  '::'  then bold text (top-level pacman action)
#   step    -> bold-green '==>' then bold text (makepkg build step)
#   substep -> bold-blue  '  ->' then plain text (makepkg sub-step)
#   warn    -> bold-yellow 'warning:' (lowercase, like pacman)
#   die     -> bold-red    'error:' then exit 1
# ---------------------------------------------------------------------------
action()  { emit "${BOLD}${C_BLUE}::${RESET} ${BOLD}$1${RESET}"; }
step()    { emit "${BOLD}${C_GREEN}==>${RESET} ${BOLD}$1${RESET}"; }
substep() { emit "${BOLD}${C_BLUE}  ->${RESET} $1"; }
warn()    { emit "${BOLD}${C_YELLOW}warning:${RESET} $1"; }

die() {
  finish_bar
  printf '%b\n' "${BOLD}${C_RED}error:${RESET} $1" >&2
  exit 1
}

# Show a command as a sub-step, hide the bar, then run it (output stays clean).
# Arguments that contain whitespace (e.g. the whole -ldflags value) are wrapped
# in single quotes for display so the echoed line reflects the real argument
# boundaries; execution still uses the untouched "$@".
run_cmd() {
  local disp="" a
  for a in "$@"; do
    if [[ "$a" == *[[:space:]]* ]]; then
      disp+=" '$a'"
    else
      disp+=" $a"
    fi
  done
  substep "\$${disp}"
  hide_bar
  "$@"
}

# ---------------------------------------------------------------------------
# Help text.
# ---------------------------------------------------------------------------
usage() {
  cat <<'EOF'
Usage: build.sh [options]

Build the xDesign release into dist/ (docs/plan/07-server-install-update.md section 2,
docs/plan/18-third-owner-list-2026-11-23.md section 10): the chosen servers and desktop apps
for each chosen CPU (the Linux server: the single self-installing file
xdesign-<version>-linux-<arch> and its .tar.gz; the Windows server:
xdesign-<version>-windows-<arch>.exe and its .zip; the desktop app: the portable
xdesign-desktop-<version>-windows-<arch>.exe or the setup file
xdesign-desktop-<version>-windows-<arch>-setup.exe or both, then
xdesign-desktop-<version>-linux-<arch>.AppImage and xdesign-desktop-<version>-macos-<arch>.zip),
then SHA256SUMS over every release file
(and SHA256SUMS.sig when .dev/release-signing-key exists) and release-notes-<version>.md, with
pacman / makepkg themed output.

Options:
  --version <ver>        Build as this version (for example 1.0.0). Skips the question.
  --servers <systems>    Build the server for these systems: linux, windows or both
                         ("linux,windows"), or none. Skips the questions of what to build.
  --desktops <systems>   Build the desktop app for these systems: windows, linux, macos or
                         several ("windows,linux,macos"), or none. Skips the questions of
                         what to build.
  --windows-desktop <files>
                         The desktop app for Windows as these files: portable (the default),
                         installer (the setup file, which needs Wine here) or both
                         ("portable,installer" works too). Skips the question. Without the
                         desktop app for Windows it changes nothing.
  --arches <cpus>        Build for these CPUs: amd64, arm64 or both ("amd64 arm64" works too).
                         Skips the question.
  -h, --help             Show this help and exit.

Run in a terminal without options, the script asks the version, what to build (the server,
the desktop app or both), the systems of each, the Windows desktop file and the CPUs. Given
only one of --servers and --desktops, the other keeps its default. Without a terminal
--version is needed, and the rest defaults to the Linux server for both CPUs (--servers linux
--desktops none --windows-desktop portable --arches both). `make release` runs it with
VERSION, SERVERS, DESKTOPS, WINDOWS_DESKTOP and ARCHES, for example:
VERSION=1.0.0 SERVERS=linux DESKTOPS=none ARCHES="amd64 arm64" make release
VERSION=1.0.0 SERVERS=none DESKTOPS=windows WINDOWS_DESKTOP=both make release

Environment:
  ALLOW_DIRTY   Set to 1 to build from a working tree with uncommitted changes.
  NO_COLOR      When set (to anything), disable colored output.

Steps:
  1. Checks  : tools, a clean working tree, version, what to build, CPUs, tools/release/*.env
  2. Website : pnpm install --frozen-lockfile, make build
  then for each CPU of the Linux server:
  3. Node.js : the pinned runtime per CPU (tools/release/node.env), cached in .dev/cache/node/
  4. Payload : dist/build/payload-<arch>.tar.zst (runtime/node, app/)
  5. Helper  : go build -tags payload ... -o dist/xdesign-<version>-linux-<arch> ./cmd/xdesign
  6. Tarball : dist/xdesign-<version>-linux-<arch>.tar.gz (the file alone, mode 0755)
  then for each CPU of the Windows server, the same steps with Node's Windows build
  (runtime/node.exe) and the Windows native modules: dist/build/payload-windows-<arch>.tar.zst,
  dist/xdesign-<version>-windows-<arch>.exe (GOOS=windows) and its .zip (the file alone)
  then for each system and CPU of the desktop app: Node.js and app/ for them in
  dist/build/desktop-<system>-<arch>/, electron-builder (apps/desktop/electron-builder.config.ts;
  Electron cached in .dev/cache/electron/, its tools in .dev/cache/electron-builder/) once per
  file (for the setup file with Wine, its folder .dev/cache/wine/), for macOS rcodesign sign
  (ad hoc; tools/release/desktop.env, cached in .dev/cache/rcodesign/) and a zip
  7. Sums    : dist/SHA256SUMS over every release file (and SHA256SUMS.sig)
  8. Notes   : dist/release-notes-<version>.md
  9. Proof   : SHA256SUMS, the tar.gz and zip files, version --json and release-files on this
               computer's CPU; for a Windows file its PE header and the Windows payload it
               holds (it cannot run here); each desktop file unpacked (7z, unsquashfs, unzip)
               and read, for the setup file with its uninstaller, for macOS with rcodesign verify
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --version)    shift; [[ $# -gt 0 ]] || die "--version needs a value"; VERSION_OVERRIDE="$1" ;;
      --version=*)  VERSION_OVERRIDE="${1#*=}" ;;
      --servers)    shift; [[ $# -gt 0 ]] || die "--servers needs a value"; SERVERS_OVERRIDE="$1" ;;
      --servers=*)  SERVERS_OVERRIDE="${1#*=}" ;;
      --desktops)   shift; [[ $# -gt 0 ]] || die "--desktops needs a value"; DESKTOPS_OVERRIDE="$1" ;;
      --desktops=*) DESKTOPS_OVERRIDE="${1#*=}" ;;
      --windows-desktop)
        shift; [[ $# -gt 0 ]] || die "--windows-desktop needs a value"; WINDOWS_DESKTOP_OVERRIDE="$1" ;;
      --windows-desktop=*) WINDOWS_DESKTOP_OVERRIDE="${1#*=}" ;;
      --arches)     shift; [[ $# -gt 0 ]] || die "--arches needs a value"; ARCHES_OVERRIDE="$1" ;;
      --arches=*)   ARCHES_OVERRIDE="${1#*=}" ;;
      -h|--help)    usage; exit 0 ;;
      *)            die "unknown option: $1 (try --help)" ;;
    esac
    shift
  done
}

# ---------------------------------------------------------------------------
# Stage 1: the toolchain, the version, the CPUs and the working tree.
# ---------------------------------------------------------------------------
preflight() {
  action "Synchronizing build toolchain..."

  local tool
  for tool in go node pnpm git; do
    command -v "$tool" >/dev/null 2>&1 \
      || die "'${tool}' was not found on PATH; it builds xDesign (make setup-tools puts pnpm into .tools/bin)"
  done
  substep "go: $(go version 2>/dev/null || echo unknown)"
  substep "node: $(node --version 2>/dev/null || echo unknown)"
  substep "pnpm: $(pnpm --version 2>/dev/null | tail -n 1 || echo unknown)"

  # The tools of the later steps: better to find one missing now than after the whole build.
  for tool in curl tar gzip xz zstd sha256sum openssl file cmp; do
    command -v "$tool" >/dev/null 2>&1 \
      || die "'${tool}' was not found on PATH; a later step of the release build needs it"
    substep "${tool}: $("$tool" --version 2>/dev/null | sed -n 1p || echo found)"
  done
  HOST_ARCH="$(go env GOHOSTARCH)"
  substep "this computer's CPU: ${HOST_ARCH}"
}

# Resolve the build version. With --version <v> it is set non-interactively;
# otherwise an interactive terminal is asked for it. The version is a label only
# (no git tag is needed): the file records its commit.
resolve_version() {
  local reply
  if [[ -n "$VERSION_OVERRIDE" ]]; then
    VER="$VERSION_OVERRIDE"
  elif [[ -t 0 ]]; then
    printf '%b::%b %bVersion to build (for example 1.0.0):%b ' \
      "${BOLD}${C_BLUE}" "${RESET}" "${BOLD}" "${RESET}" >&2
    IFS= read -r reply || reply=""
    VER="$reply"
  else
    die "no version given: run ./build.sh in a terminal, or pass --version 1.0.0 (make release: VERSION=1.0.0)"
  fi

  VER="${VER#"${VER%%[![:space:]]*}"}" # trim, since the version names a file
  VER="${VER%"${VER##*[![:space:]]}"}"
  [[ -n "$VER" ]] || die "the version is empty"
  # The form the helper reads back (buildinfo.ParseVersion), which also keeps the
  # file's name a plain file name.
  [[ "$VER" =~ $SEMVER_RE ]] \
    || die "the version must look like 1.0.0 (MAJOR.MINOR.PATCH, optionally -pre and +build): ${VER}"
  substep "version: ${VER}"
}

# ask_choice TITLE CHOICES DEFAULT COUNT asks one question of the menu on the terminal, in
# the pacman style of docs/plan/18 section 10: ":: TITLE:", the numbered CHOICES and
# "Choose [DEFAULT]:", asked again until the answer is a number from 1 to COUNT (an empty
# answer, or the end of the input, is DEFAULT). The number is left in CHOICE.
ask_choice() {
  local title="$1" choices="$2" default="$3" count="$4" reply numbers n
  printf '%b::%b %b%s:%b\n' "${BOLD}${C_BLUE}" "${RESET}" "${BOLD}" "$title" "${RESET}" >&2
  printf '   %s\n' "$choices" >&2
  while true; do
    printf '   Choose [%s]: ' "$default" >&2
    IFS= read -r reply || reply=""
    reply="${reply//[[:space:]]/}"
    reply="${reply:-$default}"
    if [[ "$reply" =~ ^[1-9]$ ]] && (( reply <= count )); then
      CHOICE="$reply"
      return
    fi
    numbers="1"
    for (( n = 2; n < count; n++ )); do numbers+=", ${n}"; done
    printf '%bwarning:%b the choice is %s or %s, not: %s\n' \
      "${BOLD}${C_YELLOW}" "${RESET}" "$numbers" "$count" "$reply" >&2
  done
}

# Resolve what to build: --servers and --desktops (the one not given keeps its default), else
# the menu in a terminal (the server question only for a server, the desktop one only for the
# desktop app), else the defaults, the Linux server and no desktop app (as make release has
# always built). The desktop app for Windows is --windows-desktop's files, else the menu's
# (docs/plan/20 section 3, asked only when it builds the desktop app for Windows), else the
# portable file alone.
resolve_targets() {
  local servers="linux" desktops="none" files="${WINDOWS_DESKTOP_OVERRIDE:-portable}" what word
  if [[ -n "$SERVERS_OVERRIDE" || -n "$DESKTOPS_OVERRIDE" ]]; then
    servers="${SERVERS_OVERRIDE:-linux}"
    desktops="${DESKTOPS_OVERRIDE:-none}"
  elif [[ -t 0 ]]; then
    ask_choice "What to build" "1) Server   2) Desktop app   3) Both" 1 3
    what="$CHOICE"
    servers="none"
    if [[ "$what" != 2 ]]; then
      ask_choice "Server for" "1) Linux   2) Windows   3) Both" 1 3
      case "$CHOICE" in
        1) servers="linux" ;;
        2) servers="windows" ;;
        *) servers="linux windows" ;;
      esac
    fi
    if [[ "$what" != 1 ]]; then
      ask_choice "Desktop app for" "1) Windows  2) Linux  3) macOS  4) All" 4 4
      case "$CHOICE" in
        1) desktops="windows" ;;
        2) desktops="linux" ;;
        3) desktops="macos" ;;
        *) desktops="windows linux macos" ;;
      esac
      if [[ "$desktops" == *windows* && -z "$WINDOWS_DESKTOP_OVERRIDE" ]]; then
        ask_choice "Windows desktop file" "1) Portable   2) Installer   3) Both" 1 3
        case "$CHOICE" in
          1) files="portable" ;;
          2) files="installer" ;;
          *) files="portable installer" ;;
        esac
      fi
    fi
  fi

  servers=" ${servers//,/ } "
  desktops=" ${desktops//,/ } "
  for word in $servers; do
    case "$word" in
      linux|windows|none) ;;
      *) die "the server systems are linux, windows or none, not: ${word}" ;;
    esac
  done
  for word in $desktops; do
    case "$word" in
      windows|linux|macos|none) ;;
      *) die "the desktop app's systems are windows, linux, macos or none, not: ${word}" ;;
    esac
  done
  files=" ${files//,/ } "
  if [[ "$files" == *" both "* ]]; then files+=" portable installer "; fi
  for word in $files; do
    case "$word" in
      portable|installer|both) ;;
      *) die "the Windows desktop files are portable, installer or both, not: ${word}" ;;
    esac
  done
  # Always in a fixed order (the order of the builds and of the checksum lines).
  SERVERS=()
  for word in linux windows; do
    if [[ "$servers" == *" $word "* ]]; then SERVERS+=("$word"); fi
  done
  DESKTOPS=()
  for word in windows linux macos; do
    if [[ "$desktops" == *" $word "* ]]; then DESKTOPS+=("$word"); fi
  done
  (( ${#SERVERS[@]} + ${#DESKTOPS[@]} > 0 )) || die "nothing to build: --servers and --desktops are both none"
  substep "servers: ${SERVERS[*]:-none}"
  substep "desktop app: ${DESKTOPS[*]:-none}"
  WINDOWS_FILES=()
  if [[ " ${DESKTOPS[*]} " == *" windows "* ]]; then
    for word in portable installer; do
      if [[ "$files" == *" $word "* ]]; then WINDOWS_FILES+=("$word"); fi
    done
    (( ${#WINDOWS_FILES[@]} > 0 )) || die "no Windows desktop file to build: --windows-desktop is empty"
    BUILD_PHASES[desktop-windows]=$(( 1 + ${#WINDOWS_FILES[@]} ))
    substep "desktop app for Windows: ${WINDOWS_FILES[*]}"
  fi
}

# Resolve the CPUs: --arches, else the pacman-style menu in a terminal, else both.
resolve_arches() {
  local list arch
  if [[ -n "$ARCHES_OVERRIDE" ]]; then
    list="$ARCHES_OVERRIDE"
  elif [[ -t 0 ]]; then
    ask_choice "CPUs" "1) amd64   2) arm64   3) both" 3 3
    case "$CHOICE" in
      1) list="amd64" ;;
      2) list="arm64" ;;
      *) list="both" ;;
    esac
  else
    list="both"
  fi

  list=" ${list//,/ } "
  [[ "$list" == *" both "* ]] && list+=" amd64 arm64 "
  for arch in $list; do
    case "$arch" in
      amd64|arm64|both) ;;
      *) die "the CPUs are amd64, arm64 or both, not: ${arch}" ;;
    esac
  done
  # Always in the order amd64 arm64 (the order of the checksum lines).
  ARCHES=()
  for arch in amd64 arm64; do
    [[ "$list" == *" $arch "* ]] && ARCHES+=("$arch")
  done
  (( ${#ARCHES[@]} > 0 )) || die "no CPU to build for"
  substep "CPUs: ${ARCHES[*]}"
}

# version_le A B: A is lower than or equal to B (X.Y.Z only).
version_le() { [[ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | head -n 1)" == "$1" ]]; }

# Releases come from committed sources: a clean working tree, unless ALLOW_DIRTY=1.
check_tree() {
  action "Checking the working tree..."
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "build.sh runs in the xDesign git repository"
  if [[ -n "$(git status --porcelain)" ]]; then
    if [[ "${ALLOW_DIRTY:-}" == 1 ]]; then
      warn "building from uncommitted changes (ALLOW_DIRTY=1): version --json says \"modified\": true"
      MODIFIED=true
    else
      die "the working tree has uncommitted changes; commit them first, or build anyway with ALLOW_DIRTY=1"
    fi
  else
    substep "working tree: clean"
  fi

  # The commit time is the build date, so one commit always gives the same files.
  COMMIT="$(git rev-parse HEAD)"
  SOURCE_DATE_EPOCH="$(git log -1 --format=%ct)"
  BUILT_AT="$(date -u -d "@${SOURCE_DATE_EPOCH}" +%Y-%m-%dT%H:%M:%SZ)"
  GO_VERSION="$(go env GOVERSION)"
  substep "commit: ${COMMIT}"
  substep "built at: ${BUILT_AT} (the commit time)"
}

# The pinned Node.js runtime and the upgrade limits (tools/release/node.env, compat.env).
load_pins() {
  action "Reading the pins..."
  # shellcheck source=tools/release/node.env
  source "$ROOT/tools/release/node.env"
  # shellcheck source=tools/release/compat.env
  source "$ROOT/tools/release/compat.env"
  [[ "${NODE_VERSION:-}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] \
    || die "tools/release/node.env: NODE_VERSION must look like v26.13.1, not '${NODE_VERSION:-}'"
  substep "Node.js: ${NODE_VERSION}"

  local core="${VER%%[-+]*}" var
  for var in MIN_UPGRADE_FROM SCHEMA_FLOOR; do
    [[ "${!var:-}" =~ $XYZ_RE ]] || die "tools/release/compat.env: ${var} must look like X.Y.Z, not '${!var:-}'"
    version_le "${!var}" "$core" \
      || die "tools/release/compat.env: ${var} ${!var} is newer than the release ${VER}"
  done
  substep "updates from ${MIN_UPGRADE_FROM} or newer, schema floor ${SCHEMA_FLOOR}"

  # The signature step signs only when the developer's key exists (dormant until then).
  if [[ -f "$SIGNING_KEY" ]]; then
    command -v ssh-keygen >/dev/null 2>&1 || die "'ssh-keygen' was not found on PATH; it signs SHA256SUMS"
    [[ -f "$SIGNING_KEY.pub" ]] \
      || die "$SIGNING_KEY.pub is missing; recreate it with: ssh-keygen -y -f $SIGNING_KEY > $SIGNING_KEY.pub"
    local key_type key_data
    read -r key_type key_data _ <"$SIGNING_KEY.pub" || true
    [[ "${key_type:-}" == ssh-ed25519 && "${key_data:-}" =~ ^[A-Za-z0-9+/]+=*$ ]] \
      || die "$SIGNING_KEY.pub must hold an Ed25519 public key (ssh-keygen -t ed25519)"
    PUBLIC_KEY="$key_type $key_data"
    SIGNING=1
    substep "signing with ${SIGNING_KEY} (${PUBLIC_KEY})"
    grep -qF "$key_data" "$ROOT/helper/internal/release/sshsig.go" \
      || warn "the key is not in trustedKeys (helper/internal/release/sshsig.go): updates do not check its signature yet"
  else
    substep "no signing key in .dev/release-signing-key: SHA256SUMS stays unsigned"
  fi
}

# node_arch ARCH prints the name nodejs.org gives the CPU.
node_arch() {
  case "$1" in
    amd64) printf 'x64\n' ;;
    arm64) printf 'arm64\n' ;;
    *)     die "no Node.js build known for $1" ;;
  esac
}

# The names of one server build, SYSTEM (linux or windows) and ARCH: server_key prints the
# name of its scratch files in dist/build/ (payload-<key>, node-<key>) and its key in
# PAYLOAD_SUM, the CPU for Linux (amd64) and the system and CPU for Windows (windows-amd64);
# server_label its words in the steps (amd64, Windows amd64); server_file its release file
# (xdesign-<version>-linux-amd64, xdesign-<version>-windows-amd64.exe). The desktop app takes
# Node.js and the native modules through the same functions, also for macOS (macos-amd64,
# macOS amd64), which has no server.
server_key() {
  case "$1" in
    linux)   printf '%s\n' "$2" ;;
    windows) printf 'windows-%s\n' "$2" ;;
    macos)   printf 'macos-%s\n' "$2" ;;
  esac
}
server_label() {
  case "$1" in
    linux)   printf '%s\n' "$2" ;;
    windows) printf 'Windows %s\n' "$2" ;;
    macos)   printf 'macOS %s\n' "$2" ;;
  esac
}
server_file() {
  case "$1" in
    linux)   printf 'xdesign-%s-linux-%s\n' "$VER" "$2" ;;
    windows) printf 'xdesign-%s-windows-%s.exe\n' "$VER" "$2" ;;
  esac
}

# Nothing from an earlier release may end up in this one: the files of every server and of
# the desktop app (docs/plan/18 sections 9.7 and 10), whatever this build makes.
clean_dist() {
  rm -rf "$STAGE"
  rm -f "$DIST"/xdesign-*-linux-amd64 "$DIST"/xdesign-*-linux-arm64 "$DIST"/xdesign-*-linux-*.tar.gz \
    "$DIST"/xdesign-*-windows-*.exe "$DIST"/xdesign-*-windows-*.zip "$DIST"/xdesign-desktop-* \
    "$DIST/SHA256SUMS" "$DIST/SHA256SUMS.sig"
  mkdir -p "$STAGE"
}

# ---------------------------------------------------------------------------
# Stage 2: the website (the SPA and the server bundles), the same for every CPU.
# ---------------------------------------------------------------------------
build_web() {
  action "Building the website..."
  step "Resolving dependencies (pnpm install)"
  run_cmd pnpm install --frozen-lockfile --prefer-offline || die "pnpm install failed"

  # XD_RELEASE_VERSION stamps the version into the server bundles (apps/server/build.ts).
  step "Building the SPA and the server bundles (make build)"
  run_cmd env XD_RELEASE_VERSION="$VER" make build || die "make build failed"
  local f
  for f in apps/web/dist/index.html apps/server/dist/server.mjs apps/server/dist/cli.mjs apps/server/dist/migrations; do
    [[ -e "$ROOT/$f" ]] || die "make build did not write $f"
  done
  substep "apps/web/dist, apps/server/dist (server.mjs, cli.mjs, migrations)"
}

# The third-party notices of app/LICENSES/, the same for every CPU: the license files of
# every production package of the server and the SPA (pnpm licenses list) and a list of
# them in THIRD-PARTY.txt. Node.js's own license comes with the runtime (fetch_node).
collect_licenses() {
  step "Collecting the third-party notices"
  local dest="$STAGE/licenses" json="$STAGE/licenses.json" count
  mkdir -p "$dest"
  substep "\$ pnpm --filter @xdesign/server --filter @xdesign/web licenses list --prod --json"
  hide_bar
  pnpm --filter @xdesign/server --filter @xdesign/web licenses list --prod --json >"$json" \
    || die "pnpm licenses list failed"
  count="$(node -e '
    const fs = require("node:fs")
    const path = require("node:path")
    const [json, dest] = process.argv.slice(1)
    const lines = []
    for (const [license, pkgs] of Object.entries(JSON.parse(fs.readFileSync(json, "utf8")))) {
      for (const pkg of pkgs) {
        pkg.versions.forEach((version, i) => {
          const dir = pkg.paths[i]
          const files = fs.readdirSync(dir, { withFileTypes: true })
            .filter((e) => e.isFile() && /^(licen[cs]e|copying|notice)/i.test(e.name))
            .map((e) => e.name)
          if (files.length > 0) {
            const out = path.join(dest, pkg.name + "@" + version)
            fs.mkdirSync(out, { recursive: true })
            for (const f of files) fs.copyFileSync(path.join(dir, f), path.join(out, f))
          }
          lines.push(pkg.name + " " + version + ": " + license + (files.length > 0 ? "" : " (the package has no license file)"))
        })
      }
    }
    lines.sort()
    const head = "Third-party software in this release of xDesign, with its license. The license files\n" +
      "are in the folder of each package (name@version); Node.js has its own in node.js/.\n\n"
    fs.writeFileSync(path.join(dest, "THIRD-PARTY.txt"), head + lines.join("\n") + "\n")
    console.log(lines.length)
  ' "$json" "$dest")" || die "the third-party notices could not be collected"
  rm -f "$json"
  substep "${count} packages in app/LICENSES/THIRD-PARTY.txt"
}

# ---------------------------------------------------------------------------
# Stage 3: the pinned Node.js runtime of one system and CPU, from the cache or nodejs.org.
# ---------------------------------------------------------------------------

# fetch_node SYSTEM ARCH DEST writes DEST/runtime/node (node.exe for Windows) and Node's
# license from the official build: node-<version>-linux-<cpu>.tar.xz (bin/node), pinned as
# NODE_SHA256_<ARCH>, node-<version>-win-<cpu>.zip (node.exe), pinned as
# NODE_SHA256_WINDOWS_<ARCH>, or for the desktop app's macOS node-<version>-darwin-<cpu>.tar.gz
# (bin/node), pinned as NODE_SHA256_MACOS_<ARCH>.
fetch_node() {
  local system="$1" arch="$2" dest="$3" file ext inner node url want var cache got tmp
  action "Fetching Node.js ${NODE_VERSION} for $(server_label "$system" "$arch")..."
  case "$system" in
    linux)
      file="node-${NODE_VERSION}-linux-$(node_arch "$arch")"
      ext=tar.xz inner=bin/node node=node var="NODE_SHA256_${arch^^}"
      ;;
    windows)
      file="node-${NODE_VERSION}-win-$(node_arch "$arch")"
      ext=zip inner=node.exe node=node.exe var="NODE_SHA256_WINDOWS_${arch^^}"
      ;;
    macos)
      file="node-${NODE_VERSION}-darwin-$(node_arch "$arch")"
      ext=tar.gz inner=bin/node node=node var="NODE_SHA256_MACOS_${arch^^}"
      ;;
  esac
  url="https://nodejs.org/dist/${NODE_VERSION}/${file}.${ext}"
  want="${!var}"
  cache="$CACHE/node/${file}.${ext}"
  mkdir -p "$CACHE/node"

  if [[ -f "$cache" ]] && [[ "$(sha256sum "$cache" | cut -d' ' -f1)" == "$want" ]]; then
    substep "cached: .dev/cache/node/${file}.${ext}"
  else
    rm -f "$cache"
    step "Downloading ${file}.${ext} from nodejs.org"
    PART_FILE="$cache.part"
    run_cmd curl -fL --proto '=https' --tlsv1.2 --retry 2 --connect-timeout 20 -# -o "$PART_FILE" "$url" \
      || die "the download of ${url} failed"
    got="$(sha256sum "$PART_FILE" | cut -d' ' -f1)"
    [[ "$got" == "$want" ]] \
      || die "${file}.${ext} has the SHA-256 ${got}, not the pinned ${want} (tools/release/node.env)"
    mv -f "$PART_FILE" "$cache"
    PART_FILE=""
  fi
  substep "${C_GREEN}SHA-256: PASS${RESET} (${want})"

  tmp="$STAGE/node-$(server_key "$system" "$arch")"
  rm -rf "$tmp" && mkdir -p "$tmp"
  case "$ext" in
    tar.xz) tar -xJf "$cache" -C "$tmp" "${file}/${inner}" "${file}/LICENSE" ;;
    tar.gz) tar -xzf "$cache" -C "$tmp" "${file}/${inner}" "${file}/LICENSE" ;;
    zip)    unzip -q "$cache" "${file}/${inner}" "${file}/LICENSE" -d "$tmp" ;;
  esac || die "cannot unpack ${inner} from ${file}.${ext}"
  mkdir -p "$dest/runtime" "$dest/app/LICENSES/node.js"
  install -m 0755 "$tmp/${file}/${inner}" "$dest/runtime/${node}"
  install -m 0644 "$tmp/${file}/LICENSE" "$dest/app/LICENSES/node.js/LICENSE"
  rm -rf "$tmp"
  substep "runtime/${node} and app/LICENSES/node.js/LICENSE"
}

# ---------------------------------------------------------------------------
# Stage 4: the payload of one system and CPU.
# ---------------------------------------------------------------------------

# lock_integrity PACKAGE@VERSION prints the integrity the lockfile pins for it.
lock_integrity() {
  awk -v key="$1" '$0 == "  \x27" key "\x27:" || $0 == "  " key ":" {
      getline
      if (match($0, /integrity: [^,}]+/)) print substr($0, RSTART + 11, RLENGTH - 11)
      exit
    }' "$ROOT/pnpm-lock.yaml"
}

# native_package NAME VERSION DEST copies the npm package NAME@VERSION into DEST: the copy
# pnpm installed (checked by pnpm against the lockfile), else, for another CPU, the package
# from the npm registry, cached in .dev/cache/npm/ and checked against the lockfile's
# integrity.
native_package() {
  local name="$1" version="$2" dest="$3" installed="$4" integrity tgz url got
  mkdir -p "$dest"
  if [[ -d "$installed" ]]; then
    cp -R "$installed/." "$dest/"
    substep "${name} ${version}: installed by pnpm"
    return
  fi
  integrity="$(lock_integrity "${name}@${version}")"
  [[ "$integrity" == sha512-* ]] || die "pnpm-lock.yaml pins no integrity for ${name}@${version}"
  tgz="$CACHE/npm/${name//\//+}-${version}.tgz"
  url="https://registry.npmjs.org/${name}/-/${name##*/}-${version}.tgz"
  mkdir -p "$CACHE/npm"
  if [[ ! -f "$tgz" ]] || [[ "sha512-$(openssl dgst -sha512 -binary "$tgz" | base64 -w0)" != "$integrity" ]]; then
    rm -f "$tgz"
    PART_FILE="$tgz.part"
    run_cmd curl -fsSL --proto '=https' --tlsv1.2 --retry 2 --connect-timeout 20 -o "$PART_FILE" "$url" \
      || die "the download of ${url} failed"
    got="sha512-$(openssl dgst -sha512 -binary "$PART_FILE" | base64 -w0)"
    [[ "$got" == "$integrity" ]] || die "${name}-${version}.tgz is not the package pnpm-lock.yaml pins (${got})"
    mv -f "$PART_FILE" "$tgz"
    PART_FILE=""
  fi
  tar -xzf "$tgz" -C "$dest" --strip-components=1 --no-same-owner || die "cannot unpack ${tgz}"
  substep "${name} ${version}: from the npm registry (.dev/cache/npm/, integrity checked)"
}

# native_modules SYSTEM ARCH DEST writes app/node_modules: only the native modules,
# better-sqlite3 with the one prebuilt binary of the system and CPU (prebuilds/linux-<cpu>.node,
# prebuilds/win32-<cpu>.node, prebuilds/darwin-<cpu>.node), and @node-rs/argon2 with its package
# for them (argon2-linux-<cpu>-gnu, argon2-win32-<cpu>-msvc, the one Node's official Windows
# build loads, argon2-darwin-<cpu>).
native_modules() {
  local system="$1" arch="$2" dest="$3/app/node_modules" sqlite argon cpu version prebuild package
  step "Taking the prebuilt native modules for $(server_label "$system" "$arch")"
  cpu="$(node_arch "$arch")"
  case "$system" in
    linux)   prebuild="linux-${cpu}" package="argon2-linux-${cpu}-gnu" ;;
    windows) prebuild="win32-${cpu}" package="argon2-win32-${cpu}-msvc" ;;
    macos)   prebuild="darwin-${cpu}" package="argon2-darwin-${cpu}" ;;
  esac
  sqlite="$(readlink -f "$ROOT/apps/server/node_modules/better-sqlite3")"
  argon="$(readlink -f "$ROOT/apps/server/node_modules/@node-rs/argon2")"
  [[ -f "$sqlite/prebuilds/${prebuild}.node" ]] || die "better-sqlite3 has no prebuilt binary for ${prebuild}"
  [[ -f "$argon/package.json" ]] || die "@node-rs/argon2 is not installed (pnpm install)"

  mkdir -p "$dest/better-sqlite3/prebuilds" "$dest/@node-rs"
  cp -R "$sqlite/package.json" "$sqlite/LICENSE" "$sqlite/lib" "$dest/better-sqlite3/"
  cp "$sqlite/prebuilds/${prebuild}.node" "$dest/better-sqlite3/prebuilds/"
  substep "better-sqlite3 $(node -p "require('$sqlite/package.json').version"): lib/ and prebuilds/${prebuild}.node"

  cp -R "$argon" "$dest/@node-rs/argon2"
  version="$(node -p "require('$argon/package.json').version")"
  native_package "@node-rs/${package}" "$version" "$dest/@node-rs/${package}" "$(dirname "$argon")/${package}"
}

# windows_names DIR: every name in the payload folder DIR can exist on Windows. None differs
# from another in case only, none is a device name (con, prn, aux, nul, com1 to com9, lpt1
# to lpt9, with any extension), none holds a character Windows refuses (< > : " | ? * \) and
# none ends in a dot or a space; release-files would stop on any of them on Windows.
windows_names() {
  local names bad
  names="$(cd "$1" && find runtime app)" || die "cannot list the payload in $1"
  bad="$(sort -f <<<"$names" | uniq -di)"
  [[ -z "$bad" ]] || die "the Windows payload holds names that differ in case only: $(head -n 5 <<<"$bad" | tr '\n' ' ')"
  bad="$(grep -iE '(^|/)(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.[^/]*)?$|[<>:"|?*\\]|[. ]$|[. ]/' <<<"$names" || true)"
  [[ -z "$bad" ]] || die "the Windows payload holds names Windows refuses: $(head -n 5 <<<"$bad" | tr '\n' ' ')"
}

# stage_payload SYSTEM ARCH DIR writes the payload of SYSTEM (linux, windows, or macos for the
# desktop app) and ARCH into the folder DIR: runtime/ with Node.js alone and app/.
stage_payload() {
  local system="$1" arch="$2" dir="$3"
  fetch_node "$system" "$arch" "$dir"

  step "Copying the app"
  mkdir -p "$dir/app/web"
  cp "$ROOT/apps/server/dist/server.mjs" "$ROOT/apps/server/dist/cli.mjs" "$dir/app/"
  cp -R "$ROOT/apps/web/dist/." "$dir/app/web/"
  cp -R "$ROOT/apps/server/dist/migrations" "$dir/app/migrations"
  cp -R "$STAGE/licenses/." "$dir/app/LICENSES/"
  substep "app/server.mjs, app/cli.mjs, app/web/, app/migrations/, app/LICENSES/"
  native_modules "$system" "$arch" "$dir"

  # Source maps are for debugging and stay out of the release (as in xWriter); modes must
  # not depend on the umask of the build machine. runtime/ holds Node.js alone (node, or
  # node.exe for Windows).
  find "$dir/app" -type f -name '*.map' -delete
  chmod -R u=rwX,go=rX "$dir"
  chmod 0755 "$dir"/runtime/*
  if [[ "$system" == windows ]]; then
    windows_names "$dir"
  fi
}

# pack_payload SYSTEM ARCH packs the payload of the server for SYSTEM (linux or windows) and
# ARCH into dist/build/payload-<key>.tar.zst (server_key) and keeps its SHA-256 in
# PAYLOAD_SUM[<key>].
pack_payload() {
  local system="$1" arch="$2" key dir out
  key="$(server_key "$system" "$arch")"
  dir="$STAGE/payload-${key}" out="$STAGE/payload-${key}.tar.zst"
  action "Packing the payload for $(server_label "$system" "$arch")..."
  stage_payload "$system" "$arch" "$dir"

  step "tar + zstd (runtime/, app/; sorted, owner 0/0, fixed times)"
  hide_bar
  PART_FILE="$out.part"
  tar --format=gnu --sort=name --mtime="@${SOURCE_DATE_EPOCH}" --owner=0 --group=0 --numeric-owner \
    -C "$dir" -cf - runtime app | zstd -q -19 -T0 -c >"$PART_FILE" \
    || die "the payload for $(server_label "$system" "$arch") could not be packed"
  mv -f "$PART_FILE" "$out"
  PART_FILE=""
  PAYLOAD_SUM[$key]="$(sha256sum "$out" | cut -d' ' -f1)"
  substep "dist/build/payload-${key}.tar.zst: $(human_size "$(stat -c %s "$out")" "$out"), SHA-256 ${PAYLOAD_SUM[$key]}"
}

# ---------------------------------------------------------------------------
# Stage 5: the Go helper of one system and CPU with its payload embedded.
# ---------------------------------------------------------------------------

# windows_type FILE ARCH KIND: file(1) names FILE a 64-bit Windows program of KIND (console
# or DLL) for the CPU, as in "PE32+ executable for MS Windows 10.00 (console), x86-64, 8
# sections" (ARM64 is "ARM64", or "Aarch64" in older versions of file).
windows_type() {
  local ftype
  ftype="$(file -b "$1")"
  [[ "$ftype" == "PE32+ executable"* && "$ftype" == *"MS Windows"* && "$ftype" == *"(${3})"* ]] || return 1
  case "$2" in
    amd64) [[ "$ftype" == *"x86-64"* ]] ;;
    arm64) [[ "$ftype" == *"ARM64"* || "$ftype" == *"Aarch64"* ]] ;;
    *)     return 1 ;;
  esac
}

# build_helper SYSTEM ARCH builds the xdesign file of the server for SYSTEM (linux or
# windows) and ARCH (server_file) with its payload embedded.
build_helper() {
  local system="$1" arch="$2" key name ldflags goos=""
  key="$(server_key "$system" "$arch")"
  name="$(server_file "$system" "$arch")"
  action "Compiling the xdesign file for $(server_label "$system" "$arch")..."
  # -w drops the DWARF data only: an update reads the version keys of a new file from its
  # symbol table without running it, so the file is never stripped (-s).
  ldflags="-w"
  ldflags+=" -X ${BUILDINFO}.Version=${VER}"
  ldflags+=" -X ${BUILDINFO}.Commit=${COMMIT}"
  ldflags+=" -X ${BUILDINFO}.BuiltAt=${BUILT_AT}"
  ldflags+=" -X ${BUILDINFO}.Arch=${arch}"
  ldflags+=" -X ${BUILDINFO}.NodeVersion=${NODE_VERSION}"
  ldflags+=" -X ${BUILDINFO}.PayloadSHA256=${PAYLOAD_SUM[$key]}"
  ldflags+=" -X ${BUILDINFO}.MinUpgradeFrom=${MIN_UPGRADE_FROM}"
  ldflags+=" -X ${BUILDINFO}.SchemaFloor=${SCHEMA_FLOOR}"

  cp "$STAGE/payload-${key}.tar.zst" "$PAYLOAD_EMBED"
  if [[ "$system" != linux ]]; then
    goos="GOOS=${system}, "
  fi
  step "go build (CGO_ENABLED=0, tags: payload, ${goos}GOARCH=${arch})"
  substep "target: ./cmd/xdesign  ->  dist/${name}"
  # GOAMD64 and GOARM64 are pinned to the baseline so the file runs on any server of the
  # CPU, whatever the build machine's environment says.
  run_cmd env CGO_ENABLED=0 GOOS="$system" GOARCH="$arch" GOAMD64=v1 GOARM64=v8.0 \
    go -C "$ROOT/helper" build -tags payload -trimpath -ldflags "$ldflags" -o "$DIST/$name" ./cmd/xdesign \
    || die "go build failed for $(server_label "$system" "$arch")"
  rm -f "$PAYLOAD_EMBED"
  chmod 0755 "$DIST/$name"

  local ftype machine syms
  ftype="$(file -b "$DIST/$name")"
  case "$system" in
    linux)
      # file(1): a static ELF file of the CPU, with its symbol table.
      case "$arch" in
        amd64) machine="x86-64" ;;
        arm64) machine="ARM aarch64" ;;
      esac
      [[ "$ftype" == *"ELF 64-bit LSB executable, ${machine}"* && "$ftype" == *"statically linked"* ]] \
        || die "dist/${name} is not a static ${arch} file: ${ftype}"
      [[ "$ftype" == *"not stripped"* ]] || die "dist/${name} is stripped; an update could not read its version keys: ${ftype}"
      substep "${C_GREEN}file: PASS${RESET} (static, ${machine}, not stripped)"
      ;;
    windows)
      # file(1): a Windows console program of the CPU; go tool nm: its symbol table, where an
      # update reads the version keys (file(1) does not tell it for a Windows file).
      windows_type "$DIST/$name" "$arch" console || die "dist/${name} is not a Windows ${arch} program: ${ftype}"
      syms="$(go tool nm "$DIST/$name")" || die "go tool nm cannot read dist/${name}"
      grep -qF " ${BUILDINFO}.Version" <<<"$syms" \
        || die "dist/${name} has no symbol table; an update could not read its version keys"
      substep "${C_GREEN}file: PASS${RESET} (${ftype}; not stripped)"
      ;;
  esac
  substep "size: $(file_size "$name")"
}

# ---------------------------------------------------------------------------
# Human-readable size helper (numfmt if present, else du -h on the file, else
# raw bytes): human_size <bytes> <file>.
# ---------------------------------------------------------------------------
human_size() {
  local bytes="$1" file="$2"
  if command -v numfmt >/dev/null 2>&1; then
    numfmt --to=iec-i --suffix=B "$bytes" 2>/dev/null && return 0
  fi
  du -h "$file" 2>/dev/null | awk '{print $1}' && return 0
  printf '%s B' "$bytes"
}

# file_size NAME prints the human-readable size of dist/NAME.
file_size() { human_size "$(stat -c %s "$DIST/$1")" "$DIST/$1"; }

# ---------------------------------------------------------------------------
# Stage 6: pack the file of one CPU alone into its .tar.gz (Linux) or .zip (Windows).
# ---------------------------------------------------------------------------
pack_tarball() {
  local arch="$1" name="xdesign-${VER}-linux-$1" tarball listing
  tarball="${name}.tar.gz"
  action "Packing the tarball for ${arch}..."

  step "tar + gzip (one entry: ${name}, mode 0755, owner 0/0)"
  substep "target: dist/${name}  ->  dist/${tarball}"
  # Fixed times and owners, and gzip without a name or time stamp, make the file a function
  # of the xdesign file only: one commit always gives the same bytes. The entry is owned by
  # uid and gid 0 (numbers only) with mode 0755, whoever builds it and whatever their umask.
  PART_FILE="$DIST/.${tarball}.part"
  tar --format=gnu --sort=name --mtime="@${SOURCE_DATE_EPOCH}" --owner=0 --group=0 --numeric-owner --mode=0755 \
    -C "$DIST" -cf - "$name" | gzip -9 -n >"$PART_FILE" \
    || die "tar failed to pack dist/${name}"

  # It must read back to its end (gzip's checksum included) and list exactly one entry,
  # the file under its own name with mode 0755.
  listing="$(tar -tvzf "$PART_FILE")" || die "the packed ${tarball} does not read back"
  [[ "$listing" != *$'\n'* && "$listing" == "-rwxr-xr-x "*" ${name}" ]] \
    || die "the packed ${tarball} should hold ${name} alone, mode 0755; it lists: ${listing}"
  substep "${C_GREEN}contents: PASS${RESET} (${listing})"

  mv -f "$PART_FILE" "$DIST/$tarball" || die "could not rename the packed tarball to ${tarball}"
  PART_FILE=""
  substep "size: $(file_size "$tarball")"
}

# pack_zip ARCH packs the Windows file of one CPU alone into its .zip
# (xdesign-<version>-windows-<arch>.zip).
pack_zip() {
  local arch="$1" name zip listing
  name="$(server_file windows "$arch")"
  zip="${name%.exe}.zip"
  action "Packing the zip for Windows ${arch}..."

  step "zip (one entry: ${name}, no extra fields, the commit time)"
  substep "target: dist/${name}  ->  dist/${zip}"
  # The file's time set to the commit time (zip keeps it as local time, so TZ is UTC) and no
  # extra fields (-X: no owner, no Unix times) make the zip a function of the xdesign file
  # only: one commit always gives the same bytes. The mode is the file's, 0755.
  touch -m -d "@${SOURCE_DATE_EPOCH}" "$DIST/$name"
  PART_FILE="$DIST/.${zip}.part"
  rm -f "$PART_FILE"
  (cd "$DIST" && TZ=UTC0 zip -q -X -9 "$PART_FILE" "$name") || die "zip failed to pack dist/${name}"

  # It must test clean (the CRC of its entry) and list exactly one entry, the file under its
  # own name.
  unzip -tqq "$PART_FILE" || die "the packed ${zip} does not read back"
  listing="$(unzip -Z1 "$PART_FILE")" || die "the packed ${zip} cannot be listed"
  [[ "$listing" == "$name" ]] || die "the packed ${zip} should hold ${name} alone; it lists: ${listing}"
  substep "${C_GREEN}contents: PASS${RESET} ($(unzip -Z -s "$PART_FILE" "$name"))"

  mv -f "$PART_FILE" "$DIST/$zip" || die "could not rename the packed zip to ${zip}"
  PART_FILE=""
  substep "size: $(file_size "$zip")"
}

# ---------------------------------------------------------------------------
# The builds (docs/plan/18 section 10). Each server system and the desktop app is a pair of
# functions (the desktop app's are the slots DESK-05 fills):
#   check_server_<system>          phase 1, once: what it needs (pins, tools), or die
#   build_server_<system> CPU      one CPU: exactly BUILD_PHASES[server-<system>] advances
#   check_desktop SYSTEM           phase 1, once per system: what it needs, or die
#   build_desktop SYSTEM CPU       one system and CPU: BUILD_PHASES[desktop-<system>] advances
# A build adds each file it ships with add_release_file (and a payload's SHA-256 to
# PAYLOAD_NOTES); the checksums, the notes, the proof and the summary cover it unchanged.
# ---------------------------------------------------------------------------

# add_release_file KIND NAME LABEL [PROOF [ARG...]] adds dist/NAME to the release: to
# SHA256SUMS, the notes' {{files}} and the summary (as "LABEL dist/NAME (size)"). KIND is file,
# or pack for a release file alone in a .tar.gz or .zip; SHA256SUMS lists the packs first, then
# the files, each in build order. The Proof phase runs PROOF ARG... NAME after it checks
# SHA256SUMS; a file without a PROOF is proved by SHA256SUMS alone.
add_release_file() {
  local kind="$1" name="$2" label="$3"
  shift 3
  case "$kind" in
    file|pack) ;;
    *) die "add_release_file: the kind is file or pack, not: ${kind}" ;;
  esac
  [[ -f "$DIST/$name" ]] || die "dist/${name} was not written"
  RELEASE_FILES+=("$name")
  FILE_KIND[$name]="$kind"
  FILE_LABEL[$name]="$label"
  FILE_PROOF[$name]="$*"
}

# check_builds runs the check of every chosen build, in phase 1.
check_builds() {
  local system
  for system in "${SERVERS[@]}"; do
    "check_server_${system}"
  done
  for system in "${DESKTOPS[@]}"; do
    check_desktop "$system"
  done
}

# count_phases sets the progress bar's step count: the checks, the website, the phases of
# every chosen build for every CPU, the checksums, the notes, the proof and done.
count_phases() {
  local system per=0
  for system in "${SERVERS[@]}"; do
    per=$(( per + ${BUILD_PHASES["server-${system}"]} ))
  done
  for system in "${DESKTOPS[@]}"; do
    per=$(( per + ${BUILD_PHASES["desktop-${system}"]} ))
  done
  PHASE_TOTAL=$(( 6 + per * ${#ARCHES[@]} ))
}

# check_server_linux: the pinned official Node.js build of each CPU (tools/release/node.env).
check_server_linux() {
  local arch var
  for arch in "${ARCHES[@]}"; do
    var="NODE_SHA256_${arch^^}"
    [[ "${!var:-}" =~ ^[0-9a-f]{64}$ ]] \
      || die "tools/release/node.env: ${var} must be the SHA-256 of node-${NODE_VERSION}-linux-$(node_arch "$arch").tar.xz"
  done
}

# build_server_linux CPU: stages 3 to 6 in 3 phases, the payload, the file and its tarball;
# then both files are release files.
build_server_linux() {
  local arch="$1" name="xdesign-${VER}-linux-$1"
  pack_payload linux "$arch"
  advance "payload ${arch}"
  build_helper linux "$arch"
  advance "compiling ${arch}"
  pack_tarball "$arch"
  advance "packing ${arch}"
  add_release_file file "$name" File prove_server_linux "$arch"
  add_release_file pack "${name}.tar.gz" Tarball prove_tarball "$name"
  PAYLOAD_NOTES+=("linux-${arch} \`${PAYLOAD_SUM[$arch]}\`")
}

# check_server_windows: what the Windows server needs (docs/plan/18 sections 8 and 10): Node's
# official Windows build of each CPU pinned in tools/release/node.env, and zip and unzip.
check_server_windows() {
  local arch var tool
  for arch in "${ARCHES[@]}"; do
    var="NODE_SHA256_WINDOWS_${arch^^}"
    [[ "${!var:-}" =~ ^[0-9a-f]{64}$ ]] \
      || die "tools/release/node.env: ${var} must be the SHA-256 of node-${NODE_VERSION}-win-$(node_arch "$arch").zip"
  done
  for tool in zip unzip; do
    command -v "$tool" >/dev/null 2>&1 \
      || die "'${tool}' was not found on PATH; the Windows server build needs it"
  done
  substep "zip: $(zip -v | sed -n '2{s/^This is //;s/,.*//;p}')"
  substep "unzip: $(unzip -v | sed -n '1{s/,.*//;p}')"
}

# build_server_windows CPU: the Windows server's stages 3 to 6 in 3 phases, the payload (Node's
# Windows build, the Windows native modules), the .exe and its zip; then both files are
# release files, the .exe proved by reading it (prove_server_windows), as it cannot run here.
build_server_windows() {
  local arch="$1" name
  name="$(server_file windows "$arch")"
  pack_payload windows "$arch"
  advance "payload windows ${arch}"
  build_helper windows "$arch"
  advance "compiling windows ${arch}"
  pack_zip "$arch"
  advance "zipping windows ${arch}"
  add_release_file file "$name" File prove_server_windows "$arch"
  add_release_file pack "${name%.exe}.zip" Zip prove_zip "$name"
  PAYLOAD_NOTES+=("windows-${arch} \`${PAYLOAD_SUM[windows-${arch}]}\`")
}

# The desktop app's names: desktop_file SYSTEM ARCH [FILE] prints its release file of
# docs/plan/18 section 9.7 (for Windows FILE installer, the setup file of docs/plan/20,
# -setup.exe), desktop_label SYSTEM [ARCH] its words in the steps (Windows amd64, Linux amd64,
# macOS amd64), electron_platform the system as Electron and Node.js name it (win32, linux,
# darwin).
desktop_file() {
  case "$1" in
    windows)
      if [[ "${3:-}" == installer ]]; then
        printf 'xdesign-desktop-%s-windows-%s-setup.exe\n' "$VER" "$2"
      else
        printf 'xdesign-desktop-%s-windows-%s.exe\n' "$VER" "$2"
      fi
      ;;
    linux)   printf 'xdesign-desktop-%s-linux-%s.AppImage\n' "$VER" "$2" ;;
    macos)   printf 'xdesign-desktop-%s-macos-%s.zip\n' "$VER" "$2" ;;
  esac
}
desktop_label() {
  case "$1" in
    windows) printf 'Windows%s\n' "${2:+ $2}" ;;
    linux)   printf 'Linux%s\n' "${2:+ $2}" ;;
    macos)   printf 'macOS%s\n' "${2:+ $2}" ;;
  esac
}
electron_platform() {
  case "$1" in
    windows) printf 'win32\n' ;;
    linux)   printf 'linux\n' ;;
    macos)   printf 'darwin\n' ;;
  esac
}

# electron_sum ZIP prints the SHA-256 that electron's package (pinned in pnpm-lock.yaml) gives
# Electron's file ZIP in its checksums.json, or nothing.
electron_sum() {
  node -e '
    const sums = require(process.argv[1])
    console.log(sums[process.argv[2]] || "")
  ' "$DESKTOP/node_modules/electron/checksums.json" "$1"
}

# rcodesign_triple prints the name of this computer's CPU in rcodesign's release files.
rcodesign_triple() {
  case "$HOST_ARCH" in
    amd64) printf 'x86_64\n' ;;
    arm64) printf 'aarch64\n' ;;
    *)     die "no rcodesign build known for this computer's CPU (${HOST_ARCH}); it signs the macOS app" ;;
  esac
}

# wine_prefix makes Wine's folder .dev/cache/wine/ (WINE_PREFIX) for electron-builder with
# wineboot, Mono and Gecko turned off so that no window asks to install them: once, and again
# after Wine was updated (else Wine would update it inside electron-builder, with Mono and Gecko
# on). xdesign-wine-version in the folder keeps the Wine it was made with.
wine_prefix() {
  local version mode=-i
  version="$(wine --version 2>&1)" || die "wine --version failed: ${version}"
  if [[ -f "$WINE_PREFIX/system.reg" && "$(cat "$WINE_PREFIX/xdesign-wine-version" 2>/dev/null)" == "$version" ]]; then
    substep "wine: ${version} (its folder .dev/cache/wine/)"
    return 0
  fi
  if [[ -f "$WINE_PREFIX/system.reg" ]]; then mode=-u; fi
  mkdir -p "$WINE_PREFIX"
  step "Making Wine's folder .dev/cache/wine/ (${version}, for the setup file's uninstaller)"
  run_cmd env WINEPREFIX="$WINE_PREFIX" WINEDEBUG=-all WINEDLLOVERRIDES="mscoree,mshtml=;winemenubuilder.exe=d" \
    wineboot "$mode" || die "wineboot ${mode} failed in .dev/cache/wine/"
  # The folder is complete once its wineserver has written the registry and ended.
  WINEPREFIX="$WINE_PREFIX" wineserver -w || die "wineserver -w failed in .dev/cache/wine/"
  [[ -f "$WINE_PREFIX/system.reg" ]] \
    || die "wineboot ${mode} did not make .dev/cache/wine/; it holds: $(find "$WINE_PREFIX" -mindepth 1 -maxdepth 1 -printf '%f ')"
  printf '%s\n' "$version" >"$WINE_PREFIX/xdesign-wine-version"
  substep "wine: ${version} (its folder .dev/cache/wine/, made now)"
}

# check_desktop SYSTEM: what the desktop app for SYSTEM (windows, linux, macos) needs
# (docs/plan/18 sections 9.7 and 10): electron-builder and Electron in apps/desktop, Electron's
# checksum and Node's pin for each CPU, and the tools of its proof (7z reads the Windows file,
# unsquashfs the AppImage, unzip the macOS zip); for macOS zip and rcodesign's pins in
# tools/release/desktop.env. The portable Windows file needs no Wine: electron-builder writes
# the .exe's icon and file details with resedit, and a portable .exe has no uninstaller. The
# setup file does (docs/plan/20 section 3): electron-builder makes its uninstaller by running
# NSIS's uninstaller maker under Wine, so Wine is asked for, and its folder made, only when the
# setup file is chosen.
check_desktop() {
  local system="$1" arch var zip node_file builder tool tools=()
  if [[ -z "$ELECTRON_VERSION" ]]; then
    [[ -x "$DESKTOP/node_modules/.bin/electron-builder" && -f "$DESKTOP/node_modules/electron/checksums.json" ]] \
      || die "electron and electron-builder are not installed in apps/desktop (pnpm install)"
    ELECTRON_VERSION="$(node -p "require('$DESKTOP/node_modules/electron/package.json').version")"
    builder="$(node -p "require('$DESKTOP/node_modules/electron-builder/package.json').version")"
    substep "Electron ${ELECTRON_VERSION}, electron-builder ${builder}"
  fi
  for arch in "${ARCHES[@]}"; do
    zip="electron-v${ELECTRON_VERSION}-$(electron_platform "$system")-$(node_arch "$arch").zip"
    [[ "$(electron_sum "$zip")" =~ ^[0-9a-f]{64}$ ]] \
      || die "apps/desktop/node_modules/electron/checksums.json has no SHA-256 for ${zip}"
    case "$system" in
      windows) var="NODE_SHA256_WINDOWS_${arch^^}" node_file="node-${NODE_VERSION}-win-$(node_arch "$arch").zip" ;;
      linux)   var="NODE_SHA256_${arch^^}" node_file="node-${NODE_VERSION}-linux-$(node_arch "$arch").tar.xz" ;;
      macos)   var="NODE_SHA256_MACOS_${arch^^}" node_file="node-${NODE_VERSION}-darwin-$(node_arch "$arch").tar.gz" ;;
    esac
    [[ "${!var:-}" =~ ^[0-9a-f]{64}$ ]] \
      || die "tools/release/node.env: ${var} must be the SHA-256 of ${node_file}"
  done

  case "$system" in
    windows) tools=(unzip 7z) ;;
    linux)   tools=(unsquashfs) ;;
    macos)   tools=(zip unzip) ;;
  esac
  for tool in "${tools[@]}"; do
    command -v "$tool" >/dev/null 2>&1 \
      || die "'${tool}' was not found on PATH; the desktop app for $(desktop_label "$system") needs it"
  done
  case "$system" in
    windows)
      substep "7z: $(7z 2>/dev/null | sed -n '/^7-Zip/{s/ *:.*//;p}')"
      if [[ " ${WINDOWS_FILES[*]} " == *" installer "* ]]; then
        for tool in wine wineboot wineserver; do
          command -v "$tool" >/dev/null 2>&1 \
            || die "'${tool}' was not found on PATH; the setup file of the desktop app for Windows needs Wine (pacman -S wine on Arch, apt install wine on Debian and Ubuntu)"
        done
        wine_prefix
      fi
      ;;
    linux)   substep "unsquashfs: $(unsquashfs -version 2>/dev/null | sed -n 1p)" ;;
    macos)
      # shellcheck source=tools/release/desktop.env
      source "$ROOT/tools/release/desktop.env"
      [[ "${RCODESIGN_VERSION:-}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] \
        || die "tools/release/desktop.env: RCODESIGN_VERSION must look like 0.29.0, not '${RCODESIGN_VERSION:-}'"
      var="RCODESIGN_SHA256_${HOST_ARCH^^}"
      [[ "${!var:-}" =~ ^[0-9a-f]{64}$ ]] \
        || die "tools/release/desktop.env: ${var} must be the SHA-256 of apple-codesign-${RCODESIGN_VERSION}-$(rcodesign_triple)-unknown-linux-musl.tar.gz"
      substep "rcodesign: ${RCODESIGN_VERSION} (signs the macOS app ad hoc)"
      ;;
  esac
}

# build_desktop SYSTEM CPU: the desktop app of one system and CPU in 2 phases (3 for macOS, for
# Windows 1 and one per file): Node.js's official build and the app for them, electron-builder
# around them, and for macOS the ad hoc signature and the zip. For Windows the staged app is
# packaged once per chosen file, the portable file and the setup file (WINDOWS_FILES). Each file
# of section 9.7 is a release file, proved by unpacking it (prove_desktop), as it does not run here.
build_desktop() {
  local system="$1" arch="$2" name dir out file chosen=("")
  if [[ "$system" == windows ]]; then chosen=("${WINDOWS_FILES[@]}"); fi
  dir="$STAGE/desktop-${system}-${arch}" out="$STAGE/desktop-out-${system}-${arch}"
  action "Staging the desktop app for $(desktop_label "$system" "$arch")..."
  rm -rf "$dir"
  stage_payload "$system" "$arch" "$dir"
  # The window's icon on Linux (Windows and macOS take the app's own).
  if [[ "$system" == linux ]]; then
    install -m 0644 "$DESKTOP/build/icon.png" "$dir/icon.png"
    substep "icon.png (the window's icon on Linux)"
  fi
  advance "app files ${system} ${arch}"

  for file in "${chosen[@]}"; do
    name="$(desktop_file "$system" "$arch" "$file")"
    package_desktop "$system" "$arch" "$dir" "$out" "$name" "$file"
    if [[ "$file" == installer ]]; then
      advance "setup file ${system} ${arch}"
    else
      advance "packaging ${system} ${arch}"
    fi
    if [[ "$system" == macos ]]; then
      sign_macos "$arch" "$out" "$name"
      advance "signing macos ${arch}"
    fi
    # electron-builder's unpacked app is not needed once the file is in dist/; the staged folder
    # stays for the proof.
    rm -rf "$out"
    if [[ "$file" == installer ]]; then
      add_release_file file "$name" Setup prove_desktop "$system" "$arch"
    else
      add_release_file file "$name" Desktop prove_desktop "$system" "$arch"
    fi
  done
}

# package_desktop SYSTEM ARCH DIR OUT NAME [FILE] runs electron-builder
# (apps/desktop/electron-builder.config.ts) for one system and CPU with the staged folder DIR
# as <resources>, into OUT; the Windows and Linux file goes to dist/NAME, the macOS app stays in
# OUT for sign_macos. For Windows FILE is portable (electron-builder's portable target) or
# installer (its nsis target, the setup file, with Wine in .dev/cache/wine/). Electron comes from
# electron-builder's own download, cached in .dev/cache/electron/ and checked against
# electron's checksums.json; electron-builder's tools (NSIS, AppImage, 7-Zip) are cached in
# .dev/cache/electron-builder/, each checked by electron-builder against its own SHA-256.
package_desktop() {
  local system="$1" arch="$2" dir="$3" out="$4" name="$5" file="${6:-}" flag zip cached want got ftype what="" target=()
  case "$file" in
    portable)  target=(XD_DESKTOP_WINDOWS=portable) what="the portable file, " ;;
    installer) target=(XD_DESKTOP_WINDOWS=nsis WINEPREFIX="$WINE_PREFIX") what="the setup file, " ;;
  esac
  if [[ "$file" == installer ]]; then
    action "Packaging the setup file of the desktop app for $(desktop_label "$system" "$arch") (electron-builder)..."
  else
    action "Packaging the desktop app for $(desktop_label "$system" "$arch") (electron-builder)..."
  fi
  [[ -f "$DESKTOP/dist/main.mjs" ]] || die "make build did not write apps/desktop/dist/main.mjs"
  case "$system" in
    windows) flag=--win ;;
    linux)   flag=--linux ;;
    macos)   flag=--mac ;;
  esac
  zip="electron-v${ELECTRON_VERSION}-$(electron_platform "$system")-$(node_arch "$arch").zip"
  want="$(electron_sum "$zip")"

  # @electron/get checks its download against SHASUMS256.txt-<version> at the cache's root
  # (offline), written here from electron's checksums.json.
  mkdir -p "$CACHE/electron" "$CACHE/electron-builder"
  node -e '
    const sums = require(process.argv[1])
    for (const [file, sum] of Object.entries(sums)) console.log(sum + " *" + file)
  ' "$DESKTOP/node_modules/electron/checksums.json" >"$CACHE/electron/SHASUMS256.txt-${ELECTRON_VERSION}" \
    || die "cannot write .dev/cache/electron/SHASUMS256.txt-${ELECTRON_VERSION}"

  rm -rf "$out"
  step "electron-builder ${flag} --$(node_arch "$arch") (${what}Electron ${ELECTRON_VERSION}, version ${VER})"
  run_cmd env XD_RELEASE_VERSION="$VER" XD_DESKTOP_RESOURCES="$dir" XD_DESKTOP_OUTPUT="$out" \
    XD_DESKTOP_FILE="$name" "${target[@]}" XD_ELECTRON_CACHE="$CACHE/electron" ELECTRON_BUILDER_CACHE="$CACHE/electron-builder" \
    NO_UPDATE_NOTIFIER=1 "$DESKTOP/node_modules/.bin/electron-builder" --projectDir "$DESKTOP" \
    --config electron-builder.config.ts "$flag" "--$(node_arch "$arch")" --publish never \
    || die "electron-builder failed for the desktop app for $(desktop_label "$system" "$arch") (${name})"

  # The Electron electron-builder used: its download in the cache, with the pinned SHA-256.
  cached="$(find "$CACHE/electron" -type f -name "$zip" -print -quit)"
  [[ -n "$cached" ]] || die "electron-builder did not keep ${zip} in .dev/cache/electron/"
  got="$(sha256sum "$cached" | cut -d' ' -f1)"
  [[ "$got" == "$want" ]] \
    || die "${cached#"$ROOT"/} has the SHA-256 ${got}, not ${want} (apps/desktop/node_modules/electron/checksums.json)"
  substep "${C_GREEN}Electron: PASS${RESET} (${zip}, SHA-256 ${want})"

  if [[ "$system" == macos ]]; then
    return
  fi
  [[ -f "$out/$name" ]] \
    || die "electron-builder did not write ${name} into dist/build/${out##*/}; it holds: $(find "$out" -mindepth 1 -maxdepth 1 -printf '%f ')"
  mv -f "$out/$name" "$DIST/$name"
  chmod 0755 "$DIST/$name"
  ftype="$(file -b "$DIST/$name")"
  substep "dist/${name}: ${ftype}"
  substep "size: $(file_size "$name")"
}

# fetch_rcodesign puts rcodesign (apple-codesign) for this computer's CPU in dist/build/rcodesign/
# and its path in RCODESIGN: the official release pinned in tools/release/desktop.env, cached
# in .dev/cache/rcodesign/ and checked against its SHA-256 before it is used.
fetch_rcodesign() {
  local file url var want cache got version
  [[ -z "$RCODESIGN" ]] || return 0
  file="apple-codesign-${RCODESIGN_VERSION}-$(rcodesign_triple)-unknown-linux-musl"
  url="https://github.com/indygreg/apple-platform-rs/releases/download/apple-codesign%2F${RCODESIGN_VERSION}/${file}.tar.gz"
  var="RCODESIGN_SHA256_${HOST_ARCH^^}"
  want="${!var}"
  cache="$CACHE/rcodesign/${file}.tar.gz"
  mkdir -p "$CACHE/rcodesign"

  if [[ -f "$cache" ]] && [[ "$(sha256sum "$cache" | cut -d' ' -f1)" == "$want" ]]; then
    substep "cached: .dev/cache/rcodesign/${file}.tar.gz"
  else
    rm -f "$cache"
    step "Downloading ${file}.tar.gz from github.com"
    PART_FILE="$cache.part"
    run_cmd curl -fL --proto '=https' --tlsv1.2 --retry 2 --connect-timeout 20 -# -o "$PART_FILE" "$url" \
      || die "the download of ${url} failed"
    got="$(sha256sum "$PART_FILE" | cut -d' ' -f1)"
    [[ "$got" == "$want" ]] \
      || die "${file}.tar.gz has the SHA-256 ${got}, not the pinned ${want} (tools/release/desktop.env)"
    mv -f "$PART_FILE" "$cache"
    PART_FILE=""
  fi
  substep "${C_GREEN}SHA-256: PASS${RESET} (${want})"

  rm -rf "$STAGE/rcodesign" && mkdir -p "$STAGE/rcodesign"
  tar -xzf "$cache" -C "$STAGE/rcodesign" --strip-components=1 "${file}/rcodesign" \
    || die "cannot unpack ${file}/rcodesign from ${file}.tar.gz; it holds: $(tar -tzf "$cache" | head -n 5 | tr '\n' ' ')"
  RCODESIGN="$STAGE/rcodesign/rcodesign"
  version="$("$RCODESIGN" --version 2>&1)" || die "rcodesign does not run: ${version}"
  [[ "$version" == *"$RCODESIGN_VERSION"* ]] || die "rcodesign says ${version}, not ${RCODESIGN_VERSION}"
  substep "${version}"
}

# rcodesign_verify FILE: rcodesign verify finds no problem with the signature of the Mach-O file
# FILE, other than the missing cryptographic (CMS) signature an ad hoc signature has by design
# (rcodesign 0.29.0 counts its empty CMS blob as a problem, "CMS error: missing further values")
# and verify's own warning that it "is known to be buggy"; otherwise it prints the last words of
# verify.
rcodesign_verify() {
  local out others
  if out="$("$RCODESIGN" verify "$1" 2>&1)"; then
    return 0
  fi
  others="$(grep -v -i -E 'cryptographic signature|cms|^error|known to be buggy' <<<"$out" || true)"
  if [[ -n "${others//[[:space:]]/}" || ( "$out" != *[Cc]ryptographic* && "$out" != *CMS* ) ]]; then
    tail -n 5 <<<"$out" | tr '\n' ' '
    return 1
  fi
}

# sign_macos ARCH OUT NAME signs the xDesign.app electron-builder wrote into OUT ad hoc (no
# identity: no Apple account, docs/plan/18 section 9.7) with rcodesign, the bundle and the
# programs in it, then zips it into dist/NAME with its links kept (the frameworks' Versions/
# Current), so the signature is inside the zip.
sign_macos() {
  local arch="$1" out="$2" name="$3" app log problems listing
  app="$(find "$out" -mindepth 2 -maxdepth 2 -type d -name 'xDesign.app' -print -quit)"
  [[ -n "$app" ]] || die "electron-builder did not write xDesign.app into dist/build/${out##*/}"
  action "Signing the desktop app for macOS ${arch} (ad hoc, rcodesign)..."
  fetch_rcodesign

  # rcodesign names every file it seals: its words go to a log, shown when it fails.
  step "rcodesign sign xDesign.app (no identity: ad hoc)"
  log="$STAGE/rcodesign-macos-${arch}.log"
  substep "\$ rcodesign sign ${app#"$ROOT"/}  (log: dist/build/${log##*/})"
  hide_bar
  "$RCODESIGN" sign "$app" >"$log" 2>&1 \
    || die "rcodesign could not sign xDesign.app for macOS ${arch}: $(tail -n 5 "$log" | tr '\n' ' ')"
  problems="$(rcodesign_verify "$app/Contents/MacOS/xDesign")" \
    || die "rcodesign verify refuses xDesign.app/Contents/MacOS/xDesign for macOS ${arch}: ${problems}"
  substep "${C_GREEN}signature: PASS${RESET} (ad hoc; rcodesign verify Contents/MacOS/xDesign)"

  step "zip (xDesign.app, links kept, no extra fields, the commit time)"
  substep "target: dist/build/${out##*/}/${app#"$out"/}  ->  dist/${name}"
  # Fixed times (zip keeps local time, so TZ is UTC), the names sorted and no extra fields (-X)
  # make the zip a function of the signed app; -y stores the links as links.
  find "$app" -exec touch -h -d "@${SOURCE_DATE_EPOCH}" {} +
  PART_FILE="$DIST/.${name}.part"
  rm -f "$PART_FILE"
  (cd "$(dirname "$app")" && find xDesign.app | sort | TZ=UTC0 zip -q -X -y -9 "$PART_FILE" -@) \
    || die "zip failed to pack xDesign.app for macOS ${arch}"
  unzip -tqq "$PART_FILE" || die "the packed ${name} does not read back"
  listing="$(unzip -Z1 "$PART_FILE" | sed -n 1p)"
  [[ "$listing" == xDesign.app/ ]] || die "the packed ${name} should begin with xDesign.app/; it lists: ${listing}"
  mv -f "$PART_FILE" "$DIST/$name" || die "could not rename the packed zip to ${name}"
  PART_FILE=""
  substep "size: $(file_size "$name")"
}

# ---------------------------------------------------------------------------
# Stage 7: SHA256SUMS over every release file, and its signature.
# ---------------------------------------------------------------------------
write_sums() {
  local name sums=()
  action "Writing the checksums..."
  # The packs first, then the files, each in build order: for the Linux server the tar.gz
  # files, then the files, amd64 before arm64 (as before the Windows server and desktop app).
  for name in "${RELEASE_FILES[@]}"; do
    if [[ "${FILE_KIND[$name]}" == pack ]]; then sums+=("$name"); fi
  done
  for name in "${RELEASE_FILES[@]}"; do
    if [[ "${FILE_KIND[$name]}" == file ]]; then sums+=("$name"); fi
  done
  (( ${#sums[@]} > 0 )) || die "no release file was built"
  (cd "$DIST" && sha256sum "${sums[@]}" >SHA256SUMS) || die "sha256sum failed"
  substep "dist/SHA256SUMS: ${#sums[@]} files"

  # The signature covers SHA256SUMS, and through it every file (dormant until the key exists).
  if (( SIGNING )); then
    step "Signing SHA256SUMS (ssh-keygen -Y sign, namespace ${SIG_NAMESPACE})"
    run_cmd ssh-keygen -q -Y sign -f "$SIGNING_KEY" -n "$SIG_NAMESPACE" "$DIST/SHA256SUMS" \
      || die "ssh-keygen could not sign SHA256SUMS"
    [[ -f "$DIST/SHA256SUMS.sig" ]] || die "ssh-keygen did not write dist/SHA256SUMS.sig"
    printf '%s %s\n' "$SIG_NAMESPACE" "$PUBLIC_KEY" >"$STAGE/allowed_signers"
    ssh-keygen -q -Y verify -f "$STAGE/allowed_signers" -I "$SIG_NAMESPACE" -n "$SIG_NAMESPACE" \
      -s "$DIST/SHA256SUMS.sig" <"$DIST/SHA256SUMS" >/dev/null \
      || die "SHA256SUMS.sig does not verify against $SIGNING_KEY.pub"
    rm -f "$STAGE/allowed_signers"
    substep "${C_GREEN}signature: PASS${RESET} (dist/SHA256SUMS.sig)"
  else
    substep "not signed (no .dev/release-signing-key)"
  fi
}

# ---------------------------------------------------------------------------
# Stage 8: the release notes from docs/release-notes-template.md.
# ---------------------------------------------------------------------------
write_notes() {
  local out="$DIST/release-notes-${VER}.md" text files="" sums signature_file="" signature name payloads="" entry
  action "Writing the release notes..."
  # The template's own notes end at its first "---" line; the rest is the release notes.
  text="$(sed '1,/^---$/d' "$ROOT/docs/release-notes-template.md")"
  [[ -n "$text" ]] || die "docs/release-notes-template.md has no '---' line with the notes below it"
  # Every release file in build order, and every payload's SHA-256.
  for name in "${RELEASE_FILES[@]}"; do
    files+="${files:+, }\`${name}\`"
  done
  for entry in "${PAYLOAD_NOTES[@]}"; do
    payloads+="${payloads:+, }${entry}"
  done
  payloads="${payloads:-none}"
  if (( SIGNING )); then
    signature_file=" and \`SHA256SUMS.sig\`"
    signature="signed, \`${PUBLIC_KEY}\`"
  else
    signature="not signed (no .dev/release-signing-key)"
  fi
  sums="$(cat "$DIST/SHA256SUMS")"
  text="${text#$'\n'}"
  text="${text//'{{version}}'/"$VER"}"
  text="${text//'{{built_at}}'/"$BUILT_AT"}"
  text="${text//'{{files}}'/"$files"}"
  text="${text//'{{signature_file}}'/"$signature_file"}"
  text="${text//'{{min_upgrade_from}}'/"$MIN_UPGRADE_FROM"}"
  text="${text//'{{schema_floor}}'/"$SCHEMA_FLOOR"}"
  text="${text//'{{commit}}'/"$COMMIT"}"
  text="${text//'{{go_version}}'/"$GO_VERSION"}"
  text="${text//'{{node_version}}'/"$NODE_VERSION"}"
  text="${text//'{{payload_sha256}}'/"$payloads"}"
  text="${text//'{{signature}}'/"$signature"}"
  text="${text//'{{sha256sums}}'/"$sums"}"
  [[ "$text" != *'{{'* ]] || die "docs/release-notes-template.md uses a word in double braces that build.sh does not fill: $(grep -o '{{[^}]*}}' <<<"$text" | head -n 1)"

  # An earlier build of this version may have notes filled in by hand: they are kept aside.
  if [[ -f "$out" ]] && [[ "$(cat "$out")" != "$text" ]]; then
    mv -f "$out" "$out.bak"
    warn "the earlier dist/release-notes-${VER}.md is kept as release-notes-${VER}.md.bak"
  fi
  printf '%s\n' "$text" >"$out"
  substep "dist/release-notes-${VER}.md (fill in the notes in angle brackets)"
}

# ---------------------------------------------------------------------------
# Stage 9: prove what the owner receives.
# ---------------------------------------------------------------------------

# executables_in DIR lists the files of DIR/runtime and DIR/app with the execute bit, sorted.
executables_in() { (cd "$1" && find runtime app -type f -perm -u=x | sort); }

prove() {
  local name proof=()
  action "Proving the release files..."
  (cd "$DIST" && sha256sum --quiet --check SHA256SUMS) || die "dist/ does not match SHA256SUMS"
  substep "${C_GREEN}SHA256SUMS: PASS${RESET}"
  # Then each release file's own proof (add_release_file), in build order.
  for name in "${RELEASE_FILES[@]}"; do
    read -ra proof <<<"${FILE_PROOF[$name]}"
    if (( ${#proof[@]} > 0 )); then
      "${proof[@]}" "$name"
    fi
  done
}

# prove_tarball FILE NAME: the tar.gz NAME holds the release file FILE, byte for byte.
prove_tarball() {
  local file="$1" name="$2" smoke="$STAGE/smoke"
  rm -rf "$smoke" && mkdir -p "$smoke"
  tar -xzf "$DIST/$name" -C "$smoke" || die "${name} cannot be read"
  cmp -s "$DIST/$file" "$smoke/$file" || die "${name}: the file inside differs from dist/${file}"
  rm -rf "$smoke"
  substep "${C_GREEN}${name}: PASS${RESET} (the same bytes as dist/${file})"
}

# prove_server_linux CPU NAME: on this computer's CPU the Linux file runs, names this release
# and writes the payload it was built with; another CPU is not run.
prove_server_linux() {
  local arch="$1" name="$2" dir out want written
  if [[ "$arch" != "$HOST_ARCH" ]]; then
    substep "${name}: not run (this computer's CPU is ${HOST_ARCH})"
    return
  fi

  # The file runs and names this release: every key of version --json.
  step "Running ${name} version --json"
  out="$("$DIST/$name" version --json)" || die "${name}: version --json failed"
  for want in "\"version\": \"${VER}\"" "\"commit\": \"${COMMIT}\"" "\"built_at\": \"${BUILT_AT}\"" \
    "\"modified\": ${MODIFIED}" "\"arch\": \"${arch}\"" "\"node_version\": \"${NODE_VERSION}\"" \
    "\"payload_sha256\": \"${PAYLOAD_SUM[$arch]}\"" "\"min_upgrade_from\": \"${MIN_UPGRADE_FROM}\"" \
    "\"schema_floor\": \"${SCHEMA_FLOOR}\""; do
    grep -qF -- "$want" <<<"$out" || die "${name}: version --json lacks ${want}: ${out}"
  done
  substep "${C_GREEN}version --json: PASS${RESET}"

  # The release folder the file writes for itself: itself, and the payload it was built
  # with, the same files, bytes and execute bits; and its Node.js runs.
  step "Running ${name} release-files"
  written="$STAGE/release-${arch}"
  rm -rf "$written"
  "$DIST/$name" release-files "$written" >/dev/null || die "${name}: release-files failed"
  cmp -s "$DIST/$name" "$written/xdesign" || die "${name}: release-files wrote an xdesign that differs from the file"
  [[ "$(stat -c %a "$written/xdesign")" == 755 ]] || die "${name}: release-files wrote xdesign without mode 0755"
  dir="$STAGE/payload-${arch}"
  if ! diff -r "$dir/runtime" "$written/runtime" >/dev/null || ! diff -r "$dir/app" "$written/app" >/dev/null; then
    die "${name}: release-files wrote other files than the payload: $(diff -rq "$dir" "$written" | head -n 5 | tr '\n' ' ')"
  fi
  [[ "$(executables_in "$dir")" == "$(executables_in "$written")" ]] \
    || die "${name}: release-files and the payload differ in their execute bits"
  out="$("$written/runtime/node" --version)" || die "${name}: runtime/node does not run"
  [[ "$out" == "$NODE_VERSION" ]] || die "${name}: runtime/node is ${out}, not ${NODE_VERSION}"
  rm -rf "$written"
  substep "${C_GREEN}release-files: PASS${RESET} (xdesign, runtime/ and app/ as built; runtime/node ${out})"
}

# prove_zip FILE NAME: the zip NAME holds the release file FILE alone, byte for byte.
prove_zip() {
  local file="$1" name="$2" smoke="$STAGE/smoke"
  [[ "$(unzip -Z1 "$DIST/$name")" == "$file" ]] || die "${name} should hold ${file} alone"
  rm -rf "$smoke" && mkdir -p "$smoke"
  unzip -q "$DIST/$name" -d "$smoke" || die "${name} cannot be read"
  cmp -s "$DIST/$file" "$smoke/$file" || die "${name}: the file inside differs from dist/${file}"
  rm -rf "$smoke"
  substep "${C_GREEN}${name}: PASS${RESET} (${file} alone, the same bytes as dist/${file})"
}

# prove_server_windows CPU NAME: a Windows file cannot run here, so it is read. file(1) names
# it a Windows console program of the CPU. It holds dist/build/payload-windows-<cpu>.tar.zst
# byte for byte, and that payload's SHA-256 as the build stamped it (release-files checks one
# against the other on Windows). And that payload is the Windows one: runtime/ holds node.exe
# alone, a Windows program of the CPU, and the native modules are better-sqlite3's
# prebuilds/win32-<cpu>.node and @node-rs/argon2-win32-<cpu>-msvc's binary, Windows libraries
# of the CPU, and no other.
prove_server_windows() {
  local arch="$1" name="$2" key="windows-$1" smoke="$STAGE/smoke" payload cpu at want got f
  payload="$STAGE/payload-${key}.tar.zst"
  cpu="$(node_arch "$arch")"
  step "Reading ${name} (a Windows file does not run here)"
  windows_type "$DIST/$name" "$arch" console \
    || die "${name} is not a Windows ${arch} program: $(file -b "$DIST/$name")"
  substep "${C_GREEN}file: PASS${RESET} ($(file -b "$DIST/$name"))"

  # The payload's bytes and the SHA-256 the build stamped, found in the file.
  [[ "$(sha256sum "$payload" | cut -d' ' -f1)" == "${PAYLOAD_SUM[$key]}" ]] \
    || die "dist/build/payload-${key}.tar.zst is not the payload that was built"
  at="$(node -e '
    const fs = require("node:fs")
    const [file, payload, sum] = process.argv.slice(1)
    const exe = fs.readFileSync(file)
    console.log(exe.includes(sum) ? exe.indexOf(fs.readFileSync(payload)) : -1)
  ' "$DIST/$name" "$payload" "${PAYLOAD_SUM[$key]}")" || die "${name} cannot be read"
  [[ "$at" =~ ^[0-9]+$ ]] || die "${name} does not hold dist/build/payload-${key}.tar.zst and its SHA-256"
  substep "${C_GREEN}payload: PASS${RESET} (dist/build/payload-${key}.tar.zst at byte ${at}, SHA-256 ${PAYLOAD_SUM[$key]})"

  # What the payload holds: Node's Windows build and the native modules of Windows for the CPU.
  rm -rf "$smoke" && mkdir -p "$smoke"
  zstd -dcq "$payload" | tar -xf - -C "$smoke" || die "dist/build/payload-${key}.tar.zst cannot be read"
  got="$(find "$smoke/runtime" -mindepth 1 -printf '%P\n')"
  [[ "$got" == node.exe ]] || die "${name}: runtime/ should hold node.exe alone; it holds: $(tr '\n' ' ' <<<"$got")"
  windows_type "$smoke/runtime/node.exe" "$arch" console \
    || die "${name}: runtime/node.exe is not a Windows ${arch} program: $(file -b "$smoke/runtime/node.exe")"
  want="app/node_modules/@node-rs/argon2-win32-${cpu}-msvc/argon2.win32-${cpu}-msvc.node"
  want+=$'\n'"app/node_modules/better-sqlite3/prebuilds/win32-${cpu}.node"
  got="$(cd "$smoke" && find runtime app -type f -name '*.node' | sort)"
  [[ "$got" == "$want" ]] \
    || die "${name}: the native modules should be the Windows ones for ${cpu}; the payload holds: $(tr '\n' ' ' <<<"$got")"
  while read -r f; do
    windows_type "$smoke/$f" "$arch" DLL || die "${name}: ${f} is not a Windows ${arch} library: $(file -b "$smoke/$f")"
  done <<<"$got"
  rm -rf "$smoke"
  substep "${C_GREEN}payload contents: PASS${RESET} (runtime/node.exe and the native modules for win32-${cpu}, all Windows ${arch})"
}

# elf_type FILE ARCH: file(1) names FILE a 64-bit ELF file of the CPU, as in "ELF 64-bit LSB pie
# executable, x86-64, version 1 (SYSV), ..." (arm64 is "ARM aarch64").
elf_type() {
  local ftype machine
  ftype="$(file -b "$1")"
  case "$2" in
    amd64) machine="x86-64" ;;
    arm64) machine="ARM aarch64" ;;
    *)     return 1 ;;
  esac
  [[ "$ftype" == "ELF 64-bit LSB "* && "$ftype" == *", ${machine},"* ]]
}

# macho_type FILE ARCH: file(1) names FILE a 64-bit Mach-O file of the CPU, as in "Mach-O 64-bit
# arm64 executable" (x86_64 for amd64; some versions of file put the CPU last).
macho_type() {
  local ftype cpu
  ftype="$(file -b "$1")"
  case "$2" in
    amd64) cpu="x86_64" ;;
    arm64) cpu="arm64" ;;
    *)     return 1 ;;
  esac
  [[ "$ftype" == "Mach-O 64-bit"* && "$ftype" == *"$cpu"* ]]
}

# nsis_header FILE TEXT... reads the script of the NSIS program FILE without running it: its
# first header after the stub (the signature 0xDEADBEEF "NullsoftInst") and the header block
# that follows, deflated as electron-builder's SetCompressor zlib writes it. It prints
# "installer" or "uninstaller" (the first header's flag), then each TEXT the script's strings
# (UTF-16, a Unicode NSIS) do not hold, one per line.
nsis_header() {
  node -e '
    const fs = require("node:fs")
    const zlib = require("node:zlib")
    const [file, ...texts] = process.argv.slice(1)
    const fd = fs.openSync(file, "r")
    const head = Buffer.alloc(Math.min(fs.fstatSync(fd).size, 8 << 20))
    fs.readSync(fd, head, 0, head.length, 0)
    const at = head.indexOf(Buffer.from("efbeadde4e756c6c736f6674496e7374", "hex")) - 4
    if (at < 0) throw new Error("no NSIS first header in its first " + head.length + " bytes")
    const flags = head.readUInt32LE(at)
    const size = head.readUInt32LE(at + 28)
    const block = Buffer.alloc(size & 0x7fffffff)
    fs.readSync(fd, block, 0, block.length, at + 32)
    const script = size >>> 31 ? zlib.inflateRawSync(block) : block
    console.log(flags & 1 ? "uninstaller" : "installer")
    for (const text of texts) if (!script.includes(Buffer.from(text, "utf16le"))) console.log(text)
  ' "$@"
}

# prove_desktop SYSTEM CPU NAME: a desktop file does not run here, so it is unpacked and read.
# Its header: NSIS's portable Windows program, an ELF file of the CPU with the AppImage's
# squashfs where the ELF ends, or a zip. Unpacked with 7z, unsquashfs or unzip (none of them
# runs the file), it holds Electron's program for the system and CPU; <resources>/runtime with
# Node.js alone, a program of the system and CPU; <resources>/app with the files staged in
# dist/build/desktop-<system>-<cpu>/app (byte for byte for Windows and Linux, by name for macOS,
# whose programs the signature changed) and the native modules of the system and CPU and no
# other; app.asar's package.json with this version. For Linux <resources>/icon.png, for macOS
# the frameworks' links and rcodesign verify of the app's program and of Node.js. The Windows
# setup file (-setup.exe, docs/plan/20 section 3) is an NSIS installer whose script names the
# entry "xDesign desktop app"; it holds the app package of its CPU alone and the uninstaller, an
# NSIS uninstaller whose script asks the question of section 4; then the same contents.
prove_desktop() {
  local system="$1" arch="$2" name="$3" smoke="$STAGE/smoke" dir="$STAGE/desktop-$1-$2"
  local cpu kind ftype found offset root res main node want got f uninstaller
  cpu="$(node_arch "$arch")"
  kind="$(desktop_label "$system" "$arch")"
  step "Reading ${name} (the desktop app does not run here)"
  rm -rf "$smoke" && mkdir -p "$smoke"
  ftype="$(file -b "$DIST/$name")"
  case "$system" in
    windows)
      # NSIS's own program is 32-bit x86 for both CPUs; it unpacks the app of its CPU, a 7z
      # package inside it.
      f="portable Windows program"
      if [[ "$name" == *-setup.exe ]]; then f="Windows setup file"; fi
      [[ "$ftype" == "PE32 executable"* && "$ftype" == *"MS Windows"* && "$ftype" == *"Nullsoft Installer"* ]] \
        || die "${name} is not a ${f} (NSIS): ${ftype}"
      7z x -y -o"$smoke/nsis" "$DIST/$name" >/dev/null || die "7z cannot unpack ${name}"
      found="$(cd "$smoke/nsis" && find . -type f -name 'app-*.7z' -printf '%P\n')"
      [[ "$found" == *.7z && "$found" != *$'\n'* ]] \
        || die "${name} should hold one app package (app-<cpu>.7z); it holds: $(cd "$smoke/nsis" && find . -type f -printf '%P ')"
      if [[ "$name" == *-setup.exe ]]; then
        # The package of its CPU, as the setup file picks it on Windows: app-64 or app-arm64.
        want="app-${cpu#x}.7z"
        [[ "${found##*/}" == "$want" ]] || die "${name} should hold the app package for ${arch}, ${want}; it holds ${found}"
        got="$(nsis_header "$DIST/$name" "xDesign desktop app")" || die "${name}: its NSIS script cannot be read"
        [[ "$got" == installer ]] \
          || die "${name}: its NSIS script should be an installer naming \"xDesign desktop app\"; it reads: $(tr '\n' ' ' <<<"$got")"
        uninstaller="$(cd "$smoke/nsis" && find . -type f -name 'Uninstall xDesign.exe' -printf '%P\n')"
        [[ -n "$uninstaller" && "$uninstaller" != *$'\n'* ]] \
          || die "${name} should hold one uninstaller (Uninstall xDesign.exe); it holds: $(cd "$smoke/nsis" && find . -type f -printf '%P ')"
        f="$(file -b "$smoke/nsis/$uninstaller")"
        [[ "$f" == "PE32 executable"* && "$f" == *"Nullsoft Installer"* ]] \
          || die "${name}: ${uninstaller} is not a Windows uninstaller (NSIS): ${f}"
        got="$(nsis_header "$smoke/nsis/$uninstaller" $'Also remove your designs?\r\n\r\nYes removes the designs, backups and settings in %APPDATA%\\xDesign.\r\nNo keeps them for the next time you install xDesign.')" \
          || die "${name}: the NSIS script of ${uninstaller} cannot be read"
        [[ "$got" == uninstaller ]] \
          || die "${name}: ${uninstaller} should be an NSIS uninstaller asking \"Also remove your designs?\"; it reads: $(tr '\n' ' ' <<<"$got")"
        substep "${C_GREEN}setup: PASS${RESET} (${want}, the entry \"xDesign desktop app\", ${uninstaller##*/} asking \"Also remove your designs?\")"
      fi
      7z x -y -o"$smoke/app" "$smoke/nsis/$found" >/dev/null || die "7z cannot unpack ${found} from ${name}"
      root="$smoke/app" res="$smoke/app/resources" main="$smoke/app/xDesign.exe" node=node.exe
      windows_type "$main" "$arch" GUI || die "${name}: xDesign.exe is not a Windows ${arch} program: $(file -b "$main")"
      ;;
    linux)
      elf_type "$DIST/$name" "$arch" || die "${name} is not an ELF file for ${arch}: ${ftype}"
      # The squashfs starts where the AppImage's ELF runtime ends (its section headers come
      # last), with the magic "hsqs".
      offset="$(node -e '
        const fs = require("node:fs")
        const fd = fs.openSync(process.argv[1], "r")
        const head = Buffer.alloc(64)
        fs.readSync(fd, head, 0, 64, 0)
        const end = Number(head.readBigUInt64LE(0x28)) + head.readUInt16LE(0x3a) * head.readUInt16LE(0x3c)
        const magic = Buffer.alloc(4)
        fs.readSync(fd, magic, 0, 4, end)
        console.log(end + " " + magic.toString("hex"))
      ' "$DIST/$name")" || die "${name} cannot be read"
      [[ "$offset" == *" 68737173" ]] || die "${name}: no squashfs where its ELF runtime ends (the byte and the magic found: ${offset})"
      offset="${offset% *}"
      unsquashfs -q -no-xattrs -o "$offset" -d "$smoke/app" "$DIST/$name" >/dev/null \
        || die "unsquashfs cannot read the squashfs of ${name} at byte ${offset}"
      root="$smoke/app" res="$smoke/app/resources" main="$smoke/app/xdesign" node=node
      elf_type "$main" "$arch" || die "${name}: xdesign is not a Linux ${arch} program: $(file -b "$main")"
      [[ -f "$res/icon.png" ]] || die "${name}: resources/icon.png (the window's icon) is missing"
      ;;
    macos)
      [[ "$ftype" == "Zip archive"* ]] || die "${name} is not a zip: ${ftype}"
      unzip -q "$DIST/$name" -d "$smoke" || die "${name} cannot be unpacked"
      root="$smoke/xDesign.app" res="$smoke/xDesign.app/Contents/Resources" main="$smoke/xDesign.app/Contents/MacOS/xDesign" node=node
      macho_type "$main" "$arch" || die "${name}: Contents/MacOS/xDesign is not a macOS ${arch} program: $(file -b "$main" 2>&1)"
      [[ -L "$root/Contents/Frameworks/Electron Framework.framework/Versions/Current" ]] \
        || die "${name}: the zip did not keep the frameworks' links (Electron Framework.framework/Versions/Current)"
      for f in "$main" "$res/runtime/node"; do
        got="$(rcodesign_verify "$f")" || die "${name}: rcodesign verify refuses ${f#"$smoke"/}: ${got}"
      done
      substep "${C_GREEN}signature: PASS${RESET} (rcodesign verify Contents/MacOS/xDesign and Contents/Resources/runtime/node)"
      ;;
  esac
  substep "${C_GREEN}file: PASS${RESET} (${ftype})"

  # Node.js alone in runtime/, a program of the system and CPU.
  got="$(find "$res/runtime" -mindepth 1 -printf '%P\n' 2>/dev/null || true)"
  [[ "$got" == "$node" ]] || die "${name}: resources/runtime should hold ${node} alone; it holds: $(tr '\n' ' ' <<<"$got")"
  case "$system" in
    windows) windows_type "$res/runtime/$node" "$arch" console ;;
    linux)   elf_type "$res/runtime/$node" "$arch" ;;
    macos)   macho_type "$res/runtime/$node" "$arch" ;;
  esac || die "${name}: resources/runtime/${node} is not a program for ${kind}: $(file -b "$res/runtime/$node")"

  # The app as staged, with the native modules of the system and CPU and no other.
  if [[ "$system" == macos ]]; then
    [[ "$(cd "$res/app" && find . -type f | sort)" == "$(cd "$dir/app" && find . -type f | sort)" ]] \
      || die "${name}: Contents/Resources/app holds other files than dist/build/desktop-${system}-${arch}/app"
  elif ! diff -rq "$dir/app" "$res/app" >/dev/null || ! cmp -s "$dir/runtime/$node" "$res/runtime/$node"; then
    die "${name}: resources/ differs from dist/build/desktop-${system}-${arch}: $(diff -rq "$dir/app" "$res/app" | head -n 5 | tr '\n' ' ')"
  fi
  case "$system" in
    windows) want="app/node_modules/@node-rs/argon2-win32-${cpu}-msvc/argon2.win32-${cpu}-msvc.node" f="win32-${cpu}" ;;
    linux)   want="app/node_modules/@node-rs/argon2-linux-${cpu}-gnu/argon2.linux-${cpu}-gnu.node" f="linux-${cpu}" ;;
    macos)   want="app/node_modules/@node-rs/argon2-darwin-${cpu}/argon2.darwin-${cpu}.node" f="darwin-${cpu}" ;;
  esac
  want+=$'\n'"app/node_modules/better-sqlite3/prebuilds/${f}.node"
  got="$(cd "$res" && find app -type f -name '*.node' | sort)"
  [[ "$got" == "$want" ]] \
    || die "${name}: the native modules should be the ones for ${kind}; it holds: $(tr '\n' ' ' <<<"$got")"
  while read -r f; do
    case "$system" in
      windows) windows_type "$res/$f" "$arch" DLL ;;
      linux)   elf_type "$res/$f" "$arch" ;;
      macos)   macho_type "$res/$f" "$arch" ;;
    esac || die "${name}: ${f} is not a library for ${kind}: $(file -b "$res/$f")"
  done <<<"$got"

  # The packaged package.json, read with electron-builder's own @electron/asar: the name, this
  # version ("About xDesign") and the main script.
  got="$(node -e '
    const fs = require("node:fs")
    const path = require("node:path")
    const [desktop, asar] = process.argv.slice(1)
    const builder = fs.realpathSync(path.join(desktop, "node_modules", "electron-builder"))
    const lib = fs.realpathSync(path.join(builder, "..", "app-builder-lib"))
    const pkg = JSON.parse(require(require.resolve("@electron/asar", { paths: [lib] })).extractFile(asar, "package.json"))
    console.log([pkg.productName, pkg.version, pkg.main].join(" "))
  ' "$DESKTOP" "$res/app.asar")" || die "${name}: the package.json in resources/app.asar cannot be read"
  want="xDesign ${VER} dist/main.mjs"
  [[ "$got" == "$want" ]] || die "${name}: the package.json in resources/app.asar says ${got}, not ${want}"
  rm -rf "$smoke"
  substep "${C_GREEN}contents: PASS${RESET} (Electron's program, runtime/${node} and app/ for ${kind}, version ${VER})"
}

# ---------------------------------------------------------------------------
# pacman-style transaction summary.
# ---------------------------------------------------------------------------
summary() {
  local name signed
  if (( SIGNING )); then signed="SHA256SUMS.sig"; else signed="not signed"; fi

  printf '\n'
  printf '%b%-11s%b %s\n' "$BOLD" "Package"  "$RESET" "xdesign"
  printf '%b%-11s%b %s\n' "$BOLD" "Version"  "$RESET" "$VER"
  printf '%b%-11s%b %s\n' "$BOLD" "Commit"   "$RESET" "${COMMIT}$([[ "$MODIFIED" == true ]] && printf ' (modified)')"
  printf '%b%-11s%b %s\n' "$BOLD" "Built"    "$RESET" "$BUILT_AT"
  printf '%b%-11s%b %s\n' "$BOLD" "Node.js"  "$RESET" "$NODE_VERSION"
  for name in "${RELEASE_FILES[@]}"; do
    printf '%b%-11s%b %s\n' "$BOLD" "${FILE_LABEL[$name]}" "$RESET" "dist/${name} ($(file_size "$name"))"
  done
  printf '%b%-11s%b %s\n' "$BOLD" "Sums"     "$RESET" "dist/SHA256SUMS (${signed})"
  printf '%b%-11s%b %s\n' "$BOLD" "Notes"    "$RESET" "dist/release-notes-${VER}.md"
  printf '\n'
  printf '%b==> Build complete:%b %s\n' "${BOLD}${C_GREEN}" "$RESET" "$DIST"
}

# ---------------------------------------------------------------------------
# Main.
# ---------------------------------------------------------------------------

# The exit trap, on success, die and Ctrl-C alike: close the bar, and remove the file
# being written, the payload copy in the helper's source and the check folders.
on_exit() {
  finish_bar
  if [[ -n "$PART_FILE" ]]; then
    rm -f "$PART_FILE"
  fi
  rm -f "$PAYLOAD_EMBED"
  rm -rf "$STAGE/smoke" "$STAGE"/release-* "$STAGE"/node-*
}

main() {
  setup_colors
  trap on_exit EXIT
  parse_args "$@"

  action "xdesign :: release build"

  # Phase 1: toolchain, working tree (before the questions), version, what to build, CPUs,
  # pins and what each chosen build needs.
  preflight
  check_tree
  resolve_version
  resolve_targets
  resolve_arches
  count_phases
  load_pins
  check_builds
  clean_dist
  advance "checking"

  # Phase 2: the website, and the notices it ships with.
  build_web
  collect_licenses
  advance "building the website"

  # The phases of each chosen build for each CPU: the servers (Linux, Windows), then the
  # desktop app (Windows, Linux, macOS); each adds its release files.
  local system arch
  for system in "${SERVERS[@]}"; do
    for arch in "${ARCHES[@]}"; do
      "build_server_${system}" "$arch"
    done
  done
  for system in "${DESKTOPS[@]}"; do
    for arch in "${ARCHES[@]}"; do
      build_desktop "$system" "$arch"
    done
  done

  write_sums
  advance "checksums"
  write_notes
  advance "release notes"
  prove
  advance "proving"

  advance "done"
  finish_bar

  summary
}

main "$@"
