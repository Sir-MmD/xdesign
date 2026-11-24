#!/usr/bin/env bash
# The start check (make start-check, a step of make sanity after build): starts the built server
# bundle (apps/server/dist/server.mjs) on a free loopback port with an empty data folder in
# .dev/tmp/, once as a server and once in the desktop app's mode (docs/plan/18 section 9.3), and
# waits for GET /api/health to answer 200. A bundle that builds but does not start (a name
# declared twice by the bundler, a missing module, a migration that fails) fails here.
#
# Usage: tools/sanity/start-check.sh   (normally through `make start-check`)
set -euo pipefail
export LC_ALL=C
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

bundle=apps/server/dist/server.mjs
[[ -f "$bundle" ]] || {
	echo "start-check: $bundle is missing: run make build first" >&2
	exit 1
}

mkdir -p .dev/tmp
work="$PWD/$(mktemp -d .dev/tmp/start-check.XXXXXX)"
pid=""
cleanup() {
	if [[ -n "$pid" ]]; then kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; fi
	rm -rf "$work"
}
trap cleanup EXIT

# A free port: the system picks one for a socket that is closed right away.
free_port() { node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }

# start NAME [VAR=VALUE...]: runs the bundle with the given environment and waits up to 30 seconds
# for its health route.
start() {
	local name="$1"; shift
	local port; port="$(free_port)"
	mkdir -p "$work/$name"
	env XD_DATA_DIR="$work/$name/data" XD_PORT="$port" XD_PUBLIC_URL="http://127.0.0.1:$port" \
		XD_LOG_LEVEL=warn NODE_ENV=production "$@" node "$bundle" >"$work/$name/log" 2>&1 &
	pid=$!
	local tries=0
	until curl -fsS -o /dev/null "http://127.0.0.1:$port/api/health" 2>/dev/null; do
		if ! kill -0 "$pid" 2>/dev/null || ((++tries > 120)); then
			echo "start-check: the $name did not start; its last lines:" >&2
			tail -n 20 "$work/$name/log" >&2
			exit 1
		fi
		sleep 0.25
	done
	kill "$pid" 2>/dev/null || true
	wait "$pid" 2>/dev/null || true
	pid=""
}

start server
start desktop XD_DESKTOP=1 XD_DESKTOP_KEY="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
echo "start-check: the server and the desktop mode start"
