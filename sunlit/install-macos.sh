#!/bin/bash

set -euo pipefail

TYPORA_APP="/Applications/Typora.app"
USER_DATA_OVERRIDE=""
DRY_RUN=0
UNINSTALL=0

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
THEME_SOURCE="$SCRIPT_DIR/sunlit.css"
ENHANCER_SOURCE="$SCRIPT_DIR/sunlit-enhancer.js"
VIDEO_SOURCE="$SCRIPT_DIR/assets/leaves.mp4"
STILL_SOURCE="$SCRIPT_DIR/assets/leaves-still.jpg"

usage() {
  cat <<'EOF'
安装 Sunlit 原型主题与实验性的树影视频增强器（macOS）。

用法：
  ./install-macos.sh [选项]

选项：
  --dry-run               只显示计划，不写入文件
  --uninstall             备份后移除 Sunlit 主题与增强器
  --typora-app PATH       指定 Typora.app 路径
  --user-data PATH        指定 Typora 用户数据目录
  -h, --help              显示帮助

安装前请完全退出 Typora。脚本会把被覆盖的文件备份到
Typora 用户数据目录的 sunlit-install-backups 中。
EOF
}

log() {
  printf '[Sunlit] %s\n' "$*"
}

fail() {
  printf '[Sunlit] 错误：%s\n' "$*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      ;;
    --uninstall)
      UNINSTALL=1
      ;;
    --typora-app)
      [[ $# -ge 2 ]] || fail "--typora-app 缺少路径"
      TYPORA_APP="$2"
      shift
      ;;
    --user-data)
      [[ $# -ge 2 ]] || fail "--user-data 缺少路径"
      USER_DATA_OVERRIDE="$2"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "未知选项：$1"
      ;;
  esac
  shift
done

[[ "$(uname -s)" == "Darwin" ]] || fail "此脚本仅支持 macOS"

USER_DATA="$HOME/Library/Application Support/abnerworks.Typora"
if [[ -n "$USER_DATA_OVERRIDE" ]]; then
  USER_DATA="$USER_DATA_OVERRIDE"
fi

[[ "$TYPORA_APP" == /* && "/$TYPORA_APP/" != *"/../"* ]] \
  || fail "--typora-app 必须是无 .. 的绝对路径"
[[ "$USER_DATA" == /* && "/$USER_DATA/" != *"/../"* ]] \
  || fail "--user-data 必须是无 .. 的绝对路径"

THEME_DIR="$USER_DATA/themes"
THEME_TARGET="$THEME_DIR/sunlit.css"
ENHANCER_TARGET="$THEME_DIR/sunlit-enhancer.js"
ASSET_DIR="$THEME_DIR/sunlit"
VIDEO_TARGET="$ASSET_DIR/leaves.mp4"
STILL_TARGET="$ASSET_DIR/leaves-still.jpg"
BACKUP_ROOT="$USER_DATA/sunlit-install-backups"
TIMESTAMP="$(date '+%Y%m%d-%H%M%S')-$$"
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"
TEMP_ROOT=""

find_typora_index() {
  local candidate
  local candidates=(
    "$TYPORA_APP/Contents/Resources/TypeMark/index.html"
    "$TYPORA_APP/Contents/Resources/app/index.html"
    "$TYPORA_APP/Contents/Resources/appsrc/index.html"
  )
  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

TYPORA_INDEX="$(find_typora_index)" \
  || fail "未找到 Typora 入口文件，请用 --typora-app 指定正确路径"

encoded_user_data="${USER_DATA// /%20}"
ENHANCER_URL="file://$encoded_user_data/themes/sunlit-enhancer.js"
ENHANCER_TAG="<!-- sunlit-enhancer:experimental --><script src=\"$ENHANCER_URL\"></script>"

backup_target() {
  local target="$1"
  local relative="$2"
  if [[ -e "$target" || -L "$target" ]]; then
    [[ ! -L "$target" ]] || fail "拒绝覆盖符号链接：$target"
    mkdir -p "$BACKUP_DIR/$(dirname "$relative")"
    if [[ -d "$target" ]]; then
      cp -R "$target" "$BACKUP_DIR/$relative"
    else
      cp -p "$target" "$BACKUP_DIR/$relative"
    fi
  fi
}

write_index() {
  local source="$1"
  if [[ -w "$TYPORA_INDEX" && -w "$(dirname "$TYPORA_INDEX")" ]]; then
    /usr/bin/install -m 0644 "$source" "$TYPORA_INDEX"
    return
  fi
  [[ -t 0 && -x /usr/bin/sudo ]] \
    || fail "需要管理员权限写入 Typora.app；请在 macOS Terminal 中运行此脚本"
  log "请输入管理员密码，仅用于更新 Typora 的 index.html"
  /usr/bin/sudo /usr/bin/install -m 0644 "$source" "$TYPORA_INDEX"
}

stage_index_with_tag() {
  local mode="$1"
  local staged="$TEMP_ROOT/Typora-index.html"
  cp -p "$TYPORA_INDEX" "$staged"
  if [[ "$mode" == install ]]; then
    LC_ALL=C ENHANCER_TAG="$ENHANCER_TAG" /usr/bin/perl -0pi -e \
      's#</body>#$ENV{ENHANCER_TAG}</body># unless index($_, $ENV{ENHANCER_TAG}) >= 0' \
      "$staged"
  else
    LC_ALL=C ENHANCER_TAG="$ENHANCER_TAG" /usr/bin/perl -0pi -e \
      's/\Q$ENV{ENHANCER_TAG}\E//g' "$staged"
  fi
  write_index "$staged"
}

if [[ "$UNINSTALL" -eq 0 ]]; then
  [[ -f "$THEME_SOURCE" ]] || fail "找不到 $THEME_SOURCE"
  [[ -f "$ENHANCER_SOURCE" ]] || fail "找不到 $ENHANCER_SOURCE"
  [[ -f "$VIDEO_SOURCE" ]] || fail "找不到 $VIDEO_SOURCE"
  [[ -f "$STILL_SOURCE" ]] || fail "找不到 $STILL_SOURCE"
fi

log "Typora 入口：$TYPORA_INDEX"
log "主题目录：$THEME_DIR"

if [[ "$DRY_RUN" -eq 1 ]]; then
  if [[ "$UNINSTALL" -eq 1 ]]; then
    log "将移除 Sunlit 主题、素材、增强器及入口标签"
  else
    log "将安装 sunlit.css、sunlit-enhancer.js、leaves.mp4 与静态降级帧"
  fi
  log "将备份到：$BACKUP_DIR"
  exit 0
fi

mkdir -p "$BACKUP_DIR" "$THEME_DIR" "$ASSET_DIR"
TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/sunlit-install.XXXXXX")"
trap '[[ -z "$TEMP_ROOT" ]] || /bin/rm -rf "$TEMP_ROOT"' EXIT

backup_target "$TYPORA_INDEX" "Typora-index.html"
backup_target "$THEME_TARGET" "themes/sunlit.css"
backup_target "$ENHANCER_TARGET" "themes/sunlit-enhancer.js"
backup_target "$VIDEO_TARGET" "themes/sunlit/leaves.mp4"
backup_target "$STILL_TARGET" "themes/sunlit/leaves-still.jpg"

if [[ "$UNINSTALL" -eq 1 ]]; then
  if grep -Fq "$ENHANCER_URL" "$TYPORA_INDEX"; then
    stage_index_with_tag uninstall
  fi
  /bin/rm -f "$THEME_TARGET" "$ENHANCER_TARGET" "$VIDEO_TARGET" "$STILL_TARGET"
  /bin/rmdir "$ASSET_DIR" >/dev/null 2>&1 || true
  log "Sunlit 已卸载；操作前文件保存在：$BACKUP_DIR"
  exit 0
fi

/usr/bin/install -m 0644 "$THEME_SOURCE" "$THEME_TARGET"
/usr/bin/install -m 0644 "$ENHANCER_SOURCE" "$ENHANCER_TARGET"
/usr/bin/install -m 0644 "$VIDEO_SOURCE" "$VIDEO_TARGET"
/usr/bin/install -m 0644 "$STILL_SOURCE" "$STILL_TARGET"
if ! grep -Fq "$ENHANCER_URL" "$TYPORA_INDEX"; then
  stage_index_with_tag install
fi

grep -Fq "$ENHANCER_URL" "$TYPORA_INDEX" \
  || fail "增强器入口注入失败；备份位于 $BACKUP_DIR"
log "安装完成。重新启动 Typora，并在主题菜单中选择 Sunlit。"
log "操作前文件保存在：$BACKUP_DIR"
