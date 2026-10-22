# 开发

> 本页面向开发者，包含实现细节与命令。使用说明见[使用版](../development.md)，全部开发文档见[索引](README.md)。

本页覆盖本地环境、`package.json` 的全部脚本、`verify` 的检查顺序、字体生成与资产提交、测试组织、浏览器约定、内容命名，以及 CI 与发布的联动。代码分层与运行时模型见[架构](architecture.md)，部署工作流见[部署](deployment.md)，版本流程见[发布](release.md)。

## 环境与 Node 解析

`package.json` 的 `engines.node` 是 `>=22.12.0`，`.nvmrc` 固定 `22.22.0`。依赖由 `package-lock.json` 锁定，安装用 `npm ci`；`npm install` 会按需改写锁文件，只在确实升级依赖时使用。

三个工作流解析 Node 的方式不同：

| 工作流 | 解析顺序 |
| --- | --- |
| `.github/workflows/ci.yml` | `.nvmrc` → `package.json` 的 `engines.node` → `22` |
| `.github/workflows/pages.yml` | `.nvmrc` → `22` |
| `.github/workflows/release.yml` | `.nvmrc` → `22` |

`release-please.yml` 只调用 action，不安装 Node。`.nvmrc` 与 `engines.node` 都要保留：前者供本地版本管理器以及 pages/release 使用，后者是 npm 安装时的版本门槛。

重建字体子集需要 Python 3 与 `fonttools`、`brotli`。`scripts/font/python.mjs` 的解析顺序是 `FONT_PYTHON` → `/tmp/dsh-fontenv/bin/python` → PATH 中的 `python3`，并用 `import fontTools, brotli` 探测。日常开发、构建与 CI 不需要 Python。

## 全部 scripts

`package.json` 共 34 个 scripts。

开发与构建：

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | `astro dev`；开发模式启用 server 输出，后台与 `/api/admin/*` 可写 |
| `npm run predev` | `dev` 前自动运行，调用 `scripts/favicon.mjs` 生成站点图标 |
| `npm run dev:clean` | 删除 `node_modules/.vite` 后启动开发服务器 |
| `npm run build` | `astro build`，输出静态产物到 `dist/` |
| `npm run prebuild` | `build` 前自动运行，生成站点图标 |
| `npm run preview` | `astro preview`，本地预览 `dist/` |
| `npm run new:bit` | 在 `content/bits/` 生成 `bits-YYYY-MM-DD-HHmm` 草稿条目 |
| `npm run theme:update` | 按 `theme.json` 的仓库与基准提交做三方合并；`-- --check` 只报告，`-- --include-fonts` 连同主题字体资产 |

校验与测试：

| 命令 | 用途 |
| --- | --- |
| `npm run check` | 依次运行 `astro check` 与六个源码检查脚本 |
| `npm test` | `vitest run --config ./vitest.config.ts` |
| `npm run verify` | 完整校验，顺序见下一节 |
| `npm run ci` | 等同 `verify`，CI 直接调用 |
| `npm run audit:prod` | `npm audit --omit=dev --audit-level=high`，手动运行，不在 CI 中 |
| `npm run test:fixtures` | 从 `dist/` 刷新 `tests/fixtures/` 的页面快照 |
| `npm run check:markdown-smoke` | 在 `dist/` 上检查提示块、代码块工具栏、KaTeX、图片与画廊输出 |
| `npm run check:admin-content-source-boundary` | 检查后台内容模块不依赖公开内容模块 |
| `npm run check:home-critical-css` | 检查首页首屏样式快照与样式源文件一致 |
| `npm run check:admin-editor-emoji-boundary` | 检查编辑器工具栏的 emoji 选择器边界 |
| `npm run check:prod-artifacts` | 检查构建产物的必需文件、只读后台与链接 |
| `npm run check:font-charset` | 检查字符集文件与子集戳记是否最新 |
| `npm run check:svelte` | 编译全部 `.svelte` 组件 |
| `npm run check:image-references` | 检查 Markdown、HTML、frontmatter 与设置里的本地图片引用 |
| `npm run check:touch-targets` | 检查产物中交互元素最终热区不小于 44px |
| `npm run check:layout-geometry` | 检查产物中的布局尺寸关系 |
| `npm run check:viewport-overflow` | 检查窄屏横向溢出相关约束 |
| `npm run smoke:cloud-images` | 检查对象存储上传、列举与清理；`ASTRO_WHONO_CLOUD_SMOKE=1` 时才执行 |

字体：

| 命令 | 用途 |
| --- | --- |
| `npm run font:fetch` | 下载并校验源字体到 `tools/fonts-src/` |
| `npm run font:charset` | 重算 `tools/charset-common.txt` |
| `npm run font:roles` | 从 `dist/**/*.html` 提取 text、textOnly、display、meta、brand 角色字符集 |
| `npm run font:subset` | 生成 base/DLC 的 WOFF2、CSS 与 `tools/font-manifest.json` |
| `npm run font:build` | 编排字体生成的完整流程 |
| `npm run font:check` | 校验清单、文件、哈希、CSS 对应与输入是否过期 |
| `npm run font:coverage` | 构建后检查页面字符覆盖；`--strict` 用于 `verify` |
| `npm run font:report` | 输出各页面的字体下载量估算，调试用 |

`predev` 与 `prebuild` 由 npm 生命周期自动触发。`scripts/favicon.mjs` 的生成物写在 `public/images/site/generated/`，标记文件为 `tools/favicon-generated.json` 与 `public/images/site/generated/.favicon-generated.json`；用户放在根目录的 `public/favicon.ico` 不会被覆盖。

## verify 的九个步骤

`npm run verify` 严格按 `package.json` 的顺序执行：

1. `npm run check`：只读源码、设置与已提交的字体资产。
2. `npm run build`：产出 `dist/`。
3. `npm run font:coverage -- --strict`：读 `dist/` 与字体清单，只把「源字体有、生成时漏掉」判为失败。
4. `npm run test:fixtures`：从 `dist/` 刷新 `tests/fixtures/`。
5. `npm test`：运行 Vitest。
6. `npm run check:prod-artifacts`：检查产物、sitemap 与后台只读边界。
7. `npm run check:layout-geometry`：检查布局尺寸。
8. `npm run check:touch-targets`：检查触控热区。
9. `npm run check:viewport-overflow`：检查窄屏溢出约束。

`npm run ci` 与 `verify` 完全相同，CI 调用的是 `ci`。`verify` 必须提供 `SITE_URL`：`check:prod-artifacts` 断言 sitemap 存在，而 `astro.config.mjs` 只在 `SITE_URL` 非空时注册 sitemap 集成。`verify` 会改写 `tests/fixtures/`，运行前先确认工作树状态，跑完把快照变化一起提交。

## 源码检查

`npm run check` 依次运行：

| 检查 | 内容 |
| --- | --- |
| `astro check` | Astro 页面、TypeScript 与模板诊断 |
| `check:svelte` | 用 `svelte/compiler` 编译 `src/**/*.svelte`；后台 Svelte 岛只在 DEV 挂载，`build` 不会编译它们 |
| `check:admin-content-source-boundary` | 扫描 `src/lib/admin-console/content*.ts` 与 `src/pages/api/admin/content/*`，禁止导入 `src/lib/content.ts`、`src/lib/bits.ts`，禁止 `CollectionEntry`/`BitsEntry` 与公开内容查询函数 |
| `check:home-critical-css` | 比对 `src/pages/index.astro` 中 `homeHeadCriticalCss` 的 `String.raw` 快照与 `src/styles/global.css`、`src/styles/components/layout.css` 的对应声明 |
| `check:image-references` | 覆盖 `content/`、`src/test-fixtures/`、`src/data/settings/`、`src/pages/`、`src/components/`、`src/layouts/` 与 `site.config.mjs` 中的图片引用；跳过外链、`data:` 与模板表达式 |
| `check:font-charset` | 用与 `font:charset` 相同的采集范围重算字符集，与 `tools/charset-common.txt` 比对，并校验 `tools/charset-common.sha256` 戳记 |
| `font:check` | 校验清单 schema、文件存在性与字节数、SHA-256、文件名哈希、生成 CSS 与清单一一对应、face 范围互斥、3500 常用字覆盖、DLC 覆盖 source cmap 全部 CJK，以及 `manifest.inputs` 是否过期 |

以上脚本都在 `scripts/` 下，多数命令与文件同名，少数文件名不同：`check:prod-artifacts` 对应 `check-production-artifacts.mjs`，`check:svelte` 对应 `check-svelte-components.mjs`，`check:font-charset` 对应 `font-charset.mjs`。

按需运行的检查：

| 检查 | 内容 |
| --- | --- |
| `check:markdown-smoke` | 读 `dist/checks/markdown-smoke/index.html` 与 `dist/checks/markdown-smoke-no-math/index.html`，检查 callout、代码块工具栏、KaTeX 样式、图片与画廊 |
| `check:admin-editor-emoji-boundary` | 断言 `EditorToolbar.svelte` 通过 `EmojiPickerPopover` 接入、emoji 选择器走动态导入、数据源使用本地 `emoji-picker-element-data`、样式注入 shadow root |
| `smoke:cloud-images` | 用 `ASTRO_WHONO_S3_*` 环境变量连接对象存储，执行上传、列举与删除；默认跳过 |

## 产物检查

四个产物检查都只读 `dist/`，必须在 `npm run build` 之后运行：

| 检查 | 内容 |
| --- | --- |
| `check:prod-artifacts` | 必需文件（sitemap、RSS、后台页面、静态占位接口）、robots 的 Sitemap 行、后台路由不进 sitemap、订阅源与 sitemap 链接、canonical 与 `og:url`、后台只读判定、公共页不泄漏后台样式与 token、`<html>` 内联 `--font-*` 变量都有定义、不存在已移除的服务端分页产物 |
| `check:layout-geometry` | 从产物 CSS 与 `<html>` 内联变量解析最终值，检查侧栏、外缘间隙、浮动列与目录按钮的尺寸关系；常量在脚本顶部（`GUTTER = 15`、`MIN_RAIL_INSET = 4`） |
| `check:touch-targets` | 按 CSS 规则顺序取最终生效尺寸，交互元素热区不小于 `MIN_TAP_PX = 44`；视觉尺寸更小的目标以 `::before`/`::after` 覆盖层补齐热区 |
| `check:viewport-overflow` | 检查滚动条预留只在桌面生效、`overflow: clip` 的回退、窄屏 body 裁剪、壳层宽度上限与窄屏浮动提示锚点 |

后台只读页面的判定包括：产物里不出现后台写入根节点、初始化数据、后台导航或 DEV 专用资源，且 `/admin/` 带 `noindex,nofollow`。`check:prod-artifacts` 还要求 `SITE_URL` 非空。对应脚本是 `scripts/check-production-artifacts.mjs`、`scripts/check-layout-geometry.mjs`、`scripts/check-touch-targets.mjs` 与 `scripts/check-viewport-overflow.mjs`。改了后台页面、样式或首页 critical CSS 后要重新构建再运行这些检查。

## 字体管线

### 生成顺序

`npm run font:build` 依次运行：

1. `font:fetch`：按 `tools/font-sources.json` 准备源字体到 `tools/fonts-src/`；命中 SHA-256 缓存时不联网。
2. `font:charset`：从 `content/`、`src/pages`、`src/components`、`src/layouts`、`src/data/settings`、`site.config.mjs` 与 `tools/charset-base.txt` 收集字符，写入 `tools/charset-common.txt`。
3. `npm run build`：生成 `dist/`，作为角色字符集的唯一来源。
4. `font:roles`：解析 `dist/**/*.html`，输出 `tools/charset-roles.json`，包含 text、textOnly、display、meta、brand 与字频。
5. `font:subset`：生成 base/DLC 分片、`src/styles/fonts.generated.css`、`src/styles/fonts.dlc.generated.css` 与 `tools/font-manifest.json`。
6. `npm run build`：让页面产物引用最新 CSS。

`font:build` 支持 `--skip-fetch`、`--skip-build`、`--skip-final-build`；`font:subset` 支持 `--plan-only` 与 `--from-result`（复用上次分片结果，只重建 CSS、清单与戳记）。`font:fetch` 命中缓存时不联网，`--offline` 强制离线，`--force` 重新下载；下载前用 Range 请求测各镜像首字节延迟，下载后校验 SHA-256 并写 `tools/font-sources.lock.json`。

### 资产与清单

- `tools/font-sources.json`：源字体路径、SHA-256、版本、镜像地址与是否可变字体。
- `tools/fonts-src/`：下载的源字体，不入库；`tools/font-sources.lock.json` 同样忽略。
- `tools/charset-base.txt`：3500 常用字基线；`tools/charset-frequency.txt`：通用字频先验。
- `public/fonts/base/`：基础分片，分 core、mid、display、meta、latin；`public/fonts/dlc/`：生僻字分片，按 `unicode-range` 下载。
- `tools/font-manifest.json`：schemaVersion 2，记录 families、faces、targets、inputs 与汇总统计，供 CSS、后台与检查脚本共用。

当前清单（`generatedAt` 为 2026-10-21T10:29:17.420Z）：base 34 个字体文件、2,321,308 字节；DLC 121 个文件、21,469,680 字节；合计 155 个 WOFF2、23,790,988 字节。最大 DLC 分片 239,856 字节，`summary.estimate.commonPageBytes` 为 341,016 字节（333.0 KB）。`npm run font:report` 在现有 `dist/` 的 20 个页面上给出 p50 305.6 KB、p90 319.6 KB、max 319.6 KB，触发 DLC 的页面 0/20；这些数值随内容与构建结果变化，改动后重新运行确认。

### 覆盖策略

`src/data/settings/ui.json` 的 `fontCoverage` 控制加载方式，默认 `full`：

- `full`：加载基础字体与 DLC 两张 CSS，生僻字按 `unicode-range` 下载；
- `common`：只加载基础字体 CSS，生僻字交给系统字体，不请求 DLC。

`src/layouts/BaseLayout.astro` 根据该值决定是否输出 DLC 样式。`font:coverage` 区分「源字体本来没有」与「生成时漏掉」：前者按系统回退处理，后者在 `--strict` 下失败；设计范围外的字符单独列出。

源字体本身覆盖不全：Noto Serif SC 与 LXGW WenKai Lite 都只含部分扩展区字符，manifest 的 `sourceCjkRanges` 记录了实际范围。`src/lib/fonts/registry.ts` 只把拉丁等宽字体（JetBrains Mono、Fira Code）注册给 Astro Fonts API，`system-mono` 不产生字体请求。字体选择在 Astro 配置期读取，改 `ui.json` 的字体后要重启开发服务器。

CI 不运行 `font:build`，`public/fonts/`、生成 CSS、`tools/charset-*` 与 `tools/font-manifest.json` 都由维护者提交。改了内容或字体选择后重新生成并一起提交这些文件，否则 `check:font-charset` 与 `font:check` 会失败。

## 测试组织

`vitest.config.ts` 默认 Node 环境，`pool: 'threads'`，`include` 为 `tests/**/*.test.ts`，单测与钩子超时均为 15 秒，并开启 `resolve.preserveSymlinks`。需要 DOM 的用例在文件首行写 `// @vitest-environment jsdom`。`tests/` 当前有 118 个 `*.test.ts`。

| 范围 | 文件 |
| --- | --- |
| 后台内容、图片、媒体与编辑器 | `tests/admin-*.test.ts` |
| 前台列表、目录、筛选与弹窗 | `tests/*-client.test.ts`、`tests/*-dialog*.test.ts`、`tests/*-filter*.test.ts` |
| Markdown、关于页指令与末尾链接 | `tests/markdown-*.test.ts`、`tests/about-directives.test.ts`、`tests/trailing-links.test.ts` |
| 设置、日期、路由与归档 | `tests/theme-settings.test.ts`、`tests/date-*.test.ts`、`tests/*-routing.test.ts`、`tests/archive-*.test.ts` |
| 页面快照与 Markdown 夹具 | `tests/fixtures/`、`src/test-fixtures/` |

写入类用例通过 `tests/admin-content-write-fixture.ts` 在系统临时目录里搭内容目录，把设置目录与项目根指向临时位置，结束后清理，不碰仓库内容。

`tests/fixtures/` 是从 `dist/` 复制的页面快照，包含列表页 HTML 与 `index.json`，以及一篇带目录标题、非 `noindex` 的文章详情页。`npm run test:fixtures` 负责刷新，`verify` 在测试前先刷新再运行。客户端用例依赖真实渲染后的 `data-*` 属性、内联 JSON 与脚本加载顺序，这些只有构建产物才完整；改了列表页或文章页的服务端输出后，重新构建并提交刷新后的快照。

## 浏览器与交互约定

- 项目卡与列表卡的键盘焦点背景依赖 `:has(:focus-visible)`（`src/styles/projects-page.css`、`src/styles/components/lists.css`）；不支持 `:has()` 的内核退化为没有整卡背景，原生焦点提示仍在。
- 输入方式记录在 `<html data-input>`，由 `src/scripts/input-modality.ts` 更新。触屏会把指针上报成 `hover: hover`，媒体查询区分不了真鼠标与触屏，因此悬停视觉以该标记为准；触屏 tap 后的 800ms 内忽略兼容鼠标事件。
- 触屏点按后 `:hover` 会粘住，默认文本链接的悬停下划线只在非触屏输入下出现。
- 主题切换涟漪使用 View Transitions（`src/scripts/sidebar-theme.ts`）；不支持该 API 或用户偏好减少动效时直接切换。
- 指针或触屏点按产生的 `:focus` 不画浏览器默认描边；部分内核把点按也判成 `:focus-visible`，触屏下作者样式同样关掉描边。按 Tab 或再次移动鼠标后恢复设计焦点环。
- 不支持 `:focus-visible` 的内核会整条丢掉相关规则，保持原生焦点提示。

## 内容命名

条目目录名构成条目 ID，目录名规范为 `YYYY-MM-DD-title`；devlog 多一层项目目录（`content/devlog/<project>/<YYYY-MM-DD-title>/`），日期规则只约束叶子目录。构造入口是 `src/utils/slug-rules.ts` 的 `buildContentEntryId()`：

- 日期取站点时区的日历日期，与 frontmatter 的 `date` 一致；
- 标题经 NFKC 归一化、转小写，空白与下划线转连字符，其余非字母数字字符转连字符，连续连字符合并；
- 超过 120 个字符时截断并追加稳定短哈希；
- 标题段为空时使用 `untitled`，命中 Windows 保留设备名时追加 `-entry`。

`src/lib/content-entry-files.ts` 负责挑选条目主文件：优先 `index.md`，其次是目录内唯一的 `.md`，再次是唯一标记 `entry: true` 的文件；多个候选或没有候选会报错。集合根目录下的 Markdown 文件同样报错，内容必须放在条目目录中。

博客默认用完整条目 ID 作公开路径，例如 `/blog/2026-10-20-theme-quick-start/`；frontmatter 的 `slug` 可以改出稳定路径，多版本必须共用同一个 `slug`，否则 `src/lib/blog-routing.ts` 报错。公开 slug 必须是小写 kebab-case（允许 CJK），且不能与 `page`、`rss.xml` 冲突。`npm run new:bit` 按 `bits-YYYY-MM-DD-HHmm` 生成草稿条目，时间带站点时区偏移。

## CI 与发布联动

`.github/workflows/ci.yml` 在推送到 `main`、`demo` 或向两者提 PR 时运行：解析 Node 版本，`npm ci`，再以 `SITE_URL=https://planetarium1001.github.io` 执行 `npm run ci`。`SITE_URL` 只给 origin；CI 不设置 `ASTRO_WHONO_BASE_PATH`，所以 CI 产物按根路径构建，Pages 部署时的子路径由 `pages.yml` 推导。

`.github/workflows/pages.yml` 在推送到 `demo` 或手动触发时运行：检出 `demo`，推导 `SITE_URL=https://<owner>.github.io` 与 base（仓库名为 `<owner>.github.io` 时用根路径，否则 `/<repo>/`），构建后用 `dist/` 发布 GitHub Pages。

`.github/workflows/release-please.yml` 在推送到 `main` 时运行 Release Please，维护后续版本号与 `CHANGELOG.md` 的变更 PR；`release-please-config.json` 配置 `release-type: node`、`prerelease: true`、`prerelease-type: rc`，当前 `1.0.0-rc.2` 在 `.release-please-manifest.json` 与 `package.json` 中一致。`.github/workflows/release.yml` 在 Release 发布后校验标签与 `package.json` 版本一致，用 `git archive` 打包已跟踪文件为 `astro-versicarium-<version>.zip`，生成 `SHA256SUMS` 并上传到同一个 Release。

分支模型与部署变量见[部署](deployment.md)，版本策略与产物命名见[发布](release.md)，`theme:update` 的合并规则见[主题更新](upstream.md)。
