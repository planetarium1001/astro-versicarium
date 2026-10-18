# 部署

## 分支模型

| 分支 | 内容 | 用途 |
| --- | --- | --- |
| `main` | 主题代码、每类一到数条种子内容、中性默认设置 | 模板与更新来源 |
| `demo` | 完整示例内容、示例截图与站点设置 | 部署到 GitHub Pages |

主题改动先在 `main` 完成，再在 `demo` 检出上执行 `npm run theme:update` 同步；不要创建 `demo` 合回 `main` 的请求。两个分支在内容、设置与测试快照上刻意不同，反向合并会把模板重新变成示例站。同步方向与冲突处理见 [upstream.md](upstream.md)。

## 工作流

| 工作流 | 触发 | 作用 | 权限 |
| --- | --- | --- | --- |
| `ci.yml` | push / PR 到 `main`、`demo` | `npm ci` 后执行 `npm run ci` | `contents: read` |
| `pages.yml` | push 到 `demo`、手动触发 | 构建并发布到 GitHub Pages | `contents: read`、`pages: write`、`id-token: write` |

`pages.yml` 固定在 `demo` 分支运行，工作流文件本身留在默认分支，因此仍可从 Actions 页面手动触发。`main` 不参与部署。

## 构建期环境变量

| 变量 | 作用 |
| --- | --- |
| `SITE_URL` | 站点 origin，用于 RSS、canonical、og 与 sitemap。为空时 RSS 回落到 `https://example.invalid`，canonical、og:url 与 og:image 省略，sitemap 不生成 |
| `ASTRO_WHONO_BASE_PATH` | 部署子路径，默认 `/`。项目页部署在仓库子路径时由 Pages 工作流推导 |

产物守卫断言 sitemap 存在，因此 CI 与发布构建必须提供 `SITE_URL`；本地仅预览时可省略。

## 配置 GitHub Pages

1. 仓库设为 public。Free 计划下私有仓库无法使用 Pages。
2. Settings → Pages → Source 选 **GitHub Actions**。不要选「Deploy from a branch」：该路径会走 GitHub 内置的 Jekyll 构建，对 Astro 项目必然失败。
3. Settings → Environments → `github-pages` → **Deployment branches and tags** → 加入部署分支（本仓库为 `demo`）。该策略默认只放行默认分支；不放行时 `deploy` 作业会在没有任何步骤执行的情况下立即失败，而 `build` 仍然成功。
4. 触发一次部署：向部署分支推送，或在 Actions → `pages` → Run workflow。

## 部署自己的站点

`pages.yml` 默认只部署 `demo`：`on.push.branches` 与 `actions/checkout` 的 `ref` 都指向它。内容放在 `main` 时要把这两处一起改掉，否则部署的仍是 `demo` 的内容：

- `on.push.branches` 改为自己的部署分支；
- `actions/checkout` 去掉 `ref: demo`，让它检出发起运行的那个提交。

改完后同样要在 `github-pages` 环境里放行新的部署分支。站点地址由工作流按仓库名推导：项目页发布在 `https://<owner>.github.io/<repo>/`，仓库名为 `<owner>.github.io` 时发布在根路径。绑定自定义域名后，把工作流中的 `SITE_URL` 与 `ASTRO_WHONO_BASE_PATH` 改为固定值（`https://你的域名` 与 `/`），否则资源路径会带上仓库子路径而 404。

## 其他静态托管

构建产物 `dist/` 可直接发布。仓库自带 Netlify 配置（`npm run build` + 发布 `dist`），也可用于 Nginx、对象存储或其他静态托管。

如果站点前面有反向代理或 Anubis 一类挑战层，favicon 图片请求可能被拦截。排查与策略配置见 [favicon.md](favicon.md)。
