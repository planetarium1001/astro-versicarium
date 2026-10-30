# 架构

## 范围

本篇覆盖：目录分层、模块边界、数据流、路由模型、开发与生产运行模式、设置解析、布局与样式组织、Markdown 管线、构建流程。前置：仓库能本地运行，见[安装与运行](../install.md)。

## 目录分层

| 路径 | 职责 |
| --- | --- |
| `content/` | 作者内容，按集合分目录；条目目录可带 `images/`、`files/`、`assets/` |
| `src/content.config.ts` | 五个集合的 schema 与加载器声明 |
| `src/pages/` | 页面、JSON、RSS、robots 与后台接口 |
| `src/layouts/` | `BaseLayout` 负责壳层、head、字体与浏览数据槽位；`ArticleLayout` 负责文章页 |
| `src/components/` | 展示组件；`components/admin/` 只被后台页面引用 |
| `src/lib/` | 内容读取、路由模型、归档、设置解析、Markdown 辅助与后台逻辑 |
| `src/lib/admin-console/` | 后台读写、内容与图片索引、设置校验、写队列与文件事务 |
| `src/lib/fonts/` | 字体注册表与 Astro Fonts API 选择 |
| `src/plugins/` | Markdown 处理、HTML 白名单与关于页指令 |
| `src/integrations/` | 构建期复制内容附件 |
| `src/scripts/` | 浏览器端脚本；`admin-*` 只在开发环境加载 |
| `src/styles/` | 样式入口、组件样式与生成的字体 CSS |
| `src/data/settings/` | 五个设置 JSON |
| `public/` | 静态资源，以及生成的图标与字体 |
| `scripts/` | 检查、字体生成、`new:bit`、`theme:update` |
| `tools/` | 字符集基线、字体清单与生成标记 |
| `tests/` | Vitest 用例与页面快照 |

## 关键入口

| 文件 | 职责 |
| --- | --- |
| `astro.config.mjs` | `output`、部署 base、集成、字体注册与 Markdown 处理器 |
| `site.config.mjs` | `SITE_URL`、`CONTENT_ROOT`、`DEFAULT_SITE_TIMEZONE` 与每页条数 |
| `src/content.config.ts` | 五个集合的 schema 与加载器声明 |
| `src/lib/content.ts` | 公开内容查询：`getPublished()`、列表与弹窗数据 |
| `src/lib/theme-settings.ts` | 设置读取、诊断、`revision` 与缓存 |
| `src/pages/` | 路由层：页面、`index.json`、RSS、robots 与后台接口 |
| `src/plugins/markdown-pipeline.mjs` | Markdown 处理器组装 |
| `src/scripts/` | 浏览器端入口，由布局与页面按需加载 |
| `scripts/` | 检查、字体生成、`new:bit` 与 `theme:update` |

## 模块边界

- 配置层：`astro.config.mjs` 负责 `output`、部署 base、集成、字体与 Markdown 处理器；`site.config.mjs` 提供 `SITE_URL`、`CONTENT_ROOT`、默认时区与每页条数。
- 加载层：`src/content.config.ts` 声明集合，`src/lib/content-loader.ts` 实现 `entryDirLoader`，`src/lib/content-entry-files.ts` 决定条目主文件。
- 路由层：`src/pages/**` 生成静态路径；`src/lib/blog-routing.ts` 与 `src/lib/project-routing.ts` 是不依赖 `astro:content` 的纯函数模型。
- 动态模块分三块：`src/lib/bits-public-routing.ts` 管 `/bits/` 路径与 `#bit-<id>` 锚点，`src/lib/bits-card-view-model.ts` 管卡片视图模型，`src/lib/bits.ts` 管查询与索引。`bits.ts` 会转发前者的 4 个符号，不构成统一出口。
- 后台：页面在 `src/pages/admin/`，接口在 `src/pages/api/admin/`；能力表在 `src/lib/admin-console/content-collections.ts`，条目契约在 `src/lib/admin-console/content-entry-contract.ts`。
- 浏览数据只给槽位与写入 API：槽位组件是 `src/components/ViewStats.astro`，写入函数在 `src/lib/view-stats.ts`，接入点 `src/scripts/view-stats.ts` 当前只有 `export {}`，仓库内没有统计实现。
- 浏览器端入口按页面加载，不按 `src/scripts/` 目录全量罗列。`src/scripts/` 共 69 个文件，被页面实际加载的入口如下。

行号随编辑漂移，下表只记文件路径，入口按路径 grep 定位。

| 加载方 | 入口 |
| --- | --- |
| `src/layouts/BaseLayout.astro` | `input-modality`、`article-dates`、`page-subtitle`、`sidebar-theme`、`sidebar-rail-nav`、`sidebar-floating-actions`、`sidebar-reading`；另加载 `view-stats` 并调用 `dispatchViewStatsReady()` |
| `src/layouts/ArticleLayout.astro` | `article-toc`、`lightbox` 的 `initArticleLightbox` 与 `initCodeCopyButtons` |
| `src/pages/index.astro` | `page-pagination` |
| `src/pages/archive/index.astro` | `entry-search`、`archive-scope` |
| `src/pages/devlog/index.astro` | `devlog-excerpts`、`devlog-drawer`、`devlog-filter`、`page-pagination` |
| `src/pages/projects/index.astro` | `projects-dialog` |
| `src/components/BlogPageView.astro` | `entry-search` |
| `src/components/BitsPageView.astro` | `entry-search`、`bits-search`、`bits-year-filter`、`bits-lightbox`、`bits-dialog` |
| `src/components/ArticleVersionNotice.astro` | `article-version-drawer` |
| `src/pages/admin/theme/index.astro` | `admin-console/index` |
| `src/pages/admin/resources/index.astro` | `admin-resources/index` |
| `src/pages/admin/data/index.astro` | `admin-data/index` |
| `src/pages/admin/content/index.astro` | `admin-content/filter-menus` |
| `src/components/admin/AdminContentEditPage.astro` | `admin-content/editor-recovery` |

后台编辑器与列表操作另用 Svelte 岛（`client:only="svelte"`），由 `src/components/admin/admin-content-editor-islands.ts` 按集合选择 `BlogEditorIsland`、`BitsEditorIsland` 或 `AboutEditorIsland`。

## 数据流

- 内容：`content/` → `entryDirLoader` 读取主 Markdown、拆分 frontmatter、调用 `context.renderMarkdown` 与 `context.parseData` → 写入 `context.store`。
- 主文件顺序为 `index.md` → 目录内唯一 `.md` → 唯一标了 `entry: true` 的文件；没有候选或候选多于一个时报错（`src/lib/content-entry-files.ts:62`）。
- `getPublished()` 在开发环境默认包含草稿，生产构建过滤草稿；生产构建对缺少 `publishedAt` 的博客条目逐条告警（`src/lib/content.ts:61`）。
- 页面：`src/pages/**` 在构建期调用 `src/lib/content.ts` 的查询函数，渲染完整列表与正文。
- 浏览器：页面输出 `index.json`、`data-*` 属性与内联 JSON，脚本据此做筛选、搜索、分页与弹窗，不请求后台。
- `/blog/index.json`、`/bits/index.json`、`/archive/index.json` 为浏览器端提供筛选、搜索与计数数据；分页由 `data-page-size` 与已渲染条目计算。
- 设置：`src/data/settings/*.json` → `src/lib/theme-settings.ts` 解析 → 页面与后台共用同一份快照。
- 浏览数据：`ViewStats.astro` 输出 `[data-view-stats]` 与 `[data-view-stat-value]`，站点在 `src/scripts/view-stats.ts` 取数后调用 `setViewStatValue()`。
- 附件：`src/integrations/content-assets.mjs` 在 `astro:build:done` 复制被引用的附件到 `dist/content-assets/`。

## 路由模型

- 站内链接统一走部署 base：`ASTRO_VERSICARIUM_BASE_PATH` 在 `astro.config.mjs` 归一化为 `/` 或 `/<segment>/`，`trailingSlash` 固定 `always`。
- `createWithBase()`（`src/utils/format.ts`）处理源码链接，`withDeploymentBase()`（`src/plugins/markdown-pipeline.mjs`）处理 Markdown 正文；对已经带 base 的图片 URL 幂等。
- 博客：分组键为 `series:<series>` 或 `single:<id>`，路由类型为 `latest-stable`、`latest-dated`、`latest-alias`、`version`，细节见 [content.md](content.md#博客系列与版本路由)。
- 项目：公开地址是 `/projects/#<anchor>`，最新版用稳定 `slug` 或压平条目 ID，历史版用压平条目 ID。
- 动态：唯一列表页 `/bits/`，锚点为 `#bit-<entry.id>`。
- 归档：`src/lib/archive.ts` 合并博客版本、项目文档版本与 devlog，按年月分组；`versionMode` 来自 `page.archive.versionMode`。
- `SITE_URL` 为空时不注册 sitemap，`robots.txt` 不写 Sitemap 行，canonical 与 `og:url` 省略。

项目锚点解析在 `src/lib/project-routing.ts`：先匹配版本锚点，再回退条目 ID，最后匹配最新版锚点；`buildProjectResolver()` 给 devlog 提供 `projectSlug` → 条目 ID → 唯一显示名的解析顺序。

## 开发与生产运行模式

- `astro.config.mjs` 用 `NODE_ENV` 选择 `output`：`astro dev` 为 `server`，`astro build` 为 `static`。
- Svelte 集成只在非生产构建注册，后台的交互岛只在开发环境出现。
- 后台写入由 `import.meta.env.DEV` 门禁：四个可写页面在构建期照常生成，`isDev` 为假时渲染只读提示，不渲染表单与后台脚本。
- `/admin/content/<集合>/_edit/<条目 ID>/` 的 `getStaticPaths` 在生产构建返回空数组（`src/pages/admin/content/[collection]/[edit]/[...entryId].astro:15`）。
- `/api/admin/**` 在非开发环境返回 404；内容、图片、预览与站点图标上传接口额外放行 `process.env.VITEST`，供测试直接调用。
- 写入请求先过同源校验：JSON 要求 `application/json`，上传要求 `multipart/form-data`，`Origin` 或 `Referer` 必须同源。
- 公开页面在构建期渲染完整内容，无 JavaScript 也能阅读；筛选、搜索、分页与弹窗只操作已渲染的页面。
- 静态构建时带 GET 处理函数的接口被执行一次，产物是 `dist/api/admin/**` 下的 `Not Found` 文本；只有 POST 的接口直接生成 Astro 404 页面。
- `check:prod-artifacts` 断言产物不泄漏 API JSON、不包含后台导航与 DEV 专用资源，且 `/admin/` 带 `noindex,nofollow`。

## 设置解析

- 设置是 `src/data/settings/` 下的五个 JSON：`site.json`、`shell.json`、`home.json`、`page.json`、`ui.json`。
- 文件组与相对路径在 `src/lib/theme-settings.ts` 的 `SETTINGS_FILE_GROUPS` 与 `SETTINGS_RELATIVE_PATHS`（`:560`），`getThemeSettingsFilePath()` 负责定位。
- `getThemeSettings()` 逐字段用 `resolveValue(newValue, legacyValue, defaultValue)` 解析，来源记为 `new`、`legacy` 或 `default`。
- 读取诊断由 `getThemeSettingsReadDiagnostics()` 产生：`invalid-json`、`invalid-root`、`read-failed`、`schema-mismatch`；`schema-mismatch` 表示字段会在读取时被静默修补。
- 开发环境不缓存（`shouldCacheThemeSettings = import.meta.env.PROD`），改 JSON 后刷新即可；生产构建缓存解析结果。
- 可编辑快照带 `revision`，由 `getThemeSettingsRevision()` 对规范化快照做 SHA-1 得到；有诊断时 `getEditableThemeSettingsState()` 返回 `{ ok: false }`，后台禁用保存。
- 字体选择在 Astro 配置期读取：`resolveTypographyFromRawUiSettings()` 与 `getSelectedAstroApiFonts()`（`src/lib/fonts/registry.ts`）注册选中的字体；改 `ui.json` 的字体后要重启开发服务器。
- 保存、`revision` 冲突与 `?dryRun=1` 的行为见 [admin.md](admin.md#检查保存与冲突)。

## 布局与样式组织

- 样式入口是 `src/styles/global.css`，引入公共组件样式与 `src/styles/fonts.generated.css`。
- 页面私有样式在 `src/styles/`：`home.css`、`article.css`、`bits-page.css`、`archive-page.css`、`projects-page.css`、`devlog-page.css`、`about.css`；后台样式在 `src/styles/components/admin/`。
- 桌面壳层是三列栅格 `var(--sidebar) 1px 1fr`，`--sidebar: 224px`；`900px` 及以下切单列，桌面规则从 `901px` 起（`src/styles/global.css:49`、`src/styles/components/layout.css:8`）。
- 页面外缘间隙由 `site.pageGapPx` 控制（32–160，默认 32），`BaseLayout` 把 `--page-gap-inline`、`--page-inline` 与 `--scrollbar-gutter-inline` 写到 `<html>` 内联样式（`src/layouts/BaseLayout.astro` 的 `htmlStyleOverride`）。`--scrollbar-gutter-inline` 是 head 内联探针的唯一取值来源：探针在样式表之前执行，读不到 `:root`，只能读 `<html>` 内联属性，这样槽宽在 TS 里只定义一次。
- 窄屏浮动列右缘距离由 `site.railOffsetPx` 控制（0–32，默认 6），写入 `--rail-action-offset-narrow`。
- 首页 critical CSS 是 `src/pages/index.astro` 的 `homeHeadCriticalCss` 快照（`:49`），由 `BaseLayout` 的 `head` 插槽输出在 `global.css` 之后。
- 产物检查：`check:layout-geometry`（`GUTTER = 15`、`MIN_RAIL_INSET = 4`）、`check:touch-targets`（`MIN_TAP_PX = 44`）、`check:viewport-overflow`。
- 字体 CSS 由 `npm run font:build` 生成；`ui.fontCoverage = 'full'` 时 `BaseLayout` 额外加载 `fonts.dlc.generated.css`。
- 站点图标由 `scripts/favicon.mjs` 在 `predev`、`prebuild` 生成到 `public/images/site/generated/`，源图顺序为 `png` → `source` → `svg`；根 `public/favicon.ico` 在文件缺失、内容与本次生成一致、上次记录确认或配置了非默认源图时写入，标记在 `tools/favicon-generated.json`。配置自定义图标后，`src/integrations/site-favicon.mjs` 还会在构建与开发服务器里接管根路径的默认图标。

| 命令 | 检查对象 |
| --- | --- |
| `npm run check:home-critical-css` | 快照与 `global.css`、`components/layout.css` 的声明是否漂移 |
| `npm run check:layout-geometry` | 产物 CSS 与 `<html>` 内联变量中的间距、热区净空与浮动列偏移 |
| `npm run check:touch-targets` | 交互元素的最终热区不小于 44px |
| `npm run check:viewport-overflow` | 滚动条槽、`overflow: clip` 回退与窄屏悬停提示的溢出约束 |

## Markdown 管线

- 公开页面处理器由 `src/plugins/markdown-pipeline.mjs` 的 `createPublicMarkdownConfig({ base })` 组装（`:382`），在 `astro.config.mjs` 作为 `markdown.processor` 传入。
- Astro 内建的 GFM 与智能标点先执行，项目插件随后处理。
- remark：`remark-math`（`singleDollarTextMath: false`）、`remark-directive`、文本指令还原、关于页指令、提示块。
- rehype：数学边界保护与还原、`rehype-raw`、关于页指令、内容附件链接改写、部署 base 改写、共享白名单清洗、KaTeX 渲染。
- 代码高亮用 Shiki，浅色 `github-light`、深色 `github-dark`，另有代码块工具栏转换器。
- 白名单在 `src/plugins/sanitize-schema.mjs`：以 `rehype-sanitize` 的 `defaultSchema` 为底，追加 `figure`、`figcaption`、`details`、`summary`、`dialog`、`button`、`svg` 等标签与所需属性。
- 提示块由 `src/plugins/remark-callout.mjs` 把 `note`、`tip`、`info`、`warning` 容器指令渲染成 `div.callout.<type>`；未知容器按 `note` 处理。
- `projects` 与 `devlog` 的末尾链接组由 `src/lib/trailing-links.ts` 解析，`renderEntryBody()`（`src/lib/entry-body.ts`）先剥离链接组再渲染正文并追加链接行。
- 关于页指令由 `src/plugins/about-directives.mjs` 处理，只在源文件路径匹配 `content/about/index.md` 时生效。
- 后台预览用独立处理器（`src/lib/admin-console/preview.ts`），插件与白名单与公开页共用，差异在标题 ID 与预览专用图片地址。

## 构建流程

- `npm run dev` 先执行 `predev` 的 `scripts/favicon.mjs`，再启动 `astro dev`；`npm run build` 先执行 `prebuild` 的同名生成器，再执行 `astro build`。
- 配置期读取 `site.config.mjs`、`site.json` 与 `ui.json`，确定 `base`、`output`、字体注册、sitemap 是否注册与 Markdown 处理器。
- 五个集合的加载器读取内容，渲染 Markdown 并生成页面、`/blog|bits|archive/index.json`、RSS、robots 与 sitemap。
- `astro:build:done` 阶段复制被引用的内容附件，并按 `/blog/index.json` 的 `isLatest` 允许列表删除 sitemap 中的历史版本与日期别名 URL。
- `npm run verify` 九步顺序固定：`check` → `build` → `font:coverage --strict` → `test:fixtures` → `test` → `check:prod-artifacts` → `check:layout-geometry` → `check:touch-targets` → `check:viewport-overflow`。
- CI 在 `verify` 之后额外运行 `check:subpath`，以子路径真实构建扫描重复 base 与不可解析 URL。
