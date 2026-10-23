---
title: Versicarium
subtitle: 内容根与多版本条目
description: 内容根移到仓库根的 content/，条目成为目录，博客系列与项目版本各自有地址。
type: 主题
date: 2026-10-19T00:00:00.000Z
slug: versicarium
versionLabel: "1.0.0"
versionName: 条目目录与版本
versionSummary: 内容根迁到仓库根，条目目录自带图片与附件，博客系列与项目多版本条目上线。
versionOrder: 2
draft: false
---

1.0.0 换掉的是内容与版本的组织方式。集合固定为 `blog`、`projects`、`bits`、`devlog` 与 `about` 五个，内容根从 `src/content/` 移到仓库根的 `content/`，主题代码与作者内容分开。

- 条目成为目录，主文件是 `index.md`，图片与附件放在同级的 `images/` 与 `files/`，删条目时一起清理。
- 正文里的图片改为相对条目目录引用，构建时随条目复制；未被引用的附件不会上传。
- 归档把文章版本、项目版本与日志放进同一条时间线，可以按集合切换范围。

## 系列与版本

同一条内容需要保留多次改版时，用 `series` 把各版连起来，分别写版本号与顺序。最新版占稳定地址，旧版留在日期路径上，文章页的侧边抽屉可以切换。

项目同样可以写多份版本条目，共用不带日期的 `slug`，卡片点开后用版本弹窗切换。版本日期按站点时区解析，避免跨时区显示成前一天。

## 后台与更新

后台补上版本与文件接口，开发环境能直接写内容、管理条目内的文件，并按站点信息生成 favicon。

主题更新沿用 `theme.json` 与 `npm run theme:update`，按文件三方合并，站点自有路径不被覆盖。`content/`、设置文件、图片与字体都在跳过清单里。

## 迁移

这次迁移不兼容旧结构：内容文件要从单条改成目录，图片引用也要重写。仓库内已有内容随提交一起迁移，站点之外的内容需要手工整理。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [文档](https://github.com/planetarium1001/astro-versicarium/tree/main/docs)
