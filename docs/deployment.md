# 部署

## 分支模型

| 分支 | 内容 | 用途 |
| --- | --- | --- |
| `main` | 主题代码、默认设置、模板示例条目与文档 | 模板与主题更新来源 |
| `demo` | 完整示例内容、示例设置与页面截图 | 部署到 GitHub Pages |

主题改动先在 `main` 完成，再在 `demo` 检出执行 `npm run theme:update` 同步，方向固定为 `main` → `demo`。反向合并会把示例内容、设置与测试快照带回模板分支。字体资产属于站点自有路径，`demo` 同步时加 `-- --include-fonts`；示例站内容与模板不同时，合并后还需在 `demo` 运行 `npm run font:build` 重新生成分片。合并机制见 [upstream.md](upstream.md)。

## 工作流

| 工作流 | 触发 | 作用 | 权限 |
| --- | --- | --- | --- |
| `ci.yml` | push / PR 到 `main`、`demo` | `npm ci` 后以固定 `SITE_URL` 执行 `npm run ci` | `contents: read` |
| `pages.yml` | push 到 `demo`、手动触发 | 构建并发布到 GitHub Pages | `contents: read`、`pages: write`、`id-token: write` |
| `release-please.yml` | push 到 `main` | 维护 release PR、版本号、CHANGELOG、标签与 GitHub Release | `contents: write`、`pull-requests: write` |
| `release.yml` | GitHub Release 发布 | 校验标签与版本号，生成模板 zip 与 `SHA256SUMS` 并附加到 Release | `contents: write` |

`ci.yml` 从 `.nvmrc` 读取 Node 版本，`SITE_URL` 为 `https://planetarium1001.github.io`。`pages.yml` 固定在 `demo` 分支检出并构建；工作流文件留在默认分支，因此仍可从 Actions 页面手动触发。`release-please.yml` 只负责版本与 Release；`release.yml` 在 Release 发布后打包附件，不自行创建 Release。发布流程见 [release.md](release.md)。

## 构建期环境变量

| 变量 | 作用 |
| --- | --- |
| `SITE_URL` | 站点 origin，例如 `https://planetarium1001.github.io`。用于 RSS、canonical、分享图绝对地址与 sitemap |
| `ASTRO_WHONO_BASE_PATH` | 部署子路径，例如 `/astro-versicarium/`；默认 `/` |
| `SITE_TIMEZONE` | IANA 时区，覆盖 `site.json` 的 `timezone`；未设置时使用 `site.json`，再回退 `Asia/Shanghai` |

`SITE_URL` 只写 origin，不要带部署子路径，子路径交给 `ASTRO_WHONO_BASE_PATH`。`SITE_URL` 为空时 RSS 回退 `https://example.invalid`，canonical 与分享图不输出，sitemap 不生成，`robots.txt` 不写 Sitemap 行，`check:prod-artifacts` 会失败。

`ASTRO_WHONO_BASE_PATH` 必须是 URL 路径。Git Bash 的 MSYS 路径转换可能把 `/blog` 改写成 Windows 文件路径，配置期会直接报错；此时在命令前加 `MSYS_NO_PATHCONV=1`。

## GitHub Pages

1. 仓库启用 GitHub Pages；私有仓库是否可用取决于账户计划。
2. Settings → Pages → Source 选择 **GitHub Actions**。不要选 “Deploy from a branch”，该路径使用 Jekyll 构建，无法处理 Astro 产物。
3. Settings → Environments → `github-pages` → Deployment branches and tags，加入 `demo`。该策略默认只放行默认分支；未放行时 `deploy` 作业会立即失败，`build` 仍成功。
4. 向 `demo` 推送，或在 Actions 中手动运行 `pages`。

部署地址由工作流推导：

- 仓库名为 `<owner>.github.io` 时，`SITE_URL=https://<owner>.github.io`，base 为 `/`；
- 其他仓库名时，`SITE_URL=https://<owner>.github.io`，base 为 `/<repo>/`。

示例站仓库为 `planetarium1001/astro-versicarium`，因此 `SITE_URL=https://planetarium1001.github.io`、base 为 `/astro-versicarium/`，站点地址为 <https://planetarium1001.github.io/astro-versicarium/>。

## 部署自己的站点

工作流默认只部署 `demo`。内容放在 `main` 时，需要同时修改两处，否则部署的仍是 `demo`：

- `pages.yml` 的 `on.push.branches` 改为自己的部署分支；
- 构建作业的 `actions/checkout` 去掉 `ref: demo`，检出触发运行的提交。

修改后仍需在 `github-pages` 环境放行新的部署分支。使用自定义域名时，把工作流中的 `SITE_URL` 改为 `https://你的域名`、`ASTRO_WHONO_BASE_PATH` 改为 `/`，并在 `public/` 下新建 `CNAME` 写入域名。否则页面与资源会继续带仓库子路径。

也可以本地构建后直接上传 `dist/`：

```bash
SITE_URL=https://example.com ASTRO_WHONO_BASE_PATH=/ npm run build
```

## 其他静态托管

`dist/` 是纯静态文件，可发布到 Nginx、对象存储或静态托管平台。仓库自带 `netlify.toml`，构建命令为 `npm run build`，发布目录为 `dist/`。

- 站点使用 `trailingSlash: 'always'`，托管方需把 `/path/` 映射到 `/path/index.html`，不要配置成单页应用回退。
- `public/_headers` 提供安全响应头，只对支持该约定的托管方生效；其他平台需在服务端配置同等头部。
- 子路径部署时，`SITE_URL` 与 `ASTRO_WHONO_BASE_PATH` 必须同时正确，否则 RSS、canonical、站内链接与静态资源路径会不一致。
- 修改部署根路径后重新执行 `npm run verify`，产物守卫会按 `ASTRO_WHONO_BASE_PATH` 检查链接前缀。

版本发布与模板下载见 [release.md](release.md)。
