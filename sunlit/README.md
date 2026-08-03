# Sunlit

Sunlit 是一个概念性 Typora 浅色主题：暖象牙色纸面上覆盖一层缓慢摇曳的枝叶阴影，让写作界面像处在窗边的阳光与微风里。

当前版本是本地效果原型。排版和组件基础沿用本仓库的 Folio 主题，树影视频由共享运行时按需注入；未安装运行时或系统启用“减少动态”时，会自动显示静态树影。

## 原型素材说明

`sunlit/assets/leaves.mp4` 暂时直接取自 [dany.works](https://dany.works/leaves.mp4)，仅用于本地设计验证。仓库没有获得该素材的再分发许可；在公开发布、打包或商业使用 Sunlit 之前，必须替换成自行制作或具有明确授权的素材。

当前素材参数：

- H.264，720 × 1280，30 fps；
- 12 秒无声循环，约 340 KB；
- 白灰底色配合 `mix-blend-mode: multiply`，让树影同时落在纸面和文字上。

## 文件

- `sunlit.css`：暖色编辑主题和静态树影降级。
- `sunlit/sunlit-module.js`：仅在 Sunlit 启用时加载、播放树影视频。
- `sunlit/assets/leaves.mp4`：临时验证视频。
- `sunlit/assets/leaves-still.jpg`：减少动态和纯 CSS 安装时使用的静态帧。
- `sunlit-test.md`：排版和树影可读性测试文档。

## 安装

自动安装、手动安装、权限处理、卸载和恢复方式统一见[仓库安装说明](../README.md#安装)。手动安装 Sunlit 时只显示静态树影，不播放视频。

## 调整树影

可在 `sunlit.css` 的 `:root` 中修改：

```css
--sunlit-shadow-opacity: 0.78;
--sunlit-static-shadow-opacity: 0.34;
```

前者控制视频强度，后者控制静态降级强度。打印和 PDF 导出会自动移除树影。
