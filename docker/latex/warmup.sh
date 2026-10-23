#!/bin/sh
# Compiles every warm-up document in $1 (written by packages/server/src/entrypoints/latex-warmup.ts:
# the template's own output for each density x paper) so Tectonic caches exactly the files
# production compiles need. Further arguments go to Tectonic: the image build runs it once with the
# network to fill the cache, then again with --only-cached and no network to prove it is complete.
set -eu
src=$1
shift
work=$(mktemp -d)
for f in "$src"/*.tex; do
  cp "$f" "$work/main.tex"
  (cd "$work" && tectonic -X compile main.tex --untrusted "$@")
  test -s "$work/main.pdf"
  rm -f "$work/main.pdf"
done
rm -rf "$work"
