# 内容模型

## 范围

本篇覆盖：五个集合与条目加载、日期解析与显示、各集合字段、博客系列与项目版本路由、图片附件与共享资源、Markdown 插件与白名单、末尾链接组、关于页指令、检查与测试。前置：能运行 `npm run dev`，内容放在 `content/`。

## 集合与条目加载

| 集合 | 内容根 | 公开位置 | `date` |
| --- | --- | --- | --- |
| `blog` | `content/blog/<条目>/` | `/blog/<公开路径>/` | 必填 |
| `projects` | `content/projects/<条目>/` | `/projects/#<锚点>` | 必填 |
| `bits` | `content/bits/<条目>/` | `/bits/#bit-<条目 ID>` | 必填 |
| `devlog` | `content/devlog/<项目>/<条目>/` | `/devlog/#<压平条目 ID>` | 必填 |
| `about` | `content/about/index.md` | `/about/` | 无 |

- 集合在 `src/content.config.ts` 用 `entryDirLoader({ collection, fixedPage })` 声明，加载器实现在 `src/lib/content-loader.ts`。
- `sync()` 找到每个条目的主文件，读取源码、拆分 frontmatter、调用 `context.renderMarkdown` 与 `context.parseData`，写入 `context.store`，并删除本轮未出现的旧条目。
- 开发环境监听集合根目录，`WATCH_DEBOUNCE_MS = 120` 防抖后重新同步（`src/lib/content-loader.ts:17`）；条目 ID 是目录相对集合根目录的路径，可以多层。
- `about` 使用固定页面加载器，只读 `content/about/index.md`，entryId 固定为 `index`（`src/content.config.ts:353`）。

主文件按以下顺序确定（`src/lib/content-entry-files.ts:62`）：

1. 名为 `index.md` 的文件，不区分大小写；
2. 目录内唯一的 `.md`；
3. 唯一一个 `entry: true` 的 `.md`。

- 没有候选或候选多于一个时构建报错；集合根目录直接放 Markdown 也会报错。
- 遍历条目目录时跳过 `images/`、`files/`、`assets/`（`src/lib/content-entry-files.ts:18`），这些目录里的 Markdown 不会被当成条目。
- 文件命名只是约定，schema 不校验。后台新建 `blog`、`projects`、`devlog` 用 `YYYY-MM-DD-title`，`bits` 用 `bits-YYYY-MM-DD-HHmm`（`src/lib/admin-console/content-create.ts:195`）。
- `buildContentEntryId()`（`src/utils/slug-rules.ts`）把标题转成 slug 部分：NFKC 归一、小写、空白与符号转连字符、折叠重复连字符、超过 120 字符截断并追加短哈希；空标题回退 `untitled`。

## 日期解析与显示

`date` 接受以下写法（`src/utils/date-only.ts:3`）：

| 写法 | 说明 |
| --- | --- |
| `YYYY-MM-DD`、`YYYY/MM/DD` | 纯日期，按站点时区当日零点解释 |
| `YYYY-MM-DD HH:mm[:ss]`、`YYYY/MM/DD HH:mm[:ss]` | 无偏移日期时间，按站点时区解释 |
| ISO 8601 带 `Z` 或 `+08:00` 偏移 | 按绝对时间解析 |

- `date`、`publishedAt`、`updatedAt` 在 schema 里先以 `z.unknown()` 接收，再由 `normalizeDateFields` 解析成 `date`、`dateText`、`dateHasTime`（`src/content.config.ts:82`）。
- YAML 可能把纯日期解析成 `Date`，`parseContentDateInput` 会处理：UTC 零点视为纯日期，其余保留时分（`src/utils/date-only.ts:166`）。
- 站点时区优先级：`SITE_TIMEZONE` > `src/data/settings/site.json` 的 `timezone` > `site.config.mjs` 的 `DEFAULT_SITE_TIMEZONE`（默认 `Asia/Shanghai`）；非法的 `SITE_TIMEZONE` 直接抛错（`src/utils/site-timezone.ts:61`）。
- 浏览器端使用配置期注入的快照，改 `site.json` 的时区后要重启开发服务器；`publishedAt` 缺失时回退 `date`，`updatedAt` 不得早于 `date`。

显示由 `src/lib/display-date.ts` 的 `resolveArticleDateItems` 计算：

- `articleDateDisplay` 可选 `published`、`updated`、`both`；缺省取 `ui.articleMeta.dateDisplay`（当前 `both`），`both` 在缺 `updatedAt` 时只显示发布项。
- `dateGranularity` 可选 `date`、`datetime`；只有值为 `datetime` 且来源本身写了时分才显示 `YYYY-MM-DD HH:mm`。
- 历史博客版本强制只显示「版本日期：」，不受该设置影响；服务端只输出站点时区的墙上时间，访客时区不同时 `src/scripts/article-dates.ts` 追加站点时区短名（`Asia/Shanghai` 固定显示 `CST`）。

## blog

| 字段 | 必填 | 默认或约束 |
| --- | --- | --- |
| `title` | ✓ | 去首尾空白后的字符串 |
| `date` | ✓ | 日期或日期时间 |
| `description` | ✗ | 摘要；文章页 description 与 RSS item 使用 |
| `publishedAt` | ✗ | 发布显示与 RSS `pubDate`；缺失回退 `date` |
| `updatedAt` | ✗ | 更新日期；不得早于 `date` |
| `tags` | ✗ | 字符串数组，默认 `[]` |
| `draft` | ✗ | 布尔，默认 `false` |
| `entry` | ✗ | 布尔，仅用于标记主文件 |
| `slug` | ✗ | 公开路径；必须小写、单词之间用连字符，允许中文；`page` 与 `rss.xml` 保留 |
| `ogImage` | ✗ | `none`（转成 `null`）、条目内相对图片或 `https://` 地址 |
| `ogImageAlt` | ✗ | 分享图替代文本 |
| `badge` | ✗ | 标题前的纯文本角标 |
| `series` | ✗ | 系列键；规则同 `slug`，同一系列填同一个值 |

- 日期显示字段：`articleDateDisplay`、`cardDateDisplay` 取 `published`、`updated`、`both`，`dateGranularity` 取 `date` 或 `datetime`。
- 版本字段：`versionLabel` 是版本号字符串，`versionName` 缺省用标题，`versionSummary` 缺省用 `description`，`versionOrder` 是非负整数，缺省按 `0` 参与排序。

- 图片字段由 schema 的 `image()` 处理：本地图片会优化并带 `width`、`height`、`format`，外链只接受 `https://`（`src/content.config.ts:208`）。
- `slug` 不填时，默认公开路径取条目 ID 压平后的值，因此带日期前缀。
- `series` 与版本字段只有同一 `series` 下才参与路由分组，单篇文章填了也不会产生版本页面。

## bits

| 字段 | 必填 | 默认或约束 |
| --- | --- | --- |
| `date` | ✓ | 日期或日期时间 |
| `title` | ✗ | 可以没有标题 |
| `description` | ✗ | 摘要 |
| `tags` | ✗ | 字符串数组，默认 `[]` |
| `draft` | ✗ | 布尔，默认 `false` |
| `entry` | ✗ | 主文件标记 |
| `slug` | ✗ | 检索数据里的标识；页面锚点仍用条目 ID |
| `images` | ✗ | 数组，每项 `src` 必填，`alt` 可选 |
| `author` | ✗ | `{ name, avatar }`，两项都可选 |

- `author.avatar` 只接受相对 `public/` 的本地图片路径，不能带前置 `/`、不能写 `public/`、不能用 URL 或 `..`、`?`、`#`。
- 扩展名限 avif、gif、jpg、jpeg、png、svg、webp；不填时用后台设置的动态默认作者（`src/utils/format.ts:136`）。

## projects

| 字段 | 必填 | 默认或约束 |
| --- | --- | --- |
| `title` | ✓ | 项目标题 |
| `date` | ✓ | 当前版本文档的日期 |
| `subtitle` | ✗ | 副标题；`description` 是摘要；`type` 是自由文本，显示为标题前的胶囊 |
| `icon` | ✗ | 卡片图标：条目内相对图片或 `https://` |
| `image` | ✗ | 卡片缩略图：条目内相对图片或 `https://` |
| `slug` | ✗ | 同一项目所有版本文档共用的稳定标识；写成 `YYYY-MM-DD-...` 时按单版本处理 |
| `versionLabel` | ✗ | 当前版本号；填了 `versions` 时必填 |
| `versions` | ✗ | 历史版本元数据数组 |
| `draft` | ✗ | 布尔，默认 `false`；`entry` 是主文件标记 |

- 当前版本另有 `versionName`（缺省用 `title`）、`versionSummary`（缺省用 `description`）与 `versionOrder`（非负整数，同日期时的排序依据）。
- `versions[]` 每项必填 `label`（非空）与 `date`，可选 `name`、`summary`、`order`（非负整数）。
- 填了 `versions` 时当前条目必须有 `versionLabel`；每个历史版本日期不得晚于项目 `date`（`src/content.config.ts:288`）。
- `versions[]` 只作为历史元数据出现在版本列表里，不生成可打开的页面。
- `projects` 没有 `tags`、`repo`、`demo` 字段，仓库与演示链接写在正文末尾的链接组。

## devlog

| 字段 | 必填 | 默认或约束 |
| --- | --- | --- |
| `title` | ✓ | 标题 |
| `date` | ✓ | 日期或日期时间 |
| `project` | ✓ | 项目显示名，自由文本，不生成链接 |
| `projectSlug` | ✗ | 项目标识；可写稳定标识、任一版本文档的条目 ID 或版本锚点 |
| `kind` | ✗ | 自由文本；常用 `feature`、`fix`、`improvement`、`breaking`、`docs` |
| `description` | ✗ | 摘要；`draft` 布尔，默认 `false`；`entry` 是主文件标记 |

- `devlog` 没有 `tags` 与链接字段，外链写在正文末尾的链接组。
- 页面位置是 `/devlog/#<压平后的条目 ID>`，条目 ID 里的 `/` 换成 `-`。
- `projectSlug` 解析不到时回退 `project` 显示名，非空且未命中的值构建时告警一次。

## about

- `about` 使用 `z.looseObject({})`，没有字段约束，未知字段也会保留（`src/content.config.ts:353`）。
- 正文只从 `content/about/index.md` 读取。
- 页面标题与副标题来自 `src/data/settings/page.json` 的 `about.title` 与 `about.subtitle`，不读 frontmatter（`src/pages/about/index.astro:14`）。
- 关于页专用指令只在这个文件生效。

## 博客系列与版本路由

- 分组键由 `series` 决定：有 `series` 用 `series:<值>`，没有则单条一组 `single:<条目 ID>`（`src/lib/blog-routing.ts:92`）。
- 组内排序为 `date` 降序、`versionOrder` 降序、条目 ID 升序，排在最前的是最新版。
- 同组所有非空 `slug` 必须一致，否则抛 `BlogRoutingError`；有版本写了 `slug` 时最新版必须也写。
- 稳定 `slug` 必须匹配 `BLOG_PUBLIC_SLUG_RE`，且不能是保留名 `page`、`rss.xml`；不同分组产生相同路径时报错。

| 类型 | 路径 | 规范地址 | `noindex` |
| --- | --- | --- | --- |
| `latest-stable` | `/blog/<slug>/` | 自身 | ✗ |
| `latest-dated` | `/blog/<条目 ID 压平>/` | 自身 | ✗ |
| `latest-alias` | 最新版的日期路径 | 稳定地址 | ✗ |
| `version` | 历史版各自的日期路径 | 组的规范地址 | ✓ |

- `latest-alias` 只在系列设置了 `slug`、且最新版的日期路径与稳定路径不同时生成。
- 历史版本页面只显示版本日期；RSS 与 sitemap 只保留最新版，`/rss.xml` 与 `/blog/rss.xml` 条目相同、频道标题不同。
- sitemap 在构建结束后按 `/blog/index.json` 中 `isLatest` 条目的 href 生成规范地址集合，移除历史版本与日期别名（`astro.config.mjs:66`）。
- 修改已发布系列的 `slug` 会改变规范地址，旧链接失效。

## 项目多版本路由

- 项目分组只看 `slug`：非空且不是 `YYYY-MM-DD-` 开头的稳定值才参与分组，否则按单版本处理（`src/lib/project-routing.ts:121`）。
- 稳定 `slug` 必须匹配 `BLOG_PUBLIC_SLUG_RE`，校验失败会列出该组全部条目 ID。

| 项 | 规则 |
| --- | --- |
| 最新版锚点 | 稳定 `slug`；没有稳定 `slug` 时用条目 ID 压平值 |
| 历史版本文档锚点 | 各自条目 ID 的压平值 |
| 公开位置 | `/projects/#<锚点>` |
| 排序 | `date` 降序、`versionOrder` 降序、条目 ID 升序 |
| 冲突 | 不同项目产生相同锚点时构建失败 |
| 深链解析 | 先精确匹配版本锚点，再回退条目 ID，最后匹配最新版锚点 |

- 列表只显示每个项目的最新版卡片，弹窗内可切换全部版本文档；同组重复 `versionOrder` 只告警。
- `versions[]` 里的历史元数据并入最新版分组的版本列表：按 `label|date` 去重，已有版本文档优先；这些项没有锚点与链接。
- 项目弹窗通过 `getVisibleProjectDialogItems` 组装正文、链接与开发日志更新（`src/lib/content.ts:142`）。
- 开发日志用 `projectSlug` 解析到项目：先按版本锚点、再按版本文档条目 ID 查找，未命中时按 `project` 显示名做唯一匹配（`src/lib/project-routing.ts:413`）。

## 图片附件与共享资源

| 场景 | 解析方式 |
| --- | --- |
| 正文 Markdown 与 HTML 图片 | `blog` 正文相对条目目录，或以 `/` 开头按 `public/` 解析；`projects` 与 `devlog` 正文由 `renderEntryBody` 渲染，建议用 `/` 开头的 public 路径 |
| `ogImage`、`projects.icon`、`projects.image`、`bits.images[].src` | schema 的 `image()`：条目内相对图片或 `https://`；`ogImage: none` 关闭 |
| `bits.author.avatar` 与默认作者头像 | 相对 `public/` 的本地图片路径，不带前导 `/`，不接受 URL |
| 正文附件链接 | 相对条目目录，例如 `files/checklist.pdf` |
| 多个条目共用的资源 | 集合级 `content/<集合>/_shared/images/` 或 `_shared/files/` |

- 附件由 `src/integrations/content-assets.mjs` 在构建结束时处理：只扫描每个条目的主 Markdown，去掉代码围栏与行内代码，收集 Markdown 链接与 `<a href>` 里的非图片、非 Markdown 文件，复制到 `dist/content-assets/<content 相对路径>`。
- 开发环境用中间件把 `/content-assets/` 映射回 `content/`（`src/integrations/content-assets.mjs:131`）；`rehypeContentAssetLinks` 把正文里的本地附件 href 改写成 `/content-assets/...`。
- 共享资源通过 `resolveContentAssetReference` 解析：先按条目相对路径，再尝试同目录 `images/`、`assets/` 回退，最终限制在内容根内（`src/lib/content-asset-paths.mjs:39`）。
- 后台把共享上传写到 `content/<集合>/_shared/`；`_shared` 没有 Markdown 主文件，不会被当成条目。
- 正文里的站内根路径会在渲染时补部署 base，`a`、`img`、`source` 与 `srcset` 都处理；后台保存 `blog` 正文时也会拒绝不存在的本地图片引用（`src/lib/admin-console/content-write-plan.ts:453`）。

## Markdown 插件与白名单

公开页面用 `astro.config.mjs` 注册的统一处理器，配置由 `createPublicMarkdownConfig` 生成（`src/plugins/markdown-pipeline.mjs:384`）。Astro 内建的 GFM 与智能标点先执行，随后是项目插件：

- remark：`remark-math`、`remark-directive`、文本指令还原、关于页指令、提示块。
- rehype：数学边界保护、`rehype-raw`、恢复数学边界、关于页指令、附件链接改写、部署 base、`rehype-sanitize`、`rehype-katex`。
- 代码高亮：Shiki，浅色 `github-light`、深色 `github-dark`，附加 `astro-whono-code-toolbar` 工具栏（`src/plugins/shiki-toolbar.mjs`）。

- 后台预览使用另一套处理器，插件与 `sanitize-schema.mjs` 与公开页共用，差异集中在标题 id、预览专用属性与高亮实现；改 Markdown 行为要同时检查公开页与预览。
- 公式：`remarkMath` 配置 `singleDollarTextMath: false`，单个 `$` 不是定界符；行内用 `$$...$$`，块级让 `$$` 单独成行。
- 代码围栏与行内代码里的 `$$` 由数学边界插件保护，原样输出；`math` 语言围栏仍是代码块。
- 提示块：`remark-callout` 把 `note`、`tip`、`info`、`warning` 四种容器指令渲染成 `div.callout.<type>`；未知容器指令按 `note` 处理（`src/plugins/remark-callout.mjs:3`）。
- 图注与画廊依赖白名单放行的 class：`figure` 保留尺寸与对齐类，`figcaption` 保留 `figure-caption`，`ul` 保留 `gallery`、`cols-2`、`cols-3`（`src/plugins/sanitize-schema.mjs:73`）。
- 原始 HTML 经 `rehype-sanitize` 清洗：在 `defaultSchema` 基础上增加 `figure`、`figcaption`、`picture`、`source`、`details`、`summary`、`dialog`、`button`、`svg` 等标签；`script` 等不在白名单内的内容会被移除。
- 新增需要保留的标签、属性或 class 时要同时改这份白名单。
- `remark-literal-text-directives` 把主题不认识的文本指令还原成原文，避免正文里的时间写法被当成空元素。

## 末尾链接组

`projects` 与 `devlog` 的正文末尾可以放一组外链，解析与渲染在 `src/lib/trailing-links.ts`，入口是 `renderEntryBody`（`src/lib/entry-body.ts`）：

- 链接组必须是文末连续的纯链接行，每行只由 Markdown 链接与空白、`·`、`|`、`、`、`,`、`，`、`/` 组成。
- 链接组前至少要有一个空行，或正文本身只有链接组；只接受 `http`、`https`、`mailto`、`tel` 协议。
- 按书写顺序输出为 `<p class="trailing-links">`，链接之间只留等距间隔；渲染正文与派生摘要前会先剥离链接组。

`blog` 不走这套机制，正文链接按普通 Markdown 渲染。项目卡片与归档摘要复用同一套模块的解析与剥离函数。

## 关于页指令

关于页指令由 `src/plugins/about-directives.mjs` 处理，只在源文件路径匹配 `content/about/index.md` 时生效；后台预览通过 `enabled` 选项单独开启。remark 阶段把指令转成带 `data-about-*` 的节点，rehype 阶段生成结构。

| 指令 | 写法 | 行为 |
| --- | --- | --- |
| `::site-info{...}` | 叶指令，属性 `name`、`url`、`description`、`avatar` 全部可选 | 四项全空不输出；`url` 为 `http`/`https` 时渲染链接；输出字段列表与复制按钮 |
| `:::friend{...}` | 容器指令，需要 `name` 与 `url`，正文是简介，`avatar` 可选 | 连续的多个 friend 合成 `ul.friend-list`；头像缺失时用名称首字 |
| `:::faq{question="..."}` | 容器指令，`question` 必填，正文是回答 | 连续的多个 faq 合成 `div.qa-list`，每项是 `details.qa-item` |
| `::contact-links` | 叶指令，无属性 | 生成占位容器，`src/pages/about/index.astro` 用可见的 `site.json` 社交项替换（`src/lib/about-contact-links.ts:61`） |

- `friend` 与 `faq` 的连续项之间允许空白文本节点；`friend` 的 `avatar` 只接受本地 public 相对路径或 `https://` 图片。
- `site-info` 的 `avatar` 只作为文本字段显示，不渲染图片；关于页标题与副标题来自 `page.json`。

## 检查与测试

- `npm test`：写作相关用例集中在 `tests/blog-routing.test.ts`、`tests/project-routing.test.ts`、`tests/date-only.test.ts`、`tests/display-date.test.ts`、`tests/content-entry-files.test.ts`、`tests/trailing-links.test.ts`、`tests/about-directives.test.ts`、`tests/markdown-pipeline-contract.test.ts`。
- `npm run verify`：类型检查、构建、字体覆盖、测试与产物检查；schema 与路由错误会在构建期暴露。
- 构建期失败：非法日期、`updatedAt` 早于 `date`、`versions` 缺少 `versionLabel`、历史版本日期晚于项目 `date`、博客系列 `slug` 不一致、博客或项目 `slug` 格式非法、博客路径重复、项目锚点冲突、条目主文件缺失、保留 `slug` 被占用。
- 构建期告警：已发布文章缺 `publishedAt`、项目同组 `versionOrder` 重复、`devlog.projectSlug` 非空但未解析。

字段变更通常还要同步后台编辑器与校验逻辑（`src/lib/admin-console/`），后台细节见 [admin.md](admin.md)。
