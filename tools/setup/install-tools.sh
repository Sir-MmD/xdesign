#!/usr/bin/env bash
# Puts the pinned developer tools into .tools/bin (copied from xWriter's
# tools/setup/install-tools.sh, trimmed to the two tools xDesign needs). Run by `make setup-tools`.
#
# - pnpm: a small shim that runs the pinned pnpm through npx (corepack is not bundled with
#   Node 25 or newer), so tools that call `pnpm` directly get the same version.
# - golangci-lint: the release tar.gz from GitHub, checked against the pinned SHA-256 below
#   (the same values as xWriter's), for the Go helper's step of `make sanity`.
#
# - Idempotent: a tool whose installed version already matches is left alone.
# - Fail closed: a download whose checksum differs from the pinned value aborts the script and
#   installs nothing; a binary of another version is removed before the new one is fetched.
#
# Usage: tools/setup/install-tools.sh [--check] [--bin-dir DIR] [TOOL...]
#   TOOL is pnpm or golangci-lint (default: both).
#   --check only verifies that the pinned versions are installed (no download).
set -euo pipefail
export LC_ALL=C

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
bin_dir="$repo_root/.tools/bin"

golangci_lint_version=2.14.0
pnpm_version=12.8.1

# SHA-256 of every release file, keyed by file name.
declare -A sha256=(
	[golangci-lint-2.14.0-linux-amd64.tar.gz]=ab90aeb7b066f92a33415b638a50fe5344bbb75a0d32ad30cc248d88f81032ab
	[golangci-lint-2.14.0-linux-arm64.tar.gz]=ee7ec5f3453d15ddf106fae5a4d6c71737712348a979d1fe9cd52ec7ea299bae
)

die() {
	echo "install-tools: $*" >&2
	exit 1
}

tools=()
check=false
while (($#)); do
	case "$1" in
	--check)
		check=true
		shift
		;;
	--bin-dir)
		[[ $# -ge 2 ]] || die "--bin-dir needs a folder"
		bin_dir="$2"
		shift 2
		;;
	golangci-lint | pnpm)
		tools+=("$1")
		shift
		;;
	*) die "unknown argument '$1' (tools: pnpm golangci-lint)" ;;
	esac
done
((${#tools[@]})) || tools=(pnpm golangci-lint)

[[ "$(uname -s)" == Linux ]] || die "only Linux is supported"
case "$(uname -m)" in
x86_64 | amd64) arch=amd64 ;;
aarch64 | arm64) arch=arm64 ;;
*) die "unsupported architecture $(uname -m) (amd64 and arm64 only)" ;;
esac

mkdir -p "$bin_dir"
work=""
cleanup() { [[ -z "$work" ]] || rm -rf "$work"; }
trap cleanup EXIT

# installed_version NAME prints the version of the installed binary, or nothing.
installed_version() {
	local bin="$bin_dir/$1"
	[[ -x "$bin" ]] || return 0
	case "$1" in
	golangci-lint) "$bin" version --short 2>/dev/null || true ;;
	esac
}

pnpm_shim_content() {
	printf '%s\n' \
		'#!/usr/bin/env bash' \
		'# Written by tools/setup/install-tools.sh: the pinned pnpm through npx.' \
		"exec npx --yes pnpm@$pnpm_version \"\$@\""
}

if $check; then
	ok=true
	for tool in "${tools[@]}"; do
		case "$tool" in
		golangci-lint) want="$golangci_lint_version" ;;
		pnpm)
			if [[ "$(cat "$bin_dir/pnpm" 2>/dev/null)" != "$(pnpm_shim_content)" ]]; then
				echo "install-tools: the pnpm $pnpm_version shim is missing or outdated; run 'make setup-tools'" >&2
				ok=false
			fi
			continue
			;;
		esac
		have="$(installed_version "$tool")"
		if [[ "$have" != "$want" ]]; then
			echo "install-tools: $tool $want is not installed in $bin_dir (found '${have:-nothing}'); run 'make setup-tools'" >&2
			ok=false
		fi
	done
	if $ok; then exit 0; fi
	exit 1
fi

# install NAME VERSION URL FILE MEMBER downloads FILE from URL, checks its pinned checksum and
# installs MEMBER (a path inside the tar.gz).
install() {
	local name="$1" version="$2" url="$3" file="$4" member="$5"
	local want="${sha256[$file]:-}" have current
	[[ -n "$want" ]] || die "no pinned checksum for $file"

	current="$(installed_version "$name")"
	if [[ "$current" == "$version" ]]; then
		echo "install-tools: $name $version already installed"
		return
	fi
	if [[ -e "$bin_dir/$name" ]]; then
		echo "install-tools: removing $name ${current:-of unknown version} (want $version)"
		rm -f "$bin_dir/$name"
	fi

	echo "install-tools: downloading $name $version ($file)"
	# Same file system as bin_dir, so the final mv is an atomic rename.
	work="$(mktemp -d "$bin_dir/.download.XXXXXX")"
	curl --fail --proto '=https' --tlsv1.2 -L --silent --show-error \
		--retry 3 --connect-timeout 30 --max-time 900 \
		-o "$work/$file" "$url" || die "download of $url failed"

	have="$(sha256sum "$work/$file" | cut -d ' ' -f 1)"
	if [[ "$have" != "$want" ]]; then
		rm -rf "$work"
		work=""
		die "checksum mismatch for $file: expected $want, got $have; nothing was installed"
	fi

	mkdir "$work/extract"
	tar -xzf "$work/$file" -C "$work/extract" "$member" || die "cannot extract $member from $file"
	mv "$work/extract/$member" "$work/binary"
	chmod 0755 "$work/binary"
	mv -f "$work/binary" "$bin_dir/$name"
	rm -rf "$work"
	work=""

	current="$(installed_version "$name")"
	if [[ "$current" != "$version" ]]; then
		rm -f "$bin_dir/$name"
		die "$name reports version '$current' after installation, expected $version; removed it"
	fi
	echo "install-tools: installed $name $version (sha256 $want)"
}

# pnpm runs through npx because corepack is not bundled with Node 25 or newer. Tools that call
# `pnpm` directly find this wrapper in .tools/bin (first on the PATH inside make).
install_pnpm_shim() {
	local shim="$bin_dir/pnpm" content
	content="$(pnpm_shim_content)"
	if [[ -f "$shim" && "$(<"$shim")" == "$content" ]]; then
		echo "install-tools: pnpm $pnpm_version shim already installed"
		return
	fi
	printf '%s\n' "$content" >"$shim.tmp"
	chmod 0755 "$shim.tmp"
	mv -f "$shim.tmp" "$shim"
	echo "install-tools: installed the pnpm $pnpm_version shim"
}

for tool in "${tools[@]}"; do
	case "$tool" in
	golangci-lint)
		f="golangci-lint-$golangci_lint_version-linux-$arch.tar.gz"
		install golangci-lint "$golangci_lint_version" \
			"https://github.com/golangci/golangci-lint/releases/download/v$golangci_lint_version/$f" \
			"$f" "golangci-lint-$golangci_lint_version-linux-$arch/golangci-lint"
		;;
	pnpm) install_pnpm_shim ;;
	esac
done
