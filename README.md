# astro-whono-tweaked

基于 [cxro/astro-whono](https://github.com/cxro/astro-whono) 的 Astro 博客主题分支，面向长文阅读做了增量改造：新增文章目录、右下角浮动操作列、阅读位置记忆与主题切换涟漪，收窄侧栏并让壳层宽度随视口自适应。主题结构、内容集合、后台与 Markdown 扩展沿用上游，无破坏性改动。

在线演示：<https://planetarium1001.github.io/astro-whono-tweaked/>

上游完整说明（部署、后台、写作、字体子集化、Markdown 扩展）见 [docs/README.upstream.md](docs/README.upstream.md)，英文版见 [docs/README.upstream.en.md](docs/README.upstream.en.md)。

## 预览

| 宽屏 | 窄屏 |
| --- | --- |
| ![](docs/images/preview_page_1.webp) | ![](docs/images/preview_page_2.webp) |
| ![](docs/images/preview_archive_1.webp) | ![](docs/images/preview_archive_2.webp) |

| 后台内容 | 后台主题 | 后台图片 |
| --- | --- | --- |
| ![](docs/images/preview_admin_1.webp) | ![](docs/images/preview_admin_2.webp) | ![](docs/images/preview_admin_3.webp) |

## 主要特性

阅读体验：

- 文章目录：宽屏（视口 ≥ 1280px）作为壳层第 4 列常驻，阅读模式下门槛降至 1024px；窄屏折叠在正文顶部可展开。
- 目录状态记忆：收起状态存于 localStorage，在首次绘制前生效；滚动时高亮当前小节。
- 定位反馈：点击目录跳转后目标小节短暂高亮并聚焦标题，读屏可落到该小节。
- 浮动操作列：文章与列表页右下角常驻阅读模式、回到上次阅读位置、回到顶部三个按钮，按需出现。
- 阅读位置记忆：跨次打开按路径存 localStorage（最近标题加段内偏移，滚动比例兜底），本次会话内用位置栈原路返回。
- 阅读模式：入口在浮动列，进入后侧栏收拢、正文放宽、右侧目录保留；进出遵循 `prefers-reduced-motion`。
- 主题切换涟漪：以点击处为圆心圆形展开；不支持 View Transitions API 或系统偏好减少动效时直接切换。

站点能力：

- 浏览数据槽位：文章元信息行与页面底部预留 PV / UV 位置，数字由站点自行接入统计服务。
- 备案信息：页脚居中显示工信部备案号与公安联网备案号，链接与图标可配置，默认不显示。
- 侧栏文案富文本：站点名与引用文案支持换行、少量 HTML 标签与对齐工具类。
- 响应式壳层：侧栏 224px，壳层宽度随视口自适应；`html` 固定滚动条槽位，页面高度变化时不横跳。

沿袭上游：

- 五个内容集合（博客、项目、动态、更新、关于）与归档时间线视图。
- 本地后台 Admin Console（概览、主题、写作、图片、快照），仅开发环境可读写，生产产物为只读静态壳。
- RSS（全站与分栏列表页）、浅色与深色模式、自托管子集字体。
- Callout、Figure、Gallery、公式等 Markdown 扩展。

## 快速开始

环境要求：Node.js ≥ 22.12.0（见 `.nvmrc` 与 `package.json` 的 `engines`）。

```bash
npm install
npm run dev       # 开发服务器，后台在 /admin/
npm run build     # 产出 dist/
npm run preview   # 预览构建结果
```

部署静态产物即可，`dist/` 可直接交给任意静态托管。仓库自带 Netlify 配置（`npm run build` + 发布 `dist`），也自带 GitHub Pages 工作流，详见「持续集成与预览部署」。

## 配置

### 站点常量

`site.config.mjs` 定义站点标题、作者、描述与列表页每页条目数（`PAGE_SIZE_BLOG`、`PAGE_SIZE_BITS`、`PAGE_SIZE_ARCHIVE`）。服务端分页已取消，这三个值是前端每页条目数，由列表页写入 `[data-entry-filters][data-page-size]` 供客户端分页读取。

构建期环境变量：

| 变量 | 作用 |
| --- | --- |
| `SITE_URL` | 站点 origin，用于 RSS、canonical、og 与 sitemap；为空时 RSS 回落到 `https://example.invalid`，canonical/og 省略，sitemap 不生成 |
| `ASTRO_WHONO_BASE_PATH` | 部署子路径，默认 `/`；项目页部署在仓库子路径时由 Pages 工作流推导 |

### 主题设置

可配置项以 JSON 保存在 `src/data/settings/`，按领域分为五组：

| 文件 | 内容 |
| --- | --- |
| `site.json` | 站点标题与描述、页脚版权、备案信息、favicon、社交链接、后台概览可见性 |
| `shell.json` | 侧栏站点名、引用文案、导航项（标签、装饰符、顺序、可见性） |
| `home.json` | 首页引导语、更多入口、Hero 图 |
| `page.json` | 各列表页标题与副标题、动态页默认作者、列表页 RSS 开关 |
| `ui.json` | 代码块行号、阅读模式入口、浮动操作列、浏览数据、侧栏动作、文章元信息、侧栏分隔线、字体角色 |

推荐用后台主题页（`/admin/theme/`）修改；直接编辑 JSON 同样有效，字段缺失时回落到默认值。开发环境下修改 `ui.json` 的字体需要在重启后生效。设置项的职责划分与操作路径见 [docs/admin-console.md](docs/admin-console.md)。

### 浏览数据（PV / UV）

主题只渲染位置、样式与 DOM 槽位，数字由站点自行接入。开关、前缀文案与显示位置在后台主题页的「浏览数据」中设置，默认关闭；开关打开但未填值时槽位保持隐藏，不占位、不引起重排。

| 位置 | 出现处 |
| --- | --- |
| 文章元信息行 | 博客详情页：日期、标签、字数、阅读时长、浏览数、访客数 |
| 页面底部 | 首页与各列表页，位于页脚版权之上 |

接入点：

| 要做的事 | 改哪里 |
| --- | --- |
| 上报访问 | `src/layouts/BaseLayout.astro` 的 `<head>` 内加入 tracker 脚本 |
| 填充数字 | `src/scripts/view-stats.ts`，唯一接入点，默认空实现 |
| 开关与位置 | 后台主题页的「浏览数据」，写入 `src/data/settings/ui.json` |

其余页面类型枚举、属性含义、helper、Umami 分享通道的完整步骤与取数口径见 [docs/analytics.md](docs/analytics.md)。

### 备案信息

工信部备案号与公安联网备案号在后台主题页的「备案信息」中填写，默认不显示，渲染在页脚最底部（版权行之下、居中）。链接仅允许 `beian.miit.gov.cn`（ICP）与 `beian.mps.gov.cn`、`beian.gov.cn`（公安，兼容旧写法）。字段说明与法规要求见 [docs/analytics.md](docs/analytics.md#备案信息)。

## 内容模型

内容集合与路由：

| 集合 | 源文件 | 路由 |
| --- | --- | --- |
| 博客 `blog` | `src/content/blog/*.md` | `/blog/`、`/blog/<slug>/` |
| 项目 `projects` | `src/content/projects/*.md` | `/projects/`（页内锚点） |
| 动态 `bits` | `src/content/bits/*.md` | `/bits/`（页内锚点） |
| 更新 `devlog` | `src/content/devlog/*.md` | `/devlog/`（页内锚点） |
| 关于 `about` | `src/content/about/index.md` | `/about/` |

`/archive/` 是跨博客、项目、更新的全站时间线，按年月分组，不含动态。

博客 frontmatter：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `title` | 是 | 标题 |
| `date` | 是 | `YYYY-MM-DD` 或带时区的 ISO 8601 |
| `description` | 否 | 摘要，留空时按正文截取 |
| `tags` | 否 | 字符串数组，默认空 |
| `draft` | 否 | `true` 仅本地预览，构建、公开列表与 RSS 会过滤 |
| `publishedAt` | 否 | 带时区的 ISO 8601 |
| `updatedAt` | 否 | `YYYY-MM-DD` 或带时区的 ISO 8601，不得早于 `date` |
| `slug` | 否 | 小写 kebab-case，允许 CJK，覆盖默认路径 |
| `cover`、`badge` | 否 | 封面与角标 |

其余集合的字段：

| 集合 | frontmatter |
| --- | --- |
| `bits` | `title?`、`description?`、`date`、`tags`、`draft`、`slug?`、`images[]`（`src`、`width?`、`height?`、`alt?`）、`author?`（`name?`、`avatar?`） |
| `projects` | `title`、`subtitle?`、`description?`、`type?`、`tags`、`icon?`、`repo?`、`repoLabel?`、`demo?`、`demoLabel?`、`date`、`draft` |
| `devlog` | `title`、`date`、`project`、`kind?`、`description?`、`draft` |
| `about` | 无约束，正文写在 `index.md` |

图片放在 `public/` 下（如 `public/images/blog/<slug>/a.webp`），正文写 `/images/blog/<slug>/a.webp`；动态的 `images[].src` 与 `author.avatar` 不带前导斜杠、也不带 `public/`（如 `author/avatar.webp`）。博客详情页的 `slug` 默认为文件名去掉 `YYYY-MM-DD-` 前缀后的部分，可用 frontmatter 的 `slug` 覆盖；文件名规范见 [docs/development.md](docs/development.md)。

订阅源为 `/rss.xml` 与 `/blog/rss.xml`，两者内容相同，均输出博客。列表页的 RSS 入口由 `page.json` 的 `listRss` 控制，博客、动态、归档三页可分别开关，链接统一指向 `/blog/rss.xml`。

三种写作入口：后台的写作页新建与编辑；在对应目录直接新增 `.md`；`npm run new:bit` 生成动态草稿。动态、更新与项目均为无独立详情页的列表集合，条目通过页内锚点定位。

## 目录结构

```
src/content/        内容源文件，按集合分目录
src/pages/          路由；admin/ 与 api/admin/ 仅开发环境可用
src/layouts/        BaseLayout、ArticleLayout
src/components/     展示组件；admin/ 为后台界面
src/lib/            设置解析、内容读取与后台逻辑；admin-console/ 为后台专用
src/scripts/        前台脚本；admin-*/ 为后台专用
src/styles/         样式入口与各组件样式
src/plugins/        Markdown 渲染管线：remark / rehype 插件与 HTML 白名单
src/utils/          格式化、日期、slug 规则等通用工具
src/data/settings/  主题设置 JSON
public/             静态资源与上传目录：images/、fonts/、author/ 等
scripts/            仓库维护脚本：字体子集、各项校验、new:bit
tools/              字体字符集基线与快照
tests/              Vitest 用例与页面快照
docs/               仓库文档
```

分层与数据流见 [docs/architecture.md](docs/architecture.md)。

## 开发与校验

常用命令为 `npm run dev`、`npm run build`、`npm run preview`、`npm run new:bit`，校验命令为 `npm run check`（类型检查与守卫脚本）、`npm test`（Vitest）与 `npm run verify`（check、test、build 与产物类校验依次执行）。

构建前需提供 `SITE_URL`，否则 sitemap 不生成、产物校验会失败。产物类校验（`check:prod-artifacts`、`check:layout-geometry`、`check:touch-targets`）读取 `dist/`，必须在构建后执行。

校验脚本清单、测试组织、命名规范与 CI 流程见 [docs/development.md](docs/development.md)。

## 文档

| 文档 | 内容 |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | 集合与路由、服务端与客户端分层、后台模块边界、样式与构建期流水线 |
| [docs/admin-console.md](docs/admin-console.md) | 后台五个模块的职责、可做的事与常见操作路径 |
| [docs/development.md](docs/development.md) | 环境、命令、校验脚本、测试与 CI、内容命名规范 |
| [docs/analytics.md](docs/analytics.md) | 访问统计槽位契约、Umami 接入步骤、取数口径与备案字段 |
| [docs/llm-view-stats-prompt.md](docs/llm-view-stats-prompt.md) | 浏览数据取数脚本的提示词模板 |
| [docs/README.upstream.md](docs/README.upstream.md) | 上游 README 快照（中文） |
| [docs/README.upstream.en.md](docs/README.upstream.en.md) | 上游 README 快照（英文） |

## 与上游的关系

主题结构、内容集合、后台、Markdown 扩展与字体子集化流程沿用上游，本分支只做增量与局部调整：新增文章目录、浮动操作列、主题切换涟漪、侧栏文案富文本、浏览数据槽位与备案信息；阅读模式入口移到浮动列并重做了进出过渡；侧栏由 320px 收窄到 224px，壳层宽度随视口自适应，前后台共用同一组间距 token。

同步上游：

```bash
git remote add upstream https://github.com/cxro/astro-whono.git
git fetch upstream --tags
git checkout main
git merge upstream/main
npm run check
```

`npm run check` 包含首屏 critical CSS 的漂移检查。合并上游后若该检查报错，说明上游改动了侧栏或壳层尺寸，需要同步 `src/pages/index.astro` 中 `homeHeadCriticalCss` 的对应声明。

## 持续集成与预览部署

仓库自带两个 GitHub Actions 工作流，均不需要配置 secret：

| 工作流 | 触发 | 作用 | 权限 |
| --- | --- | --- | --- |
| `ci.yml` | push / PR 到 `main` | `npm ci` 后执行 `npm run ci`（等同 `verify`，已含产物类守卫） | `contents: read` |
| `pages.yml` | push 到 `main`、手动触发 | 构建并发布到 GitHub Pages | `contents: read`、`pages: write`、`id-token: write` |

启用 Pages 预览：仓库设为 public（Free 计划下私有仓库无法使用 Pages）；Settings → Pages → Source 选 GitHub Actions，不需要 `gh-pages` 分支，建议先启用再 push，否则首次运行会在 deploy 步骤失败，可在 Actions 中对失败运行点 Re-run all jobs 重试；随后 push 到 `main` 或在 Actions 中手动运行。

站点地址由工作流按仓库名推导：项目页发布在 `https://<owner>.github.io/<repo>/`，仓库名为 `<owner>.github.io` 时发布在根路径并把 base 设为 `/`，改仓库名后无需改工作流。

其他情况：

- fork 后 `pages.yml` 默认跳过（`if: github.repository == '…'` 守卫）；想在自己的 fork 中发布，把该行改成自己的仓库名并启用 Pages。
- 绑定自定义域名后站点移到域名根路径，需要把工作流中的 `SITE_URL` 与 `ASTRO_WHONO_BASE_PATH` 改为固定值（`https://你的域名` 与 `/`），否则资源路径会带上仓库子路径而 404。
- 不需要 Pages 预览时删掉 `.github/workflows/pages.yml` 即可，`ci.yml` 与构建不受影响。

## 调参

| 需要调整的内容 | 变量 / 常量 | 位置 |
| --- | --- | --- |
| 侧栏宽度与内外边距 | `--sidebar`、`--public-sidebar-inline-size`、`--sidebar-padding-block`、`--sidebar-padding-inline` | `src/styles/global.css` |
| 壳层与正文宽度 | `--layout-shell-max-inline-size`、`--max` | `src/styles/global.css` |
| 目录列宽与出现门槛 | `--article-toc-inline-size`、`--article-toc-handle-column`、`@media (min-width: 1280px / 1024px)` | `src/styles/components/article-toc.css` |
| 目录跳转高亮的底色与时长 | `--prose-flash-bg`、`FLASH_DURATION_MS` | 同上、`src/scripts/article-toc.ts` |
| 主题切换涟漪 | `RIPPLE_DURATION_MS`、`RIPPLE_EASING` | `src/scripts/sidebar-theme.ts` |
| 阅读模式过渡 | `READING_ANIM_MS`，需与样式中的 `520ms` 一致 | `src/scripts/sidebar-reading.ts`、`src/styles/components/layout.css` |
| 浮动按钮尺寸、侧栏文案排版工具类 | `--float-button-size`、`.whono-left` 等 | `src/styles/components/layout.css` |
| 富文本白名单 | `ALLOWED_TAGS`、`ALLOWED_STYLE_PROPERTIES` | `src/lib/setting-html.ts` |
| 浏览数据槽位与填值 | `.view-stats*`、`resolveViewStats`、`setViewStatValue` | `src/styles/components/view-stats.css`、`src/lib/view-stats.ts` |
| 备案链接白名单与长度 | `ADMIN_ICP_FILING_HOSTS`、`ADMIN_POLICE_FILING_HOSTS`、`ADMIN_FILINGS_NUMBER_MAX_LENGTH` | `src/lib/admin-console/theme-shared.ts` |

改动侧栏或壳层尺寸后，需要同步 `src/pages/index.astro` 中 `homeHeadCriticalCss` 的对应声明，该快照在 `global.css` 之后加载并覆盖首屏几何，`npm run check:home-critical-css` 会指出不一致项。

## 许可

MIT，见 [LICENSE](LICENSE)。
