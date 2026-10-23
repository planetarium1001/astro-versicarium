# PV / UV 接入

## 范围

本篇覆盖：浏览数据槽位的属性契约、写入 API、就绪事件、设置字段、数字格式与取数提示词。前置：读过 [facts.md](facts.md)，能运行 `npm run dev`。

## 槽位契约

- 槽位组件是 `src/components/ViewStats.astro`，由布局传入范围、路径、路由与标题。
- 外层元素带 `[data-view-stats]`，属性如下。

| 属性 | 含义 | 取值 |
|---|---|---|
| `data-view-scope` | 位置范围 | 文章页 `article`；列表页取路径首段，首页 `home` |
| `data-view-path` | 当前路径 | `Astro.url.pathname` 或布局的 `pathname` |
| `data-view-route` | 路由标识 | 文章页为规范路径，列表页为 `routePath` |
| `data-view-title` | 标题 | 条目标题或页面标题，无值时不输出 |

- 每个数字是一个 `[data-view-stat]` 项，值为 `pv` 或 `uv`，初始带 `hidden`。
- 数字文本写在项内的 `[data-view-stat-value]`。
- 全部项都隐藏时，整组由 `src/styles/components/view-stats.css` 的 `:has` 规则隐藏，不占位。
- 文章页槽位在元信息行，由 `onArticleMeta` 控制；其余页面槽位在页脚，由 `onIndexPages` 控制。
- 后台页不渲染槽位，也不加载接入脚本。

## 写入 API

`src/lib/view-stats.ts` 导出以下符号。

- `resolveViewStats(stat?: 'pv' | 'uv', root: ParentNode = document): HTMLElement[]`
  - 取当前页全部槽位；传 `stat` 时只取对应种类。
- `setViewStatValue(item: Element, value: number | string): void`
  - `item` 可传槽位项，也可传它内部的值元素。
  - 传槽位项时同时摘掉该项的 `hidden`。
- `formatViewStatValue(value: number | string): string`
  - 数字与纯数字文本按千分位输出；其他文本原样返回。
  - 空值、空白与 `NaN` 返回空串。
- `dispatchViewStatsReady(): void`
  - 在 `document` 上派发就绪事件。
- `VIEW_STATS_READY_EVENT`、`VIEW_STATS_ITEM_SELECTOR`、`VIEW_STATS_VALUE_SELECTOR`
  - 事件名与两个选择器常量，值分别为 `astro-whono:view-stats-ready`、`[data-view-stat]`、`[data-view-stat-value]`。

- 写入后槽位立即显示，空值会显示为空数字，因此取数失败时不要调用写入。
- 格式化行为由 `tests/view-stats.test.ts` 覆盖，改动前先读该用例。

## 就绪事件

- 事件名是 `astro-whono:view-stats-ready`，挂在 `document` 上。
- 派发点在 `src/layouts/BaseLayout.astro`：先加载 `src/scripts/view-stats.ts`，再调用 `dispatchViewStatsReady()`。
- 加载条件是 `showPv` 或 `showUv` 为真且当前页不是后台页。
- 在模块顶层注册监听即可收到事件；事件只派发一次。
- 开关打开但当前页没有槽位时，`resolveViewStats()` 返回空数组，按空结果处理。

## 接入点

- `src/scripts/view-stats.ts` 当前是空模块，只有 `export {}` 与注释。
- 仓库内没有统计服务实现，也没有取数请求。
- 取数逻辑写在这个文件里，通过 `src/lib/view-stats.ts` 的 API 写入槽位。
- 不改槽位组件与样式；隐藏、间距与分隔符由主题控制。
- 设置字段在 `src/data/settings/ui.json` 的 `viewStats` 中。

## 设置字段

| 字段 | 作用 | 默认 |
|---|---|---|
| `showPv`、`showUv` | 是否渲染浏览量、访客数槽位 | `false`，随仓库的 `ui.json` 已开启 |
| `pvLabel`、`uvLabel` | 数字前缀，最多 8 个字符 | 浏览、访客 |
| `onArticleMeta` | 文章页元信息行显示 | `true` |
| `onIndexPages` | 列表页页脚显示 | `true` |

- 默认值在 `src/lib/theme-settings.ts` 的 `DEFAULT_UI.viewStats`。
- 字段说明与后台操作见[主题设置](../settings.md)。

## 数字格式

- 纯数字按千分位显示：`1234` 输出 `1,234`。
- 带分隔符的数字文本先归一化再格式化：`" 1,234 "` 输出 `1,234`。
- 非数字文本原样输出：`1.2万`、`—` 保持原样。
- 数字来源可以是统计服务返回的数字，也可以是已格式化的文本。
- 不要手写千分位；统一交给 `setViewStatValue` 或 `formatViewStatValue`。

## 取数提示词

- 下面的提示词可以直接交给本地 Agent。
- 提示词只要求改接入点，不动主题其他文件。

<details>
<summary>交给本地 Agent 的取数提示词</summary>

```text
改 src/scripts/view-stats.ts，接入浏览数据取数。只改这一个文件，不改主题其他文件。

导入 src/lib/view-stats.ts 的导出：
- resolveViewStats(stat?: 'pv' | 'uv', root?: ParentNode): HTMLElement[]  取槽位
- setViewStatValue(item: Element, value: number | string): void  写入并显示
- formatViewStatValue(value: number | string): string  千分位格式化
- VIEW_STATS_READY_EVENT  值为 'astro-whono:view-stats-ready'

页面结构：
- 外层 [data-view-stats]，带 data-view-scope、data-view-path、data-view-route、data-view-title
- 每个数字是 [data-view-stat="pv"] 或 [data-view-stat="uv"]，初始带 hidden
- 数字写在该项内的 [data-view-stat-value]

做法：
- 在模块顶层注册 document 上的 astro-whono:view-stats-ready 监听。
- 事件由 src/layouts/BaseLayout.astro 在本模块加载后派发，注册即生效。
- 用 resolveViewStats('pv') 与 resolveViewStats('uv') 取槽位，按 data-view-path 汇总为一次请求。
- 统计服务地址从站点设置或环境变量读取，不写死。
- 返回数字用 setViewStatValue 写入；返回文本原样传入。
- 请求失败、超时或返回空值时不要写入，槽位保持 hidden。
- 不新增样式，不修改 ViewStats.astro 与 src/lib/view-stats.ts。

验证：
- npm run check
- npm run build
- npm run dev 后打开文章页与列表页，确认有数字时显示、无数字时不占位
```

</details>
