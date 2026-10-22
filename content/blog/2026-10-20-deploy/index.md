---
title: 部署上线
description: 构建产物是静态文件；部署有 GitHub Pages 与自己的服务器两条路径，关键是站点地址与子目录变量。
date: 2026-10-20
publishedAt: 2026-10-20
tags: [说明, 部署]
draft: false
---

线上站点是一组静态文件。构建时把内容和设置生成到 `dist/`，把 `dist/` 交给托管服务即可，不需要 Node.js 服务。托管方只负责把文件发出去，不参与内容生成。

## 线上是什么

- 构建命令是 `npm run build`，产物在 `dist/`。
- 产物是网页、样式、脚本、图片与字体，任何静态托管都能放。
- 构建读取内容与设置；构建完成后不需要运行 Node.js 服务。

构建失败时先修内容或设置，托管方不会补齐缺失的页面。发布前在本地构建成功，是线上可用的前提。

线上后台只读。改内容或设置要在本地改好、重新构建再发布。静态产物没有服务端逻辑，登录、提交这类能力不在其中，因此线上也不会保留写入入口。

## 两个分支

仓库用两个分支分工：`main` 是模板，包含主题代码、默认设置和模板示例；`demo` 是示例站，放完整示例内容并自动发布到 GitHub Pages。改模板在 `main`，发布示例站看 `demo`。自己的站点可以沿用，也可以只用一个分支。

示例站的发布只读取 `demo`。两个分支共用同一套主题代码，区别在 `content/` 与设置：`main` 保留最小种子内容，`demo` 放完整示例。

## 部署到 GitHub Pages

如果仓库是从模板复制或克隆出来的，先改 `.github/workflows/pages.yml`，再启用 Pages。模板里的工作流固定部署 `demo` 分支，直接用自己的仓库运行会失败：

- `on.push.branches` 里的 `demo` 改成自己的发布分支，通常是 `main`。
- `actions/checkout` 的 `with.ref: demo` 改成同一分支；或删掉 `with.ref`，让它检出触发本次运行的提交。
- `ci.yml` 里 `push` / `pull_request` 的分支改成自己的分支，固定的 `SITE_URL` 换成自己的站点地址。
- `release-please.yml` 与 `release.yml` 只服务主题发版，自己的站点可以删除。
- 绑定自定义域名后，把 `pages.yml` 里推导站点地址的步骤改成固定域名与 `/`。

不改这些，结果通常是推送后工作流不触发，或检出 `demo` 失败，Pages 不会更新。

1. 在仓库 Settings → Pages 把 Source 设为 GitHub Actions。不要选 Deploy from a branch，那是 GitHub 自带的另一套构建方式，不认 Astro 的产物。
2. 如果 `github-pages` 环境设置了部署分支限制，允许你的发布分支。
3. 向发布分支推送，或在 Actions 页面手动运行 `pages` 工作流。
4. 等部署完成，打开 Pages 给出的地址；项目页地址通常带仓库名，例如 `https://<用户名>.github.io/<仓库名>/`。

Source 选 GitHub Actions 时，构建环境与步骤都由仓库自己的工作流控制；Deploy from a branch 会按 Jekyll 处理，静态产物的路径与资源容易出错。

自动发布只在你的发布分支有推送时触发。工作流会自己完成安装依赖、构建和上传，不需要手动把 `dist/` 传到服务器。

发布后打开站点首页，确认样式、图片和字体都已加载；再点开一篇文章，确认正文与分享图正常。发现资源 404 时，先检查子目录设置。首次部署或改了 Pages 设置后，等 Actions 里的运行结束再刷新页面。

## 部署到自己的服务器

站点是静态文件，服务器只要按目录提供网页，不需要 Node.js、数据库或后台进程。

### 构建

构建命令是 `npm run build`，运行时要带上站点地址；变量写法见[站点地址与子目录](#站点地址与子目录)，产物在 `dist/`。站点放在域名根目录时不用设 base；放在子目录时设置 `ASTRO_WHONO_BASE_PATH`，例如 `/blog/`。

### 上传

把 `dist/` 里的内容上传到服务器上的站点目录，源码、`node_modules/` 与缓存目录不需要上传。可以用 `rsync`：

```bash
rsync -av --delete dist/ <用户>@<服务器>:<站点目录>/
```

`--delete` 会删除目标目录里多余的旧文件，第一次上传前确认目标目录只放站点文件。没有 `rsync` 时，用 SFTP 或主机面板上传同样的内容。

### Nginx

让 Nginx 的 `root` 指向站点目录，`index` 设为 `index.html`。站点按目录生成页面，文章地址对应目录里的 `index.html`，刷新页面不需要额外的重写规则。改完配置先用 `nginx -t` 检查，再重新加载。

### HTTPS

证书可以从托管商申请，也可以用 Let's Encrypt。启用后把 `SITE_URL` 改成 `https://` 开头的地址并重新构建，页面里的绝对链接、订阅地址与分享图都会按新地址生成。字体、图标与图片随构建一起发布，不依赖外部静态服务。

### 发布后复查

- 打开首页，确认样式、图片与字体加载正常。
- 打开一篇文章，确认正文与分享图正常；分享图地址来自 `SITE_URL`。
- 抽查站内链接、分页与归档，确认没有指向旧域名或站点根目录。
- 子目录部署时，确认访问地址带子目录前缀。
- 浏览器缓存或 CDN 可能保留旧文件，更新后刷新缓存再检查。

## 用其他静态托管

- 构建命令填 `npm run build`，发布目录填 `dist`。
- 仓库自带 Netlify 的配置文件，Netlify 会直接读取；Cloudflare Pages 这类平台手动填上面两项。
- 构建环境要设置站点地址；放在子目录时再设置子目录。仓库里还带了一份安全响应头配置，只有部分平台会读取。

## 站点地址与子目录

`SITE_URL` 是站点的完整地址，例如 `https://example.com`。它用于生成订阅地址、分享图和页面里的绝对链接；不设置会退回占位域名，并被发布检查拦下。

`ASTRO_WHONO_BASE_PATH` 用于站点放在子目录的情况。部署到 `https://example.com/blog/` 时设为 `/blog/`，不设置就是根路径 `/`。

```bash
SITE_URL=https://example.com npm run build
SITE_URL=https://example.com ASTRO_WHONO_BASE_PATH=/blog/ npm run build
```

GitHub Pages 的项目页会自动推导这两个值，一般不用手动填；绑定自定义域名后，按工作流注释改成固定域名和 `/`。在 Git Bash 里设置子目录时，路径可能被自动改写，命令前加 `MSYS_NO_PATHCONV=1`。

地址填错时通常表现为页面能打开、样式或链接失效：`SITE_URL` 写错会影响订阅、分享图和页面里的绝对链接，子目录漏填会让站内链接指到站点根目录。

## 发布前检查

发布前在本地跑一次完整检查，并带上站点地址：

```bash
SITE_URL=https://example.com npm run verify
```

`verify` 会检查代码、构建、测试、产物与布局。站点地址为空时构建仍能完成，但发布检查会失败。想在本地预览构建结果，先构建再运行 `npm run preview`。

检查全部通过再发布。只跑 `npm run build` 只能说明构建成功，不能代替测试与产物检查。检查失败时先看输出里失败的是哪一项，前面的步骤失败会挡住后面的检查。

## 常见问题

- GitHub Pages 没有更新：确认推送的是 `demo` 分支，并确认 Pages 的 Source 是 GitHub Actions。
- 子目录部署后站内链接打不开：确认 `ASTRO_WHONO_BASE_PATH` 与托管实际路径一致，修改后重新构建。
- 自建服务器打开是 404 或页面没有样式：确认 `dist/` 已完整上传、Nginx 的 `root` 指向站点目录，子目录部署时 base 与访问路径一致。
- 启用 HTTPS 后仍有地址指向 http：重新构建，并确认 `SITE_URL` 已改成 `https://` 开头。
- 构建通过但发布检查失败：先确认命令里带了完整的 `SITE_URL`。
- 本地预览资源缺失：`npm run preview` 预览的是 `dist/`，需要先构建；子目录部署时预览命令也要带同样的子目录设置。

完整说明见[部署上线](https://github.com/planetarium1001/astro-versicarium/blob/main/docs/deployment.md)。
