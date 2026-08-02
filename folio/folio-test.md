---
title: Folio 主题测试
author: Typora Theme QA
tags: [typora, folio, 排版, 测试]
---

# Folio · 文档与刊物之间

Folio 使用**衬线标题、无衬线正文、低对比边界**构造安静的长文阅读空间。这份文档用于检查混合编辑、源码模式、专注模式以及打印与 PDF 导出。

## 字体与行文

这段文字包含**粗体**、*强调*、***粗斜体***、~~删除线~~、==高亮文字==、`inline code`、H~2~O、x^2^、一个[链接](https://typora.io)和一个脚注。[^1]

在这行文字内外点击，普通文字应保持稳定；Markdown 定界符与链接目标出现时，应使用语义化的辅助色而不污染正文。

### 第三级标题 Heading level three

#### 第四级标题 Heading level four

##### 第五级标题 Heading level five

###### 第六级标题 Heading level six

> 好的文档主题不该争夺注意力，而应让结构、节奏和内容自然浮现。引用在多行文本中仍需保持清晰。
>
> > 嵌套引用需要形成可辨认但不过度装饰的层级。

> [!NOTE]
> Claude Platform on AWS 使用与 Claude API 相同的模型 ID，例如 `claude-opus-5`。

> [!TIP]
> 可以通过 Models API 查询模型能力、`max_tokens` 和上下文窗口。

> [!IMPORTANT]
> 升级模型前，应先在测试环境验证提示词与工具调用行为。

> [!WARNING]
> 修改生产配置前请保留可恢复的版本和操作记录。

> [!CAUTION]
> 不要将访问密钥或其他敏感信息写入公开文档。

---

## 列表与任务

- 无序列表项目
  - 第二层项目
    - 第三层项目
- 这是一条较长的列表文字，用于检查窄窗口中的换行、悬挂缩进以及中英文混排节奏。

1. 确认正文阅读节奏
2. 检查编辑状态
   1. 检查嵌套有序列表

- [x] 已完成任务
- [ ] 未完成任务

## 表格

| 元素 | 状态 | 检查内容 |
| --- | ---: | --- |
| 标题 | 6 级 | 间距与信息层级 |
| 代码 | 行内 + 围栏 | 语法颜色、光标和选择 |
| 导出 | PDF / 打印 | 分页、背景与链接可见性 |

## 代码

点击围栏代码中的不同语法标记。插入光标必须持续可见，当前行应克制但可辨，选中文字也应保持足够对比。代码块进入编辑状态时，语言输入框应使用与代码标签组激活 Tab 相同的背景色和文字色。安装增强器后，普通单代码块的语言栏右侧应显示复制按钮；仅安装主题 CSS 时不应显示该按钮。

```javascript
function greet(name) {
  const message = `你好，${name}！`;
  console.log(message); // 检查注释对比度。
  return { ok: true, message };
}
```

```css
:root {
  --accent: #356f92;
}
```

### 多语言代码标签页

将多个围栏代码块放入同一个 Markdown 引用中。安装实验性的 `Folio Enhancer` 后，它们应显示为可切换的代码标签页；未聚焦时，代码下方不应为语言栏保留空白。点击代码正文后，Typora 原生语言输入框应以紧凑控件显示在活动代码块左下角，不能覆盖代码，也不应生成全宽底栏；离开代码块后控件与占位一并收起。编辑语言后按 Enter、Escape 或点击别处，顶部 Tab 名称应随之刷新。仅安装主题 CSS 时，应保持为普通的纵向代码块，不出现横向画廊。上方的单个代码块与本组代码块应采用相同的卡片、语言栏和聚焦样式，两种状态下代码都应能独立聚焦和编辑。

> ```python
> model = "claude-opus-5"
> effort = "max"
> print(model, effort)
> ```
>
> ```javascript
> const model = "claude-opus-5";
> const effort = "max";
> console.log(model, effort);
> ```
>
> ```c#
> var model = "claude-opus-5";
> var effort = "max";
> Console.WriteLine($"{model} {effort}");
> ```

下一段文字

## 数学与图表

分别检查 Mermaid 未聚焦和聚焦状态。渲染图与源码编辑器切换时，不应裁切预览、泄漏隐藏代码、产生异常留白或推动后续内容跳动。

Inline math: $e^{i\pi} + 1 = 0$.

$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
$$

```mermaid
flowchart LR
  草稿 --> 检查 --> 调整 --> 导出
```

## 图片与长内容

![远程占位图片](https://placehold.co/960x360/png?text=Folio+Theme+Test)

长内容溢出测试：`https://example.com/a/very/long/path/that/should/not/destroy/the/writing-area-layout-or-overflow-controls`。

[^1]: 脚注定义及其编辑状态同样需要清晰样式。
