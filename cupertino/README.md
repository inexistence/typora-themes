# Cupertino

Cupertino 是一套以 Apple 人机界面指南中按钮的层级语言为灵感的 Typora 主题：用系统字体、蓝色主操作、浅色强调面和简洁的圆角组件组织长文内容。它是独立实现，不包含或复制 Apple 的源码、图标、字体或其他素材。

## 视觉系统

- **Plain**：链接和低优先级操作使用蓝色文字，不占用额外容器。
- **Tinted**：引用、目录、已选文件和次级操作使用低饱和蓝色或系统灰的圆角表面。
- **Filled**：主要按钮、焦点环和代码编辑状态采用高对比 Apple blue，突出当前可操作元素。
- **平台化排版**：macOS/iOS 优先使用 SF 与苹方；其他系统使用随主题安装的 Geist、Geist Mono 和 Noto Sans SC，保持相近的屏幕排版气质与完整简体中文覆盖。
- **深色模式**：`cupertino-dark.css` 复用主样式，切换为接近系统 Dark Mode 的纯黑背景、分层灰色表面和亮蓝色重点。

代码块使用圆角容器、低对比工具栏和熟悉的窗口控制点；表格使用分组列表式分隔；任务清单使用圆形蓝色勾选状态。主题包含专注模式、窄窗口、减少动态和打印导出的降级样式。

## 文件

- `cupertino.css`：浅色主题。
- `cupertino-dark.css`：深色主题，通过本地导入复用浅色版的结构规则。
- `cupertino/fonts/`：本地跨平台字体回退与许可证；本主题不需要增强模块。

## 字体与许可证

Apple 设备会先调用系统提供的 SF Pro、SF Mono 与苹方字体；主题不会复制、嵌入或重新分发任何 Apple 字体。在其他系统上，主题使用以下本地回退：

- **Geist / Geist Mono 1.7.2**：用于拉丁文正文、标题与代码，视觉方向接近 SF Pro / SF Mono。
- **Noto Sans SC**：用于简体中文、全角标点和 CJK 字符；提供 400、500、700 三个字重。

以上字体均遵循 SIL Open Font License 1.1，完整许可证见 `cupertino/fonts/OFL-1.1.txt`。Geist 来自 [vercel/geist-font v1.7.2](https://github.com/vercel/geist-font/releases/tag/v1.7.2)；Noto Sans SC 文件来自本仓库已收录的上游 Noto Sans SC 分包，原始项目见 [notofonts/noto-cjk](https://github.com/notofonts/noto-cjk)。

## 参考

视觉方向参考 [Apple Human Interface Guidelines — Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) 的层级思想，不代表获得 Apple 认可或与 Apple 存在关联。

## 安装

自动安装、手动安装、卸载和恢复方式统一见[仓库安装说明](../README.md#安装)。

## 验证建议

在 Typora 中打开根目录的 `theme-test.md`，分别检查浅色、深色、源代码模式、专注模式、侧栏、搜索、窄窗口以及导出 PDF 的可读性。
