# 岛屿 Typora 主题

从 `wechat-article-template` 的“岛屿”样式同步而来，并继续对齐最初的 `animal-island-ui` 参考：暖纸背景、棕色正文、原版叶片标题图标、Divider `line-yellow` 分割线、Checkbox 任务项、Tag `soft` 行内代码、圆角引用、暖色表格以及 CodeBlock 容器与高亮色板。

## 文件

- `island.css`：可安装的完整 Typora 主题。
- `island-test.md`：覆盖标题、引用、列表、表格、代码、数学公式、图表和打印的测试文档。
- `island-fonts/`：与 `animal-island-ui` 对齐的 Nunito 与 Noto Sans SC 本地字体及许可证。
- `island-assets/`：主题专属视觉资源；分割线使用 Divider 组件的 `line-yellow` 原始 SVG。

## 安装

1. 在 Typora 中打开“偏好设置 → 外观 → 打开主题文件夹”。
2. 将 `island.css`、同级 `island-fonts/` 和 `island-assets/` 目录复制到主题文件夹。
3. 重启 Typora，在“主题”菜单中选择 `Island`。

字体栈与最初参考 `animal-island-ui` 保持一致：拉丁字符优先使用 Nunito，中文使用 Noto Sans SC，并回退到系统中文无衬线字体。
