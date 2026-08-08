# Canopy

Canopy 是一个概念性 Typora 动态主题：四季天光、日出日落与月色覆盖整个编辑窗口，枝叶投影在纸面、文字和侧栏上持续摇曳。主题不使用 Canvas；日期与时刻只驱动 CSS 渐变光场和语义色变量，视频负责连续的树影运动。

排版和 Typora 组件基础沿用本仓库的 Sunlit/Folio 系统。增强模块以 `Asia/Shanghai`、北纬 31.23°、东经 121.47°计算每日太阳时间，并在春分、夏至、秋分和冬至色板之间连续插值。日落后纸面会进入深灰紫夜色，树影继续播放。

文字明暗与环境昼夜独立计算：正文和标题优先保持 `7:1` 对比度，信息文字至少保持 WCAG AA 的 `4.5:1`。晨昏光源重叠、最终合成风险升高时，模块会同步收窄季节色、发光层与树影，并加强信息文字的基础对比和细微边缘。`window.__canopyDebug.getScene()` 返回的 `phase`、`contrastMode` 和 `contrastGuard` 可用于检查晨昏阶段、文字极性与保护强度。

## 原型素材说明

`canopy/assets/leaves.mp4` 暂时复用 Sunlit 的验证视频，原始素材取自 [dany.works](https://dany.works/leaves.mp4)。仓库没有获得该素材的再分发许可；它只能用于本地设计验证。公开发布、打包或商业使用 Canopy 前，必须替换为自行制作或具有明确授权的素材。

当前素材参数：

- H.264，720 × 1280，30 fps；
- 12 秒无声循环，约 340 KB；
- 白灰底色通过 `mix-blend-mode: multiply` 覆盖整个 Typora 窗口。

## 文件

- `canopy.css`：完整 Typora 排版、静态降级和 CSS 光场样式。
- `canopy/canopy-module.js`：上海日期/太阳模型、单套季节与环境光场、语义色更新和视频生命周期。
- `canopy/assets/leaves.mp4`：临时动态树影素材。
- `canopy/assets/leaves-still.jpg`：减少动态或增强模块不可用时的静态树影。
- `canopy-test.md`：昼夜、树影与完整 Markdown 排版验证文档。

## 安装

自动安装、手动安装、卸载和恢复方式统一见[仓库安装说明](../README.md#安装)。手动安装 Canopy 时显示默认暖色下午场景和静态树影，不启用实时日期与视频。

## 可调参数

可在 `canopy.css` 的 `:root` 中调整：

```css
--canopy-shadow-opacity: 0.78;
--canopy-static-shadow-opacity: 0.34;
--canopy-text-edge-radius: 0px;
--canopy-text-edge-opacity: 0;
```

增强模块会按当前场景更新这些参数。打印和 PDF 导出会自动移除季节光场、树影与文字边缘补偿。

## 时间调试与演示录制

Canopy 启用后，可在 Typora 开发者工具 Console 中打开调试 HUD：

```js
window.__canopyDebug.show()
```

HUD 提供日期、时刻滑杆、播放/暂停、完整一天的播放时长、季节色/环境光/树影开关、恢复实时和隐藏控件。默认以 90 秒播放完整一天；也可选择 1440 秒/天，此时现实 1 秒对应场景 1 分钟。隐藏 HUD 后自动播放仍会继续，适合录制演示视频。

实时模式每分钟整点后更新当前光场；拖动时刻滑杆会立即显示目标场景。自动播放使用单套季节色与环境色，由浏览器动画帧调度并以最高 20 FPS 连续计算场景，在保持录制流畅度的同时为界面点击留出响应时间。它不再通过两套半透明背景交叉淡入，直射光也已移除。

为避免光斑洗白文字或在 Typora 正文合成层边缘产生色差，Canopy 不再绘制独立直射光。季节色、环境色和树影保持原有层级，主题也不修改 `#write` 的背景、层级或 GPU 合成设置。

也可以直接使用控制台 API：

```js
// 固定上海日期与时刻
window.__canopyDebug.setTime('2026-06-21T18:45:00+08:00')

// 常用四季场景
window.__canopyDebug.preset('spring-noon')
window.__canopyDebug.preset('summer-sunset')
window.__canopyDebug.preset('autumn-dawn')
window.__canopyDebug.preset('winter-midnight')

// 60 秒播放完整一天
window.__canopyDebug.play({ dayDurationSeconds: 60 })
window.__canopyDebug.pause()
window.__canopyDebug.toggle()

// 现实 1 秒推进场景 1 分钟
window.__canopyDebug.play({ dayDurationSeconds: 1440 })

// 隔离光影图层；树影会同时控制静态降级图与动态视频
window.__canopyDebug.setLayer('season', false)
window.__canopyDebug.setLayer('ambient', false)
window.__canopyDebug.toggleLayer('shadow')
window.__canopyDebug.getLayers()

// 隐藏控件但继续播放；恢复真实时间会停止自动播放
window.__canopyDebug.hide()
window.__canopyDebug.reset()
```

图层开关只改变最终合成，日期、太阳位置和时间轴仍会继续计算；重新开启时会立即显示当前调试时刻的效果。“实时”只恢复真实时间，不会重置图层。调试状态只保存在当前 Canopy 实例的内存中；切换主题或重启 Typora 后自动清除。
