#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/typora-themes-test.XXXXXX")"
TYPORA_APP="$TEMP_ROOT/Typora.app"
TYPORA_INDEX="$TYPORA_APP/Contents/Resources/TypeMark/index.html"
USER_DATA="$TEMP_ROOT/User Data"
THEME_DIR="$USER_DATA/themes"
INSTALLER="$ROOT_DIR/install-macos.sh"

cleanup() {
  /bin/rm -rf "$TEMP_ROOT"
}
trap cleanup EXIT

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

assert_file() {
  [[ -f "$1" ]] || fail "missing file: $1"
}

assert_dir() {
  [[ -d "$1" ]] || fail "missing directory: $1"
}

assert_missing() {
  [[ ! -e "$1" && ! -L "$1" ]] || fail "unexpected path: $1"
}

assert_contains() {
  grep -Fq "$2" "$1" || fail "$1 does not contain: $2"
}

assert_not_contains() {
  ! grep -Fq "$2" "$1" || fail "$1 still contains: $2"
}

run_installer() {
  "$INSTALLER" --typora-app "$TYPORA_APP" --user-data "$USER_DATA" "$@"
}

mkdir -p "$(dirname "$TYPORA_INDEX")" "$THEME_DIR"
cp "$ROOT_DIR/tests/fixtures/typora-index.html" "$TYPORA_INDEX"

printf '%s\n' '<!doctype html><html><body>missing closing body' > "$TYPORA_INDEX"
if run_installer install folio >/dev/null 2>&1; then
  fail 'install unexpectedly accepted an index without a closing body tag'
fi
assert_missing "$THEME_DIR/folio.css"
assert_missing "$THEME_DIR/folio-dark.css"
assert_missing "$THEME_DIR/folio"
assert_missing "$THEME_DIR/typora-themes-runtime.js"
failed_snapshot="$(find "$USER_DATA/typora-themes-install-backups" \
  -mindepth 1 -maxdepth 1 -type d | LC_ALL=C sort | tail -n 1)"
assert_file "$failed_snapshot/after-hashes.txt"
assert_file "$failed_snapshot/rollback-completed.txt"
run_installer restore latest >/dev/null
assert_missing "$THEME_DIR/folio.css"
cp "$ROOT_DIR/tests/fixtures/typora-index.html" "$TYPORA_INDEX"

run_installer list | grep -Fq 'runtime  inactive' \
  || fail 'initial runtime status is not inactive'

run_installer install island >/dev/null
assert_file "$THEME_DIR/island.css"
assert_dir "$THEME_DIR/island"
assert_missing "$THEME_DIR/typora-themes-runtime.js"

run_installer install geek >/dev/null
assert_file "$THEME_DIR/geek.css"
assert_file "$THEME_DIR/geek-dark.css"
assert_dir "$THEME_DIR/geek"

encoded_user_data="${USER_DATA//%/%25}"
encoded_user_data="${encoded_user_data// /%20}"
legacy_folio_url="file://$encoded_user_data/themes/folio-enhancer.js"
legacy_sunlit_url="file://$encoded_user_data/themes/sunlit-enhancer.js"
legacy_tags="<!-- folio-enhancer:experimental -->
<script defer src='$legacy_folio_url'></script>
<!-- sunlit-enhancer:experimental --><script src=\"$legacy_sunlit_url\" async></script>"
LC_ALL=C LEGACY_TAGS="$legacy_tags" /usr/bin/perl -0pi -e \
  's#</body>#$ENV{LEGACY_TAGS}</body>#' "$TYPORA_INDEX"
/usr/bin/install -m 0644 "$ROOT_DIR/folio/folio/folio-module.js" \
  "$THEME_DIR/folio-enhancer.js"
/usr/bin/install -m 0644 "$ROOT_DIR/sunlit/sunlit/sunlit-module.js" \
  "$THEME_DIR/sunlit-enhancer.js"
mkdir -p "$THEME_DIR/typora-themes-runtime"
/usr/bin/install -m 0644 "$ROOT_DIR/folio/folio/folio-module.js" \
  "$THEME_DIR/typora-themes-runtime/folio-module.js"

run_installer install folio >/dev/null
assert_file "$THEME_DIR/folio.css"
assert_file "$THEME_DIR/folio-dark.css"
assert_file "$THEME_DIR/typora-themes-runtime.js"
assert_file "$THEME_DIR/folio/folio-module.js"
assert_missing "$THEME_DIR/sunlit/sunlit-module.js"
assert_missing "$THEME_DIR/typora-themes-runtime"
assert_missing "$THEME_DIR/folio-enhancer.js"
assert_missing "$THEME_DIR/sunlit-enhancer.js"
assert_not_contains "$TYPORA_INDEX" 'folio-enhancer:experimental'
assert_not_contains "$TYPORA_INDEX" 'sunlit-enhancer:experimental'
assert_contains "$TYPORA_INDEX" 'typora-themes-runtime:v1'

run_installer install sunlit >/dev/null
assert_file "$THEME_DIR/sunlit.css"
assert_file "$THEME_DIR/sunlit/assets/leaves.mp4"
assert_file "$THEME_DIR/folio/folio-module.js"
assert_file "$THEME_DIR/sunlit/sunlit-module.js"
[[ "$(grep -Fc 'typora-themes-runtime:v1' "$TYPORA_INDEX")" -eq 1 ]] \
  || fail 'runtime entry is not unique'

run_installer uninstall folio >/dev/null
assert_missing "$THEME_DIR/folio.css"
assert_missing "$THEME_DIR/folio"
assert_file "$THEME_DIR/typora-themes-runtime.js"
assert_file "$THEME_DIR/sunlit/sunlit-module.js"
assert_contains "$TYPORA_INDEX" 'typora-themes-runtime:v1'

run_installer uninstall sunlit >/dev/null
assert_missing "$THEME_DIR/sunlit.css"
assert_missing "$THEME_DIR/typora-themes-runtime.js"
assert_missing "$THEME_DIR/sunlit"
assert_not_contains "$TYPORA_INDEX" 'typora-themes-runtime:v1'

run_installer install all >/dev/null
for theme in island geek folio sunlit; do
  assert_file "$THEME_DIR/$theme.css"
done
assert_file "$THEME_DIR/folio/folio-module.js"
assert_file "$THEME_DIR/sunlit/sunlit-module.js"

run_installer uninstall all >/dev/null
for theme in island geek folio sunlit; do
  assert_missing "$THEME_DIR/$theme.css"
done
assert_missing "$THEME_DIR/geek"
assert_missing "$THEME_DIR/typora-themes-runtime.js"

run_installer restore latest >/dev/null
for theme in island geek folio sunlit; do
  assert_file "$THEME_DIR/$theme.css"
done
assert_file "$THEME_DIR/typora-themes-runtime.js"
assert_contains "$TYPORA_INDEX" 'typora-themes-runtime:v1'

/usr/bin/install -m 0644 "$ROOT_DIR/folio/folio-dark.css" "$THEME_DIR/folio.css"
if run_installer restore latest >/dev/null 2>&1; then
  fail 'restore accepted a modified managed file without --force'
fi

printf 'PASS: unified macOS installer smoke test\n'
