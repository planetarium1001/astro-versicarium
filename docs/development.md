# 开发

## 环境

需要 Node.js 22.12.0 或更高版本与 npm。`.nvmrc` 固定当前基线 22.22.0，`package.json` 的 `engines` 给出最低版本，CI 优先读取 `.nvmrc`。依赖锁定在 `package-lock.json`，安装用 `npm ci`。

## 命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器，后台与 `/api/admin/*` 可用 |
| `npm run dev:clean` | 删除 `node_modules/.vite` 后启动 |
| `npm run build` | 构建静态产物到 `dist/` |
| `npm run preview` | 预览构建产物 |
| `npm run check` | `astro check`、Svelte 编译与源码守卫 |
| `npm test` | Vitest 用例 |
| `npm run verify` | check、build、字体覆盖检查、fixture 刷新、测试与产物守卫 |
| `npm run ci` | 等价于 `verify`，CI 使用 |
| `npm run new:bit` | 生成一条动态草稿 |
| `npm run theme:update` | 同步主题更新；`-- --check` 只报告，`-- --include-fonts` 连同字体资产 |
| `npm run font:fetch` | 按清单从多个镜像下载源字体到 `tools/fonts-src/` 并校验 SHA-256；源字体不入库 |
| `npm run font:charset` | 重算正文基础字符集 |
| `npm run font:roles` | 从 `dist/**/*.html` 提取 text、display、meta、brand 角色字符集 |
| `npm run font:subset` | 生成 base/DLC WOFF2、CSS 与 `tools/font-manifest.json` |
| `npm run font:build` | 编排 fetch → charset → build → roles → subset → 最终 build |
| `npm run font:check` | 校验清单、文件哈希、base/DLC 范围互斥与常用字覆盖 |
| `npm run font:coverage` | 构建后检查页面字符覆盖；`-- --strict` 把管线漏覆盖视为失败 |
| `npm run font:report` | 输出各页面首屏字体预算与 DLC 增量 |
| `npm run check:markdown-smoke` | 在 `dist/` 上检查 Markdown 渲染契约 |
| `npm run check:image-references` | 检查 Markdown、HTML、frontmatter 与设置中的本地图片引用 |
| `npm run smoke:cloud-images` | 云端图片冒烟，需显式开启并配置凭据 |

## 验证流水线

`verify` 按顺序执行：

1. `npm run check`，其中包含 `font:check`
2. `npm run build`
3. `npm run font:coverage -- --strict`
4. `npm run test:fixtures`
5. `npm run test`
6. `npm run check:prod-artifacts`
7. `npm run check:layout-geometry`
8. `npm run check:touch-targets`
9. `npm run check:viewport-overflow`

源码守卫只读源文件或设置 JSON；产物守卫读 `dist/`，必须在构建后执行。`SITE_URL` 为空时 sitemap 不生成，`check:prod-artifacts` 会失败。本地只预览页面可以省略 `SITE_URL`，执行 `verify` 与 CI 时必须提供。

## 源码守卫

`npm run check` 依次包含：

| 检查 | 内容 |
| --- | --- |
| `astro check` | Astro 页面、TypeScript 与模板诊断 |
| `check:svelte` | 编译全部 `.svelte`；后台编辑器岛只在开发环境挂载，构建不会覆盖 |
| `check:admin-content-source-boundary` | 后台内容模块不越界引用公开内容模块或服务端专用索引 |
| `check:home-critical-css` | 首页 critical CSS 快照与 `global.css`、`layout.css` 未漂移 |
| `check:image-references` | Markdown、HTML `src`/`srcset`、frontmatter 与设置中的本地图片可解析 |
| `check:font-charset` | `tools/charset-common.txt` 与实际文本一致，字体子集指纹未过期 |

按需执行的检查：

| 检查 | 用途 |
| --- | --- |
| `check:markdown-smoke` | 渲染 `src/test-fixtures/markdown-smoke.md`，断言代码工具栏、公式与样式表输出；需要已构建的 `dist/` |
| `check:admin-editor-emoji-boundary` | 编辑器工具栏与 emoji 选择器的引用边界 |
| `smoke:cloud-images` | 对象存储上传与列举；未设置 `ASTRO_WHONO_CLOUD_SMOKE=1` 时跳过 |
| `audit:prod` | 生产依赖的已知漏洞扫描 |

## 产物守卫

| 检查 | 内容 |
| --- | --- |
| `check:prod-artifacts` | 必需文件、后台只读壳、无后台导航与开发偏好资源、RSS / sitemap / robots 内容 |
| `check:layout-geometry` | 解析产物 CSS 与 `<html>` 内联属性，断言侧栏、外缘间隙、浮动列与目录把手几何 |
| `check:touch-targets` | 按规则顺序取最终生效尺寸，断言交互元素不小于 44px |
| `check:viewport-overflow` | 读产物 CSS 与首页快照，断言滚动条槽位仅桌面生效、clip 回退、窄屏 body 兜底、壳层宽度上限与提示锚点 |

后台只读壳的判定包括：产物中不出现后台写入根节点、bootstrap 数据、后台导航或开发专用 UI 偏好资源，`/admin/` 带 `noindex,nofollow`。改动后台页面或样式后需要重新构建并执行这些检查。

## fixture

`tests/fixtures/` 是从 `dist/` 复制出的页面快照，包含：

- `/bits/`、`/blog/`、`/archive/`、`/devlog/`、`/projects/` 的 HTML；
- `/bits/index.json`、`/blog/index.json`、`/archive/index.json`；
- 构建产物中字典序第一篇文章的详情页 HTML。

客户端用例依赖真实渲染后的 `data-*` 属性、内联 JSON 与脚本加载顺序，这些只在构建产物中完整。`npm run test:fixtures` 负责刷新，已包含在 `verify` 中；改动列表页或文章页的服务端输出结构后，需要重新生成并提交快照。

## 字体

自托管字体按「角色 × 字符层」分片，源文件与生成物分开存放：

- `tools/font-sources.json`：源字体清单，记录路径、SHA-256、版本、下载地址与是否可变字体。源字体下载到 `tools/fonts-src/`，该目录不入库。
- `tools/charset-base.txt`：3500 常用字基线；`tools/charset-common.txt`：正文基础字符集；`tools/charset-roles.json`：从构建产物提取的 text、display、meta、brand 角色字符集；`tools/charset-frequency.txt`：字频排序。
- `public/fonts/base/`：基础分片，分为 core、mid、display、meta、latin，由基础 CSS 声明。
- `public/fonts/dlc/`：生僻字 DLC 分片，目标每片 180 KB，实测单片最大约 234 KB。只在 `full` 覆盖模式下声明，浏览器按 `unicode-range` 按需下载。
- `src/styles/fonts.generated.css`、`src/styles/fonts.dlc.generated.css`：由清单生成，不要手改。
- `tools/font-manifest.json`：face、字节、范围、字体归属与预算，供 CSS、后台与检查脚本共用。

生成流程：

```bash
python -m pip install fonttools brotli zopfli
npm run font:build
```

`font:build` 依次执行 `font:fetch` → `font:charset` → `npm run build` → `font:roles` → `font:subset` → 最终 `npm run build`。`dist` 是角色字符集的唯一来源，所以 roles 之前必须有一次完整构建；subset 改写生成 CSS 后再构建一次，让页面引用最新样式。`font:fetch` 命中本地缓存时不联网，`--offline` 强制离线，`--force` 重新下载；`font:build` 支持 `--skip-fetch`、`--skip-build`、`--skip-final-build`，供调试单步时使用。

修改内容或字体选择后重新运行，并提交 `public/fonts/`、生成的 CSS、`tools/charset-*` 与 `tools/font-manifest.json`。维护者提交字体资产，CI 不运行 `font:build`。

覆盖策略由 `src/data/settings/ui.json` 的 `fontCoverage` 控制：

- `full`：默认。加载 base 与 DLC CSS，生僻字按 `unicode-range` 自动下载。
- `common`：只加载 base CSS，生僻字回退系统字体，不请求 DLC。

当前资产规模（2026-10-21 生成）：base 34 个 face、约 2.21 MB，DLC 121 个 face、约 20.48 MB，合计约 22.69 MB（155 个 WOFF2）。旧版 9 个字体文件合计约 5.2 MB，替换后仓库净增约 17.5 MB。`font:report` 在当前构建的 20 个页面上给出常用页首屏 p50 305.6 KB、p90 319.6 KB；`font:check` 按清单给出的保守一页估算为 333.0 KB，用作预算上限。当前内容没有触发 DLC 的页面，单块 DLC 最大约 234 KB。

体积口径：

- 主题仓库与 `dist`：`public/fonts/` 含全部 base 与 DLC，约 22.69 MB。Astro 把 `public/` 全量复制进 `dist/`，部署目录包含全部字体。
- 单页请求：`font:report` 的 305.6 KB 是常用页实际命中的分片之和，不是构建产物大小。`full` 模式下 DLC CSS 异步加载，字体只在 `unicode-range` 命中时下载。
- 后台「基础分片合计」：某个字体在正文、引用、品牌等用途下所有 base 分片之和，例如 readable 的 core、mid、display 与 latin 全部相加。它不是单页下载量，单页预算以 `font:report` 为准。
- 当前选择：默认 typography 为 readable=Noto Serif、copy=WenKai，对应 DLC 约 16.5 MB；仓库还包含未选中的 Noto Sans SC DLC，因此全部 DLC 为 20.48 MB。

源字体不入库。`public/fonts/` 下保留各字体的 OFL 许可证文件，随子集资产一起分发。用途选择器集中在 `scripts/font/role-selectors.mjs`；新增 600 字重或 `--font-copy` 场景时同步更新该文件与对应 CSS，避免预算失真。

源字体自身的覆盖不完整：Noto Serif SC 的子集可变字体不含 Ext B 区，WenKai Lite 也只覆盖部分扩展区字形。使用这些字体时，缺失的字回退系统字体。`npm run font:coverage` 会区分「源字体本来没有」与「管线漏覆盖」，`--strict` 只把后者视为失败。

Astro Fonts API 只保留拉丁等宽字体（JetBrains Mono、Fira Code）的构建期下载。Noto Sans SC 已迁入自托管分层管线，不再下载 fontsource 的整段中文文件。修改字体选择后需重启开发服务器；覆盖策略在开发模式下可即时预览，生产静态构建需重新构建部署。

## 测试组织

Vitest 配置在 `vitest.config.ts`，用例位于 `tests/*.test.ts`，默认 Node 环境；需要 DOM 的文件在首行声明 `// @vitest-environment jsdom`。

| 范围 | 文件 |
| --- | --- |
| 后台内容、图片、媒体与编辑器 | `tests/admin-content-*.test.ts`、`tests/admin-images-*.test.ts`、`tests/admin-editor-*.test.ts` |
| 前台列表、目录、筛选与弹窗 | `tests/*-client.test.ts`、`tests/projects-dialog-*.test.ts`、`tests/devlog-*.test.ts` |
| Markdown 与关于页指令 | `tests/markdown-*.test.ts`、`tests/about-directives.test.ts`、`tests/trailing-links.test.ts` |
| 设置、日期、路由与版本 | `tests/theme-settings.test.ts`、`tests/filings.test.ts`、`tests/view-stats.test.ts`、`tests/project-routing.test.ts`、`tests/blog-routing.test.ts` |
| 页面快照与 Markdown 夹具 | `tests/fixtures/`、`src/test-fixtures/` |

写入类用例通过 `tests/admin-content-write-fixture.ts` 在系统临时目录搭建内容目录，并把设置目录与项目根指向临时位置，结束后清理，不触碰仓库内容。

## 浏览器基线

- 样式层使用 `:has()`：项目卡与列表卡的键盘焦点背景依赖 `:has(:focus-visible)`；不支持的内核降级为没有整卡背景，但保留原生焦点提示。
- 触屏悬停：公开页面的悬停视觉以 `<html data-input>`（`src/scripts/input-modality.ts`）记录的输入模态为准。媒体查询不足以区分把指针上报成 `hover: hover` 的触屏设备。
- 主题切换涟漪使用 View Transitions，不支持或偏好减少动效时直接切换主题，不播放涟漪。
- 默认文本链接的悬停下划线只在非触屏模态出现，避免触屏点按后 `:hover` 粘住。
- 指针或触屏点按产生的 `:focus`（非 `:focus-visible`）不绘制浏览器默认焦点描边；部分内核会把点按判作 `:focus-visible`，因此触屏模态下作者样式同样关闭描边。按一次 Tab / Shift+Tab，或发生真实鼠标移动、点按后，键盘标记解除，设计焦点环恢复。悬停门禁仍以 `data-input` 为准。
- 不支持 `:focus-visible` 的内核会整条丢弃相关规则，保持原生焦点提示。

## 内容命名

内容条目的目录名即条目 ID，规范为 `YYYY-MM-DD-title`。构造入口是 `src/utils/slug-rules.ts` 的 `buildContentEntryId()`：

- 日期取站点时区的日历日期，与 frontmatter 的 `date` 对齐；
- 标题经 NFKC 归一化、转小写，空白与符号折叠为单个连字符，允许中文；
- 超过 120 个字符时截断并追加稳定短哈希；
- 标题段为空时回退 `untitled`，命中 Windows 保留设备名时追加 `-entry`。

博客默认公开路径使用完整条目 ID，例如 `/blog/2026-10-20-theme-quick-start/`；frontmatter 的 `slug` 可覆盖为更短的稳定路径。`npm run new:bit` 按 `bits-YYYY-MM-DD-HHMM` 生成动态草稿，日期时间带站点时区偏移。

## CI 与发布

`.github/workflows/ci.yml` 在推送到 `main`、`demo` 或向两者提交 PR 时运行：按 `.nvmrc` 安装 Node，执行 `npm ci`，再以 `SITE_URL=https://planetarium1001.github.io` 运行 `npm run ci`。

Release Please 在推送到 `main` 时运行，维护版本号、CHANGELOG 与 release PR；合并后创建标签与 GitHub Release。GitHub Release 发布后，`release.yml` 校验标签与版本一致，并打包模板附件。工作流细节见 [deployment.md](deployment.md)，版本与发布流程见 [release.md](release.md)。
