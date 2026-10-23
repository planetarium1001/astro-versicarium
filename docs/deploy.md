# 部署上线

## 范围

本篇覆盖：构建产物、站点地址与子目录、GitHub Pages、其他静态托管、自建服务器与发布前检查。前置：站点能在本地构建，见[安装与运行](install.md)。

## 构建与产物

- `npm run build` 生成 `dist/`，内容是网页、样式、脚本、图片与字体。
- 产物是纯静态文件，任何静态托管都能放，不需要 Node.js 服务与数据库。
- 构建读取内容与设置；构建出来的后台只读。
- 本地确认效果：先构建，再运行 `npm run preview`。

## 站点地址与子目录

两个环境变量决定页面里的地址：

| 变量 | 作用 |
|---|---|
| `SITE_URL` | 站点完整地址，用于订阅源、分享图、站点地图与页面绝对链接 |
| `ASTRO_VERSICARIUM_BASE_PATH` | 子目录部署前缀，默认 `/` |

- 不设置 `SITE_URL` 时退回占位地址 `https://example.invalid`，产物检查会失败。
- 部署在域名根目录时只设 `SITE_URL`。
- 部署在 `https://example.com/blog/` 时，再把子目录设成 `/blog/`。
- 只设地址不设子目录，站内链接会指向站点根目录。

<details>
<summary>带站点地址构建</summary>

```bash
SITE_URL=<SITE-URL> npm run build
SITE_URL=<SITE-URL> ASTRO_VERSICARIUM_BASE_PATH=/<SUBDIR>/ npm run build
```

- `<SITE-URL>` 换成站点地址，只写协议与域名，不带路径。
- `<SUBDIR>` 换成子目录名，前后都要有斜杠。

</details>

<details>
<summary>Git Bash 里设置子目录</summary>

```bash
MSYS_NO_PATHCONV=1 ASTRO_VERSICARIUM_BASE_PATH=/blog/ npm run build
```

- Windows 的 Git Bash 会把 `/blog/` 当成磁盘路径改写，构建出的链接会错。
- 加 `MSYS_NO_PATHCONV=1` 阻止改写；只影响当次命令。

</details>

## GitHub Pages

前置：在仓库 Settings → Pages 把 Source 设为 GitHub Actions。不要选 Deploy from a branch，那是 GitHub 自带的构建，产物不是 Astro 的 `dist/`。

仓库自带 `.github/workflows/pages.yml`，直接可用。要改的只有文件开头三处：

- `on.push.branches` 换成自己的发布分支，一般是 `main`。
- `env.SITE_URL` 换成站点地址，只写协议与域名，不带路径。
- `env.ASTRO_VERSICARIUM_BASE_PATH` 部署在子目录时写 `/<REPO>/`，部署在根目录时写 `/`。

改完推送，或在 Actions 页面手动运行 `pages` 工作流，等运行结束打开 Pages 给出的地址。

站点地址规则：

- 项目页带仓库名：`https://<USERNAME>.github.io/<REPO>/`，对应 `ASTRO_VERSICARIUM_BASE_PATH: /<REPO>/`。
- 仓库名是 `<USERNAME>.github.io`（用户主页仓库）时部署在根路径，对应 `ASTRO_VERSICARIUM_BASE_PATH: /`。
- 绑定自定义域名后，`SITE_URL` 写域名，`ASTRO_VERSICARIUM_BASE_PATH` 写 `/`。

工作流分两段：

- `build` 检出代码、装依赖、构建、检查产物，再把 `dist/` 上传成 Pages 产物。
- `deploy` 只负责把产物发布到 Pages，不重复构建。

注意事项：

- `checkout` 不写 `ref`，部署的就是触发本次运行的分支。
- 构建前必须给 `SITE_URL`，否则站点地图不生成，产物检查会失败。
- 子目录写错会让站内链接指向站点根目录；`Verify deployment base` 这一步会拦住重复前缀。
- `SITE_URL` 与 `ASTRO_VERSICARIUM_BASE_PATH` 都放在工作流级 `env`：构建与产物校验都要读它们，只给某一步会让两步看到不同的前缀。
- `github-pages` 环境若设了部署分支限制，要放行自己的发布分支。
- 首次部署或改了 Pages 设置后，等 Actions 运行结束再刷新页面。

常见失败：

- Pages 的 Source 选了 Deploy from a branch：产物不是 Astro 的 `dist/`，改成 GitHub Actions。
- 子目录变量漏设：项目页的站内链接指向站点根目录。
- 权限不足：缺 `pages: write` 或 `id-token: write`，部署步骤失败。
- Pages 未启用：部署步骤直接失败，先在 Settings → Pages 开启再重跑。
- 自定义域名后子目录仍带仓库名：把 `ASTRO_VERSICARIUM_BASE_PATH` 改成 `/`。

<details>
<summary>pages.yml 完整模板</summary>

```yaml
name: pages

on:
  push:
    branches: [<BRANCH>]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

env:
  SITE_URL: <SITE-URL>
  ASTRO_VERSICARIUM_BASE_PATH: /<REPO>/

jobs:
  build:
    name: build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Resolve Node version
        id: node
        shell: bash
        run: |
          if [ -f .nvmrc ]; then
            version="$(cat .nvmrc)"
          else
            version="24"
          fi
          echo "version=$version" >> "$GITHUB_OUTPUT"

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ steps.node.outputs.version }}
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build site
        run: npm run build

      - name: Verify deployment base
        run: node ./scripts/check-deployment-base.mjs

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    name: deploy
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- `<BRANCH>` 换成发布分支，例如 `main`。
- `<SITE-URL>` 换成站点地址，例如 `https://example.com`。
- `/<REPO>/` 换成仓库名子路径；用户主页仓库与自定义域名写 `/`。
- `${{ ... }}` 是工作流语法，原样保留。

</details>

## 其他静态托管

- Netlify：仓库自带 `netlify.toml`，会读取构建命令 `npm run build` 与发布目录 `dist`。
- Cloudflare Pages：手动填构建命令 `npm run build` 与输出目录 `dist`。
- 通用配置：Node.js 22.12.0+，构建命令与输出目录同上，站点地址放进构建环境变量。
- `public/_headers` 是安全响应头配置，只有部分平台读取。

## 自建服务器

- 构建：按上面确定站点地址与子目录，运行 `npm run build`。
- 上传：只传 `dist/` 里的内容，源码、`node_modules/` 与本地缓存不要上传。
- Nginx：站点按目录生成页面，文章地址对应目录里的 `index.html`，不需要额外的重写规则。
- HTTPS：证书用托管商提供的或 Let's Encrypt；启用后把 `SITE_URL` 改成 `https://` 开头并重新构建。
- `/_astro/` 与 `/fonts/` 下的文件名带内容哈希，适合在服务端配置长缓存。
- 子目录部署时，站点目录放在域名下的对应路径，或单独加 `location /<SUBDIR>/` 指向该目录。

<details>
<summary>rsync 上传</summary>

```bash
rsync -rlptD --delete --chmod=D755,F644 dist/ <SERVER-USER>@<SERVER-HOST>:<SERVER-DIR>/
```

- `<SERVER-USER>`、`<SERVER-HOST>`、`<SERVER-DIR>` 换成服务器账号、地址与站点目录。
- `--delete` 会删除目标目录里多余的文件，第一次上传前确认目标目录只放站点文件。

</details>

<details>
<summary>Nginx 站点配置</summary>

```nginx
server {
  listen 80;
  server_name <HOST-NAME>;
  root <SERVER-DIR>;
  index index.html;

  location /_astro/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  location /fonts/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }
}
```

- `<HOST-NAME>` 换成域名，`<SERVER-DIR>` 换成站点目录的绝对路径。
- 改完先用 `nginx -t` 检查，再重新加载 Nginx。

</details>

发布后复查：

- 打开首页，确认样式、图片与字体都正常加载。
- 打开一篇文章，确认正文与分享图正常；分享图地址来自 `SITE_URL`。
- 抽查站内链接、分页与归档，确认没有指向旧域名或站点根目录。
- 子目录部署时，确认访问地址带子目录前缀。
- 浏览器缓存或 CDN 可能保留旧文件，更新后清缓存再检查。

## 发布前检查

发布前在本地跑一次完整检查，并带上站点地址：

```bash
SITE_URL=<SITE-URL> npm run verify
```

- `verify` 检查代码、构建、字体、测试与产物；缺站点地址会在产物检查一步失败。
- 只跑 `npm run build` 不能代替测试与产物检查。
- 子目录部署时再跑一次 `npm run check:subpath`。
- 全部通过再发布。
