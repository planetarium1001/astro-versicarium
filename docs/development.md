# 开发

## 环境

需要 Node.js 22.12.0 或更高版本与 npm。`.nvmrc` 固定当前基线 22.22.0，`package.json` 的 `engines` 给出最低版本；CI 优先读取 `.nvmrc`。依赖锁定在 `package-lock.json`，安装使用 `npm ci`。

## 命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器，后台与 `/api/admin/*` 可用 |
| `npm run dev:clean` | 删除 `node_modules/.vite` 后启动 |
| `npm run build` | 构建静态产物到 `dist/` |
| `npm run preview` | 预览构建产物 |
| `npm run check` | `astro check`、Svelte 编译与源码类守卫 |
| `npm test` | Vitest 用例 |
| `npm run verify` | check、build、刷新 fixture、test 与产物类守卫 |
| `npm run ci` | 等价于 `verify`，CI 使用 |
| `npm run new:bit` | 生成一条动态草稿 |
| `npm run theme:update` | 同步主题更新；`-- --check` 只报告 |
| `npm run font:charset` | 重算字符集 |
| `npm run font:subset` | 依据字符集重建 WOFF2 子集 |
| `npm run font:build` | 依次执行字符集与子集 |
| `npm run check:markdown-smoke` | 在 `dist/` 上检查 Markdown 渲染契约 |
| `npm run smoke:cloud-images` | 云端图片冒烟，需显式开启与凭据 |

## 验证流水线

```bash
npm run check     # 源码与类型
npm test          # Vitest
npm run verify    # check → build → test:fixtures → test → 产物守卫
npm run ci        # 等价于 verify
```

`verify` 的实际顺序是：

1. `npm run check`
2. `npm run build`
3. `npm run test:fixtures`
4. `npm run test`
5. `npm run check:prod-artifacts`
6. `npm run check:layout-geometry`
7. `npm run check:touch-targets`

源码类守卫只读源文件或设置 JSON；产物类守卫读取 `dist/`，必须在构建后执行。`SITE_URL` 为空时 sitemap 不生成，`check:prod-artifacts` 会失败；本地只预览页面可以省略，执行 `verify` 与 CI 必须提供。

## 源码守卫

`npm run check` 依次包含：

| 检查 | 内容 |
| --- | --- |
| `astro check` | Astro 页面、TypeScript 与模板诊断 |
| `check:svelte` | 编译全部 `.svelte`；后台编辑器岛只在开发环境挂载，构建不会覆盖 |
| `check:admin-content-source-boundary` | 后台内容模块不越界引用公开内容模块或服务端专用索引 |
| `check:home-critical-css` | 首页 critical CSS 快照与 `global.css`、`layout.css` 未漂移 |
| `check:image-references` | Markdown、HTML `src`/`srcset`、frontmatter 与设置中的本地图片可解析 |
| `check:font-charset` | `tools/charset-common.txt` 与实际文本一致，且字体子集指纹未过期 |

另有按需执行的检查：

| 检查 | 用途 |
| --- | --- |
| `check:markdown-smoke` | 渲染 `src/test-fixtures/markdown-smoke.md`，断言代码工具栏、公式与样式表输出；需要已构建的 `dist/` |
| `check:admin-editor-emoji-boundary` | 编辑器工具栏与 emoji 选择器的引用边界 |
| `smoke:cloud-images` | 对象存储上传与列举；未设置 `ASTRO_WHONO_CLOUD_SMOKE=1` 时跳过 |
| `audit:prod` | 生产依赖的已知漏洞扫描 |

## 构建产物守卫

| 检查 | 内容 |
| --- | --- |
| `check:prod-artifacts` | 必需文件、后台只读壳、无后台导航与开发偏好资源、RSS / sitemap / robots 内容 |
| `check:layout-geometry` | 解析产物 CSS 与 `<html>` 内联属性，断言侧栏、外缘间隙、浮动列与目录把手几何 |
| `check:touch-targets` | 按规则顺序取最终生效尺寸，断言交互元素不小于 44px |

后台只读壳的判定包括：产物中不出现后台写入根节点、bootstrap 数据、后台导航或开发专用 UI 偏好资源；`/admin/` 带 `noindex,nofollow`。改动后台页面或样式后应重新构建并执行这些检查。

## fixture

`tests/fixtures/` 是从 `dist/` 复制出的页面快照，包含：

- `/bits/`、`/blog/`、`/archive/`、`/devlog/`、`/projects/` 的 HTML；
- `/bits/index.json`、`/blog/index.json`、`/archive/index.json`；
- 构建产物中字典序第一篇文章的详情页 HTML。

客户端用例依赖真实渲染后的 `data-*` 属性、内联 JSON 与脚本加载顺序，这些只在构建产物中完整。`npm run test:fixtures` 负责刷新，已包含在 `verify` 中；改动列表页或文章页的服务端输出结构后，需要重新生成并提交快照。

## 字体

未使用 Astro Fonts API 的字体由 `public/fonts/` 提供自托管 WOFF2 子集，`global.css` 以 `@font-face` 与 `unicode-range` 分段声明。

字符集由 `content/`、`src/pages/`、`src/components/`、`src/layouts/`、`src/data/settings/` 的文本、`site.config.mjs` 与 `tools/charset-base.txt` 汇总，写入 `tools/charset-common.txt`；不要手改该文件。`font:subset` 依赖 `pyftsubset`：

```bash
python -m pip install fonttools brotli zopfli
# 源字体放入 tools/fonts-src/，该目录不入库
npm run font:build
```

子集按 latin / cjk-common / cjk-ext 切分到 `public/fonts/`，成功后写入指纹 `tools/charset-common.sha256`。缺字时补充 `tools/charset-base.txt` 后重新生成。选择 `src/lib/fonts/registry.ts` 中的 Astro Fonts API 字体时，构建期只注册被选中的条目并下载自托管，不需要本地源字体；修改 `ui.json` 的字体选择后需重启开发服务器。

## 测试组织

Vitest 配置在 `vitest.config.ts`，用例位于 `tests/*.test.ts`，默认 Node 环境；需要 DOM 的文件在首行声明 `// @vitest-environment jsdom`。

| 范围 | 文件 |
| --- | --- |
| 后台内容、图片、媒体与编辑器 | `tests/admin-content-*.test.ts`、`tests/admin-images-*.test.ts`、`tests/admin-editor-*.test.ts` |
| 前台列表、目录、筛选与弹窗 | `tests/*-client.test.ts`、`tests/projects-dialog-*.test.ts`、`tests/devlog-*.test.ts` |
| Markdown 与关于页指令 | `tests/markdown-*.test.ts`、`tests/about-directives.test.ts`、`tests/trailing-links.test.ts` |
| 设置、日期、路由与版本 | `tests/theme-settings.test.ts`、`tests/filings.test.ts`、`tests/view-stats.test.ts`、`tests/project-routing.test.ts`、`tests/blog-routing.test.ts` |
| 页面快照与 Markdown 夹具 | `tests/fixtures/`、`src/test-fixtures/` |

写入类用例通过 `tests/admin-content-write-fixture.ts` 在系统临时目录搭建内容目录，并把设置目录与项目根指向临时位置，测试结束清理，不触碰仓库内容。

## 内容命名

内容条目的目录名即条目 ID，规范为 `YYYY-MM-DD-title`。构造入口是 `src/utils/slug-rules.ts` 的 `buildContentEntryId()`：

- 日期取站点时区的日历日期，与 frontmatter 的 `date` 对齐；
- 标题经 NFKC 归一化、转小写，空白与符号折叠为单个连字符，允许中文；
- 超过 120 个字符时截断并追加稳定短哈希；
- 标题段为空时回退 `untitled`，命中 Windows 保留设备名时追加 `-entry`。

博客默认公开路径使用完整条目 ID，例如 `/blog/2026-10-20-theme-quick-start/`；frontmatter 的 `slug` 可覆盖为更短的稳定路径。`npm run new:bit` 按 `bits-YYYY-MM-DD-HHMM` 生成动态草稿，日期时间带站点时区偏移。

## CI 与发布

`.github/workflows/ci.yml` 在推送到 `main`、`demo` 或向两者提交 PR 时运行：按 `.nvmrc` 安装 Node，执行 `npm ci`，再以 `SITE_URL=https://planetarium1001.github.io` 运行 `npm run ci`。

Release Please 在推送到 `main` 时运行，维护版本号、CHANGELOG、标签与 Release；GitHub Release 发布后再由 `release.yml` 校验标签与版本一致，并打包模板附件。工作流细节见 [deployment.md](deployment.md)，版本与发布流程见 [release.md](release.md)。
