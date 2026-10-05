#!/usr/bin/env bash
# Regenerates the raster icons in public/ from public/logo.svg, and the link-preview
# card from scripts/og-image.html. Needs ImageMagick 7 and Chrome (set CHROME to its path).
set -euo pipefail
cd "$(dirname "$0")/.."

# iOS, GitHub and Android round the corners themselves, so their icons are
# full-bleed: the same mark without the rounded corners.
square="$(mktemp -t square).svg"
# Android's maskable icons show only the middle two thirds, cropped to the launcher's
# shape, so the mark shrinks to three quarters around its centre (16, 16.5).
maskable="$(mktemp -t maskable).svg"
trap 'rm -f "$square" "$maskable"' EXIT
sed 's/ rx="7"//' public/logo.svg > "$square"
sed 's|<rect x|<g transform="translate(4 4.125) scale(.75)"><rect x|; s|</svg>|</g></svg>|' "$square" > "$maskable"

render() { magick -background none -density 1536 "$1" -resize "$2x$2" -depth 8 -strip "$3"; }

magick -background none -density 1536 public/logo.svg -define icon:auto-resize=48,32,16 public/favicon.ico
render "$square" 180 public/apple-touch-icon.png
render "$square" 192 public/icon-192.png
render "$square" 512 public/icon-512.png
render "$maskable" 192 public/icon-maskable-192.png
render "$maskable" 512 public/icon-maskable-512.png

# Chrome renders the card with the app's web fonts; the time budget lets them load.
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
"$chrome" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1200,630 --virtual-time-budget=10000 \
  --screenshot="$PWD/public/og-image.png" "file://$PWD/scripts/og-image.html" 2>/dev/null
magick public/og-image.png -depth 8 -strip public/og-image.png
