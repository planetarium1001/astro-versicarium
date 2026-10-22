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
  <div style="display:inline-grid; grid-template-columns:auto auto auto auto auto; justify-items:center; column-gap:.6em;">
    <div><b>Versicarium</b></div><div>=</div><div><b><code>versiculus</code></b></div><div>+</div><div><b><code>arium</code></b></div>
    <div></div><div></div><div>诗行短句</div><div></div><div>收卷之匣</div>
  </div>
</div>

当前版本是 `1.0.0-rc.2`，Demo 正在运行这一版。

## 五个集合

内容文件夹在仓库的 `content/`，一个条目一个目录：

| 集合 | 位置 | 公开地址 |
| --- | --- | --- |
| 文章 | `content/blog/<条目>/` | `/blog/`、`/blog/<条目>/` |
| 项目 | `content/projects/<条目>/` | `/projects/` |
| 动态 | `content/bits/<条目>/` | `/bits/` |
| 开发日志 | `content/devlog/<项目>/<条目>/` | `/devlog/` |
| 关于 | `content/about/index.md` | `/about/` |

条目目录自带 `index.md`、`images/` 与 `files/`，图片、附件与正文绑定。归档页把文章版本、项目版本与日志按年月放在同一条时间线上，支持筛选与标签组合；草稿只在开发环境可见。

## 文章系列

同一篇内容需要保留多次改版时，各版本放在不同目录，填同一个 `series`，再用 `versionLabel`、`versionName`、`versionSummary` 与 `versionOrder` 描述顺序。同一系列的版本共用一个 `slug`，日期最新的版本占 `/blog/<slug>/` 稳定地址，历史版本留在日期地址上并标为 noindex；订阅源与站点地图只收当前版本，历史版本仍可从版本抽屉进入。

排序先看日期，日期相同时再看 `versionOrder`。版本抽屉列出每个版本的版本号、名称与日期，正文只展示当前版本的日期。

## 项目版本

项目按同样方式处理多版本文档：每个版本一个目录，共享项目标识与 `slug`，分别写版本号与版本名称。项目列表用卡片网格展示，只列最新版；打开卡片后在弹窗里切换历史版本，每个版本有独立地址。项目卡片支持图标与封面，图片路径可写条目内的相对路径或 `https://` 地址。

## 后台

`npm run dev` 后打开 `/admin/`，后台分概览、主题、写作、资源与快照五个页面。主题设置分七组，写作页带实时预览与字段检查。资源页统一管理图片与附件，支持上传、批量重命名、移动与删除，显示引用状态，支持整条目 ZIP 导入导出与对象存储。生产构建不包含写入接口。

## 主题更新

`theme.json` 记录主题仓库、分支与基准提交。先运行 `npm run theme:update -- --check` 查看将发生的变更，再运行 `npm run theme:update` 执行合并。合并按文件做三方合并：站点未改动的文件直接取新版本，主题未改动的文件保留站点版本，双方都改的文件合并并列出冲突。`content/`、`src/data/settings/`、`public/fonts/`、`theme.json` 等站点自有路径不会被覆盖。

示例站从 `main` 同步时加 `-- --include-fonts`，把主题生成的字体资产一并纳入；合并后在 `demo` 分支重跑 `npm run font:build`，按示例内容重新生成字体切片。

## 字体

中文字体按角色分层分片：常用字随页面加载，生僻字在需要时下载。常用页面的首屏字体从约 2.25 MB 降到约 305 KB，字体资产目录约 22.69 MB。后台可以在常用覆盖与完整覆盖之间切换，正文出现生僻字时会自动补载对应切片。

## 部署入口

双分支模型保持不变：`main` 保存主题代码、默认设置与模板示例条目，是主题更新的来源；`demo` 保存完整示例内容与设置，`pages.yml` 在 `demo` 上构建并发布到 GitHub Pages。`main` 上还有 `ci.yml` 覆盖两个分支的检查，以及发布版本用的 release 工作流。

构建时提供站点地址，部署到子路径时再设 base：

```bash
SITE_URL=https://example.com npm run build
SITE_URL=https://example.com ASTRO_WHONO_BASE_PATH=/blog/ npm run build
```

`SITE_URL` 只写 origin，子路径交给 `ASTRO_WHONO_BASE_PATH`。不填 `SITE_URL` 时页面里的正式地址与分享图不输出，站点地图不生成，`npm run verify` 会失败。本地提交前跑 `npm run verify`，它依次执行类型检查、构建、快照、测试与产物检查。

获取模板有三种方式：在仓库页面选择 Use this template，得到历史独立的仓库；浅克隆 `main` 分支；fork 后合并上游。站点跟踪 `main`，不要直接合并 `demo`。

这一版仍是预览候选。标签 `v1.0.0-rc.2` 停在 10-21 的提交上，字体分层与 README 和文档重写在标签之后；包版本仍是 `1.0.0-rc.2`。
