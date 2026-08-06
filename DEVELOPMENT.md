# Typora Themes 开发规范

本文是本仓库新增主题、主题资源和增强模块的统一规范。安装使用说明只维护在根目录 [README](./README.md#安装)，本文不重复面向用户的安装步骤。

## 1. 基本原则

- 一个主题对应一个顶级目录，主题代码、资源、测试、预览和许可放在一起。
- 根目录 `install-macos.sh` 是唯一安装器；不要为主题编写独立安装脚本。
- `runtime/typora-themes-runtime.js` 是唯一 JavaScript 注入入口。
- 本项目所说的“增强器插件”统一称为“增强模块”。它不是 Typora 官方插件，只能依赖 Typora 当前的页面结构，因此必须允许安全降级。
- CSS、字体、图片、视频和脚本默认全部本地化。引入外部素材时必须记录来源和许可证。
- 主题切换后不得继续保留上一个主题的观察器、事件监听、定时器或生成的 DOM。

## 2. 目录和命名

主题 ID 使用小写 kebab-case，例如 `paper-note`。CSS 文件名、资源目录名、运行时注册 ID 和安装器参数必须使用同一个 ID。

仓库根目录只放共享入口和项目级文档：

```text
typora-themes/
├── README.md                       # 唯一用户安装说明
├── DEVELOPMENT.md                  # 本开发规范
├── theme-test.md                   # 统一主题语法与视觉验收文档
├── themes.plist                    # 唯一主题与增强模块注册表
├── install-macos.sh                # 唯一正式安装器
├── runtime/                         # 共享运行时管理器和架构说明
├── tests/                           # 隔离的运行时与安装器测试
└── <theme-id>/                      # 各主题包
```

每个主题包使用以下结构：

```text
<theme-id>/
├── README.md                       # 设计说明、特性、素材来源、验证建议
├── <theme-id>.css                  # 必需，浅色或唯一主题
├── <theme-id>-dark.css             # 可选，深色版本
├── <theme-id>-test.md              # 可选，主题专属场景或历史回归文档
├── <theme-id>/                     # 必需，安装到 themes/<theme-id>/
│   ├── <theme-id>-module.js        # 可选，主题增强模块
│   ├── assets/                     # 可选，图片、视频、SVG 等
│   ├── fonts/                      # 可选，本地字体和字体许可证
│   └── LICENSE*                    # 可选，资源级许可证或署名
├── preview/                        # 建议，README 使用的最终预览图
└── preview-source/                 # 建议，预览文档、原始截图和拍摄说明
```

资源目录即最终安装目录。例如：

```text
仓库：sunlit/sunlit/assets/leaves.mp4
安装：~/Library/Application Support/abnerworks.Typora/themes/sunlit/assets/leaves.mp4
```

约束：

- 即使暂时没有资源，也保留 `<theme-id>/<theme-id>/`，可用 `.gitkeep` 占位。
- 不提交 `.DS_Store`、临时导出、缓存或无来源的素材。
- 主题专属文件不得放入 `runtime/`；`runtime/` 只存共享生命周期管理器及其架构说明。
- 不新增 `<theme-id>/install-macos.sh`；所有主题统一通过根目录安装器管理。
- `preview/` 中的主预览建议保持当前项目的 1440 × 900 尺寸；预览来源、拍摄文档和未经裁切的截图放在 `preview-source/`。
- 大体积图片和视频在不影响效果的前提下压缩；README 只引用仓库内的最终预览文件。

## 3. 新增主题

### 3.1 创建主题包

优先使用根目录脚手架创建主题包：

以下命令中的 `paper-note` 是自定义的主题 ID，`Paper Note` 是对应的显示名称；请替换为你的主题信息，并在后续命令中保持一致。

```bash
./theme-scaffold.sh create paper-note --name "Paper Note" --dark
```

需要增强模块时增加 `--module`。脚手架会生成主样式、可选深色样式、资源占位图、增强模块模板、主题 README 和预览目录，并在主题 README 中链接根目录的统一验收文档。新主题默认是未进入安装包的本地草稿，可用 `./theme-scaffold.sh list` 查看状态。

之后按以下步骤开发：

1. 确定唯一主题 ID，并检查脚手架生成的目录和文件。
2. 在 `<theme-id>.css` 中完成主题样式；深色版本使用 `<theme-id>-dark.css`。
3. CSS 中的资源地址使用安装后的相对路径：

```css
background-image: url("./<theme-id>/assets/background.webp");
```

4. 应用主题并打开根目录 `theme-test.md`，完成文末的通用视觉验收清单。只有主题存在统一文档无法表达的专属交互或历史回归场景时，才补充 `<theme-id>-test.md`。
5. 创建主题 README，说明设计目标、文件组成、素材来源、许可和验证建议。安装章节只保留一行链接：

```md
## 安装

自动安装、手动安装、卸载和恢复方式统一见[仓库安装说明](../README.md#安装)。
```

### 3.2 CSS 要求

- 颜色、间距、边框和代码高亮优先定义为 `:root` 变量，避免同一值分散在大量选择器中。
- 深色主题可以通过本地 `@import` 复用基础 CSS，但不得依赖远程 CSS。
- 同时检查混合编辑、源码模式、专注模式、打字机模式、侧栏、搜索、弹窗和窄窗口。
- `@media print` 必须移除视频、投影、动画和纯装饰背景，确保 PDF 导出可读。
- 动画必须提供 `prefers-reduced-motion: reduce` 降级。
- 交互增强失效或未安装时，Markdown 内容仍须完整、可编辑、可导出。
- 不依赖仅在预览文档中成立的固定元素 ID、窗口尺寸或绝对文件路径。

### 3.3 注册主题

开发和验收完成后，通过脚手架上架主题：

```bash
./theme-scaffold.sh publish paper-note --name "Paper Note"
```

脚手架会校验必需文件，自动识别 `<id>*.css` 和 `<id>-module.js`，再原子更新根目录 `themes.plist`。下架使用 `./theme-scaffold.sh unpublish paper-note`；下架只移除注册项，保留主题目录。不要为了上架或下架修改安装器代码。

脚手架最终向 `themes` 数组追加等价于以下内容的字典：

```xml
<dict>
  <key>id</key>
  <string>paper-note</string>
  <key>name</key>
  <string>Paper Note</string>
  <key>css</key>
  <array>
    <string>paper-note.css</string>
    <string>paper-note-dark.css</string>
  </array>
  <key>module</key>
  <string></string>
</dict>
```

字段约束：

| 字段 | 必需 | 含义 |
| --- | --- | --- |
| `id` | 是 | 小写 kebab-case；同时作为命令参数、主 CSS 名和安装目录名 |
| `name` | 是 | 面向开发者的主题名称 |
| `css` | 是 | 一个或多个文件名，必须包含 `<id>.css`，不能填写目录 |
| `module` | 是 | 资源目录内的文件名；纯 CSS 主题使用空字符串，增强主题使用 `<id>-module.js` |

主题目录严格由 `id` 推导：CSS 源码位于 `<id>/<css-file>`，资源位于 `<id>/<id>/`，模块位于 `<id>/<id>/<module>`。安装器从注册表自动生成帮助文本、合法主题参数、安装与卸载动作、状态列表、备份范围和 `all` 行为。主题登记后只需在根 README 的主题表与手动安装表补充面向用户的说明。

配置必须通过：

```bash
/usr/bin/plutil -lint themes.plist
```

## 4. 新增增强模块

只有 CSS 无法实现、且功能确实依赖编辑器运行时状态时才增加增强模块。纯视觉效果优先使用 CSS。

开始实现前先阅读[增强模块技术原理](./runtime/ARCHITECTURE.md)，理解共享运行时的主题识别、异步加载、竞态保护和生命周期边界。

### 4.1 文件位置

模块必须放在主题资源目录：

```text
<theme-id>/<theme-id>/<theme-id>-module.js
```

安装后的路径必须对应：

```text
themes/<theme-id>/<theme-id>-module.js
```

不要创建 `themes/<theme-id>-enhancer.js`，也不要向 Typora `index.html` 注入第二个主题脚本标签。

### 4.2 CSS 主题标记

增强主题的主 CSS 必须声明：

```css
:root {
  --typora-theme-id: <theme-id>;
}
```

不要为新模块增加 `--<theme-id>-enhancer-enabled`。Folio 和 Sunlit 的旧变量只用于兼容已发布版本。

### 4.3 模块接口

模块只负责注册；所有 DOM 副作用必须在工厂被运行时激活后产生：

```js
(() => {
  'use strict'

  const runtime = window[Symbol.for('typora-themes-runtime@1')]
  if (!runtime?.register) {
    return
  }

  runtime.register('<theme-id>', ({ context, themesBaseUrl }) => {
    let currentContext = context
    let destroyed = false

    const assetUrl = new URL(
      '<theme-id>/assets/example.webp',
      themesBaseUrl,
    ).href

    function reconcile() {
      if (destroyed) {
        return
      }
      // 根据 currentContext 和当前 DOM 挂载或更新增强效果。
    }

    reconcile()

    return {
      update(nextContext) {
        currentContext = nextContext
        reconcile()
      },
      destroy() {
        destroyed = true
        // 移除模块创建的 DOM、class、监听器、观察器、RAF 和定时器。
      },
    }
  })
})()
```

`context` 当前包含：

- `hidden`：Typora 页面是否不可见。
- `reducedMotion`：系统是否启用“减少动态”。

`themesBaseUrl` 指向 Typora 的 `themes/` 目录，用于解析本地资源。不要硬编码用户目录或使用网络 URL。

### 4.4 生命周期要求

- `update(context)` 必须可重复调用；相同状态重复更新不能创建重复 DOM 或监听器。
- `destroy()` 必须可重复、安全且同步完成主要清理。异步回调触发时也要检查 `destroyed`。
- 每个 `MutationObserver`、事件监听器、`requestAnimationFrame`、定时器和媒体播放都必须有对应清理。
- 模块只能修改自己创建或明确接管的 DOM；生成元素使用主题前缀的 ID、class 和 `data-*`。
- 切换到其他主题后，不得继续播放媒体、响应键盘、写剪贴板或修改编辑器内容。
- 动态效果在 `hidden` 或 `reducedMotion` 时暂停，并提供 CSS 静态降级。
- 依赖 Typora 内部 DOM 的选择器要集中、可识别；找不到目标时安静退出，不阻断编辑器。
- 交互控件必须提供键盘操作、ARIA 标签和清晰的焦点状态。

### 4.5 接入共享运行时和安装器

在该主题的 `themes.plist` 配置中把 `module` 从空字符串改为 `<theme-id>-module.js`。安装器会自动：

1. 从 `<theme-id>/<theme-id>/<theme-id>-module.js` 安装模块。
2. 生成 `<theme-id> → <theme-id>/<theme-id>-module.js` 的运行时允许列表。
3. 把允许列表编译进安装后的共享运行时文件，继续保持单入口。
4. 根据主 CSS 是否安装来安装或移除模块。
5. 在任一增强主题存在时保留共享运行时，在最后一个增强主题卸载后移除它。
6. 把主题 CSS、资源目录、模块和运行时纳入同一备份与恢复快照。

不要修改 `runtime/typora-themes-runtime.js` 或 `install-macos.sh` 来登记新模块。只有模块协议或配置 schema 本身发生变化时，才修改共享基础设施。

新增模块仍需扩展 `tests/runtime-manager.test.js` 的主题切换断言；`tests/config-driven-installer.test.sh` 负责保证仅增加配置和文件就能完成安装、卸载和恢复。

## 5. 代码风格与兼容性

- Markdown、CSS、JavaScript 和 Shell 文件使用 UTF-8、LF 换行和文件末尾换行。
- CSS 和 JavaScript 使用两个空格缩进；新增命名使用可检索的主题前缀，避免与 Typora 或其他主题的 class、ID、变量冲突。
- 增强模块使用无依赖 IIFE 和严格模式，不引入包管理器、远程脚本或全局插件框架。
- JavaScript 错误应安全降级，可以记录带 `[Typora Themes]` 前缀的警告，但不能阻断编辑器。
- 安装器保持兼容 macOS 自带 Bash 3.2；不要使用关联数组、`mapfile` 等 Bash 4+ 功能。
- 主题元数据只维护在 `themes.plist`；安装器代码不得再次出现当前主题 ID 的安装分支或模块映射。
- Shell 变量始终加引号；删除操作只能针对已验证的 `themes/` 子路径，禁止宽泛 glob、未解析变量和不可恢复的目录级操作。
- 修改 Typora `index.html` 时使用临时文件和原子替换，只在这一操作需要时调用 `sudo`，不要让用户使用 `sudo` 运行整个安装器。

## 6. 文档归属

| 内容 | 唯一维护位置 |
| --- | --- |
| 用户安装、卸载、权限、备份和恢复 | 根目录 `README.md` 的“安装”章节 |
| 主题 ID、CSS 文件名和增强模块文件名 | 根目录 `themes.plist` |
| Markdown、Typora 扩展语法和通用视觉验收 | 根目录 `theme-test.md` |
| 主题设计、文件说明、素材来源、许可、验证建议 | `<theme-id>/README.md` |
| 共享运行时概览 | `runtime/README.md` |
| 增强模块技术原理、生命周期和调试 | `runtime/ARCHITECTURE.md` |
| 开发目录、扩展接口、接入流程和质量门槛 | 本文 `DEVELOPMENT.md` |

主题 README 不复制安装命令，只链接根安装章节。安装器行为变化时，只修改根 README；运行时接口变化时，同时修改 `runtime/README.md`、`runtime/ARCHITECTURE.md` 和本文。

## 7. 验证和质量门槛

提交前至少运行：

```bash
/usr/bin/plutil -lint themes.plist
bash -n theme-scaffold.sh install-macos.sh tests/theme-scaffold.test.sh tests/install-macos-smoke.sh tests/config-driven-installer.test.sh
node --check runtime/typora-themes-runtime.js
find . -name '*-module.js' -exec node --check {} \;
node tests/runtime-manager.test.js
node tests/sunlit-module.test.js
node tests/canopy-module.test.js
./tests/theme-scaffold.test.sh
./tests/install-macos-smoke.sh
./tests/config-driven-installer.test.sh
git diff --check
```

人工验证至少包括：

- 自动安装、单主题卸载、`all` 安装/卸载和快照恢复。
- 浅色、深色、源码、专注、窄窗口及打印/PDF。
- 增强主题与纯 CSS 主题之间反复切换，不产生重复 UI 或残留效果。
- 启用“减少动态”、窗口失焦和页面隐藏时，动画或媒体正确暂停。
- 删除或禁用共享运行时后，主题仍能以纯 CSS 安全显示。
- Typora 更新后重新检查内部 DOM 选择器和入口文件位置。

新增或修改测试时只能操作 `mktemp` 创建的隔离目录，不得写入开发者真实的 Typora 用户数据或 `/Applications/Typora.app`。

## 8. 完成清单

### 新主题

- [ ] 目录和 ID 符合约定。
- [ ] CSS、资源、README 和许可齐全，并已使用根目录 `theme-test.md` 完成统一验收。
- [ ] 已在 `themes.plist` 登记，且没有为主题修改安装器代码。
- [ ] 统一安装器支持安装、卸载、状态、`all` 和恢复。
- [ ] 根 README 已登记主题和手动安装内容。
- [ ] 自动测试与 Typora 人工验证通过。

### 新增强模块

- [ ] 模块位于主题资源目录并通过共享运行时注册。
- [ ] `themes.plist` 的 `module` 已声明，且没有修改运行时模块映射代码。
- [ ] CSS 声明 `--typora-theme-id`，且纯 CSS 降级可用。
- [ ] `update()` 幂等，`destroy()` 完整清理所有副作用。
- [ ] 安装器能正确处理共存、单独卸载和最后一个模块卸载。
- [ ] 生命周期测试、安装矩阵和 Typora 内人工切换验证通过。
