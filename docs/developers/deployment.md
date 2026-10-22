# 部署

> 本页面向开发者，包含实现细节与命令。使用说明见[使用者版](../deployment.md)，全部开发者文档见[索引](README.md)。

`dist/` 是静态产物，构建读取 `content/` 与 `src/data/settings/`，不需要数据库。后台写入只在 `npm run dev` 下可用，生产构建不包含写入接口；后台边界见 [admin-console.md](admin-console.md)。

## 产物与运行模式

- `astro build` 在 `NODE_ENV=production` 下运行，`astro.config.mjs` 的 `isProductionBuild` 据此把 `output` 切成 `static`；开发时是 `server`。
- 构建前置：`prebuild` 执行 `scripts/favicon.mjs` 生成图标；`predev` 同样执行。
- 产物只包含公开页面、RSS、sitemap 与静态资源；后台页面是只读壳，`/api/admin/*` 生成 404 占位。
- `public/` 的内容原样复制进 `dist/`，包括 `_headers`、图标与字体目录；`dist/` 的目录结构不随 base 嵌套。
- `SITE_URL` 为空时 sitemap 集成不注册，`dist/sitemap-*.xml` 不会生成，`robots.txt` 也不写 Sitemap 行。

## 分支模型

| 分支 | 内容 | 用途 |
| --- | --- | --- |
| `main` | 主题代码、默认设置、模板示例条目与文档 | 模板来源，主题更新从它发出 |
| `demo` | 完整示例内容、示例设置与页面截图 | 部署到 GitHub Pages |

- `pages.yml` 固定 `ref: demo`，向 `main` 推送不触发部署。
- 同步方向固定为 `main` → `demo`：在 `demo` 检出后执行 `npm run theme:update -- --include-fonts`。反向合并会把示例内容与测试快照带回模板分支。
- 字体属于站点自有路径，同步时需要 `--include-fonts`；合并后还要在 `demo` 执行 `npm run font:build` 重新生成字体资产。
- `theme.json` 记录主题来源 `repository`、`branch` 与 `commit`，`commit` 停在最近一次同步或发布点；语义见 [release.md](release.md) 与 [upstream.md](upstream.md)。

## 四个工作流

| 工作流 | 触发 | 主要步骤 | 权限 |
| --- | --- | --- | --- |
| `ci.yml` | 向 `main`、`demo` 推送或提 PR | 解析 Node、`npm ci`、以固定 `SITE_URL` 运行 `npm run ci`（等价 `npm run verify`） | `contents: read` |
| `pages.yml` | 向 `demo` 推送、手动触发 | 检出 `demo`、`npm ci`、推导 `SITE_URL` 与 base、`npm run build`、上传并部署 `dist/` | `contents: read`、`pages: write`、`id-token: write` |
| `release-please.yml` | 向 `main` 推送 | `googleapis/release-please-action@v4` 维护版本 PR、版本号与 `CHANGELOG.md` | `contents: write`、`pull-requests: write` |
| `release.yml` | `release: published` | 校验标签与 `package.json` 版本、`git archive` 打包、生成 `SHA256SUMS`、上传 Release 附件 | `contents: write` |

- `ci.yml` 的 `SITE_URL` 固定为 `https://planetarium1001.github.io`；只给 owner 的 origin，项目页子路径由构建期 base 决定。
- `pages.yml` 的 build 与 deploy 是两个 job；部署 job 使用 `github-pages` 环境与 `actions/deploy-pages@v4`，并发组 `pages`、`cancel-in-progress: true`。
- `pages.yml` 的构建顺序：检出 `demo`、解析 Node、`npm ci`、写入 `SITE_URL` 与 `ASTRO_WHONO_BASE_PATH`、`npm run build`、`actions/upload-pages-artifact@v3` 上传 `dist`。它不跑 `verify`，校验由 `ci.yml` 负责。
- `ci.yml` 在 `main`、`demo` 的 push 与 PR 上都会运行；页面部署不依赖它通过，但发布前应保证两者都绿。
- `release.yml` 只打包已跟踪文件（`git archive ... HEAD`），不含 `node_modules`、`dist` 或本地缓存；`docs/images/` 下的截图已跟踪，会随包分发。标签与 `package.json` 版本不一致时工作流失败。
- `release.yml` 的产物命名、校验和与发布清单见 [release.md](release.md)。

## 构建期环境变量

| 变量 | 作用 | 未设置或为空时 |
| --- | --- | --- |
| `SITE_URL` | 站点地址，用于 RSS、canonical、`og:url`、分享图与 sitemap | 回退 `https://example.invalid`，生产模式打印一次警告；canonical 与 `og:image` 不输出、sitemap 不注册、`robots.txt` 不写 Sitemap 行、`check:prod-artifacts` 失败 |
| `ASTRO_WHONO_BASE_PATH` | 部署子路径，作为 Astro 的 `base` | `/`；非空值规范成 `/segment/` |
| `SITE_TIMEZONE` | IANA 时区，服务端覆盖 `site.json` 的 `timezone` | 读 `site.json`，再回退 `Asia/Shanghai`；非法值让构建直接报错 |

- `SITE_URL` 只写 origin，子路径交给 `ASTRO_WHONO_BASE_PATH`；`site.config.mjs` 会 trim 并去掉尾随斜杠。
- `SITE_URL` 带路径时行为不一致：`robots.txt` 拼接时保留路径段，canonical 用 `new URL(路径, Astro.site)` 会丢掉 origin 之外的路径。约定只写 origin。
- `ASTRO_WHONO_BASE_PATH` 出现 `:` 或空白时 `astro.config.mjs` 在配置期直接抛错（Git Bash 的 MSYS 路径转换常触发），命令前加 `MSYS_NO_PATHCONV=1` 规避。
- 构建期会把 `site.json` 的时区快照注入浏览器端（`import.meta.env.ASTRO_WHONO_SITE_TIMEZONE`）；开发时改字体或时区需要重启。
- Node 版本：`.nvmrc` 为 `22.22.0`，`package.json` 的 `engines.node` 为 `>=22.12.0`。`ci.yml` 依次读 `.nvmrc`、`engines.node`、回退 `22`；`pages.yml` 与 `release.yml` 只读 `.nvmrc`，缺失时回退 `22`。

## GitHub Pages 部署与 base 推导

`pages.yml` 在构建前推导环境变量：

- `SITE_URL=https://${GITHUB_REPOSITORY_OWNER}.github.io`。
- 比较时把仓库名与 owner 转小写，用来判断是否为 `<owner>.github.io`；base 路径使用原始仓库名，仓库名不是 `<owner>.github.io` 时 `ASTRO_WHONO_BASE_PATH=/<repo>/`，否则用 `/`。

本仓库对应 `https://planetarium1001.github.io` 与 `/astro-versicarium/`。`dist/` 的目录结构不随 base 嵌套，base 只影响产物内的 URL；`trailingSlash: 'always'` 与 `redirects` 目标都按 base 生成。

Pages 设置：Settings → Pages 的 Source 必须是 GitHub Actions，不能选 Deploy from a branch；部署 job 使用 `github-pages` 环境，如果该环境配置了部署分支限制，需要放行 `demo`。绑定自定义域名后，把 `SITE_URL` 与 `ASTRO_WHONO_BASE_PATH` 改成固定域名和 `/`。

## 其他托管

- `netlify.toml` 指定 `command = "npm run build"` 与 `publish = "dist"`。
- Cloudflare Pages 等静态平台配置相同的构建命令与产物目录，并在构建环境设置 `SITE_URL`，子目录部署时再设 `ASTRO_WHONO_BASE_PATH`。
- 自建 nginx 把站点根目录指向 `dist/`；`public/_headers` 是部分平台读取的安全响应头，nginx 需要另行配置等价规则。
- 构建环境需要 Node 22.12+ 与 `npm ci` 依赖。字体目录体积较大，注意托管平台的单文件与总量限制；`dist/` 已包含 `public/` 的全部内容。

## 本地验证

```bash
SITE_URL=https://example.com npm run verify
SITE_URL=https://example.com ASTRO_WHONO_BASE_PATH=/blog/ npm run build
npm run preview
```

- `verify` 顺序（`package.json`）：`check` → `build` → `font:coverage -- --strict` → `test:fixtures` → `test` → `check:prod-artifacts` → `check:layout-geometry` → `check:touch-targets` → `check:viewport-overflow`。
- `check:prod-artifacts` 断言 `SITE_URL` 非空，并检查后台静态壳、接口占位、sitemap 不含后台与 DEV 专用资源。
- 验证子路径时同时设置 `ASTRO_WHONO_BASE_PATH`，`npm run preview` 用同一个 base 提供 `dist/`。
- `npm run check:markdown-smoke` 读取已构建的 `dist/`，用于抽查 Markdown 渲染；需要先构建。
- CI 的 `npm run ci` 就是 `npm run verify`，本地与 CI 使用同一套检查。

## 部署前核对

- 构建完成后确认 `dist/index.html`、`dist/sitemap-index.xml`（设置了 `SITE_URL` 时）和 `dist/admin/index.html` 存在。
- `dist/admin/*` 页面不应包含写入根节点、Bootstrap 数据或后台导航；`dist/api/admin/*` 应是 404 占位而不是 JSON 接口。
- 子目录部署时抽查产物里的站内链接与 `dist/sitemap-index.xml`，确认都带 base 前缀。
- `dist/` 里的字体文件较大，上传托管平台时不要漏传；平台有单文件或总量限制时先检查字体体积。

## 常见问题

- Git Bash 下 base 被改写成文件路径：命令前加 `MSYS_NO_PATHCONV=1`。
- 构建成功但 `check:prod-artifacts` 失败：先确认 `SITE_URL` 非空且是带协议的完整地址。
- 子路径部署后站内链接 404：确认 `ASTRO_WHONO_BASE_PATH` 与托管实际路径一致，重定向目标已按 base 生成。
- GitHub Pages 没有更新：确认推送的是 `demo` 分支，且 Pages Source 是 GitHub Actions。
