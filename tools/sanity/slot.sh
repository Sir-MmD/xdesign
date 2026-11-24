#!/usr/bin/env bash
# Runs its arguments while holding one of two build slots (modeled on xWriter's
# tools/gate/slot.sh): at most two make sanity runs of agents' worktrees share this desktop at
# once, and the others wait quietly for their turn. The slots are the lock files 1 and 2 in
# ~/.cache/xdesign/slots/ (flock); the command learns its slot from XD_SLOT.
#
# Usage: tools/sanity/slot.sh COMMAND...   (normally through tools/sanity/sanity.sh)
set -u

slots="${XDG_CACHE_HOME:-$HOME/.cache}/xdesign/slots"
mkdir -p "$slots"
# flock -o: a program the command leaves behind must not keep the slot.
while :; do
	for slot in 1 2; do
		XD_SLOT="$slot" flock -n -o -E 99 "$slots/$slot" "$@"
		status=$?
		[[ "$status" -eq 99 ]] || exit "$status"
	done
	sleep 5
done
