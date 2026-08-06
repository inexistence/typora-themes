# Typora Themes Runtime

所有增强主题共用的实验性运行时。安装后 Typora 的 `index.html` 只包含一个本地脚本入口：

```html
<!-- typora-themes-runtime:v1 --><script src=".../themes/typora-themes-runtime.js"></script>
```

运行时读取主题 CSS 中的 `--typora-theme-id`，按需加载对应模块：

- `../folio/folio/folio-module.js`：代码标签组和复制按钮，安装到 `themes/folio/`。
- `../sunlit/sunlit/sunlit-module.js`：动态树影视频，安装到 `themes/sunlit/`。
- `../canopy/canopy/canopy-module.js`：日期驱动的 CSS 天光和动态树影，安装到 `themes/canopy/`。

具体主题、CSS 文件名和模块文件名声明在根目录 `themes.plist`，目录由主题 ID 推导。安装器会校验注册表，并把模块允许列表编译进安装后的共享运行时；运行时源码不硬编码主题 ID。

模块通过 `Symbol.for('typora-themes-runtime@1')` 注册，并返回可选的 `update(context)` 与必须可重复调用的 `destroy()`。运行时保证同一时刻只挂载一个主题模块；主题切换后会先销毁旧模块，再加载新模块。

共享运行时的启动、主题识别、异步竞态、模块协议、安装器协作和调试方法见[增强模块技术原理](./ARCHITECTURE.md)。新增模块的目录与接入要求见[项目开发规范](../DEVELOPMENT.md)。

本目录只保存共享生命周期管理器；主题模块和主题自身代码放在一起。请使用仓库根目录的 `install-macos.sh` 安装、迁移、卸载或恢复。
