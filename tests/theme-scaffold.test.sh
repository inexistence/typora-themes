#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/typora-theme-scaffold-test.XXXXXX")"
TEST_REPO="$TEMP_ROOT/repo"
SCAFFOLD="$TEST_REPO/theme-scaffold.sh"

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

assert_contains() {
  grep -Fq -- "$2" "$1" || fail "$1 does not contain: $2"
}

assert_file "$ROOT_DIR/theme-test.md"
assert_contains "$ROOT_DIR/theme-test.md" '[toc]'
assert_contains "$ROOT_DIR/theme-test.md" '> [!NOTE]'
assert_contains "$ROOT_DIR/theme-test.md" '```sequence'
assert_contains "$ROOT_DIR/theme-test.md" '```flow'
assert_contains "$ROOT_DIR/theme-test.md" 'requirementDiagram'
assert_contains "$ROOT_DIR/theme-test.md" 'test_entity - satisfies -> test_req'
assert_contains "$ROOT_DIR/theme-test.md" '不计入主题样式验收结果'
assert_contains "$ROOT_DIR/theme-test.md" 'x-axis "低影响" --> "高影响"'
assert_contains "$ROOT_DIR/theme-test.md" '<video controls'

mkdir -p "$TEST_REPO"
/usr/bin/install -m 0755 "$ROOT_DIR/theme-scaffold.sh" "$SCAFFOLD"
/usr/bin/install -m 0644 "$ROOT_DIR/themes.plist" "$TEST_REPO/themes.plist"

"$SCAFFOLD" create paper-note --name 'Paper Note' --dark --module >/dev/null
assert_file "$TEST_REPO/paper-note/paper-note.css"
assert_file "$TEST_REPO/paper-note/paper-note-dark.css"
assert_file "$TEST_REPO/paper-note/paper-note/paper-note-module.js"
assert_file "$TEST_REPO/paper-note/paper-note/assets/placeholder.svg"
assert_file "$TEST_REPO/paper-note/README.md"
assert_dir "$TEST_REPO/paper-note/preview"
assert_dir "$TEST_REPO/paper-note/preview-source"
assert_contains "$TEST_REPO/paper-note/paper-note.css" \
  '--typora-theme-id: paper-note'
assert_contains "$TEST_REPO/paper-note/README.md" '../theme-test.md'
node --check "$TEST_REPO/paper-note/paper-note/paper-note-module.js"

draft_output="$("$SCAFFOLD" list)"
[[ "$draft_output" == *'paper-note'*draft* ]] \
  || fail 'new theme was not listed as a local draft'

"$SCAFFOLD" publish paper-note --name 'Paper Note' >/dev/null
/usr/bin/plutil -lint "$TEST_REPO/themes.plist" >/dev/null
published_output="$("$SCAFFOLD" list)"
[[ "$published_output" == *'paper-note'*published* ]] \
  || fail 'published theme was not listed in the install package'
[[ "$published_output" == *'paper-note.css,paper-note-dark.css'* ]] \
  || fail 'published CSS files were not auto-detected'
[[ "$published_output" == *'paper-note-module.js'* ]] \
  || fail 'published module was not auto-detected'

theme_count="$(/usr/bin/plutil -extract themes raw -expect array -o - \
  "$TEST_REPO/themes.plist")"
last_index=$((theme_count - 1))
[[ "$(/usr/bin/plutil -extract "themes.$last_index.id" raw -o - \
  "$TEST_REPO/themes.plist")" == 'paper-note' ]] \
  || fail 'published ID was not appended to themes.plist'
[[ "$(/usr/bin/plutil -extract "themes.$last_index.module" raw -o - \
  "$TEST_REPO/themes.plist")" == 'paper-note-module.js' ]] \
  || fail 'published module was not written to themes.plist'

if "$SCAFFOLD" publish paper-note >/dev/null 2>&1; then
  fail 'duplicate publish unexpectedly succeeded'
fi

"$SCAFFOLD" unpublish paper-note >/dev/null
assert_dir "$TEST_REPO/paper-note"
unpublished_output="$("$SCAFFOLD" list)"
[[ "$unpublished_output" == *'paper-note'*draft* ]] \
  || fail 'unpublished theme did not return to draft status'
if /usr/bin/plutil -p "$TEST_REPO/themes.plist" | grep -Fq 'paper-note'; then
  fail 'unpublished theme remained in themes.plist'
fi

"$SCAFFOLD" create instant-theme --publish >/dev/null
instant_output="$("$SCAFFOLD" list)"
[[ "$instant_output" == *'instant-theme'*published* ]] \
  || fail 'create --publish did not publish the theme'

if "$SCAFFOLD" create '../unsafe' >/dev/null 2>&1; then
  fail 'unsafe theme ID unexpectedly succeeded'
fi

printf 'PASS: theme scaffold create/list/publish/unpublish test\n'
