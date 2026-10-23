---
title: 主题介绍
description: 当前预览版 1.0.0-rc.2：Versicarium · 垄录，五个集合、文章系列与项目版本、可写后台、按文件主题更新与分层字体。
date: 2026-10-22
publishedAt: 2026-10-22
tags: [主题, 版本]
series: theme-introduction
slug: theme-introduction
versionLabel: "1.0.0-rc.2"
versionName: 当前版本
versionSummary: 改名与品牌重做后的预览版，补上资源管理、移动端回归修复与按角色分层的字体。
versionOrder: 3
ogImage: images/share.webp
ogImageAlt: 主题 Hero 图，深浅斜向分割与中央记录图标
draft: false
---
<h1 align="center">Versicarium · 垄录</h1>
<p align="center">面向开发者的内容与版本管理博客主题，基于 Astro 构建，修改自<a href="https://github.com/cxro/astro-whono">Whono</a>。</p>
<div align="center">
  <p><b>Versicarium</b> = <b><code>versiculus</code></b> + <b><code>arium</code></b></p>
  <p>&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&thinsp;&thinsp;&thinsp;&thinsp;&thinsp;&thinsp;&ensp;诗行短句&emsp;&thinsp;&thinsp;&thinsp;&ensp;收卷之匣</p>
</div>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-22C55E?style=flat-square" alt="License: MIT"></a>
  <a href="./CHANGELOG.md"><img src="https://img.shields.io/badge/version-1.0.0--rc.2-F59E0B?style=flat-square" alt="Version 1.0.0-rc.2"></a>
</p>

## 版本与名称

- 版本号 `1.0.0-rc.2` 是 `1.0.0` 之前的第二个预览候选，变更记录日期为 2026-10-21。
- 名称由 `versiculus`（诗行短句）与 `arium`（收卷之匣）拼成，10-20 连同仓库名与站点名一起更换。
- 派生自 `cxro/astro-whono`，保留 MIT 许可与版权声明；仓库已脱离它的 fork network，主题仓库是唯一来源。

标签 `v1.0.0-rc.2` 停在 10-21 的提交上，字体分层与文档重写在标签之后，包版本仍是 `1.0.0-rc.2`。

## 五个集合

内容在仓库根的 `content/`，一个条目一个目录，主文件是 `index.md`。

| 集合 | 位置 | 公开地址 |
|---|---|---|
| 文章 | `content/blog/<条目>/` | `/blog/`、`/blog/<条目>/` |
| 项目 | `content/projects/<条目>/` | `/projects/` |
| 动态 | `content/bits/<条目>/` | `/bits/` |
| 开发日志 | `content/devlog/<项目>/<条目>/` | `/devlog/` |
| 关于 | `content/about/index.md` | `/about/` |

- 条目目录自带 `images/` 与 `files/`，图片、附件与正文绑定，构建时只复制被引用的文件。
- 归档页把文章版本、项目版本与日志按年月放在同一条时间线上，按全部、博客、项目、更新四个视图筛选。
- 草稿只在开发环境可见，构建后的站点、列表与订阅源都会跳过。

字段全表见[内容与写作](https://github.com/planetarium1001/astro-versicarium/blob/main/docs/content.md)。

## 文章系列

同一篇内容需要保留多次改版时，各版本放在不同目录，填同一个 `series`，再用 `versionLabel`、`versionName`、`versionSummary` 与 `versionOrder` 描述顺序。

- 同一系列的版本共用一个 `slug`，日期最新的版本占 `/blog/<slug>/` 稳定地址。
- 历史版本留在日期地址上，标为 noindex，页面上提示该版本已归档。
- 排序先看日期，日期相同时再看 `versionOrder`。
- 版本抽屉列出每个版本的版本号、名称与日期，正文只展示当前版本的日期。

## 项目版本

项目按同样方式处理多个版本。

- 每个版本一个目录，共享项目标识，分别写版本号与版本名称。
- 项目列表用卡片网格展示，只列最新版；打开卡片后在弹窗里切换历史版本。
- 每个版本有独立地址，卡片图与图标按各自条目目录读取。

## 后台

`npm run dev` 后打开 `/admin/`，后台分概览、主题、写作、资源与快照五个页面。

- 主题设置分七组：站点设置、侧栏设置、首页设置、内页设置、条目版本、代码显示、排版字体。
- 写作页带实时预览与字段检查，保存前校验正文引用的本地图片是否存在。
- 资源页统一管理图片与附件，支持上传、批量重命名、移动与删除，显示引用状态，也支持整条目 ZIP 导入导出。
- 快照页只导入导出设置，不碰内容与图片。

生产构建不输出控制台根节点与写入接口，线上站点只读。

## 主题更新

`theme.json` 记录主题仓库、分支与基准提交。

<details>
<summary>查看与执行更新</summary>

```bash
npm run theme:update -- --check
npm run theme:update
npm run verify
```

</details>

- `--check` 只列出会新增、更新、删除与冲突的文件，不写盘。
- 合并按文件做三方合并：站点未改动的文件取新版本，主题未改动的文件保留站点版本，双方都改的文件合并并列出冲突。
- `content/`、`src/data/settings/`、`public/fonts/`、`theme.json` 等站点自有路径不会被覆盖。
- 有冲突时命令以非零状态退出，解决后重跑。

## 字体

中文字体按用途与常用程度分层分片，随构建一起发布，页面不向外部字体服务请求。

- 基础分片 33 个，合计 2,338,700 字节，随页面加载。
- 生僻字分片 82 个，合计 21,092,964 字节，单块目标 240 KB，页面出现生僻字时才下载。
- 合计 115 个 WOFF2，共 23,431,664 字节。
- 常用页实际下载约 385 KB。

覆盖策略在后台的排版字体里切换：完整覆盖包含生僻字分片，只覆盖常用字时生僻字交给系统字体。

## 部署

构建时提供站点地址，部署到子目录时再设前缀。

<details>
<summary>两种构建方式</summary>

```bash
SITE_URL=<SITE-URL> npm run build
SITE_URL=<SITE-URL> ASTRO_VERSICARIUM_BASE_PATH=/<SUBDIR>/ npm run build
```

</details>

- `SITE_URL` 只写协议与域名，不带路径。
- 不填 `SITE_URL` 时页面里的正式地址与分享图不输出，站点地图不生成，`npm run verify` 会在产物检查一步失败。
- 产物在 `dist/`，是纯静态文件，GitHub Pages、Netlify、Cloudflare Pages 与自建服务器都能托管。

仓库用两个分支分工：`main` 是模板，`demo` 是示例站。`pages.yml` 在 `demo` 上构建并发布到 GitHub Pages，`ci.yml` 覆盖两个分支。发布工作流 `release-please.yml` 与 `release.yml` 都只手动触发。

获取模板有两条路径：在仓库页面选择 **Use this template**，得到历史独立的仓库；或浅克隆 `main` 分支。完整说明见[安装与运行](https://github.com/planetarium1001/astro-versicarium/blob/main/docs/install.md)。

这一版仍是预览候选。内容模型不再大改，改动集中在使用体验与文档；同步主题的方式见[主题更新](https://github.com/planetarium1001/astro-versicarium/blob/main/docs/update.md)。
