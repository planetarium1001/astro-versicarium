# 部署上线

> 本文档为使用文档，不涉及代码、开发等内容。代码分层、命令参数与实现细节见[开发文档：部署](developers/deployment.md)。

线上站点是一组静态文件，构建时把内容和设置生成到 `dist/`，把 `dist/` 交给托管服务即可。

线上后台只读，改内容或设置要在本地改好、重新构建再发布。

## 构建与上线

- 构建命令是 `npm run build`，产物在 `dist/`。
- 产物是网页、样式、脚本、图片与字体，任何静态托管都能放。
- 构建读取内容与设置；构建完成后不需要 Node.js 服务。

## 两个分支

仓库用两个分支分工：`main` 是模板，包含主题代码、默认设置和模板示例；`demo` 是示例站，放完整示例内容并自动发布到 GitHub Pages。改模板在 `main`，发布示例站看 `demo`。

## 用 GitHub Pages 发布

如果仓库是从模板复制或克隆出来的，先修改 `.github/workflows/pages.yml`，再启用 Pages。模板里的工作流固定部署 `demo` 分支，直接用自己的仓库运行会失败，需要修改的内容如下：

- 把 `on.push.branches` 里的 `demo` 改成你的发布分支，通常是 `main`。
- 把 `actions/checkout` 的 `with.ref: demo` 改成同一分支；或删掉 `with.ref`，让它检出触发本次运行的提交。
- 把 `ci.yml` 里 `push` / `pull_request` 的 `main`、`demo` 改成自己的分支，并把固定的 `SITE_URL` 换成自己的站点地址。
- `release-please.yml` 与 `release.yml` 只服务主题发版，自己的站点不需要，可以删除。
- 绑定自定义域名后，把 `pages.yml` 里“Resolve site URL and base path”步骤改成固定域名与 `/`。

不改这些，结果通常有两种：推送后工作流不触发，或检出 `demo` 失败，Pages 不会更新。

1. 在仓库 Settings → Pages 把 Source 设为 GitHub Actions。不要选 Deploy from a branch，那是 GitHub 自带的另一套构建方式，不认 Astro 的产物。
2. 如果 `github-pages` 环境设置了部署分支限制，允许你的发布分支。
3. 向发布分支推送，或在 Actions 页面手动运行 `pages` 工作流。
4. 等部署完成，打开 Pages 给出的地址；项目页地址通常带仓库名，例如 `https://<用户名>.github.io/<仓库名>/`。

改过工作流后，自动发布只在你的发布分支有推送时触发。手动运行可以在 Actions 页面发起。

工作流会自己完成安装依赖、构建和上传，不需要手动把 `dist/` 传到服务器。第一次部署或改了 Pages 设置后，等 Actions 里的运行结束再刷新页面。

发布后打开站点首页，确认样式、图片和字体都已加载；再点开一篇文章，确认正文与分享图正常。发现资源 404 时，先检查子目录设置。

## GitHub Actions 工作流

仓库自带四个工作流，都在 `.github/workflows/`，分别负责检查、部署示例站、维护版本号与打包模板。四个工作流各自触发，职责与权限分开声明。

### ci.yml：推送与 PR 的检查

`ci.yml` 在向 `main`、`demo` 推送或提交 PR 时运行，权限只有 `contents: read`。步骤是解析 Node 版本、`npm ci` 安装依赖、以固定的 `SITE_URL` 运行 `npm run ci`。

`npm run ci` 等价于 `npm run verify`，包含类型与源码检查、构建、字体覆盖、测试与产物检查。因为其中有构建，它同样需要 `SITE_URL`；工作流固定写成 owner 的 `https://planetarium1001.github.io`，项目页的子路径由构建时的 base 决定。

`pages.yml` 不等待 `ci.yml` 通过，两个工作流相互独立。发布前应确认两者都通过。

### pages.yml：发布示例站

`pages.yml` 只部署示例站，触发条件是向 `demo` 推送，或在 Actions 页面手动运行。固定 `demo` 是因为仓库用两个分支分工：`main` 是模板，`demo` 是完整示例站。工作流检出时写死 `ref: demo`，所以即使在 Actions 里手动运行，发布的内容仍是 `demo`。工作流文件也在默认分支上，因此 Actions 页面能看到手动运行入口。

权限为 `contents: read`、`pages: write`、`id-token: write`。`pages: write` 用于更新 Pages，`id-token: write` 供部署步骤换取 OIDC 凭据。并发组是 `pages`，有新部署时取消上一次未完成的运行。

构建前会推导两个变量：

- `SITE_URL` 是 `https://${GITHUB_REPOSITORY_OWNER}.github.io`。
- `ASTRO_VERSICARIUM_BASE_PATH` 取仓库名：仓库名是 `<owner>.github.io` 时用 `/`，否则用 `/<仓库名>/`。判断时把仓库名与 owner 转小写比较，路径里保留原始仓库名。

本仓库得到 `https://planetarium1001.github.io` 与 `/astro-versicarium/`。两个值只在工作流内部生成，不使用仓库变量或 Secrets。

首次部署前，先在 Settings → Pages 把 Source 设为 GitHub Actions；`github-pages` 环境若限制部署分支，放行 `demo`。没设置就运行时，构建可能成功而部署步骤失败；设置后重新运行 `pages`，或再向 `demo` 推送一次即可，不需要改代码。

### release-please.yml 与 release.yml

这两个工作流处理发版，不部署站点。

`release-please.yml` 在向 `main` 推送时运行，权限是 `contents: write` 与 `pull-requests: write`，使用 `googleapis/release-please-action@v4` 读取 `release-please-config.json` 与 `.release-please-manifest.json`，维护版本号与 `CHANGELOG.md` 的变更 PR。预览候选的版本号、变更记录与内部清单由维护者手动写入。

`release.yml` 在 GitHub Release 发布时运行，事件是 `release: published`，权限是 `contents: write`。它校验标签与 `package.json` 版本一致，把该标签的已跟踪文件打包成模板 zip，生成 `SHA256SUMS`，附到同一个 Release。

两者的触发源都不是 `demo` 分支推送，也不会生成或上传站点页面。`pages.yml` 负责把 `demo` 的构建产物发布到 GitHub Pages；`release.yml` 只往 Release 附件里放模板包与校验文件。

### 复用到自己的站点

主题仓库的 `main`/`demo` 分工是为示例站准备的。自己的站点通常只有一条发布分支，复用时改三处：

- 触发分支改成自己的发布分支，例如把 `branches: [demo]` 改成 `branches: [main]`。
- 检出分支同步改掉 `ref: demo`，或删掉该行，使用当前触发分支。
- `SITE_URL` 与 `ASTRO_VERSICARIUM_BASE_PATH` 按实际地址填写：项目页保留 `/<仓库名>/`，用户主页仓库与自定义域名用 `/`。

`ci.yml` 里固定的 `SITE_URL` 也换成自己的站点 origin；它只服务于构建检查，不参与部署。`release-please.yml` 与 `release.yml` 只服务主题发版，自己的站点不需要保留。

绑定自定义域名后，`SITE_URL` 写域名，base 写 `/`，Pages 设置里也填同一个域名。工作流的自动推导只覆盖 `github.io` 地址。

构建步骤给出两个变量即可，其余沿用：

```yaml
- name: Build
  run: npm run build
  env:
    SITE_URL: https://example.com
    ASTRO_VERSICARIUM_BASE_PATH: /
```

权限保留 `pages: write` 与 `id-token: write`；上传与部署继续使用 `actions/upload-pages-artifact@v3` 与 `actions/deploy-pages@v4`，部署步骤继续使用 `github-pages` 环境。

### 常见失败

- Pages 的 Source 选了 Deploy from a branch：GitHub 会用另一套方式构建，产物不是 Astro 的 `dist/`；改成 GitHub Actions。
- 子目录变量漏设：项目页部署在 `/<仓库名>/` 下，漏设 base 时站内链接指向站点根目录。
- 权限不足：部署步骤缺少 `pages: write` 或 `id-token: write` 时无法上传与部署；仓库收紧 `GITHUB_TOKEN` 权限时同样失败。
- Pages 未启用：部署步骤直接失败；先在 Settings → Pages 开启并选择 GitHub Actions，再重跑工作流。
- 自定义域名后 base 仍带仓库名：自动推导只适用于 `github.io` 地址，改域名后要把 base 改成 `/`，否则站内链接多出一层仓库名。

## 用其他静态托管

- 构建命令填 `npm run build`，发布目录填 `dist`。
- 仓库自带 Netlify 的配置文件，Netlify 会直接读取；Cloudflare Pages 这类平台手动填上面两项。
- 构建环境要设置站点地址；放在子目录时再设置子目录。仓库里还带了一份安全响应头配置，只有部分平台会读取。

## 用自己的服务器

站点是静态文件，服务器只需要按目录提供网页，不需要 Node.js、数据库或后台进程。

### 构建

先按[站点地址与子目录](#站点地址与子目录)确定 `SITE_URL` 与子目录设置，再运行 `npm run build`，产物在 `dist/`。站点放在域名根目录时不用设置 `ASTRO_VERSICARIUM_BASE_PATH`；放在子目录时设置成对应的路径，例如 `/blog/`。

### 上传

把 `dist/` 里的内容上传到服务器的站点目录，源码、`node_modules/` 与本地缓存不要上传。可以用 `rsync -av --delete dist/ <用户>@<服务器>:<站点目录>/`，也可以走 SFTP 或主机面板。第一次上传前确认目标目录只放站点文件，以免 `--delete` 删掉其他内容。

### Nginx

Nginx 的 `root` 指向站点目录，`index` 设为 `index.html`。站点按目录生成页面，文章地址对应目录里的 `index.html`，不需要额外的重写规则。改完配置先用 `nginx -t` 检查，再重新加载。`/_astro/` 与 `/fonts/` 下的文件名带内容哈希，建议在服务端配置长缓存；`public/_headers` 只对 Netlify/Cloudflare Pages 等宿主生效，nginx 不读取。

### HTTPS

证书可以用托管商提供的，也可以用 Let's Encrypt。启用后把 `SITE_URL` 改成 `https://` 开头的地址并重新构建，页面里的绝对链接、订阅地址与分享图都会按新地址生成。字体、图标与图片随构建一起发布，不依赖外部静态服务。

### 发布后复查

- 打开首页，确认样式、图片与字体加载正常。
- 打开一篇文章，确认正文与分享图正常；分享图地址来自 `SITE_URL`。
- 抽查站内链接、分页与归档，确认没有指向旧域名或站点根目录。
- 子目录部署时，确认访问地址带子目录前缀。
- 浏览器缓存或 CDN 可能保留旧文件，更新后刷新缓存再检查。

发布前仍建议按[发布前检查](#发布前检查)跑一次完整检查。

## 站点地址与子目录

`SITE_URL` 是站点的完整地址，例如 `https://example.com`。它用于生成订阅地址、分享图和页面里的绝对链接；不设置会退回占位域名，并被发布检查拦下。

`ASTRO_VERSICARIUM_BASE_PATH` 用于站点放在子目录的情况。部署到 `https://example.com/blog/` 时设为 `/blog/`，不设置就是根路径 `/`。

```bash
SITE_URL=https://example.com npm run build
SITE_URL=https://example.com ASTRO_VERSICARIUM_BASE_PATH=/blog/ npm run build
```

GitHub Pages 的项目页会自动推导这两个值，一般不用手动填；绑定自定义域名后，按工作流注释改成固定域名和 `/`。

在 Git Bash 里设置子目录时，路径可能被自动改写，命令前加 `MSYS_NO_PATHCONV=1`。

地址填错时通常表现为页面能打开、样式或链接失效：`SITE_URL` 写错会影响订阅、分享图和页面里的绝对链接，子目录漏填会让站内链接指到站点根目录。

## 发布前检查

发布前在本地跑一次完整检查，并带上站点地址：

```bash
SITE_URL=https://example.com npm run verify
```

`verify` 会检查代码、构建、测试、产物与布局。站点地址为空时构建仍能完成，但发布检查会失败。想在本地预览构建结果，先构建再运行 `npm run preview`。

检查全部通过再发布。只跑 `npm run build` 只能说明构建成功，不能代替测试与产物检查。

## 常见问题

- GitHub Pages 没有更新或部署失败：Source、分支限制、权限与子目录变量见[GitHub Actions 工作流](#github-actions-工作流)的「常见失败」。
- 构建通过但发布检查失败：先确认命令里带了完整的 `SITE_URL`，例如 `SITE_URL=https://example.com npm run verify`。
- 本地预览资源缺失：`npm run preview` 预览的是 `dist/`，需要先构建；子目录部署时预览命令也要带同样的子目录设置。

