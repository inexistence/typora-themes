# Folio

Folio 是一套介于产品文档与编辑刊物之间的 Typora 主题，提供独立的浅色与深色版本。

它参考 Claude Platform Docs 的视觉语言：衬线标题、无衬线正文、暖中性色、低对比边界和克制的代码组件。主题没有复制或打包 Anthropic 的字体、图片或源 CSS。

## 预览

![Folio Typora 主题总览](./preview/overview.jpg)

![Folio 主题的语义提示与表格](./preview/content.jpg)

![Folio Dark 主题的代码标签组与图表](./preview/code.jpg)

## 文件

- `folio.css`：暖白浅色版本。
- `folio-dark.css`：暖灰黑深色版本，通过导入 `folio.css` 复用排版与编辑状态规则。
- `folio-enhancer.js`：无依赖的实验性代码标签组增强器。
- `install-macos.sh`：带备份、恢复和卸载能力的 macOS 安装脚本。
- `folio-test.md`：覆盖排版、代码、图表、图片和 Typora 状态的测试文档。
- `preview/`：用于 README 展示的 1440 × 900 主题效果图。
- `preview-source/`：用于在 Typora 中拍摄真实主题效果的预览文档和截图说明。

## 视觉系统

- 一级至三级标题使用系统衬线字体栈；正文与较低级标题使用系统无衬线字体栈。
- 浅色版以 `#fcfcfb` 为纸张底色，正文使用低饱和暖灰。
- 深色版使用 `#141413`、`#1f1e1d`、`#262624` 和 `#30302e` 构成四级表面。
- 陶土色仅用于链接交互、任务控件、光标、选择和少量强调。
- 表格以水平分隔为主；普通代码围栏使用轻边框、8px 圆角、简洁语言栏和 14/20px 等宽正文。
- 单个代码块与代码标签组共用同一套卡片、语言栏、语法高亮及聚焦样式。

## 引用与语义提示框

普通 Markdown 引用使用中性背景、0.5px 边框、8px 圆角和紧凑内边距，适合长文中的引述及嵌套引用。它不会自动添加图标或状态颜色。

Typora 的 GitHub Alert 语法会显示为 Claude Docs 风格的语义提示框，支持 `NOTE`、`TIP`、`IMPORTANT`、`WARNING` 和 `CAUTION`：

```markdown
> [!NOTE]
> 这是一条信息说明。

> [!TIP]
> 这是一条使用建议。
```

提示框使用 Typora 自带的语义图标：Note 为蓝色，Tip 为中性表面，Important 为紫色，Warning 为琥珀色，Caution 为红色。浅色与深色主题分别提供对应背景、边框和文字颜色，不依赖 Folio Enhancer。

## 实验性功能：代码标签组

> **实验性功能：** `folio-enhancer.js` 依赖 Typora 当前的内部 DOM 结构，并非 Typora 官方插件 API。Typora 更新后可能暂时失效，需要重新安装或调整增强器。重要文档应始终以不启用增强器也能正常阅读为前提。

Folio 使用 Markdown 引用作为代码组容器。一个引用中直接包含两个或更多普通围栏代码块时，增强器会把它们显示成可点击的 `Python / TypeScript / …` 标签页：

````markdown
> ```python
> model = "claude-opus-5"
> ```
>
> ```typescript
> const model = "claude-opus-5";
> ```
````

标签组支持鼠标点击、左右方向键、Home、End 和复制当前代码。增强器也会在普通单代码块的语言栏右侧加入同款复制按钮；未安装增强器时不会生成按钮。点击标签组的代码正文进入编辑状态后，左下角会显示紧凑的 Typora 原生语言输入框；它不创建全宽底栏，离开代码块后控件和占位会一起收起。输入后按 Enter、Escape 或点击别处，顶部 Tab 名称会随之刷新。Mermaid 等高级围栏不会被加入标签组。

这个 Markdown 写法不依赖增强器。在未安装增强器、增强器失效、切换到其他主题或导出打印时，各代码块会安全降级为普通的纵向代码块，不会变成横向画廊，也不会损失内容。

增强器是一个约 14 KB 的本地脚本，没有包管理器、运行时依赖、设置界面、网络请求或全局插件样式。它通过 Folio CSS 中的主题标记启用，因此不会改造其他主题的代码块。

Typora 官方说明将编辑器外观自定义放在[主题 CSS](https://support.typora.io/Add-Custom-CSS/)中，而 JavaScript 注入记录在[导出功能](https://support.typora.io/Export/)中；没有可供编辑器标签交互使用的官方扩展入口。因此 Folio Enhancer 仍需向 Typora 应用的 `index.html` 加入一个本地脚本标签，这也是该功能被标记为实验性的原因。

## macOS 自动安装

完全退出 Typora，在终端进入 `folio` 目录后运行：

```bash
./install-macos.sh
```

脚本会安装两套主题和 `folio-enhancer.js`，并向 Typora 入口加入一个带 `folio-enhancer:experimental` 标记的本地脚本标签。它不会联网，也不会安装第三方插件框架。可先预览计划：

```bash
./install-macos.sh --dry-run
```

若 `/Applications/Typora.app` 不可写，请在交互式 macOS Terminal 中运行。脚本只会在原子替换 Typora 的 `index.html` 时单独请求管理员密码；不要使用 `sudo ./install-macos.sh`。如果仍出现 `Operation not permitted`，请在“系统设置 → 隐私与安全性 → 应用管理”中允许当前终端更新其他应用，然后重新运行。

### 备份与恢复

脚本会在每次安装、卸载前，把将要改动的文件备份到：

```text
~/Library/Application Support/abnerworks.Typora/folio-install-backups/
```

正常情况下不需要手动复制备份。完全退出 Typora 后，运行下面的命令即可恢复最近一次尚未恢复的操作：

```bash
./install-macos.sh --restore latest
```

也可以传入操作结束时显示的快照名称。建议先追加 `--dry-run` 做恢复预检查。恢复会校验文件哈希；如果安装后文件又被修改，脚本会停止，只有确认覆盖这些后续修改时才使用 `--force`。

### 卸载

完全退出 Typora 后运行：

```bash
./install-macos.sh --uninstall
```

它会移除 Folio、Folio Dark、`folio-enhancer.js` 及 Typora 入口中的增强器标签，并先创建可一键恢复的快照。脚本不会改动其他主题或插件目录。

## 仅安装主题

如果不需要实验性的代码标签组，可只安装 CSS：

1. 在 Typora 中打开“偏好设置 → 外观 → 打开主题文件夹”。
2. 将 `folio.css` 和 `folio-dark.css` 复制到主题文件夹，两份文件必须位于同一目录。
3. 重启 Typora，在“主题”菜单中选择 `Folio` 或 `Folio Dark`。

此方式不会修改 Typora.app。所有代码组会保持为普通的纵向代码块，普通代码块的样式与自动安装版本一致。

## 验证建议

使用 `folio-test.md` 分别检查：

- 混合编辑与源码模式中的 Markdown 元字符；
- 普通代码围栏的插入光标、当前行、选择与语法颜色；
- 单个代码块与标签组中的代码块样式一致；
- 标签切换、键盘导航、复制按钮及未安装增强器时的纵向显示；
- Mermaid 未聚焦预览与聚焦编辑状态；
- 数学公式、目录、脚注和 YAML front matter；
- 浅色、深色、专注模式、侧栏、弹窗、窄窗口和 PDF 导出。

主题已通过仓库的静态选择器检查，但代码标签组仍应在目标 Typora 版本中完成人工验证。
