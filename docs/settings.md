# 主题设置

## 范围

本篇覆盖：七组设置的用途、五个设置文件的对应关系、站点图标、浏览数据的显示与接入。前置：站点能在本地运行，见[安装与运行](install.md)。

## 七组设置

设置分七组，后台主题页按组展示。保存后写入 `src/data/settings/` 下的五个文件；也可以直接改文件，刷新页面生效。

| 分组 | 内容 |
|---|---|
| 站点设置 | 站点标题、语言、时区、默认描述、页脚、备案、社交链接、站点图标与布局尺寸 |
| 侧栏设置 | 侧栏站点名、窄屏标题、引用文案、分隔线、图标、导航项与顺序 |
| 首页设置 | 首页头图、导语主文案与补充文案、「更多」入口 |
| 内页设置 | 列表页主副标题、归档版本、文章元信息、分页、订阅源、动态默认作者、浮动操作列、浏览数据 |
| 条目版本 | 版本名称显示在标题后、版本号后，或不显示 |
| 代码显示 | 代码块是否显示行号 |
| 排版字体 | 正文、文案、等宽、品牌四个字体用途，以及字库覆盖范围 |

## 五个设置文件

| 文件 | 内容 |
|---|---|
| `src/data/settings/site.json` | 站点设置 |
| `src/data/settings/shell.json` | 侧栏设置 |
| `src/data/settings/home.json` | 首页设置 |
| `src/data/settings/page.json` | 内页设置里的列表页标题、归档版本、分页、订阅源、动态默认作者 |
| `src/data/settings/ui.json` | 条目版本、代码显示、排版字体、文章元信息、浮动操作列、浏览数据 |

- 后台保存或直接改文件，刷新页面即生效；换字体是例外，要重启 `npm run dev`。
- 后台只在开发环境可写，线上站点只读，见[后台使用](admin.md)。

## 站点设置

- 站点标题、站点语言、站点时区、默认描述。
- 页脚年份、版权文案与预览。
- 备案信息：ICP 备案、公安备案、图标与显示范围。
- 社交链接：预置项与自定义项，按顺序显示。
- 窄屏标题宽度、页面外缘间隙、窄屏浮动列右侧距离。
- 概览页是否公开，以及关闭时的提示文字；站点图标见本篇「站点图标」一节。

## 侧栏设置

- 侧栏站点名、窄屏标题、引用文案与分隔线样式。
- 侧栏图标与导航项：可改名、调顺序、设分隔符号、控制是否显示。

## 首页设置

- 首页头图：预设图案，或自己的图片地址与说明。
- 首页导语主文案与补充文案，各自可开关；「更多」入口的文字与链接目标。

## 内页设置

- 列表页：各页主标题与副标题；归档可切换显示全部版本或每个系列最新版。
- 文章元信息：日期、日期前缀、标签、字数、阅读时长。
- 列表分页：各列表页的开关与每页条数。
- 订阅源：文章、动态、归档三处是否输出。
- 动态默认作者：作者名与头像。
- 浮动操作列：阅读模式入口、回到上次阅读位置、回到顶部。
- 浏览数据：见本篇「浏览数据」一节。

## 条目版本

- 三个选项：不显示、标题后、版本号后；影响列表、归档与项目卡片，没有版本信息的条目不受影响。

## 代码显示

- 代码块是否显示行号，默认显示。

## 排版字体

- 四个用途：正文用于文章正文与标题，文案用于导语与关于页，等宽用于代码，品牌用于侧栏站点名与引言。
- 覆盖策略决定自托管中文字体包含哪些字：完整覆盖，或只含常用字。
- 后台会显示每个用途当前的字体体积，便于权衡加载量。
- 改字体后要重启 `npm run dev`，只刷新页面不生效。

<details>
<summary>ui.json 的字体与覆盖设置</summary>

```json
{
  "typography": {
    "readable": "<BODY-FONT-ID>",
    "copy": "<COPY-FONT-ID>",
    "mono": "<MONO-FONT-ID>",
    "brand": "<BRAND-FONT-ID>"
  },
  "fontCoverage": "<FULL-OR-COMMON>"
}
```

- 四个用途各填一个字体标识，可选项见后台的字体卡片。
- `<FULL-OR-COMMON>` 换成 `full` 或 `common`。

</details>

## 字体文件与重建

站点自带中文字体，随构建一起发布，页面不向外部字体服务请求。

字体按用途和常用程度切成小片，浏览器只下载页面用到的部分：

| 分片 | 内容 | 何时下载 |
|---|---|---|
| 基础分片 | 常用字、标题字、符号与拉丁字母 | 打开页面就下载命中的分片 |
| 生僻字分片 | 基础分片之外的字 | 页面出现生僻字时才下载对应分片 |

- 基础分片合计约 2.3 MB，全部生僻字分片合计约 21 MB，都在 `public/fonts/`。
- 一个页面通常只下载其中几片，不会拉全量；具体数字可以在后台主题页的字体区看到。
- 覆盖策略选「只覆盖常用字」时，生僻字交给系统字体，不下载生僻字分片。

### 按自己的内容重建

分片是按**你站点自己的内容**算出来的，不是固定集合。构建时会扫描 `content/`、页面模板与设置，统计实际用到的字，再按角色切成基础分片与生僻字分片。

- 新写了大量内容、换过字体或调整覆盖策略后，建议重建一次，让分片贴合当前内容。
- 重建命令：

  ```bash
  npm run font:build
  ```

- 重建会改写 `public/fonts/`、两个生成 CSS 与 `tools/font-manifest.json`，需要一起提交。

### 重建的代价

- 需要本机装 Python 3 与 `fonttools`、`brotli`，日常开发与构建不需要这些。
- 首次运行会下载源字体到 `tools/fonts-src/`，约 200 MB，不进仓库；之后命中缓存不再联网。
- 生成分片这一步要跑几分钟（当前内容约 7 分钟），期间 CPU 占用较高。
- 生成物约 23 MB 会进入仓库；内容变化多时，分片哈希会变，访客需要重新下载字体。

只想调整字体用途或覆盖策略、不改内容时，用后台改设置即可，不必重建。

## 站点图标

- 后台上传 PNG：正方形，宽高偏差不超过 2%，边长 16–512 像素，不超过 256KB。
- 只传标签页图标即可，触摸图标留空时沿用同一张。
- 想用 SVG：把文件放进 `public/`，再在站点设置的图标路径里填写文件名。
- 图标路径不是模板默认值（`/favicon.svg`、`/favicon-32x32.png`）且文件存在时，根路径的 `/favicon-32x32.png`、`/apple-touch-icon.png` 会换成自定义图标；未配置自定义 SVG 时 `/favicon.svg` 返回 404。用自定义 PNG 作源图时，`/favicon.ico` 也会换成该图标。
- 路径保持模板默认值时不触发接管。
- 上传、替换源图或修改图标路径后重启 `npm run dev` 或重新构建；生成器只在 `predev` 与 `prebuild` 运行。

图标按源图生成这些尺寸：

| 尺寸 | 用途 |
|---|---|
| 16 与 32 像素 | 浏览器标签页 |
| 180 像素 | 手机主屏 |
| 192 与 512 像素 | 安装到桌面后的图标 |
| 旧格式图标 | 老浏览器与直接访问图标地址 |

<details>
<summary>site.json 的图标路径</summary>

```json
{
  "favicon": {
    "svg": "/<ICON-NAME>.svg",
    "png": "/images/site/<UPLOADED-PNG>",
    "appleTouchIcon": "/images/site/<TOUCH-PNG>"
  }
}
```

- `<ICON-NAME>` 换成放进 `public/` 的 SVG 文件名，不要带 `public/`。
- 上传后后台会自动写入后两项，一般不用手改；清空即回到自带图标。

</details>

## 浏览数据

「内页设置」的浏览数据控制浏览量（PV）与访客数（UV）的显示。字段在 `src/data/settings/ui.json` 的 `viewStats` 中：

| 字段 | 作用 |
|---|---|
| `showPv`、`showUv` | 是否显示浏览量、访客数，默认关闭 |
| `pvLabel`、`uvLabel` | 数字前缀，默认「浏览」「访客」，最多 8 个字符 |
| `onArticleMeta` | 显示在文章页的元信息行 |
| `onIndexPages` | 显示在列表页底部 |

- 主题只渲染槽位与样式，仓库里没有任何统计实现。
- 没有填值的槽位保持隐藏，不占位；数字可以是纯数字或 `1.2万` 这类文本，纯数字按千分位显示，文本原样显示。
- 接入点 `src/scripts/view-stats.ts` 当前是空模块，页面加载时会引入它；取数逻辑写在这里，数字用 `src/lib/view-stats.ts` 的写入方法填进槽位。
- 槽位带当前页面的范围、路径与标题，可以按页面取数。
- 槽位渲染完成后，页面在 `document` 上派发就绪事件 `astro-whono:view-stats-ready`。

<details>
<summary>交给本地 Agent 的取数提示词</summary>

```text
改 src/scripts/view-stats.ts，实现浏览数据取数。不改动主题其他文件。

可用 API 来自 src/lib/view-stats.ts，导入后直接调用：
- resolveViewStats(stat?: 'pv' | 'uv', root?: ParentNode): HTMLElement[]  取当前页槽位
- setViewStatValue(item: Element, value: number | string): void  写入数字并显示
- formatViewStatValue(value: number | string): string  千分位格式化
- VIEW_STATS_READY_EVENT：值为 'astro-whono:view-stats-ready'
- dispatchViewStatsReady(): void

槽位属性：
- 外层 [data-view-stats]，带 data-view-scope、data-view-path、data-view-route、data-view-title
- 值元素 [data-view-stat-value]；每个数字外面还有 [data-view-stat="pv"] 或 [data-view-stat="uv"]

做法：
- 在模块顶层监听 document 上的 astro-whono:view-stats-ready；脚本加载后该事件立即派发。
- 用 resolveViewStats('pv') 与 resolveViewStats('uv') 取槽位，按 data-view-path 汇总成一次请求。
- 统计服务返回数字或 '1.2万' 这类文本；用 setViewStatValue 写入，不要手写数字文本。
- 统计服务地址从站点配置读取，不要固定在脚本里；请求失败时保持槽位隐藏。
- 不给槽位加样式，隐藏与间距由主题控制。

数字格式规则：
- 纯数字交给 formatViewStatValue，按千分位显示。
- 已是 '1.2万' 这类文本时原样显示。

验证：
- npm run check
- npm run build
- npm run dev 后打开文章页与列表页，确认数字出现、没有数字时槽位不占位
```

</details>

## 生效方式

- 后台保存或直接改设置文件，刷新页面即可生效。
- 换字体、换图标源图后要重启 `npm run dev`，或重新构建。
- 提交仓库后线上才会更新，线上要重新构建。
