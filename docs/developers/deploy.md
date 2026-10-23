# 部署

## 范围

本篇覆盖：产物与运行模式、`main` / `demo` 分支模型、四个工作流、构建期环境变量、GitHub Pages 与 base 推导、`check:subpath`、其他托管、部署前核对。前置：仓库能构建，后台边界见 [admin.md](admin.md)。

## 产物与运行模式

- `astro build` 在 `NODE_ENV=production` 下运行，`astro.config.mjs` 的 `isProductionBuild` 据此把 `output` 切成 `static`；开发时是 `server`。
- 构建前置：`prebuild` 执行 `scripts/favicon.mjs` 生成图标；`predev` 同样执行。
- 产物只包含公开页面、RSS、sitemap 与静态资源；后台页面是只读壳，`/api/admin/*` 生成 404 占位。
- `public/` 的内容原样复制进 `dist/`，包括 `_headers`、图标与字体目录；`dist/` 的目录结构不随 base 嵌套。
- `SITE_URL` 为空时 sitemap 集成不注册，`dist/sitemap-*.xml` 不会生成，`robots.txt` 也不写 Sitemap 行。
- `dist/` 是纯静态产物，构建读取 `content/` 与 `src/data/settings/`，不需要数据库。

| 产物路径 | 来源 |
| --- | --- |
| `dist/index.html`、`dist/blog/`、`dist/projects/`、`dist/bits/`、`dist/devlog/`、`dist/archive/`、`dist/about/` | 页面路由渲染 |
| `dist/blog/index.json`、`dist/bits/index.json`、`dist/archive/index.json` | 浏览器端筛选与计数数据 |
| `dist/rss.xml`、`dist/blog/rss.xml` | RSS 路由 |
| `dist/sitemap-index.xml`、`dist/sitemap-*.xml` | `SITE_URL` 非空时由 sitemap 集成生成 |
| `dist/content-assets/` | `astro:build:done` 复制的被引用附件 |
| `dist/admin/`、`dist/api/admin/` | 只读壳与 404 占位 |

## 分支模型

| 分支 | 内容 | 用途 |
| --- | --- | --- |
| `main` | 主题代码、默认设置、模板示例条目与文档 | 模板来源，主题更新从它发出 |
| `demo` | 完整示例内容、示例设置与页面截图 | 部署到 GitHub Pages |

- `pages.yml` 只监听 `demo` 推送，向 `main` 推送不触发部署。
- 同步方向固定为 `main` → `demo`：在 `demo` 检出后执行 `npm run theme:update -- --include-fonts`。
- 反向合并会把示例内容与测试快照带回模板分支，不要这样做。
- 字体属于站点自有路径，同步时需要 `--include-fonts`；合并后还要在 `demo` 执行 `npm run font:build` 重新生成字体资产。
- `theme.json` 记录主题来源 `repository`、`branch` 与 `commit`，`commit` 停在最近一次同步或发布点；语义见 [release.md](release.md#themejson-基准) 与 [provenance.md](provenance.md)。

## 四个工作流

| 工作流 | 触发 | 主要步骤 | 权限 |
| --- | --- | --- | --- |
| `ci.yml` | 向 `main`、`demo` 推送或提 PR | 解析 Node、`npm ci`、`npm run ci`（等价 `npm run verify`）、`check:subpath` | `contents: read` |
| `pages.yml` | 向 `demo` 推送、手动触发 | 解析 Node、`npm ci`、`npm run build`、`check-deployment-base`、上传并部署 `dist/` | `contents: read`、`pages: write`、`id-token: write` |
| `release-please.yml` | 仅手动触发 | `googleapis/release-please-action@v4` 维护发布 PR 与 `CHANGELOG.md` | `contents: write`、`pull-requests: write` |
| `release.yml` | 仅手动触发，需要 `tag` 输入 | 校验标签与版本、确认 Release 存在、`git archive` 打包、生成 `SHA256SUMS`、上传附件 | `contents: write` |

- 工作流文件都在 `.github/workflows/`：`ci.yml`、`pages.yml`、`release-please.yml`、`release.yml`。
- `ci.yml` 与 `pages.yml` 的可变值都提到文件顶部的 `env:`，改配置只看开头几行。
- `ci.yml` 的 `SITE_URL` 是固定字面量 `https://planetarium1001.github.io`；`npm run ci` 包含构建，因此必须提供非空 `SITE_URL`。
- `ci.yml` 不设置 `ASTRO_VERSICARIUM_BASE_PATH`，产物按根路径构建；子路径由 `pages.yml` 的 `BASE_PATH` 覆盖。
- `pages.yml` 的 `checkout` 不指定 `ref`，部署触发本次运行的分支；本仓库的触发分支是 `demo`。
- `pages.yml` 的 build 与 deploy 是两个 job；部署 job 使用 `github-pages` 环境与 `actions/deploy-pages@v4`，并发组 `pages`、`cancel-in-progress: true`。
- `pages.yml` 不跑 `verify`，静态校验由 `ci.yml` 负责；构建后额外跑一次 `node ./scripts/check-deployment-base.mjs` 扫描产物。
- 两个发布工作流只接受手动触发：`release-please.yml` 用 `workflow_dispatch`，`release.yml` 用带 `tag` 输入的 `workflow_dispatch`。
- `release.yml` 的 `RELEASE_TAG` 来自 `inputs.tag`，`VERSION` 取自 `package.json.version`，标签去掉 `v` 后必须与 `VERSION` 相同。
- `release.yml` 在上传前用 `gh release view` 确认 Release 已存在，缺失时给出可读错误并退出，不上传任何文件。
- `release.yml` 只打包已跟踪文件（`git archive ... HEAD`），不含 `node_modules`、`dist` 或本地缓存；`docs/images/` 下的截图已跟踪，会随包分发。
- 从模板复制出的站点要改两处：`ci.yml` 的 `on` 分支列表与 `env.SITE_URL`，`pages.yml` 的 `on` 分支与 `env` 的 `SITE_URL`、`BASE_PATH`。

## 构建期环境变量

| 变量 | 作用 | 未设置或为空时 |
| --- | --- | --- |
| `SITE_URL` | 站点地址，用于 RSS、canonical、`og:url`、分享图与 sitemap | 回退 `https://example.invalid`，生产模式打印一次警告；canonical 与 `og:image` 不输出、sitemap 不注册、`check:prod-artifacts` 失败 |
| `ASTRO_VERSICARIUM_BASE_PATH` | 部署子路径，作为 Astro 的 `base` | `/`；非空值规范成 `/segment/` |
| `SITE_TIMEZONE` | IANA 时区，服务端覆盖 `site.json` 的 `timezone` | 读 `site.json`，再回退 `Asia/Shanghai`；非法值让构建直接报错 |

- `SITE_URL` 只写 origin，子路径交给 `ASTRO_VERSICARIUM_BASE_PATH`；`site.config.mjs` 会 trim 并去掉尾随斜杠。
- `SITE_URL` 带路径时行为不一致：`robots.txt` 拼接时保留路径段，canonical 用 `new URL(路径, Astro.site)` 会丢掉 origin 之外的路径；约定只写 origin。
- `ASTRO_VERSICARIUM_BASE_PATH` 出现 `:` 或空白时 `astro.config.mjs` 在配置期直接抛错（Git Bash 的 MSYS 路径转换常触发），命令前加 `MSYS_NO_PATHCONV=1` 规避。
- 构建期会把 `site.json` 的时区快照注入浏览器端（`import.meta.env.ASTRO_WHONO_SITE_TIMEZONE`）；开发时改字体或时区需要重启。
- Node 版本：`.nvmrc` 为 `24.22.1`（建议值），`package.json` 的 `engines.node` 为 `>=22.12.0`（实际要求）；工作流读 `.nvmrc`，缺失时退回 `24`。

## GitHub Pages 与 base 配置

`pages.yml` 的 `env` 直接给出两个值，不做动态推导：

- `SITE_URL` 是站点 origin，只写协议与域名。
- `BASE_PATH` 是子目录前缀，构建时以 `ASTRO_VERSICARIUM_BASE_PATH` 传入。

- 本仓库对应 `https://planetarium1001.github.io` 与 `/astro-versicarium/`。
- 用户主页仓库（`<owner>.github.io`）与自定义域名把 `BASE_PATH` 写成 `/`。
- 动态推导会随仓库改名漂移，显式配置更易读也更容易改。
- `dist/` 的目录结构不随 base 嵌套，base 只影响产物内的 URL；`trailingSlash: 'always'` 与 `redirects` 目标都按 base 生成。
- GitHub Pages 不读取 `public/_headers`，长缓存规则在该宿主上不生效。
- 仓库 Pages 的发布源要选 GitHub Actions，不能选 Deploy from a branch；`pages.yml` 用 `actions/upload-pages-artifact@v3` 上传、`actions/deploy-pages@v4` 发布。
- 部署 job 使用 `github-pages` 环境；该环境若配置了部署分支限制，需要放行触发分支。
- 绑定自定义域名后，把 `SITE_URL` 改成域名、`BASE_PATH` 改成 `/`。

## check:subpath

- `npm run check:subpath` 运行 `scripts/verify-subpath-build.mjs`：以 `package.json` 的 `homepage` 推导子路径，真实构建一次 `dist/`，再调用 `checkDeploymentBase()` 扫描。
- 默认 `SUBPATH_BASE` 取 `homepage` 的 pathname，`SITE_URL` 取 `homepage` 的 origin；可用 `ASTRO_VERSICARIUM_BASE_PATH` 与 `SITE_URL` 覆盖。
- 它抓的是 `createWithBase()` 一类「部署 base 被拼两次」的回归，这类问题只在 base 非 `/` 时出现，CI 的根路径构建抓不到。
- `check:subpath` 不在 `verify` 内，只在 CI 与手动运行时执行。
- `scripts/check-deployment-base.mjs` 同时被 `pages.yml` 与单测 `tests/deployment-base-check.test.ts` 使用。

## 其他托管

- `netlify.toml` 指定 `command = "npm run build"` 与 `publish = "dist"`。
- Cloudflare Pages 等静态平台配置相同的构建命令与产物目录，并在构建环境设置 `SITE_URL`，子目录部署时再设 `ASTRO_VERSICARIUM_BASE_PATH`。
- 自建 nginx 把站点根目录指向 `dist/`；`public/_headers` 只对 Netlify、Cloudflare Pages 等读取该文件的宿主生效，nginx 需要另行配置等价规则。
- `public/_headers` 除安全头外，还为 `/_astro/*`、`/fonts/base/*`、`/fonts/dlc/*` 声明一年 immutable 缓存；GitHub Pages 与自建 nginx 都不读取它。
- 构建环境需要 Node 22.12+ 与 `npm ci` 依赖；字体目录体积较大，注意托管平台的单文件与总量限制。

## 本地验证

```bash
SITE_URL=https://example.com npm run verify
SITE_URL=https://example.com ASTRO_VERSICARIUM_BASE_PATH=/blog/ npm run build
npm run preview
npm run check:subpath
```

- `verify` 九步顺序见 [development.md](development.md#verify-的九个步骤)；`check:prod-artifacts` 断言 `SITE_URL` 非空。
- 验证子路径时同时设置 `ASTRO_VERSICARIUM_BASE_PATH`，`npm run preview` 用同一个 base 提供 `dist/`。
- `npm run check:markdown-smoke` 读取已构建的 `dist/`，用于抽查 Markdown 渲染。

## 部署前核对

- 构建完成后确认 `dist/index.html`、`dist/sitemap-index.xml`（设置了 `SITE_URL` 时）和 `dist/admin/index.html` 存在。
- `dist/admin/*` 页面不应包含写入根节点、Bootstrap 数据或后台导航；`dist/api/admin/*` 应是 404 占位而不是 JSON 接口。
- 子目录部署时抽查产物里的站内链接与 `dist/sitemap-index.xml`，确认都带 base 前缀。
- 子目录部署可运行 `npm run check:subpath`，确认产物无重复 base、本地 URL 全部可解析。
- `dist/` 里的字体文件较大，上传托管平台时不要漏传；平台有单文件或总量限制时先检查字体体积。

常见失败：Git Bash 下 base 被改写成文件路径时加 `MSYS_NO_PATHCONV=1`；`check:prod-artifacts` 失败时先确认 `SITE_URL` 是带协议的完整地址；GitHub Pages 没更新时确认推送的是 `demo` 且 Pages Source 是 GitHub Actions。
