#!/bin/bash

set -euo pipefail

TYPORA_APP="/Applications/Typora.app"
USER_DATA_OVERRIDE=""
DRY_RUN=0
FORCE_RESTORE=0
RESTORE_TARGET=""
UNINSTALL=0

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
THEME_LIGHT="$SCRIPT_DIR/folio.css"
THEME_DARK="$SCRIPT_DIR/folio-dark.css"
ENHANCER_SOURCE="$SCRIPT_DIR/folio-enhancer.js"

usage() {
  cat <<'EOF'
安装 Folio 浅色/深色主题和实验性的 Folio Enhancer（macOS）。

用法：
  ./install-macos.sh [选项]

选项：
  --force                 恢复时覆盖安装后的哈希冲突
  --dry-run               只显示检测结果和计划，不写入文件
  --restore SNAPSHOT      恢复指定安装快照；SNAPSHOT 可为 latest 或备份目录名
  --uninstall             移除 Folio 主题和 Folio Enhancer
  --typora-app PATH       指定 Typora.app 路径
  --user-data PATH        指定 Typora 用户数据目录
  -h, --help              显示帮助

默认行为：
  - 安装 folio.css 与 folio-dark.css；
  - 安装无依赖的 folio-enhancer.js，并在 Typora 入口中添加一个本地脚本标签；
  - 代码标签组是实验性功能，仅在 Folio 主题启用时生效；
  - 不下载任何运行时依赖；
  - 修改前备份到 Typora 用户数据目录的 folio-install-backups 中；
  - 每次安装生成恢复清单，可用 --restore latest 一键回滚；
  - 恢复前会校验安装后哈希，检测到后续修改时停止，使用 --force 可确认覆盖。
EOF
}

log() {
  printf '[Folio] %s\n' "$*"
}

fail() {
  printf '[Folio] 错误：%s\n' "$*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)
      FORCE_RESTORE=1
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    --restore)
      [[ $# -ge 2 ]] || fail "--restore 缺少快照名称（例如 latest）"
      RESTORE_TARGET="$2"
      shift
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

ACTION_MODE_COUNT=0
[[ -z "$RESTORE_TARGET" ]] || ACTION_MODE_COUNT=$((ACTION_MODE_COUNT + 1))
[[ "$UNINSTALL" -eq 0 ]] || ACTION_MODE_COUNT=$((ACTION_MODE_COUNT + 1))
if [[ "$ACTION_MODE_COUNT" -gt 1 ]]; then
  fail "--restore 与 --uninstall 不能同时使用"
fi

[[ "$(uname -s)" == "Darwin" ]] || fail "此脚本仅支持 macOS"
if [[ -z "$RESTORE_TARGET" && "$UNINSTALL" -eq 0 ]]; then
  [[ -f "$THEME_LIGHT" ]] || fail "找不到 $THEME_LIGHT"
  [[ -f "$THEME_DARK" ]] || fail "找不到 $THEME_DARK"
  [[ -f "$ENHANCER_SOURCE" ]] || fail "找不到 $ENHANCER_SOURCE"
fi

USER_DATA="$HOME/Library/Application Support/abnerworks.Typora"
if [[ -n "$USER_DATA_OVERRIDE" ]]; then
  USER_DATA="$USER_DATA_OVERRIDE"
fi
THEME_DIR="$USER_DATA/themes"
ENHANCER_TARGET="$THEME_DIR/folio-enhancer.js"

[[ "$TYPORA_APP" == /* && "/$TYPORA_APP/" != *"/../"* ]] \
  || fail "--typora-app 必须是无 .. 的绝对路径"
[[ "$USER_DATA" == /* && "/$USER_DATA/" != *"/../"* ]] \
  || fail "--user-data 必须是无 .. 的绝对路径"

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

read_typora_version() {
  /usr/bin/plutil -extract CFBundleShortVersionString raw -o - \
    "$TYPORA_APP/Contents/Info.plist" 2>/dev/null || printf 'unknown\n'
}

folio_enhancer_url() {
  local encoded_user_data="${USER_DATA// /%20}"
  printf 'file://%s/themes/folio-enhancer.js\n' "$encoded_user_data"
}

can_write_typora_index() {
  [[ -w "$TYPORA_INDEX" && -w "$(dirname "$TYPORA_INDEX")" ]]
}

ensure_typora_index_writable() {
  local target_url="${1:-}"

  if [[ -n "$target_url" ]] && grep -Fq "$target_url" "$TYPORA_INDEX"; then
    return
  fi
  if can_write_typora_index; then
    return
  fi
  if [[ -x /usr/bin/sudo ]] && /usr/bin/sudo -n true >/dev/null 2>&1; then
    return
  fi
  if [[ -t 0 && -x /usr/bin/sudo ]]; then
    log "Typora.app 需要管理员权限；写入入口文件时将单独请求密码"
    return
  fi
  fail "当前环境不能写入 Typora.app，且无法交互请求管理员权限。请在 macOS Terminal 中重新运行脚本；不要使用 sudo 执行整个脚本"
}

write_typora_index() {
  local source="$1"
  local destination="$2"
  local destination_dir destination_owner destination_group staged_destination
  local use_sudo=0

  destination_dir="$(dirname "$destination")"
  staged_destination="$destination_dir/.folio-index.$$.tmp"
  if [[ -e "$destination" ]]; then
    destination_owner="$(stat -f '%Su' "$destination")"
    destination_group="$(stat -f '%Sg' "$destination")"
  else
    destination_owner="$(stat -f '%Su' "$destination_dir")"
    destination_group="$(stat -f '%Sg' "$destination_dir")"
  fi

  if [[ ! -w "$destination_dir" || ( -e "$destination" && ! -w "$destination" ) ]]; then
    use_sudo=1
    [[ -x /usr/bin/sudo ]] || fail "找不到 sudo，无法写入 Typora.app"
    if ! /usr/bin/sudo -n true >/dev/null 2>&1; then
      [[ -t 0 ]] || fail "需要管理员权限写入 Typora.app；请在 macOS Terminal 中运行"
      log "请输入管理员密码，仅用于写入 Typora 的 index.html"
    fi
  fi

  if [[ "$use_sudo" -eq 1 ]]; then
    if ! /usr/bin/sudo /usr/bin/install -o "$destination_owner" -g "$destination_group" \
      -m 0644 "$source" "$staged_destination"; then
      fail "macOS 拒绝修改 Typora.app。请在“系统设置 → 隐私与安全性 → 应用管理”中授权当前终端"
    fi
    if ! /usr/bin/sudo /bin/mv -f "$staged_destination" "$destination"; then
      /usr/bin/sudo /bin/rm -f "$staged_destination" >/dev/null 2>&1 || true
      fail "无法原子替换 Typora index；原文件未被主动删除"
    fi
  else
    if ! /usr/bin/install -o "$destination_owner" -g "$destination_group" \
      -m 0644 "$source" "$staged_destination"; then
      fail "无法在 Typora.app 中创建安全的临时入口文件"
    fi
    if ! /bin/mv -f "$staged_destination" "$destination"; then
      /bin/rm -f "$staged_destination" >/dev/null 2>&1 || true
      fail "无法原子替换 Typora index；原文件未被主动删除"
    fi
  fi
}

install_folio_enhancer_entry() {
  local temp_root="$1"
  local enhancer_url enhancer_tag staged_index action_index

  enhancer_url="$(folio_enhancer_url)"
  if grep -Fq "$enhancer_url" "$TYPORA_INDEX"; then
    return
  fi

  record_action_before typora-index file "$TYPORA_INDEX" \
    "Typora-index.html" "Folio Enhancer 加载入口"
  action_index="$LAST_ACTION_INDEX"
  enhancer_tag="<!-- folio-enhancer:experimental --><script src=\"$enhancer_url\"></script>"
  staged_index="$temp_root/Typora-index.with-folio-enhancer.html"
  cp -p "$TYPORA_INDEX" "$staged_index"
  LC_ALL=C ENHANCER_TAG="$enhancer_tag" /usr/bin/perl -0pi -e \
    's#</body>#$ENV{ENHANCER_TAG}</body># unless index($_, $ENV{ENHANCER_TAG}) >= 0' \
    "$staged_index"
  grep -Fq "$enhancer_url" "$staged_index" \
    || fail "无法在 Typora index 临时副本中生成 Folio Enhancer 注入"
  write_typora_index "$staged_index" "$TYPORA_INDEX"
  finalize_action "$action_index"
}

remove_folio_enhancer_entry() {
  local temp_root="$1"
  local enhancer_url enhancer_tag staged_index action_index

  enhancer_url="$(folio_enhancer_url)"
  if ! grep -Fq "$enhancer_url" "$TYPORA_INDEX"; then
    return
  fi

  record_action_before typora-index file "$TYPORA_INDEX" \
    "Typora-index.html" "Folio Enhancer 加载入口"
  action_index="$LAST_ACTION_INDEX"
  enhancer_tag="<!-- folio-enhancer:experimental --><script src=\"$enhancer_url\"></script>"
  staged_index="$temp_root/Typora-index.without-folio-enhancer.html"
  cp -p "$TYPORA_INDEX" "$staged_index"
  LC_ALL=C ENHANCER_TAG="$enhancer_tag" /usr/bin/perl -0pi -e \
    's/\Q$ENV{ENHANCER_TAG}\E//g' "$staged_index"
  if grep -Fq "$enhancer_url" "$staged_index"; then
    fail "无法从 Typora index 临时副本中移除 Folio Enhancer 标签"
  fi
  write_typora_index "$staged_index" "$TYPORA_INDEX"
  finalize_action "$action_index"
}

hash_path() {
  local target="$1"
  local relative

  if [[ ! -e "$target" && ! -L "$target" ]]; then
    printf 'missing\n'
    return
  fi
  if [[ -L "$target" ]]; then
    {
      printf 'L '
      readlink "$target"
    } | LC_ALL=C shasum -a 256 | awk '{print $1}'
    return
  fi
  if [[ -f "$target" ]]; then
    LC_ALL=C shasum -a 256 "$target" | awk '{print $1}'
    return
  fi
  if [[ -d "$target" ]]; then
    (
      cd "$target"
      find . -type d -print | LC_ALL=C sort | sed 's/^/D /'
      find . -type f -print | LC_ALL=C sort | while IFS= read -r relative; do
        printf 'F %s ' "$relative"
        LC_ALL=C shasum -a 256 "$relative" | awk '{print $1}'
      done
      find . -type l -print | LC_ALL=C sort | while IFS= read -r relative; do
        printf 'L %s ' "$relative"
        readlink "$relative"
      done
    ) | LC_ALL=C shasum -a 256 | awk '{print $1}'
    return
  fi
  fail "不支持记录此文件类型：$target"
}

init_restore_manifest() {
  local operation="${1:-install}"

  MANIFEST_PLIST="$BACKUP_DIR/restore-manifest.plist"
  MANIFEST_JSON="$BACKUP_DIR/restore-manifest.json"
  ACTION_COUNT=0

  /usr/bin/plutil -create xml1 "$MANIFEST_PLIST"
  /usr/bin/plutil -insert schema -integer 1 "$MANIFEST_PLIST"
  /usr/bin/plutil -insert status -string pending "$MANIFEST_PLIST"
  /usr/bin/plutil -insert operation -string "$operation" "$MANIFEST_PLIST"
  /usr/bin/plutil -insert createdAt -string "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$MANIFEST_PLIST"
  /usr/bin/plutil -insert typoraApp -string "$TYPORA_APP" "$MANIFEST_PLIST"
  /usr/bin/plutil -insert typoraIndex -string "$TYPORA_INDEX" "$MANIFEST_PLIST"
  /usr/bin/plutil -insert userData -string "$USER_DATA" "$MANIFEST_PLIST"
  /usr/bin/plutil -insert enhancer -string "folio-enhancer:experimental" "$MANIFEST_PLIST"
  /usr/bin/plutil -insert actions -xml '<array/>' "$MANIFEST_PLIST"
}

record_action_before() {
  local component="$1"
  local kind="$2"
  local target="$3"
  local relative="$4"
  local label="$5"
  local index="$ACTION_COUNT"
  local backup="$BACKUP_DIR/$relative"
  local existed=NO
  local before_hash=missing

  [[ "$target" != *$'\n'* && "$target" != *$'\r'* ]] || fail "目标路径包含换行符"
  if [[ -e "$target" || -L "$target" ]]; then
    [[ ! -L "$target" ]] || fail "拒绝覆盖符号链接，以免恢复目标不明确：$target"
    existed=YES
    before_hash="$(hash_path "$target")"
    mkdir -p "$(dirname "$backup")"
    if [[ "$kind" == directory ]]; then
      [[ -d "$target" ]] || fail "预期目录但发现其他类型：$target"
      cp -R "$target" "$backup"
    else
      [[ -f "$target" ]] || fail "预期文件但发现其他类型：$target"
      cp -p "$target" "$backup"
    fi
  fi

  /usr/bin/plutil -insert "actions.$index" -xml '<dict/>' "$MANIFEST_PLIST"
  /usr/bin/plutil -insert "actions.$index.component" -string "$component" "$MANIFEST_PLIST"
  /usr/bin/plutil -insert "actions.$index.kind" -string "$kind" "$MANIFEST_PLIST"
  /usr/bin/plutil -insert "actions.$index.label" -string "$label" "$MANIFEST_PLIST"
  /usr/bin/plutil -insert "actions.$index.target" -string "$target" "$MANIFEST_PLIST"
  /usr/bin/plutil -insert "actions.$index.backupRelative" -string "$relative" "$MANIFEST_PLIST"
  /usr/bin/plutil -insert "actions.$index.beforeExists" -bool "$existed" "$MANIFEST_PLIST"
  /usr/bin/plutil -insert "actions.$index.beforeHash" -string "$before_hash" "$MANIFEST_PLIST"
  /usr/bin/plutil -insert "actions.$index.installedHash" -string pending "$MANIFEST_PLIST"
  LAST_ACTION_INDEX="$index"
  ACTION_COUNT=$((ACTION_COUNT + 1))
}

finalize_action() {
  local index="$1"
  local target
  local installed_hash

  target="$(/usr/bin/plutil -extract "actions.$index.target" raw -o - "$MANIFEST_PLIST")"
  installed_hash="$(hash_path "$target")"
  /usr/bin/plutil -replace "actions.$index.installedHash" -string "$installed_hash" "$MANIFEST_PLIST"
}

finalize_restore_manifest() {
  /usr/bin/plutil -replace status -string complete "$MANIFEST_PLIST"
  /usr/bin/plutil -convert json -o "$MANIFEST_JSON" "$MANIFEST_PLIST"
}

manifest_value() {
  /usr/bin/plutil -extract "$1" raw -o - "$RESTORE_MANIFEST"
}

resolve_restore_snapshot() {
  local backup_root="$USER_DATA/folio-install-backups"
  local candidate
  local selected=""

  [[ -d "$backup_root" ]] || fail "找不到备份目录：$backup_root"
  if [[ "$RESTORE_TARGET" == latest ]]; then
    for candidate in "$backup_root"/*; do
      [[ -d "$candidate" ]] || continue
      [[ -f "$candidate/restore-manifest.plist" ]] || continue
      [[ ! -f "$candidate/restore-completed.txt" ]] || continue
      if [[ -z "$selected" || "$candidate" > "$selected" ]]; then
        selected="$candidate"
      fi
    done
    [[ -n "$selected" ]] || fail "没有找到可自动恢复的未恢复快照"
  else
    [[ "$RESTORE_TARGET" =~ ^[0-9]{8}-[0-9]{6}-[0-9]+$ ]] \
      || fail "快照名称格式无效；请使用 latest 或备份目录名"
    selected="$backup_root/$RESTORE_TARGET"
    [[ -d "$selected" ]] || fail "找不到快照：$selected"
  fi

  RESTORE_DIR="$selected"
  if [[ ! -f "$RESTORE_DIR/restore-manifest.plist" ]]; then
    fail "此备份没有恢复清单，只能手动恢复：$RESTORE_DIR"
  fi
  RESTORE_MANIFEST="$RESTORE_DIR/restore-manifest.plist"
}

validate_restore_target() {
  local component="$1"
  local target="$2"
  local expected=""

  case "$component" in
    theme-light)
      expected="$RESTORE_USER_DATA/themes/folio.css"
      ;;
    theme-dark)
      expected="$RESTORE_USER_DATA/themes/folio-dark.css"
      ;;
    typora-index)
      expected="$RESTORE_TYPORA_INDEX"
      case "$expected" in
        "$RESTORE_TYPORA_APP/Contents/Resources/TypeMark/index.html"|"$RESTORE_TYPORA_APP/Contents/Resources/app/index.html"|"$RESTORE_TYPORA_APP/Contents/Resources/appsrc/index.html")
          ;;
        *)
          fail "恢复清单中的 Typora index 路径不安全"
          ;;
      esac
      ;;
    folio-enhancer)
      expected="$RESTORE_USER_DATA/themes/folio-enhancer.js"
      ;;
    *)
      fail "恢复清单包含未知组件：$component"
      ;;
  esac

  [[ "$target" == "$expected" ]] || fail "恢复目标与组件不匹配：$target"
  [[ "$target" != / && "$target" != "$RESTORE_USER_DATA" && "$target" != "$RESTORE_TYPORA_APP" ]] \
    || fail "拒绝恢复过宽的目标路径：$target"
  [[ "$target" != *$'\n'* && "$target" != *$'\r'* ]] || fail "恢复目标包含换行符"
}

remove_restore_target() {
  local target="$1"

  if [[ -d "$target" && ! -L "$target" ]]; then
    rm -rf "$target"
  else
    rm -f "$target"
  fi
}

restore_snapshot() {
  local schema status action_count index
  local component kind label target relative before_exists before_hash installed_hash
  local backup current_hash backup_hash marker

  resolve_restore_snapshot
  marker="$RESTORE_DIR/restore-completed.txt"
  [[ ! -f "$marker" ]] || fail "此快照已经恢复：$RESTORE_DIR"
  /usr/bin/plutil -lint "$RESTORE_MANIFEST" >/dev/null || fail "恢复清单格式无效"

  schema="$(manifest_value schema)"
  status="$(manifest_value status)"
  RESTORE_USER_DATA="$(manifest_value userData)"
  RESTORE_TYPORA_APP="$(manifest_value typoraApp)"
  RESTORE_TYPORA_INDEX="$(manifest_value typoraIndex)"
  [[ "$schema" == 1 ]] || fail "不支持的恢复清单版本：$schema"
  [[ "$RESTORE_TYPORA_APP" == /* && "/$RESTORE_TYPORA_APP/" != *"/../"* \
    && "$RESTORE_TYPORA_APP" != / ]] || fail "恢复清单中的 Typora.app 路径不安全"
  [[ "$RESTORE_USER_DATA" == "$USER_DATA" ]] \
    || fail "快照属于其他用户数据目录，请使用 --user-data 指定：$RESTORE_USER_DATA"
  [[ "$(manifest_value enhancer)" == "folio-enhancer:experimental" ]] \
    || fail "恢复清单不属于 Folio Enhancer"
  if [[ "$status" != complete && "$FORCE_RESTORE" -eq 0 ]]; then
    fail "安装事务未完整结束；检查备份后使用 --force 恢复"
  fi

  action_count="$(manifest_value actions)"
  [[ "$action_count" =~ ^[0-9]+$ ]] || fail "恢复清单的动作数量无效"
  log "恢复快照：$RESTORE_DIR"
  log "预检查 $action_count 个改动"

  for ((index = 0; index < action_count; index++)); do
    component="$(manifest_value "actions.$index.component")"
    kind="$(manifest_value "actions.$index.kind")"
    label="$(manifest_value "actions.$index.label")"
    target="$(manifest_value "actions.$index.target")"
    relative="$(manifest_value "actions.$index.backupRelative")"
    before_exists="$(manifest_value "actions.$index.beforeExists")"
    before_hash="$(manifest_value "actions.$index.beforeHash")"
    installed_hash="$(manifest_value "actions.$index.installedHash")"

    [[ "$kind" == file || "$kind" == directory ]] || fail "未知恢复动作类型：$kind"
    [[ "$relative" != /* && "/$relative/" != *"/../"* ]] || fail "备份相对路径不安全：$relative"
    validate_restore_target "$component" "$target"
    backup="$RESTORE_DIR/$relative"

    if [[ "$before_exists" == true ]]; then
      [[ -e "$backup" || -L "$backup" ]] || fail "备份缺失：$backup"
      backup_hash="$(hash_path "$backup")"
      [[ "$backup_hash" == "$before_hash" ]] || fail "备份校验失败：$label"
    elif [[ "$before_exists" != false ]]; then
      fail "恢复清单中的 beforeExists 无效"
    fi

    current_hash="$(hash_path "$target")"
    if [[ "$installed_hash" == pending ]]; then
      [[ "$FORCE_RESTORE" -eq 1 ]] || fail "动作未完成，无法确认当前状态：$label"
      log "警告：忽略未完成动作的状态校验：$label"
    elif [[ "$current_hash" != "$installed_hash" ]]; then
      if [[ "$FORCE_RESTORE" -eq 1 ]]; then
        log "警告：忽略安装后哈希冲突：$label"
      else
        fail "检测到安装后修改：${label}。请保留改动或确认后使用 --force"
      fi
    fi
  done

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "dry-run 完成；恢复预检查通过，没有写入文件"
    return
  fi

  for ((index = action_count - 1; index >= 0; index--)); do
    component="$(manifest_value "actions.$index.component")"
    kind="$(manifest_value "actions.$index.kind")"
    label="$(manifest_value "actions.$index.label")"
    target="$(manifest_value "actions.$index.target")"
    relative="$(manifest_value "actions.$index.backupRelative")"
    before_exists="$(manifest_value "actions.$index.beforeExists")"
    before_hash="$(manifest_value "actions.$index.beforeHash")"
    validate_restore_target "$component" "$target"
    backup="$RESTORE_DIR/$relative"

    if [[ "$(hash_path "$target")" == "$before_hash" ]]; then
      log "已是原始状态：$label"
      continue
    fi

    if [[ "$component" == typora-index ]]; then
      [[ "$before_exists" == true ]] || fail "Typora index 恢复动作缺少原始备份"
      write_typora_index "$backup" "$target"
    else
      remove_restore_target "$target"
    fi
    if [[ "$before_exists" == true && "$component" != typora-index ]]; then
      mkdir -p "$(dirname "$target")"
      if [[ "$kind" == directory ]]; then
        cp -R "$backup" "$target"
      else
        cp -p "$backup" "$target"
      fi
    fi
    [[ "$(hash_path "$target")" == "$before_hash" ]] || fail "恢复后校验失败：$label"
    log "已恢复：$label"
  done

  printf 'restoredAt=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$marker"
  log "恢复完成。快照已标记为已恢复：$RESTORE_DIR"
}

uninstall_folio() {
  local action_index
  local has_changes=0

  log "将移除 Folio、Folio Dark 与实验性的 Folio Enhancer"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    [[ ! -e "$THEME_DIR/folio.css" ]] || log "将移除：$THEME_DIR/folio.css"
    [[ ! -e "$THEME_DIR/folio-dark.css" ]] || log "将移除：$THEME_DIR/folio-dark.css"
    [[ ! -e "$ENHANCER_TARGET" ]] || log "将移除：$ENHANCER_TARGET"
    if grep -Fq "$(folio_enhancer_url)" "$TYPORA_INDEX"; then
      log "将从 Typora 入口移除 Folio Enhancer 标签"
    fi
    log "dry-run 完成，没有写入文件"
    return
  fi

  TIMESTAMP="$(date '+%Y%m%d-%H%M%S')-$$"
  BACKUP_DIR="$USER_DATA/folio-install-backups/$TIMESTAMP"
  TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/folio-uninstall.XXXXXX")"
  trap 'rm -rf "$TEMP_ROOT"' EXIT
  mkdir -p "$BACKUP_DIR"
  init_restore_manifest uninstall

  if grep -Fq "$(folio_enhancer_url)" "$TYPORA_INDEX"; then
    remove_folio_enhancer_entry "$TEMP_ROOT"
    has_changes=1
    log "已移除 Typora 中的 Folio Enhancer 加载入口"
  fi

  if [[ -e "$THEME_DIR/folio.css" || -L "$THEME_DIR/folio.css" ]]; then
    record_action_before theme-light file "$THEME_DIR/folio.css" \
      "themes/folio.css" "Folio 浅色主题"
    action_index="$LAST_ACTION_INDEX"
    remove_restore_target "$THEME_DIR/folio.css"
    finalize_action "$action_index"
    has_changes=1
  fi
  if [[ -e "$THEME_DIR/folio-dark.css" || -L "$THEME_DIR/folio-dark.css" ]]; then
    record_action_before theme-dark file "$THEME_DIR/folio-dark.css" \
      "themes/folio-dark.css" "Folio 深色主题"
    action_index="$LAST_ACTION_INDEX"
    remove_restore_target "$THEME_DIR/folio-dark.css"
    finalize_action "$action_index"
    has_changes=1
  fi
  if [[ -e "$ENHANCER_TARGET" || -L "$ENHANCER_TARGET" ]]; then
    record_action_before folio-enhancer file "$ENHANCER_TARGET" \
      "themes/folio-enhancer.js" "Folio Enhancer（实验性）"
    action_index="$LAST_ACTION_INDEX"
    remove_restore_target "$ENHANCER_TARGET"
    finalize_action "$action_index"
    has_changes=1
  fi
  finalize_restore_manifest
  if [[ "$has_changes" -eq 1 ]]; then
    log "Folio 已卸载。恢复快照：$TIMESTAMP"
    log "撤销卸载：$SCRIPT_DIR/install-macos.sh --restore $TIMESTAMP"
  else
    printf 'noChangesAt=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
      > "$BACKUP_DIR/restore-completed.txt"
    log "没有找到已安装的 Folio 文件"
  fi
  log "备份目录：$BACKUP_DIR"
}

install_file() {
  local source="$1"
  local destination="$2"
  local relative="$3"
  local component="$4"
  local label="$5"
  local action_index

  if [[ -f "$destination" ]] && cmp -s "$source" "$destination"; then
    return
  fi
  record_action_before "$component" file "$destination" "$relative" "$label"
  action_index="$LAST_ACTION_INDEX"
  mkdir -p "$(dirname "$destination")"
  install -m 0644 "$source" "$destination"
  finalize_action "$action_index"
}

if [[ -n "$RESTORE_TARGET" ]]; then
  if pgrep -x Typora >/dev/null 2>&1; then
    if [[ "$DRY_RUN" -eq 1 ]]; then
      log "警告：Typora 正在运行；实际恢复前需要完全退出。"
    else
      fail "Typora 正在运行。请完全退出 Typora 后再恢复。"
    fi
  fi
  restore_snapshot
  exit 0
fi

[[ -d "$TYPORA_APP" ]] || fail "找不到 Typora：$TYPORA_APP"
[[ -f "$TYPORA_APP/Contents/Info.plist" ]] || fail "不是有效的 Typora.app：$TYPORA_APP"
TYPORA_INDEX="$(find_typora_index)" || fail "找不到 Typora 的 index.html"
TYPORA_VERSION="$(read_typora_version)"
if [[ "$UNINSTALL" -eq 1 ]]; then
  if pgrep -x Typora >/dev/null 2>&1; then
    if [[ "$DRY_RUN" -eq 1 ]]; then
      log "警告：Typora 正在运行；实际卸载前需要完全退出。"
    else
      fail "Typora 正在运行。请完全退出 Typora 后再卸载。"
    fi
  fi
  uninstall_folio
  exit 0
fi
if [[ "$DRY_RUN" -eq 1 ]]; then
  if ! grep -Fq "$(folio_enhancer_url)" "$TYPORA_INDEX" && ! can_write_typora_index; then
    log "警告：Typora.app 当前不可写；实际安装需要在交互式 macOS Terminal 中授权管理员写入入口文件。"
  fi
else
  ensure_typora_index_writable "$(folio_enhancer_url)"
fi

if pgrep -x Typora >/dev/null 2>&1; then
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "警告：Typora 正在运行；实际安装前需要完全退出。"
  else
    fail "Typora 正在运行。请完全退出 Typora 后重试。"
  fi
fi

log "Typora：${TYPORA_APP}（${TYPORA_VERSION}）"
log "主题目录：$THEME_DIR"
log "实验性增强器：$ENHANCER_TARGET"
log "运行时依赖：无"

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "dry-run 完成，没有写入文件"
  exit 0
fi

TIMESTAMP="$(date '+%Y%m%d-%H%M%S')-$$"
BACKUP_DIR="$USER_DATA/folio-install-backups/$TIMESTAMP"
TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/folio-install.XXXXXX")"
trap 'rm -rf "$TEMP_ROOT"' EXIT
mkdir -p "$BACKUP_DIR"
init_restore_manifest

install_file "$THEME_LIGHT" "$THEME_DIR/folio.css" "themes/folio.css" \
  theme-light "Folio 浅色主题"
install_file "$THEME_DARK" "$THEME_DIR/folio-dark.css" "themes/folio-dark.css" \
  theme-dark "Folio 深色主题"
install_file "$ENHANCER_SOURCE" "$ENHANCER_TARGET" "themes/folio-enhancer.js" \
  folio-enhancer "Folio Enhancer（实验性）"
install_folio_enhancer_entry "$TEMP_ROOT"
grep -Fq "$(folio_enhancer_url)" "$TYPORA_INDEX" \
  || fail "Folio Enhancer 注入验证失败，备份位于 $BACKUP_DIR"
log "已安装 Folio、Folio Dark 与 Folio Enhancer（实验性）"

finalize_restore_manifest
if [[ "$ACTION_COUNT" -eq 0 ]]; then
  printf 'noChangesAt=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    > "$BACKUP_DIR/restore-completed.txt"
  log "Folio 已是最新版本，没有需要恢复的改动。"
else
  log "安装完成。备份目录：$BACKUP_DIR"
  log "恢复本次安装：$SCRIPT_DIR/install-macos.sh --restore $TIMESTAMP"
fi
log "重新启动 Typora，并在主题菜单中选择 Folio 或 Folio Dark。"
log "提示：代码标签组依赖 Typora 内部 DOM，属于实验性功能。"
