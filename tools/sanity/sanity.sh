#!/usr/bin/env bash
# make sanity, the only check (docs/plan/14-milestones.md section 1; modeled on xWriter's
# tools/gate/sanity.sh): runs the make targets given as arguments (SANITY_STEPS of the
# Makefile) in order, each with its full log in .dev/gate/latest/<step>.log, and stops at the
# first failure. It prints one line when all pass, or the failing step's name and the last 40
# lines of its log.
#
# On main every check looks at the whole repository. In an agent's worktree (its git dir is not
# the main one) ESLint and Prettier look only at the files that differ from main, committed or
# not, the Go helper's step runs only when something under helper/ differs, and the run first
# waits for one of two build slots (tools/sanity/slot.sh), so parallel agents do not overload
# the desktop. The Go helper's step is skipped anywhere while helper/ does not exist.
#
# Usage: tools/sanity/sanity.sh STEP...   (normally through `make sanity`)
set -euo pipefail
export LC_ALL=C
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

(($#)) || {
	echo "usage: tools/sanity/sanity.sh STEP..." >&2
	exit 2
}

worktree=false
if [[ "$(git rev-parse --absolute-git-dir)" != "$(git rev-parse --path-format=absolute --git-common-dir)" ]]; then
	worktree=true
fi

# slot.sh runs this script again, with XD_SLOT set, once it holds a slot.
if $worktree && [[ -z "${XD_SLOT:-}" ]]; then
	exec tools/sanity/slot.sh "$0" "$@"
fi

changed=""
if $worktree; then
	base="$(git merge-base HEAD main 2>/dev/null || git rev-parse HEAD)"
	changed="$({
		git diff --name-only --diff-filter=d "$base"
		git ls-files --others --exclude-standard
	} | sort -u)"
	# Read by the lint target of the Makefile. A "$" in a name (the route files of TanStack
	# Router, `invite.$token.tsx`) is written `\$$`: make turns `$$` into `$`, and the shell of
	# the recipe takes `\$` as a plain "$".
	files="${changed//$'\n'/ }"
	export LINT_CHANGED=1 CHANGED_FILES="${files//\$/'\$$'}"
fi

logs=.dev/gate/latest
rm -rf "$logs"
mkdir -p "$logs"

started=$SECONDS
passed=0
skipped=()
for step in "$@"; do
	log="$logs/$step.log"
	if [[ "$step" == helper-check ]]; then
		if [[ ! -d helper ]]; then
			echo "skipped: helper/ does not exist yet" >"$log"
			skipped+=("$step")
			continue
		fi
		if $worktree && ! grep -q '^helper/' <<<"$changed"; then
			echo "skipped: nothing under helper/ differs from main" >"$log"
			skipped+=("$step")
			continue
		fi
	fi
	if ! make "$step" >"$log" 2>&1; then
		echo "sanity: $step failed; the last 40 lines of $log:"
		tail -n 40 "$log"
		exit 1
	fi
	passed=$((passed + 1))
done

line="sanity: all $passed checks passed in $((SECONDS - started))s"
if ((${#skipped[@]})); then
	line+=" (skipped: ${skipped[*]})"
fi
echo "$line" | tee "$logs/summary.txt"
