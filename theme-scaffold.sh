#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$ROOT_DIR/themes.plist"
TEMP_THEME_ROOT=""
TEMP_CONFIG=""

cleanup() {
  if [[ -n "$TEMP_THEME_ROOT" && -d "$TEMP_THEME_ROOT" ]]; then
    /bin/rm -rf "$TEMP_THEME_ROOT"
  fi
  if [[ -n "$TEMP_CONFIG" && -f "$TEMP_CONFIG" ]]; then
    /bin/rm -f "$TEMP_CONFIG"
  fi
}
trap cleanup EXIT

usage() {
  cat <<'EOF'
创建和管理符合仓库规范的 Typora 主题包。

用法：
  ./theme-scaffold.sh create <theme-id> [选项]
  ./theme-scaffold.sh list
  ./theme-scaffold.sh publish <theme-id> [--name NAME]
  ./theme-scaffold.sh unpublish <theme-id>

create 选项：
  --name NAME    主题显示名称；默认由 theme-id 生成
  --dark         同时创建 <theme-id>-dark.css
  --module       同时创建共享运行时增强模块模板
  --publish      创建并校验后立即上架

说明：
  create 默认只创建本地草稿，不修改 themes.plist。
  publish 将主题加入安装包；CSS 和增强模块根据目录内容自动识别。
  unpublish 只从安装包移除主题，不删除主题目录和资源。
EOF
}

log() {
  printf '[Theme Scaffold] %s\n' "$*"
}

fail() {
  printf '[Theme Scaffold] 错误：%s\n' "$*" >&2
  exit 1
}

validate_id() {
  [[ "$1" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] \
    || fail "主题 ID 必须使用小写 kebab-case：$1"
}

validate_name() {
  [[ -n "$1" && "$1" != *$'\n'* && "$1" != *$'\r'* ]] \
    || fail "主题名称不能为空或包含换行"
}

default_name() {
  local id="$1" word result=""
  local old_ifs="$IFS"
  IFS='-'
  for word in $id; do
    word="$(printf '%s' "$word" | /usr/bin/awk \
      '{ print toupper(substr($0, 1, 1)) substr($0, 2) }')"
    if [[ -n "$result" ]]; then
      result="$result $word"
    else
      result="$word"
    fi
  done
  IFS="$old_ifs"
  printf '%s\n' "$result"
}

plist_value() {
  local file="$1" key="$2" expected_type="$3"
  /usr/bin/plutil -extract "$key" raw -expect "$expected_type" -o - "$file" \
    || fail "主题配置字段缺失或类型错误：$key（应为 $expected_type）"
}

validate_config() {
  [[ -f "$CONFIG_FILE" ]] || fail "找不到主题配置：$CONFIG_FILE"
  /usr/bin/plutil -lint "$CONFIG_FILE" >/dev/null \
    || fail "主题配置不是有效的 plist：$CONFIG_FILE"
  [[ "$(plist_value "$CONFIG_FILE" schema integer)" == 1 ]] \
    || fail "仅支持 schema 1 的主题配置"
  plist_value "$CONFIG_FILE" themes array >/dev/null
}

theme_index() {
  local wanted="$1" count index id
  count="$(plist_value "$CONFIG_FILE" themes array)"
  for ((index = 0; index < count; index++)); do
    id="$(plist_value "$CONFIG_FILE" "themes.$index.id" string)"
    if [[ "$id" == "$wanted" ]]; then
      printf '%s\n' "$index"
      return 0
    fi
  done
  return 1
}

write_main_css() {
  local target="$1" id="$2" name="$3"
  {
    printf '/* %s — Typora theme */\n\n' "$name"
    printf ':root {\n  --typora-theme-id: %s;\n' "$id"
    cat <<'EOF'
  --theme-bg: #fbfaf7;
  --theme-text: #24211d;
  --theme-muted: #6f6961;
  --theme-accent: #2868c7;
  --theme-border: #ded9d1;
  --theme-code-bg: #f1eee8;
  --theme-radius: 8px;
}

html,
body,
#write {
  background: var(--theme-bg);
  color: var(--theme-text);
}

#write {
  max-width: 860px;
  padding: 48px 56px 80px;
}

#write a {
  color: var(--theme-accent);
}

#write blockquote {
  border-left: 3px solid var(--theme-accent);
  color: var(--theme-muted);
}

#write code,
#write tt {
  background: var(--theme-code-bg);
  border-radius: 4px;
  padding: 0.12em 0.32em;
}

#write pre.md-fences {
  background: var(--theme-code-bg);
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius);
}

#write table th,
#write table td {
  border-color: var(--theme-border);
}

@media (max-width: 720px) {
  #write {
    padding: 32px 24px 56px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

@media print {
  html,
  body,
  #write {
    background: #fff !important;
    color: #000 !important;
  }

  #write {
    max-width: none;
    padding: 0;
  }

  video,
  [class*="decoration"] {
    display: none !important;
  }
}
EOF
  } > "$target"
}

write_dark_css() {
  local target="$1" id="$2" name="$3"
  {
    printf '/* %s Dark — Typora theme */\n' "$name"
    printf '@import "./%s.css";\n\n' "$id"
    printf ':root {\n  --typora-theme-id: %s;\n' "$id"
    cat <<'EOF'
  --theme-bg: #1d1e20;
  --theme-text: #e7e3dc;
  --theme-muted: #aaa49a;
  --theme-accent: #78aefc;
  --theme-border: #3c3d40;
  --theme-code-bg: #27282b;
}
EOF
  } > "$target"
}

write_module() {
  local target="$1" id="$2"
  {
    cat <<'EOF'
(() => {
  'use strict'

  const runtime = window[Symbol.for('typora-themes-runtime@1')]
  if (!runtime?.register) {
    return
  }

EOF
    printf "  runtime.register('%s', ({ context, themesBaseUrl }) => {\n" "$id"
    cat <<'EOF'
    let currentContext = context
    let destroyed = false

    // Resolve local assets with new URL('<theme-id>/assets/file', themesBaseUrl).
    void themesBaseUrl

    function reconcile() {
      if (destroyed) {
        return
      }
      // Mount or update this theme's optional enhancement here.
      void currentContext
    }

    reconcile()

    return {
      update(nextContext) {
        currentContext = nextContext
        reconcile()
      },
      destroy() {
        destroyed = true
        // Remove every DOM node, listener, observer, timer and media side effect.
      },
    }
  })
})()
EOF
  } > "$target"
}

write_readme() {
  local target="$1" id="$2" name="$3" dark="$4" module="$5"
  {
    printf '# %s\n\n' "$name"
    cat <<'EOF'
在此说明主题的设计目标、适用场景和主要视觉特征。

## 文件

EOF
    printf -- '- `%s.css`：主主题样式。\n' "$id"
    if [[ "$dark" -eq 1 ]]; then
      printf -- '- `%s-dark.css`：深色版本。\n' "$id"
    fi
    printf -- '- `%s-test.md`：Typora 人工验收文档。\n' "$id"
    printf -- '- `%s/`：安装后的主题资源目录。\n' "$id"
    if [[ "$module" -eq 1 ]]; then
      printf -- '- `%s/%s-module.js`：可选增强模块。\n' "$id" "$id"
    fi
    cat <<'EOF'

## 素材与许可

记录字体、图片、图标和其他外部素材的来源、作者、修改情况及许可证。当前占位图由本项目脚手架生成，可自由替换。

## 安装

自动安装、手动安装、卸载和恢复方式统一见[仓库安装说明](../README.md#安装)。

## 验证

使用同目录测试文档检查浅色、深色、源码、专注、打字机、窄窗口和打印/PDF 模式。若包含增强模块，还需检查主题切换、页面隐藏与“减少动态”状态下的挂载和清理。
EOF
  } > "$target"
}

write_test_document() {
  local target="$1" id="$2" name="$3"
  {
    printf '%s\n' '---' 'title: Theme Test' 'tags:' '  - typora' '  - theme' '---' ''
    printf '# %s 验收文档\n\n' "$name"
    cat <<'EOF'
正文包含 **粗体**、*斜体*、~~删除线~~、[链接](https://typora.io/) 和 `inline code`。

## 列表与任务

- 无序列表
  - 嵌套项目
- [x] 已完成任务
- [ ] 未完成任务

1. 有序列表
2. 第二项

> 引用块用于检查边框、缩进、文字颜色和多段内容。

## 表格

| 元素 | 状态 | 备注 |
| --- | --- | --- |
| 正文 | 完成 | 中英文混排 Typography |
| 代码 | 完成 | `const ready = true` |

## 代码

```js
function greet(name) {
  return `Hello, ${name}!`
}
```

## 数学公式

行内公式 $E = mc^2$。

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

## Mermaid

```mermaid
flowchart LR
  Draft --> Review --> Published
```

## 图片

EOF
    printf '![%s 占位图](%s/assets/placeholder.svg)\n\n' "$name" "$id"
    cat <<'EOF'
## 脚注

主题应在不启用增强模块时保持内容完整。[^fallback]

[^fallback]: 检查脚注编号、悬浮提示和脚注区域样式。
EOF
  } > "$target"
}

write_placeholder_svg() {
  local target="$1"
  {
    cat <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="480" viewBox="0 0 960 480" role="img">
  <rect width="960" height="480" rx="24" fill="#f1eee8"/>
  <path d="M120 342 310 160l126 120 92-82 312 144" fill="none" stroke="#2868c7" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="480" y="420" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#24211d">Theme preview placeholder</text>
</svg>
EOF
  } > "$target"
}

create_theme() {
  local id="$1" name="$2" dark="$3" module="$4"
  local package_dir

  [[ ! -e "$ROOT_DIR/$id" ]] || fail "目标目录已存在：$id"
  TEMP_THEME_ROOT="$(mktemp -d "$ROOT_DIR/.theme-scaffold.XXXXXX")"
  package_dir="$TEMP_THEME_ROOT/$id"
  mkdir -p "$package_dir/$id/assets" "$package_dir/preview" \
    "$package_dir/preview-source"

  write_main_css "$package_dir/$id.css" "$id" "$name"
  write_readme "$package_dir/README.md" "$id" "$name" "$dark" "$module"
  write_test_document "$package_dir/$id-test.md" "$id" "$name"
  write_placeholder_svg "$package_dir/$id/assets/placeholder.svg"
  printf '%s\n' '# Preview' '' \
    '将用于 README 的最终 1440 × 900 预览图放在此目录。' \
    > "$package_dir/preview/README.md"
  printf '%s\n' '# Preview Source' '' \
    '记录预览文档、原始截图、Typora 版本、窗口尺寸和拍摄步骤。' \
    > "$package_dir/preview-source/README.md"

  if [[ "$dark" -eq 1 ]]; then
    write_dark_css "$package_dir/$id-dark.css" "$id" "$name"
  fi
  if [[ "$module" -eq 1 ]]; then
    write_module "$package_dir/$id/$id-module.js" "$id"
  fi

  /bin/mv "$package_dir" "$ROOT_DIR/$id"
  /bin/rmdir "$TEMP_THEME_ROOT"
  TEMP_THEME_ROOT=""
  log "已创建本地主题草稿：$id/"
}

collect_css_files() {
  local id="$1" candidate basename
  PUBLISH_CSS=()
  [[ -f "$ROOT_DIR/$id/$id.css" ]] || fail "缺少主样式：$id/$id.css"
  PUBLISH_CSS+=("$id.css")
  shopt -s nullglob
  for candidate in "$ROOT_DIR/$id/$id-"*.css; do
    basename="${candidate##*/}"
    [[ "$basename" != *' '* ]] || fail "CSS 文件名不能包含空格：$basename"
    PUBLISH_CSS+=("$basename")
  done
  shopt -u nullglob
}

validate_package() {
  local id="$1" module_file="$ROOT_DIR/$1/$1/$1-module.js"
  [[ -d "$ROOT_DIR/$id" ]] || fail "找不到本地主题目录：$id"
  [[ -f "$ROOT_DIR/$id/README.md" ]] || fail "缺少主题说明：$id/README.md"
  [[ -f "$ROOT_DIR/$id/$id-test.md" ]] || fail "缺少验收文档：$id/$id-test.md"
  [[ -d "$ROOT_DIR/$id/$id" ]] || fail "缺少资源目录：$id/$id/"
  collect_css_files "$id"
  PUBLISH_MODULE=""
  if [[ -f "$module_file" ]]; then
    command -v node >/dev/null 2>&1 || fail "校验增强模块需要 node"
    node --check "$module_file" >/dev/null
    PUBLISH_MODULE="$id-module.js"
  fi
}

commit_config() {
  /usr/bin/plutil -lint "$TEMP_CONFIG" >/dev/null \
    || fail "更新后的主题配置无效，未写入 themes.plist"
  /bin/chmod 0644 "$TEMP_CONFIG"
  /bin/mv "$TEMP_CONFIG" "$CONFIG_FILE"
  TEMP_CONFIG=""
}

publish_theme() {
  local id="$1" name="$2" count index css_file
  validate_config
  if theme_index "$id" >/dev/null; then
    fail "主题已在安装包中：$id"
  fi
  validate_package "$id"
  validate_name "$name"

  TEMP_CONFIG="$(mktemp "$ROOT_DIR/.themes.plist.XXXXXX")"
  /bin/cp "$CONFIG_FILE" "$TEMP_CONFIG"
  count="$(plist_value "$TEMP_CONFIG" themes array)"
  /usr/bin/plutil -insert themes -dictionary -append "$TEMP_CONFIG" >/dev/null
  /usr/bin/plutil -insert "themes.$count.id" -string "$id" "$TEMP_CONFIG" >/dev/null
  /usr/bin/plutil -insert "themes.$count.name" -string "$name" "$TEMP_CONFIG" >/dev/null
  /usr/bin/plutil -insert "themes.$count.css" -array "$TEMP_CONFIG" >/dev/null
  for css_file in "${PUBLISH_CSS[@]}"; do
    /usr/bin/plutil -insert "themes.$count.css" -string "$css_file" \
      -append "$TEMP_CONFIG" >/dev/null
  done
  /usr/bin/plutil -insert "themes.$count.module" -string "$PUBLISH_MODULE" \
    "$TEMP_CONFIG" >/dev/null
  commit_config
  log "已上架：$id（${#PUBLISH_CSS[@]} 个 CSS，模块：${PUBLISH_MODULE:-无}）"
}

unpublish_theme() {
  local id="$1" index
  validate_config
  index="$(theme_index "$id")" || fail "主题不在安装包中：$id"
  TEMP_CONFIG="$(mktemp "$ROOT_DIR/.themes.plist.XXXXXX")"
  /bin/cp "$CONFIG_FILE" "$TEMP_CONFIG"
  /usr/bin/plutil -remove "themes.$index" "$TEMP_CONFIG" >/dev/null
  commit_config
  log "已下架：$id（本地目录和资源已保留）"
}

list_themes() {
  local count index id name module css_count css_index css_files local_state
  local package id_from_dir listed
  validate_config
  count="$(plist_value "$CONFIG_FILE" themes array)"
  printf '%-18s %-20s %-12s %-22s %s\n' 'THEME' 'NAME' 'STATUS' 'CSS' 'MODULE'
  for ((index = 0; index < count; index++)); do
    id="$(plist_value "$CONFIG_FILE" "themes.$index.id" string)"
    name="$(plist_value "$CONFIG_FILE" "themes.$index.name" string)"
    module="$(plist_value "$CONFIG_FILE" "themes.$index.module" string)"
    css_count="$(plist_value "$CONFIG_FILE" "themes.$index.css" array)"
    css_files=""
    for ((css_index = 0; css_index < css_count; css_index++)); do
      if [[ -n "$css_files" ]]; then
        css_files="$css_files,"
      fi
      css_files="$css_files$(plist_value "$CONFIG_FILE" \
        "themes.$index.css.$css_index" string)"
    done
    local_state="published"
    [[ -d "$ROOT_DIR/$id" ]] || local_state="published*"
    printf '%-18s %-20s %-12s %-22s %s\n' "$id" "$name" "$local_state" \
      "$css_files" "${module:--}"
  done

  shopt -s nullglob
  for package in "$ROOT_DIR"/*; do
    [[ -d "$package" ]] || continue
    id_from_dir="${package##*/}"
    [[ "$id_from_dir" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || continue
    [[ -f "$package/$id_from_dir.css" ]] || continue
    listed=0
    if theme_index "$id_from_dir" >/dev/null; then
      listed=1
    fi
    if [[ "$listed" -eq 0 ]]; then
      collect_css_files "$id_from_dir"
      module="-"
      [[ ! -f "$package/$id_from_dir/$id_from_dir-module.js" ]] \
        || module="$id_from_dir-module.js"
      css_files=""
      for id in "${PUBLISH_CSS[@]}"; do
        if [[ -n "$css_files" ]]; then
          css_files="$css_files,"
        fi
        css_files="$css_files$id"
      done
      name="$(default_name "$id_from_dir")"
      printf '%-18s %-20s %-12s %-22s %s\n' "$id_from_dir" "$name" 'draft' \
        "$css_files" "$module"
    fi
  done
  shopt -u nullglob
  printf '\n%s\n' '* published* 表示已上架，但本地主题目录缺失。'
}

[[ $# -ge 1 ]] || { usage; exit 1; }
COMMAND="$1"
shift

case "$COMMAND" in
  -h|--help|help)
    usage
    ;;
  create|new)
    [[ $# -ge 1 ]] || fail "create 需要 theme-id"
    ID="$1"
    shift
    validate_id "$ID"
    NAME="$(default_name "$ID")"
    DARK=0
    MODULE=0
    PUBLISH=0
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --name)
          [[ $# -ge 2 ]] || fail "--name 缺少名称"
          NAME="$2"
          shift
          ;;
        --dark)
          DARK=1
          ;;
        --module)
          MODULE=1
          ;;
        --publish)
          PUBLISH=1
          ;;
        *)
          fail "create 的未知选项：$1"
          ;;
      esac
      shift
    done
    validate_name "$NAME"
    create_theme "$ID" "$NAME" "$DARK" "$MODULE"
    if [[ "$PUBLISH" -eq 1 ]]; then
      publish_theme "$ID" "$NAME"
    else
      log "完成编辑和验收后运行：./theme-scaffold.sh publish $ID --name \"$NAME\""
    fi
    ;;
  list|ls)
    [[ $# -eq 0 ]] || fail "list 不接受参数"
    list_themes
    ;;
  publish|up)
    [[ $# -ge 1 ]] || fail "publish 需要 theme-id"
    ID="$1"
    shift
    validate_id "$ID"
    NAME="$(default_name "$ID")"
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --name)
          [[ $# -ge 2 ]] || fail "--name 缺少名称"
          NAME="$2"
          shift
          ;;
        *)
          fail "publish 的未知选项：$1"
          ;;
      esac
      shift
    done
    publish_theme "$ID" "$NAME"
    ;;
  unpublish|down)
    [[ $# -eq 1 ]] || fail "unpublish 需要且只接受 theme-id"
    ID="$1"
    validate_id "$ID"
    unpublish_theme "$ID"
    ;;
  *)
    fail "未知命令：$COMMAND"
    ;;
esac
