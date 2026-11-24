#!/usr/bin/env bash
# The icons (make icons): every icon file of xDesign from its logo, apps/desktop/build/icon.svg (the
# owner's choice E of 2026-11-24). Needs rsvg-convert (librsvg), icotool (icoutils), llvm-windres (llvm)
# and python3. Run it
# after changing the logo and commit what it writes:
# and its form for 32 pixels and less, apps/desktop/build/icon-small.svg (bolder, without the dots):
#   apps/desktop/build/icon.png   512 by 512, the Linux app's and window's icon
#   apps/desktop/build/icon.ico   16 to 256 (16 to 32 from icon-small.svg), the Windows app's icon
#   apps/desktop/build/icon.icns  32 to 1024 (ic07 to ic14), the macOS app's icon, drawn with the margin
#                                 macOS icons have (the tile at 824 of 1024)
#   apps/web/public/favicon.svg (icon-small.svg: a tab draws it at 16 or 32), favicon.ico (16 and 32
#                                 small, 48), apple-touch-icon.png (180, the tile's colour to the
#                                 edges, as iOS rounds it itself): the browser's icons
#   helper/cmd/xdesign/rsrc_windows_amd64.syso and rsrc_windows_arm64.syso: icon.ico as the
#                                 Windows server file's icon (Go links a package's .syso files into a
#                                 Windows build by themselves; made with llvm-windres)
#
# Usage: tools/icons.sh   (normally through `make icons`)
set -euo pipefail
export LC_ALL=C
cd "$(dirname "${BASH_SOURCE[0]}")/.."

svg=apps/desktop/build/icon.svg
small=apps/desktop/build/icon-small.svg
for tool in rsvg-convert icotool llvm-windres python3; do
	command -v "$tool" >/dev/null || { echo "icons: $tool is missing" >&2; exit 1; }
done
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# png SVG SIZE OUT: the SVG drawn at SIZE by SIZE pixels.
png() { rsvg-convert --width "$2" --height "$2" --keep-aspect-ratio "$1" -o "$3"; }

# The variants: inner is the logo's drawing without its tile's outline (the tile path is the first
# <path> after </defs>).
body="$(sed -n '/<\/defs>/,/<\/svg>/p' "$svg" | sed '1d;$d')"
defs="$(sed -n '/<defs>/,/<\/defs>/p' "$svg")"
inner="$(sed '1d' <<<"$body")"
# macOS: the whole logo at 824 of 1024 (the margin of macOS's icon grid).
cat >"$work/mac.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">$defs<g transform="translate(256 256) scale(0.888) translate(-256 -256)">$body</g></svg>
SVG
# iOS: the tile's colour to the edges (iOS rounds the corners itself).
cat >"$work/full.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">$defs<rect width="512" height="512" fill="url(#xd-bg)"/><g transform="translate(256 256) scale(1.08) translate(-256 -256)">$inner</g></svg>
SVG

# The desktop app.
png "$svg" 512 apps/desktop/build/icon.png
for size in 16 24 32; do png "$small" "$size" "$work/win-$size.png"; done
for size in 48 64 128 256; do png "$svg" "$size" "$work/win-$size.png"; done
icotool -c -o apps/desktop/build/icon.ico "$work"/win-{16,24,32,48,64,128,256}.png
for size in 32 64 128 256 512 1024; do png "$work/mac.svg" "$size" "$work/mac-$size.png"; done
python3 - "$work" apps/desktop/build/icon.icns <<'PY'
import struct, sys
work, out = sys.argv[1], sys.argv[2]
# The PNG types of the .icns format: ic11 is 16@2x, ic12 32@2x, ic07 128, ic13 128@2x, ic08 256,
# ic14 256@2x, ic09 512, ic10 512@2x.
kinds = [('ic11', 32), ('ic12', 64), ('ic07', 128), ('ic13', 256), ('ic08', 256), ('ic14', 512), ('ic09', 512), ('ic10', 1024)]
parts = b''
for kind, size in kinds:
    data = open(f'{work}/mac-{size}.png', 'rb').read()
    parts += kind.encode() + struct.pack('>I', len(data) + 8) + data
open(out, 'wb').write(b'icns' + struct.pack('>I', len(parts) + 8) + parts)
PY

# The website.
mkdir -p apps/web/public
cp "$small" apps/web/public/favicon.svg
for size in 16 32; do png "$small" "$size" "$work/fav-$size.png"; done
png "$svg" 48 "$work/fav-48.png"
icotool -c -o apps/web/public/favicon.ico "$work"/fav-{16,32,48}.png
png "$work/full.svg" 180 apps/web/public/apple-touch-icon.png

# The Windows server file: the icon only (no manifest: the file asks for Administrator itself when it
# is double-clicked, and `xdesign version` runs in any terminal).
cp apps/desktop/build/icon.ico "$work/xdesign.ico"
printf '1 ICON "xdesign.ico"\n' >"$work/xdesign.rc"
for arch in amd64:x86_64 arm64:aarch64; do
	(cd "$work" && llvm-windres --target="${arch#*:}-w64-mingw32" -O coff xdesign.rc "rsrc-${arch%%:*}.syso")
	cp "$work/rsrc-${arch%%:*}.syso" "helper/cmd/xdesign/rsrc_windows_${arch%%:*}.syso"
done

echo "icons: written from $svg"
