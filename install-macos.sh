#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$ROOT_DIR/themes.plist"
TYPORA_APP="/Applications/Typora.app"
USER_DATA_OVERRIDE=""
DRY_RUN=0
FORCE=0
POSITIONAL=()
THEME_IDS=()
THEME_NAMES=()
THEME_MODULES=()
CSS_THEME_IDS=()
CSS_FILES=()
THEME_CHOICES=""

usage() {
  cat <<EOF
统一安装和管理本仓库的 Typora 主题（macOS）。

用法：
  ./install-macos.sh [选项] list
  ./install-macos.sh [选项] install <$THEME_CHOICES>
  ./install-macos.sh [选项] uninstall <$THEME_CHOICES>
  ./install-macos.sh [选项] restore <latest|快照名称>

选项：
  --dry-run               只显示计划，不写入文件
  --force                 恢复时覆盖安装后的哈希冲突
  --typora-app PATH       指定 Typora.app 路径
  --user-data PATH        指定 Typora 用户数据目录
  -h, --help              显示帮助

带增强模块的主题共用一个运行时入口，纯 CSS 主题不会安装运行时。
每次安装、卸载和恢复前都会创建可逆快照。
EOF
}

log() {
  printf '[Typora Themes] %s\n' "$*"
}

fail() {
  printf '[Typora Themes] 错误：%s\n' "$*" >&2
  exit 1
}

plist_value() {
  local key="$1" expected_type="$2"
  /usr/bin/plutil -extract "$key" raw -expect "$expected_type" -o - "$CONFIG_FILE" \
    || fail "主题配置字段缺失或类型错误：$key（应为 $expected_type）"
}

load_theme_config() {
  local schema theme_count theme_index existing_index css_count css_index
  local id name module css_file base_css_found

  [[ -f "$CONFIG_FILE" ]] || fail "找不到主题配置：$CONFIG_FILE"
  /usr/bin/plutil -lint "$CONFIG_FILE" >/dev/null \
    || fail "主题配置不是有效的 plist：$CONFIG_FILE"
  schema="$(plist_value schema integer)"
  [[ "$schema" == 1 ]] || fail "不支持的主题配置版本：$schema"
  theme_count="$(plist_value themes array)"
  [[ "$theme_count" =~ ^[1-9][0-9]*$ ]] || fail "主题配置必须至少包含一个主题"

  for ((theme_index = 0; theme_index < theme_count; theme_index++)); do
    id="$(plist_value "themes.$theme_index.id" string)"
    name="$(plist_value "themes.$theme_index.name" string)"
    module="$(plist_value "themes.$theme_index.module" string)"

    [[ "$id" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] \
      || fail "主题 ID 必须使用小写 kebab-case：$id"
    [[ -n "$name" && "$name" != *$'\n'* && "$name" != *$'\r'* ]] \
      || fail "主题 $id 的 name 无效"
    if [[ -n "$module" ]]; then
      [[ "$module" == "$id-module.js" ]] \
        || fail "主题 $id 的 module 必须是 $id-module.js"
    fi
    for ((existing_index = 0; existing_index < theme_index; existing_index++)); do
      [[ "${THEME_IDS[$existing_index]}" != "$id" ]] || fail "主题 ID 重复：$id"
    done

    THEME_IDS+=("$id")
    THEME_NAMES+=("$name")
    THEME_MODULES+=("$module")

    css_count="$(plist_value "themes.$theme_index.css" array)"
    [[ "$css_count" =~ ^[1-9][0-9]*$ ]] \
      || fail "主题 $id 必须至少声明一个 CSS 文件"
    base_css_found=0
    for ((css_index = 0; css_index < css_count; css_index++)); do
      css_file="$(plist_value "themes.$theme_index.css.$css_index" string)"
      [[ -n "$css_file" && "$css_file" != */* && "$css_file" == *.css ]] \
        || fail "主题 $id 的 CSS 必须只填写 .css 文件名"
      [[ "$css_file" == "$id"*.css ]] \
        || fail "主题 $id 的 CSS 文件名必须以 $id 开头"
      [[ "$css_file" != *' '* ]] || fail "CSS 文件名不能包含空格：$css_file"
      [[ "$css_file" != "$id.css" ]] || base_css_found=1
      CSS_THEME_IDS+=("$id")
      CSS_FILES+=("$css_file")
    done
    [[ "$base_css_found" -eq 1 ]] || fail "主题 $id 缺少主文件 $id.css"
  done

  for id in "${THEME_IDS[@]}"; do
    if [[ -n "$THEME_CHOICES" ]]; then
      THEME_CHOICES="$THEME_CHOICES|$id"
    else
      THEME_CHOICES="$id"
    fi
  done
  THEME_CHOICES="$THEME_CHOICES|all"
}

known_theme_target() {
  local candidate
  [[ "$1" == all ]] && return 0
  for candidate in "${THEME_IDS[@]}"; do
    [[ "$1" != "$candidate" ]] || return 0
  done
  return 1
}

validate_install_sources() {
  local theme_index css_index id module css_file
  for ((theme_index = 0; theme_index < ${#THEME_IDS[@]}; theme_index++)); do
    id="${THEME_IDS[$theme_index]}"
    [[ "$TARGET" == all || "$TARGET" == "$id" ]] || continue
    module="${THEME_MODULES[$theme_index]}"
    [[ -d "$ROOT_DIR/$id/$id" ]] || fail "找不到主题资源目录：$id/$id"
    for ((css_index = 0; css_index < ${#CSS_FILES[@]}; css_index++)); do
      [[ "${CSS_THEME_IDS[$css_index]}" != "$id" ]] || {
        css_file="${CSS_FILES[$css_index]}"
        [[ -f "$ROOT_DIR/$id/$css_file" ]] || fail "找不到主题 CSS：$id/$css_file"
      }
    done
    if [[ -n "$module" ]]; then
      [[ -f "$ROOT_DIR/$id/$id/$module" ]] \
        || fail "找不到主题增强模块：$id/$id/$module"
    fi
  done
}

load_theme_config

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      ;;
    --force)
      FORCE=1
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
      POSITIONAL+=("$1")
      ;;
  esac
  shift
done

[[ "$(uname -s)" == "Darwin" ]] || fail "此脚本仅支持 macOS"
[[ "${#POSITIONAL[@]}" -ge 1 ]] || { usage; exit 1; }

COMMAND="${POSITIONAL[0]}"
TARGET="${POSITIONAL[1]:-}"
case "$COMMAND" in
  list)
    [[ "${#POSITIONAL[@]}" -eq 1 ]] || fail "list 不接受主题参数"
    ;;
  install|uninstall)
    [[ "${#POSITIONAL[@]}" -eq 2 ]] || fail "$COMMAND 需要一个主题参数"
    known_theme_target "$TARGET" || fail "未知主题：$TARGET"
    ;;
  restore)
    [[ "${#POSITIONAL[@]}" -eq 2 ]] || fail "restore 需要 latest 或快照名称"
    ;;
  *)
    fail "未知命令：$COMMAND"
    ;;
esac

[[ "$COMMAND" != install ]] || validate_install_sources

USER_DATA="$HOME/Library/Application Support/abnerworks.Typora"
if [[ -n "$USER_DATA_OVERRIDE" ]]; then
  USER_DATA="$USER_DATA_OVERRIDE"
fi

[[ "$TYPORA_APP" == /* && "$TYPORA_APP" != / \
  && "/$TYPORA_APP/" != *"/../"* ]] \
  || fail "--typora-app 必须是无 .. 的绝对路径"
[[ "$USER_DATA" == /* && "$USER_DATA" != / \
  && "/$USER_DATA/" != *"/../"* ]] \
  || fail "--user-data 必须是无 .. 的绝对路径"
[[ "$TYPORA_APP" != *$'\n'* && "$TYPORA_APP" != *$'\r'* \
  && "$USER_DATA" != *$'\n'* && "$USER_DATA" != *$'\r'* ]] \
  || fail "路径不能包含换行符"

THEME_DIR="$USER_DATA/themes"
BACKUP_ROOT="$USER_DATA/typora-themes-install-backups"
TIMESTAMP="$(date '+%Y%m%d-%H%M%S')-$$"
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"
TEMP_ROOT=""
SNAPSHOT_STARTED=0
TRANSACTION_ACTIVE=0

RUNTIME_SOURCE="$ROOT_DIR/runtime/typora-themes-runtime.js"
RUNTIME_TARGET="$THEME_DIR/typora-themes-runtime.js"
LEGACY_MODULE_DIR="$THEME_DIR/typora-themes-runtime"

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

encoded_user_data="${USER_DATA//%/%25}"
encoded_user_data="${encoded_user_data// /%20}"
RUNTIME_URL="file://$encoded_user_data/themes/typora-themes-runtime.js"
RUNTIME_TAG="<!-- typora-themes-runtime:v1 --><script src=\"$RUNTIME_URL\"></script>"
LEGACY_FOLIO_URL="file://$encoded_user_data/themes/folio-enhancer.js"
LEGACY_SUNLIT_URL="file://$encoded_user_data/themes/sunlit-enhancer.js"

managed_relatives() {
  local index css_file id
  for ((index = 0; index < ${#CSS_FILES[@]}; index++)); do
    css_file="${CSS_FILES[$index]}"
    printf 'themes/%s\n' "$css_file"
  done
  for id in "${THEME_IDS[@]}"; do
    printf 'themes/%s\n' "$id"
  done
  cat <<'EOF'
themes/typora-themes-runtime.js
themes/typora-themes-runtime
themes/folio-enhancer.js
themes/sunlit-enhancer.js
EOF
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
  fail "不支持的文件类型：$target"
}

safe_remove() {
  local target="$1"
  case "$target" in
    "$THEME_DIR"/*) ;;
    *) fail "拒绝移除主题目录以外的目标：$target" ;;
  esac
  if [[ -d "$target" && ! -L "$target" ]]; then
    /bin/rm -rf "$target"
  else
    /bin/rm -f "$target"
  fi
}

copy_for_backup() {
  local source="$1"
  local destination="$2"
  mkdir -p "$(dirname "$destination")"
  if [[ -d "$source" && ! -L "$source" ]]; then
    cp -R "$source" "$destination"
  else
    cp -p "$source" "$destination"
  fi
}

snapshot_relatives() {
  local snapshot="$1"
  if [[ -f "$snapshot/managed-relatives.txt" ]]; then
    /bin/cat "$snapshot/managed-relatives.txt"
  else
    awk '{print $2}' "$snapshot/after-hashes.txt"
  fi
}

snapshot_before() {
  local operation="$1"
  local included_snapshot="${2:-}"
  local relative target
  mkdir -p "$BACKUP_DIR/user-data"
  printf '%s\n' "$operation" > "$BACKUP_DIR/operation.txt"
  printf '%s\n' "$TYPORA_APP" > "$BACKUP_DIR/typora-app.txt"
  printf '%s\n' "$TYPORA_INDEX" > "$BACKUP_DIR/typora-index.txt"
  printf '%s\n' "$USER_DATA" > "$BACKUP_DIR/user-data.txt"
  cp -p "$TYPORA_INDEX" "$BACKUP_DIR/Typora-index.html"
  {
    managed_relatives
    if [[ -n "$included_snapshot" ]]; then
      snapshot_relatives "$included_snapshot"
    fi
  } | LC_ALL=C sort -u > "$BACKUP_DIR/managed-relatives.txt"
  : > "$BACKUP_DIR/before-exists.txt"
  while IFS= read -r relative; do
    target="$USER_DATA/$relative"
    if [[ -e "$target" || -L "$target" ]]; then
      [[ ! -L "$target" ]] || fail "拒绝操作符号链接：$target"
      printf '%s\n' "$relative" >> "$BACKUP_DIR/before-exists.txt"
      copy_for_backup "$target" "$BACKUP_DIR/user-data/$relative"
    fi
  done < "$BACKUP_DIR/managed-relatives.txt"
}

finalize_snapshot() {
  local relative target
  hash_path "$TYPORA_INDEX" > "$BACKUP_DIR/after-index.sha256"
  : > "$BACKUP_DIR/after-hashes.txt"
  while IFS= read -r relative; do
    target="$USER_DATA/$relative"
    printf '%s %s\n' "$(hash_path "$target")" "$relative" \
      >> "$BACKUP_DIR/after-hashes.txt"
  done < "$BACKUP_DIR/managed-relatives.txt"
}

write_typora_index() {
  local source="$1" permission_hint=""
  local destination_dir owner group staged use_sudo=0
  destination_dir="$(dirname "$TYPORA_INDEX")"
  staged="$destination_dir/.typora-themes-index.$$.tmp"
  owner="$(stat -f '%Su' "$TYPORA_INDEX")"
  group="$(stat -f '%Sg' "$TYPORA_INDEX")"
  if [[ ! -w "$TYPORA_INDEX" || ! -w "$destination_dir" ]]; then
    use_sudo=1
    [[ -t 0 && -x /usr/bin/sudo ]] \
      || fail "需要管理员权限写入 Typora.app；请在 macOS Terminal 中运行"
    if /usr/bin/xattr -p com.apple.macl "$destination_dir" >/dev/null 2>&1; then
      permission_hint="；若提示 Operation not permitted，请在“系统设置 → 隐私与安全性 → 应用管理”中允许当前终端后重试"
    fi
    log "请输入管理员密码，仅用于更新 Typora 的 index.html$permission_hint"
  fi
  if [[ "$use_sudo" -eq 1 ]]; then
    /usr/bin/sudo /usr/bin/install -o "$owner" -g "$group" -m 0644 "$source" "$staged" \
      || fail "无法在 Typora 资源目录创建临时文件。请在“系统设置 → 隐私与安全性 → 应用管理”中允许当前终端，然后完全退出并重新打开终端后重试"
    /usr/bin/sudo /bin/mv -f "$staged" "$TYPORA_INDEX" \
      || fail "无法替换 Typora 的 index.html；临时文件保留在：$staged"
  else
    /usr/bin/install -o "$owner" -g "$group" -m 0644 "$source" "$staged" \
      || fail "无法在 Typora 资源目录创建临时文件：$staged"
    /bin/mv -f "$staged" "$TYPORA_INDEX" \
      || fail "无法替换 Typora 的 index.html；临时文件保留在：$staged"
  fi
}

update_runtime_entry() {
  local wanted="$1" runtime_count
  local staged="$TEMP_ROOT/Typora-index.html"
  cp -p "$TYPORA_INDEX" "$staged"
  LC_ALL=C RUNTIME_TAG="$RUNTIME_TAG" RUNTIME_URL="$RUNTIME_URL" \
    LEGACY_FOLIO_URL="$LEGACY_FOLIO_URL" \
    LEGACY_SUNLIT_URL="$LEGACY_SUNLIT_URL" WANT_RUNTIME="$wanted" \
    /usr/bin/perl -0pi -e '
      sub remove_script {
        my ($url) = @_;
        s{<script\b(?=[^>]*\bsrc\s*=\s*"\Q$url\E")[^>]*>\s*</script>}{}gi;
        s{<script\b(?=[^>]*\bsrc\s*=\s*'"'"'\Q$url\E'"'"')[^>]*>\s*</script>}{}gi;
      }
      remove_script($ENV{LEGACY_FOLIO_URL});
      remove_script($ENV{LEGACY_SUNLIT_URL});
      remove_script($ENV{RUNTIME_URL});
      s{<!--\s*folio-enhancer:experimental\s*-->}{}gi;
      s{<!--\s*sunlit-enhancer:experimental\s*-->}{}gi;
      s{<!--\s*typora-themes-runtime:v1\s*-->}{}gi;
      if ($ENV{WANT_RUNTIME} eq "1") {
        s#</body>#$ENV{RUNTIME_TAG}</body>#;
      }
    ' "$staged"
  runtime_count="$(grep -Foc "$RUNTIME_URL" "$staged" || true)"
  if [[ "$wanted" -eq 1 ]]; then
    [[ "$runtime_count" -eq 1 ]] || fail "无法生成唯一的共享运行时入口"
  else
    [[ "$runtime_count" -eq 0 ]] || fail "无法移除共享运行时入口"
  fi
  write_typora_index "$staged"
}

install_file() {
  local source="$1"
  local target="$2"
  [[ -f "$source" ]] || fail "找不到源文件：$source"
  [[ ! -L "$target" ]] || fail "拒绝覆盖符号链接：$target"
  mkdir -p "$(dirname "$target")"
  /usr/bin/install -m 0644 "$source" "$target"
}

install_tree() {
  local source="$1"
  local target="$2"
  [[ -d "$source" ]] || fail "找不到源目录：$source"
  [[ ! -L "$target" ]] || fail "拒绝覆盖符号链接：$target"
  safe_remove "$target"
  mkdir -p "$(dirname "$target")"
  cp -R "$source" "$target"
  find "$target" -name .DS_Store -type f -delete
}

selected() {
  [[ "$TARGET" == all || "$TARGET" == "$1" ]]
}

install_selected_themes() {
  local theme_index css_index id css_file
  for ((theme_index = 0; theme_index < ${#THEME_IDS[@]}; theme_index++)); do
    id="${THEME_IDS[$theme_index]}"
    selected "$id" || continue
    for ((css_index = 0; css_index < ${#CSS_FILES[@]}; css_index++)); do
      [[ "${CSS_THEME_IDS[$css_index]}" != "$id" ]] || {
        css_file="${CSS_FILES[$css_index]}"
        install_file "$ROOT_DIR/$id/$css_file" "$THEME_DIR/$css_file"
      }
    done
    install_tree "$ROOT_DIR/$id/$id" "$THEME_DIR/$id"
  done
}

uninstall_selected_themes() {
  local theme_index css_index id css_file
  for ((theme_index = 0; theme_index < ${#THEME_IDS[@]}; theme_index++)); do
    id="${THEME_IDS[$theme_index]}"
    selected "$id" || continue
    for ((css_index = 0; css_index < ${#CSS_FILES[@]}; css_index++)); do
      [[ "${CSS_THEME_IDS[$css_index]}" != "$id" ]] || {
        css_file="${CSS_FILES[$css_index]}"
        safe_remove "$THEME_DIR/$css_file"
      }
    done
    safe_remove "$THEME_DIR/$id"
  done
}

generate_runtime_source() {
  local generated="$TEMP_ROOT/typora-themes-runtime.js"
  local theme_index id module
  [[ -f "$RUNTIME_SOURCE" ]] || fail "找不到共享运行时：$RUNTIME_SOURCE"
  {
    printf '%s\n' '/* Generated from themes.plist by install-macos.sh. */'
    printf '%s\n' "window[Symbol.for('typora-themes-runtime-config@1')] = Object.freeze({"
    for ((theme_index = 0; theme_index < ${#THEME_IDS[@]}; theme_index++)); do
      id="${THEME_IDS[$theme_index]}"
      module="${THEME_MODULES[$theme_index]}"
      [[ -z "$module" ]] || printf "  '%s': '%s/%s',\n" "$id" "$id" "$module"
    done
    printf '%s\n' '});'
    /bin/cat "$RUNTIME_SOURCE"
  } > "$generated"
  printf '%s\n' "$generated"
}

reconcile_runtime_files() {
  local theme_index id module module_source module_target
  local need_runtime=0 generated_runtime
  safe_remove "$THEME_DIR/folio-enhancer.js"
  safe_remove "$THEME_DIR/sunlit-enhancer.js"
  safe_remove "$LEGACY_MODULE_DIR"

  for ((theme_index = 0; theme_index < ${#THEME_IDS[@]}; theme_index++)); do
    id="${THEME_IDS[$theme_index]}"
    module="${THEME_MODULES[$theme_index]}"
    [[ -n "$module" ]] || continue
    module_source="$ROOT_DIR/$id/$id/$module"
    module_target="$THEME_DIR/$id/$module"
    if [[ -f "$THEME_DIR/$id.css" ]]; then
      install_file "$module_source" "$module_target"
      need_runtime=1
    else
      safe_remove "$module_target"
    fi
  done

  if [[ "$need_runtime" -eq 1 ]]; then
    generated_runtime="$(generate_runtime_source)"
    install_file "$generated_runtime" "$RUNTIME_TARGET"
    update_runtime_entry 1
  else
    safe_remove "$RUNTIME_TARGET"
    update_runtime_entry 0
  fi
}

resolve_snapshot() {
  local requested="$1"
  local selected_snapshot
  [[ -d "$BACKUP_ROOT" ]] || fail "找不到备份目录：$BACKUP_ROOT"
  if [[ "$requested" == latest ]]; then
    selected_snapshot="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d \
      -exec basename {} \; | LC_ALL=C sort | tail -n 1)"
    [[ -n "$selected_snapshot" ]] || fail "没有可恢复的快照"
  else
    [[ "$requested" != */* && "$requested" != .* ]] || fail "快照名称无效"
    selected_snapshot="$requested"
  fi
  printf '%s/%s\n' "$BACKUP_ROOT" "$selected_snapshot"
}

verify_restore_snapshot() {
  local snapshot="$1"
  local expected_user_data expected_index relative expected actual
  [[ -f "$snapshot/user-data.txt" && -f "$snapshot/typora-index.txt" \
    && -f "$snapshot/after-index.sha256" && -f "$snapshot/after-hashes.txt" ]] \
    || fail "快照不完整：$snapshot"
  IFS= read -r expected_user_data < "$snapshot/user-data.txt"
  IFS= read -r expected_index < "$snapshot/typora-index.txt"
  [[ "$expected_user_data" == "$USER_DATA" ]] || fail "快照属于其他用户数据目录"
  [[ "$expected_index" == "$TYPORA_INDEX" ]] || fail "快照属于其他 Typora 入口"
  [[ "$FORCE" -eq 1 ]] && return
  IFS= read -r expected < "$snapshot/after-index.sha256"
  actual="$(hash_path "$TYPORA_INDEX")"
  [[ "$actual" == "$expected" ]] \
    || fail "Typora 入口在快照后已变化；确认覆盖时使用 --force"
  while IFS=' ' read -r expected relative; do
    actual="$(hash_path "$USER_DATA/$relative")"
    [[ "$actual" == "$expected" ]] \
      || fail "$relative 在快照后已变化；确认覆盖时使用 --force"
  done < "$snapshot/after-hashes.txt"
}

restore_from_snapshot() {
  local snapshot="$1"
  local relative target backup
  while IFS= read -r relative; do
    target="$USER_DATA/$relative"
    backup="$snapshot/user-data/$relative"
    safe_remove "$target"
    if grep -Fxq "$relative" "$snapshot/before-exists.txt"; then
      copy_for_backup "$backup" "$target"
    fi
  done < <(snapshot_relatives "$snapshot")
  write_typora_index "$snapshot/Typora-index.html"
}

cleanup_on_exit() {
  local exit_status=$?
  local rollback_status=0 finalize_status=0
  trap - EXIT
  set +e

  if [[ "$exit_status" -ne 0 && "$TRANSACTION_ACTIVE" -eq 1 ]]; then
    log "操作失败，正在恢复操作前状态"
    (restore_from_snapshot "$BACKUP_DIR") || rollback_status=$?
    if [[ "$rollback_status" -eq 0 ]]; then
      (finalize_snapshot) || finalize_status=$?
    fi
    if [[ "$rollback_status" -eq 0 && "$finalize_status" -eq 0 ]]; then
      printf 'rolledBackAt=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
        > "$BACKUP_DIR/rollback-completed.txt"
      log "已恢复操作前状态；失败记录保存在：$BACKUP_DIR"
    else
      log "警告：自动恢复失败；请保留并人工检查备份：$BACKUP_DIR"
    fi
  elif [[ "$exit_status" -ne 0 && "$SNAPSHOT_STARTED" -eq 1 ]]; then
    /bin/rm -rf "$BACKUP_DIR"
  fi

  if [[ -n "$TEMP_ROOT" ]]; then
    /bin/rm -rf "$TEMP_ROOT"
  fi
  exit "$exit_status"
}

begin_transaction() {
  SNAPSHOT_STARTED=1
  snapshot_before "$@"
  TRANSACTION_ACTIVE=1
}

print_status() {
  local theme_index theme css
  for ((theme_index = 0; theme_index < ${#THEME_IDS[@]}; theme_index++)); do
    theme="${THEME_IDS[$theme_index]}"
    css="$THEME_DIR/$theme.css"
    if [[ -f "$css" ]]; then
      printf '%-8s installed\n' "$theme"
    else
      printf '%-8s not-installed\n' "$theme"
    fi
  done
  if [[ -f "$RUNTIME_TARGET" ]] && grep -Fq "$RUNTIME_URL" "$TYPORA_INDEX"; then
    printf '%-8s active\n' runtime
  else
    printf '%-8s inactive\n' runtime
  fi
}

log "Typora 入口：$TYPORA_INDEX"
log "主题目录：$THEME_DIR"

if [[ "$COMMAND" == list ]]; then
  print_status
  exit 0
fi

if /usr/bin/pgrep -x Typora >/dev/null 2>&1; then
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "警告：Typora 正在运行；实际操作前需要完全退出"
  else
    fail "Typora 正在运行；请完全退出后重试"
  fi
fi

if [[ "$COMMAND" == restore ]]; then
  RESTORE_SNAPSHOT="$(resolve_snapshot "$TARGET")"
  verify_restore_snapshot "$RESTORE_SNAPSHOT"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "将恢复快照：$RESTORE_SNAPSHOT"
    exit 0
  fi
  mkdir -p "$BACKUP_ROOT" "$THEME_DIR"
  TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/typora-themes.XXXXXX")"
  trap cleanup_on_exit EXIT
  begin_transaction "restore:$TARGET" "$RESTORE_SNAPSHOT"
  restore_from_snapshot "$RESTORE_SNAPSHOT"
  finalize_snapshot
  TRANSACTION_ACTIVE=0
  log "恢复完成；恢复前状态保存在：$BACKUP_DIR"
  exit 0
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "将执行：$COMMAND $TARGET"
  log "将备份到：$BACKUP_DIR"
  exit 0
fi

mkdir -p "$BACKUP_ROOT" "$THEME_DIR"
TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/typora-themes.XXXXXX")"
trap cleanup_on_exit EXIT
begin_transaction "$COMMAND:$TARGET"

if [[ "$COMMAND" == install ]]; then
  install_selected_themes
else
  uninstall_selected_themes
fi
reconcile_runtime_files
finalize_snapshot
TRANSACTION_ACTIVE=0

log "$COMMAND $TARGET 完成；操作前状态保存在：$BACKUP_DIR"
print_status
