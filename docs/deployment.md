# 部署上线

> 本文档为使用文档，不涉及代码、开发等内容。代码分层、命令参数与实现细节见[开发者文档：部署](developers/deployment.md)。

线上站点是一组静态文件，不需要数据库。构建时把内容和设置生成到 `dist/`，把 `dist/` 交给托管服务即可。

线上后台只读，改内容或设置要在本地改好、重新构建再发布。

## 线上是什么

- 构建命令是 `npm run build`，产物在 `dist/`。
- 产物是网页、样式、脚本、图片与字体，任何静态托管都能放。
- 构建读取内容与设置；构建完成后不需要 Node.js 服务。

## 两个分支

仓库用两个分支分工：`main` 是模板，包含主题代码、默认设置和模板示例；`demo` 是示例站，放完整示例内容并自动发布到 GitHub Pages。改模板在 `main`，发布示例站看 `demo`。

## 用 GitHub Pages 发布

1. 在仓库 Settings → Pages 把 Source 设为 GitHub Actions。不要选 Deploy from a branch，那是 GitHub 自带的另一套构建方式，不认 Astro 的产物。
2. 如果 `github-pages` 环境设置了部署分支限制，允许 `demo`。
3. 向 `demo` 推送，或在 Actions 页面手动运行 `pages` 工作流。
4. 等部署完成，打开 Pages 给出的地址；项目页地址通常带仓库名，例如 `https://<用户名>.github.io/<仓库名>/`。

自动发布只在 `demo` 有推送时触发；向 `main` 推送不会更新示例站。手动运行可以在 Actions 页面发起。

工作流会自己完成安装依赖、构建和上传，不需要手动把 `dist/` 传到服务器。第一次部署或改了 Pages 设置后，等 Actions 里的运行结束再刷新页面。

发布后打开站点首页，确认样式、图片和字体都已加载；再点开一篇文章，确认正文与分享图正常。发现资源 404 时，先检查子目录设置。

## 用其他静态托管

- 构建命令填 `npm run build`，发布目录填 `dist`。
- 仓库自带 Netlify 的配置文件，Netlify 会直接读取；Cloudflare Pages 这类平台手动填上面两项。
- 自己的服务器把站点根目录指向 `dist` 即可。
- 构建环境要设置站点地址；放在子目录时再设置子目录。仓库里还带了一份安全响应头配置，只有部分平台会读取。

## 站点地址与子目录

`SITE_URL` 是站点的完整地址，例如 `https://example.com`。它用于生成订阅地址、分享图和页面里的绝对链接；不设置会退回占位域名，并被发布检查拦下。

`ASTRO_WHONO_BASE_PATH` 用于站点放在子目录的情况。部署到 `https://example.com/blog/` 时设为 `/blog/`，不设置就是根路径 `/`。

```bash
SITE_URL=https://example.com npm run build
SITE_URL=https://example.com ASTRO_WHONO_BASE_PATH=/blog/ npm run build
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

- GitHub Pages 没有更新：确认推送的是 `demo` 分支，并确认 Pages 的 Source 是 GitHub Actions。
- 子目录部署后站内链接打不开：确认 `ASTRO_WHONO_BASE_PATH` 与托管实际路径一致，修改后重新构建。
- 构建通过但发布检查失败：先确认命令里带了完整的 `SITE_URL`，例如 `SITE_URL=https://example.com npm run verify`。
- 本地预览资源缺失：`npm run preview` 预览的是 `dist/`，需要先构建；子目录部署时预览命令也要带同样的子目录设置。

