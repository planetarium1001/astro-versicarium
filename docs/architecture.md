# 架构

## 内容集合与路由

集合在 `src/content.config.ts` 中定义，博客使用自定义 schema 与 transform 做日期归一化，其余集合使用内联 schema。

| 集合 | 加载器 base | 路由 |
| --- | --- | --- |
| `blog` | `src/content/blog` | `/blog/` 列表、`/blog/<slug>/` 详情（`getStaticPaths` 逐条生成） |
| `projects` | `src/content/projects` | `/projects/` 单页，条目以 `#<entryId>` 锚点定位 |
| `bits` | `src/content/bits` | `/bits/` 单页，条目以 `#<entryId>` 锚点定位 |
| `devlog` | `src/content/devlog` | `/devlog/` 单页，条目以 `#<entryId>` 锚点定位 |
| `about` | `src/content/about` | `/about/`，仅加载 `index.md` |

`/archive/` 是跨集合时间线，聚合博客、项目与更新三类条目，按年月分组，不含动态。`/blog/index.json`、`/bits/index.json`、`/archive/index.json` 三个端点均显式声明 `prerender`，为客户端筛选与计数提供数据。

路由前缀由 `astro.config.mjs` 的 `base`（环境变量 `ASTRO_WHONO_BASE_PATH`）决定，页面内所有站内链接经 `createWithBase()` 拼接。`trailingSlash` 固定为 `always`。

## 渲染分层

服务端负责完整输出：列表页在构建时渲染全部条目，保证无 JavaScript 时的可用性与搜索引擎可见性；条目筛选、分页、搜索只在已渲染的 DOM 上切换可见性，不从 JSON 重新渲染列表。

构建输出的模式由 `output` 决定：开发环境为 `server`，生产构建为 `static`。因此 `/admin/` 与 `/api/admin/*` 只在 `npm run dev` 下具备读写能力，生产产物中的后台是只读静态壳。

客户端脚本位于 `src/scripts/`，均为 TypeScript ES 模块，由布局或页面的 `<script>` 引入并参与打包：

| 脚本组 | 职责 |
| --- | --- |
| `article-toc.ts` | 目录展开与收起、滚动高亮、跳转高亮、状态持久化 |
| `sidebar-*.ts` | 侧栏导航、主题切换涟漪、阅读模式、浮动操作列与阅读位置记忆 |
| `entry-search.ts`、`tag-expression.ts`、`bits-*.ts`、`devlog-*.ts` | 列表页搜索、标签表达式、年份与项目筛选 |
| `view-stats.ts` | 浏览数据取数的唯一接入点，默认空实现 |
| `admin-*/` | 后台各类控制台行为，仅开发环境加载 |

需要 DOM 环境的脚本在 `document` 上读取服务端渲染的 `data-*` 属性与内联 JSON，约定集中在 `src/lib/` 的对应模块中，脚本本身不重复定义契约。

## 后台模块与 API 边界

后台路由定义在 `src/lib/admin-console/routes.ts`，分为概览、主题、写作、图片、快照五个入口，其中概览为只读汇总，其余四个模块的职责见 [admin-console.md](admin-console.md)。

后台逻辑集中在 `src/lib/admin-console/`：内容读写与契约、图片浏览与上传、设置解析与校验、概览数据、只读预览各自独立成模块；后台界面组件在 `src/components/admin/`，前台不引用。后台的 Markdown 编辑器以 Svelte 岛形式挂载（`client:only="svelte"`），只出现在开发环境。

API 位于 `src/pages/api/admin/`，按模块划分：

| 路径 | 用途 |
| --- | --- |
| `content/` | 条目读写、创建、删除、批量状态与批量导出、编辑器预览 |
| `images/` | 列表、元信息、重命名、上传；站点资源上传单独在 `site-assets/` |
| `settings.ts`、`data/settings.ts` | 主题设置的读写与导出 |
| `preview/` | 后台预览渲染 |

所有 API 处理函数以 `import.meta.env.DEV` 作为第一道门，非开发环境返回 404。生产构建由 `scripts/check-production-artifacts.mjs` 断言后台各页面仍是静态只读壳，且不输出仅在开发环境使用的界面标记。

## 样式与设计 token

样式入口为 `src/styles/global.css`，按层组织：

| 层 | 位置 |
| --- | --- |
| 基础层与设计 token | `global.css` 的 `:root` 与元素规则 |
| 跨页面组件 | `src/styles/components/*.css` |
| 页面私有 | `home.css`、`about.css`、`article.css`、`bits-page.css`、`projects-page.css`、`devlog-page.css`、`archive-page.css` |
| 后台 | `src/styles/components/admin/`，按模块再分子目录 |

设计 token 分为四类：

- 颜色与表面：`--bg`、`--text`、`--muted`、`--border`、`--accent`、`--code-*`。
- 字体角色：`--font-readable`、`--font-copy`、`--font-mono`、`--font-brand`，由 `ui.json` 的 `typography` 选择。
- 间距与壳层几何：`--sidebar`、`--page-gap-inline`、`--page-inline`、`--scrollbar-gutter-inline`、`--public-content-padding-inline`。
- 交互尺寸：`--tap-min-h`、`--float-button-size`、`--rail-action-*`。

深色主题通过 `:root[data-theme="dark"]` 覆盖同一组变量。

`--page-gap-inline` 是后台「页面外缘间隙」（`site.pageGapPx`），即内容盒到浏览器边缘的视觉距离，默认与下限 32px。
`--page-inline = --page-gap-inline - --scrollbar-gutter-inline` 在构建期算好，两者与窄屏标题宽度上限一起以 `<html>` 内联属性输出；内联属性优先级高于 `:root` 与首屏快照，因此首页 critical CSS 里的数值只是默认值。
壳层的起始内边距取 `--page-gap-inline`，结束内边距取 `--page-inline`：`scrollbar-gutter: stable` 把滚动条槽排除在 ICB 之外，结束侧扣掉槽宽后两侧的视觉间隙才相等。两个 token 在 `global.css` 的 `:root` 里也有默认值。
窄屏（≤ 900px）由 `global.css` 在 `body` 上把两者都覆写为 0。
目录列的右边界落在壳层内容盒右缘（列宽 = `calc(var(--article-toc-inline-size) - var(--page-inline))`），把手位置由 `.article-toc__rail-head` 的 `margin-right: calc(var(--page-inline) * -1)` 与 `padding-right: var(--rail-action-offset)` 单独补偿，因此不随间隙设置位移。

壳层几何存在若干不变量，由 `npm run check:layout-geometry` 解析构建产物断言，其中 `--page-inline` 与 `--page-gap-inline` 的生效值取自 `dist` 页面 `<html>` 的内联属性。
断言项包括竖线两侧留白一致、内容盒两侧视觉间隙相等（起始内边距 == 结束内边距 + 槽宽）、悬浮列不越过滚动条槽位与正文、目录把手与悬浮列右缘对齐，以及 `--page-inline == --page-gap-inline - --scrollbar-gutter-inline`。
改动这些 token 时还必须同步 `src/pages/index.astro` 中 `homeHeadCriticalCss` 的首屏快照，`npm run check:home-critical-css` 负责比对。

## 设置解析与数据流

主题设置以纯 JSON 存放，读取集中在 `src/lib/theme-settings.ts`：按组读取 `src/data/settings/` 下的五个文件，逐字段做类型与范围校验，缺省或非法值回落到内置默认值，同时记录该字段来源是文件、兼容旧值还是默认值。来源信息随可编辑快照一起下发给后台，用于表单回显与变更预览。生产构建会缓存解析结果，开发环境每次读取。

内容读取集中在 `src/lib/content.ts`：按草稿与可见性过滤条目，派生公开 slug，计算排序与上下篇关系，并按需生成摘要文本。构建期会断言博客公开 slug 唯一且不与 `/blog/` 下的静态路由冲突，冲突时直接失败，不产出路由重叠的页面。

列表页把渲染所需的筛选数据以 `data-*` 属性与内联 JSON 写到服务端输出的 HTML 上，客户端脚本在此基础上工作，因此搜索、筛选与分页的取数口径只有服务端一处定义。

`projects` 与 `devlog` 的正文末尾链接组由 `src/lib/trailing-links.ts` 解析：`parseTrailingLinks` 按书写顺序取链接，`stripTrailingLinks` 供摘要派生与正文渲染剥离链接组，`renderTrailingLinksHtml` 输出统一的 `.trailing-links` 链接行（样式在 `src/styles/components/trailing-links.css`）。
页面用 `src/lib/entry-body.ts` 在与站点一致的 markdown 处理器上渲染剥离后的正文并追加链接行。
后台预览 `src/lib/admin-console/preview.ts` 对这两个集合走同一套处理，因此项目卡片/弹窗、更新展开面板与预览的标记一致，链接不会重复出现。
博客不使用这套机制。

## 构建期流水线

Markdown 管线在 `src/plugins/markdown-pipeline.mjs` 中组装，由 `astro.config.mjs` 的 `markdown` 配置接入，公开页与后台预览共用同一份特性契约：

- remark 阶段处理 GFM、数学公式、指令语法（Callout、关于页的友链与 FAQ 块）与排版符号转换。
- rehype 阶段处理原始 HTML 放行、白名单清洗（`sanitize-schema.mjs`）、KaTeX 渲染与代码块工具栏。
- 代码高亮使用 Shiki，浅色与深色主题分别为 `github-light` 与 `github-dark`；数学边界由独立插件保护，避免公式内容被后续转换破坏。

字体有两条路径。未选中 Astro Fonts API 的字体由 `public/fonts/` 提供自托管子集，`global.css` 用 `@font-face` 按 `unicode-range` 分段声明。`npm run font:charset` 从内容与模板汇总常用字符集并写入 `tools/charset-common.txt`，`npm run font:subset` 依据该文件与 `tools/fonts-src/` 的源字体生成子集文件；字符集哈希未变化时跳过重建。选中注册表中的 Astro Fonts API 条目时，`astro.config.mjs` 在配置期读取 `ui.json`，只把被选中的条目注册进 `fonts[]`，由 Astro 在构建期下载自托管，并以 `import.meta.env.ASTRO_WHONO_FONT_CSS_VARIABLES` 快照过滤 `<Font>` 渲染。

图片以文件路径字符串引用，不经过 Astro 的图片优化管线；`src/assets/` 仅存放交给 `astro:assets` 处理的首页 Hero 图。内容配图存放在 `public/images/{collection}/{slug}/`，上传、重命名与引用校验由后台图片模块与 `npm run check:image-references` 共同保证。

构建完成后由产物类守卫复核结果：`check:prod-artifacts` 检查文件清单、后台只读壳、RSS、sitemap 与 robots；`check:layout-geometry` 与 `check:touch-targets` 解析产出的 CSS，判定最终生效的几何与触控尺寸。这些判定必须在构建产物上进行，源文件无法反映同特异性规则的实际覆盖顺序。命令与脚本清单见 [development.md](development.md)。
