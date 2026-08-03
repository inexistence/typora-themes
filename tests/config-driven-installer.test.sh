#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/typora-theme-config-test.XXXXXX")"
TEST_REPO="$TEMP_ROOT/repo"
TYPORA_APP="$TEMP_ROOT/Typora.app"
TYPORA_INDEX="$TYPORA_APP/Contents/Resources/TypeMark/index.html"
USER_DATA="$TEMP_ROOT/User Data"
THEME_DIR="$USER_DATA/themes"

cleanup() {
  /bin/rm -rf "$TEMP_ROOT"
}
trap cleanup EXIT

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

mkdir -p "$TEST_REPO/runtime" "$TEST_REPO/paper-note/paper-note" \
  "$(dirname "$TYPORA_INDEX")" "$THEME_DIR"
/usr/bin/install -m 0755 "$ROOT_DIR/install-macos.sh" "$TEST_REPO/install-macos.sh"
/usr/bin/install -m 0644 "$ROOT_DIR/themes.plist" "$TEST_REPO/themes.plist"
/usr/bin/install -m 0644 "$ROOT_DIR/runtime/typora-themes-runtime.js" \
  "$TEST_REPO/runtime/typora-themes-runtime.js"
/usr/bin/install -m 0644 "$ROOT_DIR/tests/fixtures/paper-note.css" \
  "$TEST_REPO/paper-note/paper-note.css"
/usr/bin/install -m 0644 "$ROOT_DIR/tests/fixtures/paper-note-module.js" \
  "$TEST_REPO/paper-note/paper-note/paper-note-module.js"
/usr/bin/install -m 0644 "$ROOT_DIR/tests/fixtures/typora-index.html" "$TYPORA_INDEX"

/usr/bin/plutil -insert themes -json \
  '{"id":"paper-note","name":"Paper Note","css":["paper-note.css"],"module":"paper-note-module.js"}' \
  -append "$TEST_REPO/themes.plist"

installer_output="$("$TEST_REPO/install-macos.sh" --help)"
[[ "$installer_output" == *'paper-note|all'* ]] \
  || fail 'help output did not include the configured theme'

run_installer() {
  "$TEST_REPO/install-macos.sh" --typora-app "$TYPORA_APP" \
    --user-data "$USER_DATA" "$@"
}

run_installer install paper-note >/dev/null
[[ -f "$THEME_DIR/paper-note.css" ]] || fail 'configured CSS was not installed'
[[ -f "$THEME_DIR/paper-note/paper-note-module.js" ]] \
  || fail 'configured enhancement module was not installed'
[[ -f "$THEME_DIR/typora-themes-runtime.js" ]] \
  || fail 'shared runtime was not installed for the configured module'
grep -Fq "'paper-note': 'paper-note/paper-note-module.js'" \
  "$THEME_DIR/typora-themes-runtime.js" \
  || fail 'generated runtime did not include the configured module mapping'
node --check "$THEME_DIR/typora-themes-runtime.js"

status_output="$(run_installer list)"
[[ "$status_output" == *'paper-note installed'* ]] \
  || fail 'status output did not include the configured theme'

run_installer uninstall paper-note >/dev/null
[[ ! -e "$THEME_DIR/paper-note.css" ]] || fail 'configured CSS was not removed'
[[ ! -e "$THEME_DIR/paper-note" ]] || fail 'configured resources were not removed'
[[ ! -e "$THEME_DIR/typora-themes-runtime.js" ]] \
  || fail 'runtime remained after the last enhanced theme was removed'

run_installer restore latest >/dev/null
[[ -f "$THEME_DIR/paper-note.css" ]] || fail 'restore did not recover configured CSS'
[[ -f "$THEME_DIR/paper-note/paper-note-module.js" ]] \
  || fail 'restore did not recover configured module'

printf 'PASS: configuration-driven theme extension test\n'
