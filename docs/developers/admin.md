# 后台

## 范围

本篇覆盖：五个后台页面与路由、七组设置与写入文件、检查保存与冲突、写作、资源、快照、API 分组与写入规则、生产边界。前置：`npm run dev` 能启动，内容模型见 [content.md](content.md)。

## 页面与路由

路由常量在 `src/lib/admin-console/routes.ts` 的 `ADMIN_ROUTES`，导航高亮由 `activeMatch` 控制（概览用 `exact`）。后台只有 5 个页面。

| 页面 | 路由 | 页面文件 | 作用 |
| --- | --- | --- | --- |
| 概览 | `/admin/` | `src/pages/admin/index.astro` | 内容规模、热门标签、字数、最近条目与写作活动 |
| 主题 | `/admin/theme/` | `src/pages/admin/theme/index.astro` | 七组设置、检查、保存与只读诊断 |
| 写作 | `/admin/content/`、`/admin/content/<集合>/_edit/<条目 ID>/` | `src/pages/admin/content/index.astro`、`src/pages/admin/content/[collection]/[edit]/[...entryId].astro` | 内容列表、筛选与条目编辑 |
| 资源 | `/admin/resources/` | `src/pages/admin/resources/index.astro` | 图片与附件的浏览、上传、批量操作与引用状态 |
| 快照 | `/admin/data/` | `src/pages/admin/data/index.astro` | 设置快照的导出、校验与导入 |

- `/admin/images` 由 `astro.config.mjs` 的 `redirects` 指向 `${base}admin/resources/`；生产构建生成重定向占位页。
- 概览在开发环境把草稿计入最近条目；生产环境按 `site.json` 的 `adminOverview.publicVisible` 显示公开概览或 `hiddenMessage`。
- 后台统一由 `src/components/admin/AdminLayout.astro` 输出 `noindex,nofollow`；`showNav={isDev}` 控制后台导航只在开发环境渲染。
- 资源页是单页工作区，实现是 `src/scripts/admin-resources/index.ts` 一套脚本，根节点标记为 `data-admin-resources-root`。
- 后台没有独立的图片浏览器、媒体控制台或附件控制台。

## 七组设置与写入文件

主题页把设置分成七组，服务端只写入 `src/data/settings/` 的五个文件；`SETTINGS_RELATIVE_PATHS` 固定了文件映射（`src/lib/theme-settings.ts:558`）。

| 分组 | 写入文件 | 主要字段 |
| --- | --- | --- |
| 站点设置 | `site.json` | 标题、描述、语言、时区、页脚、备案、后台概览、社交链接、站点图标、窄屏标题宽度、页面外缘间隙、浮动按钮右侧距离 |
| 侧栏设置 | `shell.json`、`ui.json` 的 `layout.sidebarDivider` 与 `sidebarActions` | 侧栏站点名、窄屏标题、引语、导航标签与顺序、分隔线、订阅与主题按钮、后台入口按钮 |
| 首页设置 | `home.json` | 头图开关与图片、替代文本、导语与补充文案、更多入口与链接 |
| 内页设置 | `page.json`、`ui.json` 的 `articleMeta`、`cardDateDisplay`、`viewStats`、`floatStack`、`readingMode` | 各页面标题与副标题、归档版本模式、列表订阅开关、动态默认作者、文章元信息、卡片日期、浏览数据、浮动按钮、分页 |
| 条目版本 | `ui.json` 的 `entryVersionName` | 版本名称隐藏、放在版本号前或版本号后 |
| 代码显示 | `ui.json` 的 `codeBlock` | 代码块行号 |
| 排版字体 | `ui.json` 的 `typography`、`fontCoverage` | readable、copy、mono、brand 四个字体用途；覆盖策略 `full` 或 `common` |

- 服务端校验在 `src/lib/admin-console/theme-shared.ts`：字段类型、长度、范围、URL 与图标路径限制集中在这里。
- 客户端表单编码在 `src/scripts/admin-console/form-codec.ts`：它把 DOM 输入归一化成设置快照，归一化函数直接从 `theme-shared.ts` 导入，两侧行为一致。
- 改归一化规则只改 `theme-shared.ts`；`form-codec.ts` 只负责 DOM 读写与调用顺序。

- 归档版本模式 `all` 同时影响归档里的博客系列与项目版本文档，`latest` 只显示最新版；不影响项目弹窗与文章页的版本导航。
- 站点图标上传在 `src/lib/admin-console/site-assets.ts`：仅 `png`、`appleTouchIcon` 两个位置，接受 PNG，≤256KB，写入 `public/images/site/`，文件名带尺寸与内容哈希。
- SVG 图标需手工放 `public/` 并在 `site.json` 的 `favicon.svg` 指定；保存前会校验本地文件存在。
- 分页按首页、博客、动态、开发日志、归档分别开关，条数范围 1–100。

## 检查、保存与冲突

- `GET /api/admin/settings`（`src/pages/api/admin/settings.ts`）返回 `getEditableThemeSettingsState()`：正常为 `{ ok: true, payload: { revision, settings, sources } }`，读取失败为 `ok: false` 并带 diagnostics。
- `POST /api/admin/settings` 先过 `validateAdminJsonWriteRequest`：要求 `application/json` 且同源（`Origin` 或 `Referer`），否则返回 415 或 403。
- `?dryRun=1|true` 只做校验与差异计算，返回按文件组划分的 `results`，不写文件。
- 正式保存必须带 `revision` 与完整 canonical `settings` 快照；`revision` 是五个设置文件的可编辑快照哈希。
- 服务端在 `withAdminSettingsWriteLock` 内重读配置并比对 `revision`，不一致返回 409 和最新 `payload`。
- 只写发生变化的文件组。`persistAdminFileTransaction` 先写临时文件，把原文件改名为备份，再把临时文件改名到目标位置；任一步失败按逆序回滚。
- 成功后 `resetThemeSettingsCache()` 并重读；写入成功但重读失败返回 500。
- 客户端 `src/scripts/admin-console/controller.ts` 处理 409：保留草稿并提示，`重置更改` 回到最新快照，`重新检测` 重新读取配置与 `revision`。
- `src/scripts/admin-console/invalid-settings-banner.ts` 负责只读诊断展示；设置保存与 `site-assets` 上传共用 `withAdminSettingsWriteLock`。

## 写作

集合能力表在 `src/lib/admin-console/content-collections.ts`，条目契约在 `src/lib/admin-console/content-entry-contract.ts`；页面与接口都以能力表为准。

| 集合 | 新建 | 删除 | 草稿状态 | 正文图片上传 | 图片选择器 | 导出 |
| --- | --- | --- | --- | --- | --- | --- |
| `blog` | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| `projects` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `bits` | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ |
| `devlog` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `about` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

- 新建、编辑、删除、新建版本与批量操作都走内容写锁 `withAdminContentWriteLock`；新建、上传、导入不需要 `revision`，编辑与删除需要。
- 条目 ID：`blog`、`projects`、`devlog` 在 `ContentListActions.svelte` 按标题与日期生成 `YYYY-MM-DD-title`，`devlog` 填了 `projectSlug` 时加项目前缀；`bits` 在 `src/lib/admin-console/content-create.ts` 生成 `bits-YYYY-MM-DD-HHmm`。
- `blog` 的「新建版本」在 `src/lib/admin-console/content-create-version.ts`：复制系列最新版条目目录，重写 `date`、`versionOrder`、`versionLabel`（默认 `vN`）、`versionName`，标记 `draft: true` 并删除 `publishedAt`、`updatedAt`。
- 删除把条目目录移到 `.trash/content/<时间戳>/`（`src/lib/admin-console/content-delete.ts:94`）；批量删除最多 200 条（`src/lib/admin-console/content-bulk.ts:4`）；列表每页 20 条（`src/lib/admin-console/content-routes.ts:22`）。
- 列表正文搜索只在选中单个集合时生效，全部内容范围只匹配元信息。
- 列表分组在 `src/lib/admin-console/content-series.ts`：`blog` 按 `series`，`projects` 按稳定 `projectSlug`；总览截断与分页窗口会把同组版本完整并入。
- 保存 `blog` 正文时，`src/lib/admin-console/content-write-plan.ts` 用 `findMissingMarkdownBodyLocalImageReferences` 拒绝不存在的本地图片。
- 编辑器插入项在 `src/components/admin/editor/markdown/markdown-tools.ts` 与 `src/components/admin/editor/markdown/insert-tools.ts`；预览接口是 `POST /api/admin/preview`。

## 资源

- `src/lib/admin-console/media-index.ts` 扫描 `content/` 条目目录与 `public/images/`，组织成集合 → 系列 → 版本或条目 → 目录树；`content/<集合>/_shared/` 标记为共享资源。
- 引用状态：引用数大于 0 为 `referenced`，条目仍存在为 `unreferenced`，条目不存在为 `orphan`（`src/lib/admin-console/media-index.ts:441`）。
- 上传：图片落当前条目的 `images/`，附件落 `files/`，共享资源落 `content/<集合>/_shared/`；文件名规范化，重名追加序号（`src/lib/admin-console/image-upload.ts`）。
- 批量重命名、移动、删除与引用改写走 `src/lib/admin-console/media-batch.ts`，单次最多 100 个文件（`:310`）；移动与改名会同步改写 `content/` 中的引用。
- 条目 ZIP 导入导出在 `src/lib/admin-console/content-archive.ts`，只写入 `content/<集合>/<条目>/`，拒绝 `..`、绝对路径与覆盖已有条目。
- 云端图片：设置 `ASTRO_WHONO_IMAGE_STORAGE=s3` 与 `ASTRO_WHONO_S3_BUCKET`、`ASTRO_WHONO_S3_REGION`、`ASTRO_WHONO_S3_ACCESS_KEY_ID`、`ASTRO_WHONO_S3_SECRET_ACCESS_KEY`（可选 `ASTRO_WHONO_S3_ENDPOINT`、`ASTRO_WHONO_S3_FORCE_PATH_STYLE`、`ASTRO_WHONO_S3_PUBLIC_BASE_URL`、`ASTRO_WHONO_S3_PREFIX`）后，上传进入云端，列表并入云端项。
- 未配置对象存储时只用本地文件（`src/lib/admin-console/image-cloud-storage.ts`）。

## 快照

`src/lib/admin-console/settings-data.ts` 定义 `settings` 快照格式：

- manifest 字段：`schemaVersion`（当前 1）、`createdAt`、`includedScopes: ['settings']`、`excludes: ['content', 'images', '.local', 'private-files', 'credentials']`、`locale`。
- 导出：`GET /api/admin/data/settings`，以附件下载，文件名 `astro-whono-settings-<时间>.json`。
- 导入：解析并校验 manifest 后，用设置接口的 dry-run 展示会变化的设置分组，确认后按设置接口规则写入；设置损坏时快照页同样只读。
- 快照不含内容、图片与凭据，不是整站备份。

## API 分组与写入规则

| 前缀 | 文件 | 说明 |
| --- | --- | --- |
| `/api/admin/settings` | `settings.ts` | 设置读取、检查（dry-run）与保存 |
| `/api/admin/data/settings` | `data/settings.ts` | 设置快照导出 |
| `/api/admin/content/*` | `content/` | 条目读取、新建、编辑、删除、新建版本、导入导出与批量操作 |
| `/api/admin/content/files/*` | `content/files/` | 条目图片与附件上传、列表 |
| `/api/admin/images/*` | `images/` | 图片列表、元信息、改名与上传 |
| `/api/admin/media/*` | `media/` | 统一媒体列表、批量操作与文本预览 |
| `/api/admin/preview` | `preview/index.ts` | Markdown 预览渲染 |
| `/api/admin/site-assets/upload` | `site-assets/upload.ts` | 站点图标上传 |

路径常量集中在 `src/lib/admin-console/admin-api-paths.ts`。

- 所有写接口校验同源 `Origin` 或 `Referer`；JSON 用 `application/json`，上传用 `multipart/form-data`。
- 需要 `revision`：设置保存、内容编辑、单条删除（另需 `expectedRelativePath`）、批量删除（逐条带 `revision` 与 `expectedRelativePath`）。
- 写队列由 `createAdminWriteQueue()`（`src/lib/admin-console/admin-api.ts:192`）建立，按用途串行：内容写锁、设置与站点图标锁、图片上传、附件上传、条目导入、媒体批处理各自独立。
- 返回 409 的情形：`revision` 不一致、文件在外部被修改、`expectedRelativePath` 不匹配；服务端不覆盖现有文件。
- 内容编辑在写锁内二次比对最新 `revision`（`src/pages/api/admin/content/entry.ts:319`）。

## 生产边界

- 开发用 `server`、生产构建用 `static`（`astro.config.mjs` 的 `isProductionBuild`）。
- 生产构建的后台页面不输出写入根节点、Bootstrap 数据与后台导航，并带 `noindex,nofollow`。
- `/api/admin/*` 在 `import.meta.env.DEV` 为假时只生成 404 占位页，不返回 JSON；`/admin/images` 生成重定向占位页。
- `npm run check:prod-artifacts` 断言这些边界（页面壳、接口占位、导航、sitemap 不含后台、DEV 专用界面偏好资源），静态壳判定在 `scripts/smoke-utils.mjs`。
- 界面偏好（顶部导航、侧栏导航模式、编辑器布局、大纲状态）存在浏览器 localStorage，键在 `src/lib/admin-console/ui-prefs-keys.ts`，不写入仓库。
- 开发侧边界检查：`npm run check:admin-content-source-boundary`、`npm run check:admin-editor-emoji-boundary`，两者都在 `npm run check` 链内。

## 相关命令

```bash
npm run dev
npm run check:prod-artifacts
npm run verify
```

后台测试集中在 `tests/admin-*.test.ts` 与 `tests/entry-version-admin.test.ts`，运行 `npm test`。设置解析与读取诊断见 [architecture.md](architecture.md#设置解析)。
