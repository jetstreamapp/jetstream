#!/usr/bin/env bash
#
# Regenerate the data-flow diagram artifacts (PNGs + combined PDF) from source.
#
# Sources of truth (edit these):
#   *.mmd       Mermaid-authored diagrams (converted to .drawio, then PNG)
#   *.drawio    draw.io XML. For Mermaid diagrams this is generated from the
#               .mmd; diagrams 01 and 02 have no .mmd and are hand-authored XML.
#
# Generated artifacts (do NOT hand-edit — they are overwritten here):
#   *.drawio.png                        per-diagram PNG (embeds the editable diagram)
#   jetstream-data-flow-diagrams.pdf    every diagram, one page each, in index order
#
# Requirements:
#   draw.io Desktop   provides the CLI. Override the path with DRAWIO=/path/to/draw.io
#   pdfunite          from poppler: `brew install poppler`
#   perl              small in-place .drawio post-processing (preinstalled on macOS and most Linux)
#
# Usage:
#   ./regenerate.sh            Full rebuild: all .mmd -> .drawio, all PNGs, then the PDF
#   ./regenerate.sh <base>     Rebuild one diagram (e.g. 11-auth-desktop): .drawio (if it
#                              has a .mmd) + its PNG. Does not touch the combined PDF.
#   ./regenerate.sh --pdf      Rebuild only the combined PDF from the existing .drawio files
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

DRAWIO="${DRAWIO:-/Applications/draw.io.app/Contents/MacOS/draw.io}"

# Diagram 00 is Mermaid-authored, but its .drawio was hand-edited to move the
# legend below the diagram (the arrows were overlapping it). Re-converting from
# the .mmd would discard that, so 00 is intentionally excluded from .mmd ->
# .drawio conversion; its existing .drawio is exported as-is. If you ever do
# re-convert 00, re-apply the legend move afterward: find the "Legend:" cell's
# <mxGeometry> and set x="560" y="635".
MERMAID_DIAGRAMS=(
  10-auth-web-app
  11-auth-desktop
  12-auth-web-extension
  13-auth-canvas
  20-sfdata-web-app
  21-sfdata-web-extension
  22-sfdata-desktop
  23-sfdata-canvas
)

# Page order for the combined PDF. 01 and 02 are hand-authored draw.io XML
# (no .mmd); everything else has a .mmd source.
PDF_ORDER=(
  00-system-context
  01-data-residency
  02-pii-data-classification
  10-auth-web-app
  11-auth-desktop
  12-auth-web-extension
  13-auth-canvas
  20-sfdata-web-app
  21-sfdata-web-extension
  22-sfdata-desktop
  23-sfdata-canvas
)

cleanup() { rm -f _page_*.pdf ./*.building 2>/dev/null || true; }
trap cleanup EXIT

require_drawio() {
  if [[ ! -x "$DRAWIO" ]]; then
    echo "ERROR: draw.io CLI not found at: $DRAWIO" >&2
    echo "       Install draw.io Desktop, or run with DRAWIO=/path/to/draw.io" >&2
    exit 1
  fi
}

require_pdfunite() {
  if ! command -v pdfunite >/dev/null 2>&1; then
    echo "ERROR: pdfunite not found (needed for the combined PDF)." >&2
    echo "       Install poppler: brew install poppler" >&2
    exit 1
  fi
}

# drawio_export <output_file> <drawio flags/input...>
# draw.io's CLI exit code is unreliable, so we export to a temp file and verify
# it was written (non-empty) before moving it into place — a failed export then
# leaves the previous artifact untouched instead of truncating it.
drawio_export() {
  local out="$1"; shift
  local tmp="$out.building"
  rm -f "$tmp"
  "$DRAWIO" -x -o "$tmp" "$@" >/dev/null 2>&1 || true
  if [[ ! -s "$tmp" ]]; then
    echo "ERROR: draw.io failed to produce $out" >&2
    rm -f "$tmp"
    exit 1
  fi
  mv -f "$tmp" "$out"
}

# draw.io's Mermaid engine renders Markdown in note text, so a double-underscore
# identifier such as `jetstream__UserPreferences__c` is parsed as **bold** and the
# underscores are dropped (-> `jetstreamUserPreferencesc`) in the generated .drawio.
# The .mmd keeps the correct name; we restore it in the .drawio here. Escapes in the
# .mmd (\_\_, backticks, #95;) do not survive conversion, so this fixup is the fix.
# If you add other `__` identifiers to note text, add a matching case below.
apply_mermaid_fixups() {
  local base="$1"
  case "$base" in
    23-sfdata-canvas)
      perl -pi -e 's/jetstreamUserPreferencesc/jetstream__UserPreferences__c/g' "$base.drawio"
      ;;
  esac
}

# draw.io assigns a fresh random <diagram id="..."> on every conversion. Since the
# PNG embeds the XML, that would churn every .drawio and .png on each run even when
# nothing changed. Preserving the id already committed keeps regeneration idempotent:
# a no-op rebuild produces no diff, and content changes diff cleanly.
current_diagram_id() {
  [[ -f "$1" ]] || return 0
  perl -ne 'if (/<diagram id="([^"]*)"/) { print $1; exit }' "$1"
}

restore_diagram_id() {
  local file="$1" previousId="$2"
  [[ -n "$previousId" ]] || return 0
  PREVIOUS_ID="$previousId" perl -pi -e 's/(<diagram id=")[^"]*(")/$1$ENV{PREVIOUS_ID}$2/' "$file"
}

convert_mermaid() {
  echo "==> Converting Mermaid sources (.mmd -> .drawio)"
  for base in "${MERMAID_DIAGRAMS[@]}"; do
    echo "    $base.mmd -> $base.drawio"
    local previousId; previousId="$(current_diagram_id "$base.drawio")"
    drawio_export "$base.drawio" -f xml "$base.mmd"
    apply_mermaid_fixups "$base"
    restore_diagram_id "$base.drawio" "$previousId"
  done
}

export_pngs() {
  echo "==> Exporting PNGs (.drawio -> .drawio.png)"
  for drawioFile in *.drawio; do
    echo "    $drawioFile -> ${drawioFile%.drawio}.drawio.png"
    drawio_export "${drawioFile%.drawio}.drawio.png" -f png -e -b 12 "$drawioFile"
  done
}

# Per-page --crop then pdfunite gives exactly one right-sized page per diagram.
# Do NOT use draw.io's -a (all-pages) flag: it tiles the tall sequence diagrams
# across multiple sheets.
build_pdf() {
  echo "==> Building combined PDF (jetstream-data-flow-diagrams.pdf)"
  local pages=()
  for base in "${PDF_ORDER[@]}"; do
    local page="_page_$base.pdf"
    echo "    $base.drawio -> page"
    drawio_export "$page" -f pdf --crop -e -b 14 "$base.drawio"
    pages+=("$page")
  done
  pdfunite "${pages[@]}" jetstream-data-flow-diagrams.pdf
  rm -f "${pages[@]}"
}

regenerate_one() {
  local base="$1"
  if [[ ! -f "$base.drawio" && ! -f "$base.mmd" ]]; then
    echo "ERROR: no '$base.drawio' or '$base.mmd' in $(pwd)" >&2
    exit 1
  fi
  if [[ -f "$base.mmd" && "$base" != "00-system-context" ]]; then
    echo "==> $base.mmd -> $base.drawio"
    local previousId; previousId="$(current_diagram_id "$base.drawio")"
    drawio_export "$base.drawio" -f xml "$base.mmd"
    apply_mermaid_fixups "$base"
    restore_diagram_id "$base.drawio" "$previousId"
  fi
  echo "==> $base.drawio -> $base.drawio.png"
  drawio_export "$base.drawio.png" -f png -e -b 12 "$base.drawio"
  echo "Note: the combined PDF was not rebuilt. Run './regenerate.sh --pdf' to refresh it."
}

case "${1:-}" in
  "")
    require_drawio
    require_pdfunite
    convert_mermaid
    export_pngs
    build_pdf
    echo "Done. All PNGs and the combined PDF regenerated."
    ;;
  --pdf)
    require_drawio
    require_pdfunite
    build_pdf
    echo "Done. Combined PDF regenerated."
    ;;
  -h|--help)
    grep '^#' "$0" | grep -v '^#!' | sed 's/^# \{0,1\}//'
    ;;
  *)
    require_drawio
    regenerate_one "$1"
    ;;
esac
