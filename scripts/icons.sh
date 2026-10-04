#!/usr/bin/env bash
# Regenerates the raster icons in public/ from public/logo.svg. Needs ImageMagick 7.
set -euo pipefail
cd "$(dirname "$0")/.."

# iOS, Android and GitHub round the corners themselves, so their icons are
# full-bleed: the same mark without the rounded corners.
square="$(mktemp -t square).svg"
trap 'rm -f "$square"' EXIT
sed 's/ rx="7"//' public/logo.svg > "$square"

render() { magick -background none -density 1536 "$1" -resize "$2x$2" -depth 8 "$3"; }

magick -background none -density 1536 public/logo.svg -define icon:auto-resize=48,32,16 public/favicon.ico
render "$square" 180 public/apple-touch-icon.png
render "$square" 192 public/icon-192.png
render "$square" 512 public/icon-512.png
