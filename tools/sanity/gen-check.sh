#!/usr/bin/env bash
# The drift check of make gen (make gen-check, a step of make sanity): copies the working tree
# (the tracked files and the new ones, with their uncommitted changes) into a temporary folder
# in .dev/tmp/ that shares this checkout's node_modules and .tools, runs make gen there and
# compares the outputs given as arguments (GEN_OUTPUTS of the Makefile, files or folders) with
# the ones here. Nothing else in this checkout is changed.
#
# Usage: tools/sanity/gen-check.sh OUTPUT...   (normally through `make gen-check`)
set -euo pipefail
export LC_ALL=C
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

(($#)) || {
	echo "usage: tools/sanity/gen-check.sh OUTPUT..." >&2
	exit 2
}

# The copy stays on this checkout's file system (in the git-ignored .dev/): the generators write
# a temporary file into the shared node_modules and rename it into the copy.
mkdir -p .dev/tmp
copy="$PWD/$(mktemp -d .dev/tmp/gen-check.XXXXXX)"
trap 'rm -rf "$copy"' EXIT

# Tracked files deleted in the working tree are left out.
git ls-files -z --cached --others --exclude-standard |
	while IFS= read -r -d '' file; do
		if [[ -e "$file" ]]; then printf '%s\0' "$file"; fi
	done |
	tar --null --files-from=- -cf - |
	tar -xf - -C "$copy"

for dir in node_modules {apps,packages,tools}/*/node_modules .tools; do
	if [[ -d "$dir" ]]; then ln -s "$PWD/$dir" "$copy/$dir"; fi
done

make -C "$copy" gen

status=0
for out in "$@"; do
	diff -ruN "$out" "$copy/$out" || status=1
done
if ((status)); then
	echo "gen-check: the files above differ from what make gen writes; run make gen and commit the result" >&2
fi
exit "$status"
