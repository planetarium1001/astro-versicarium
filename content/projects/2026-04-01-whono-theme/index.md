---
title: Whono Theme
subtitle: 内容模型与项目多版本
description: 固定五个集合与目录式条目，引入项目文档级多版本、系列版本字段与归档版本模式。
type: 主题
date: 2026-04-01
slug: whono-theme
versionLabel: 0.5.0
versionName: 内容模型
versionSummary: 五个集合落位，项目与博客的版本文档拥有稳定的路由和归档表现。
versionOrder: 2
draft: false
---

v0.5.0 把内容模型固定下来。`blog`、`projects`、`bits`、`devlog`、`about` 五个集合各有独立的 schema 与路由；每个条目采用目录式存放，`index.md` 与 `images/`、`files/` 同级，内容根从主题代码中彻底分离。

这一版最重要的改动是项目文档级多版本。同一项目可以写多份版本文档，共享一个非日期形式的 `slug`。最新版使用 `/projects/#<slug>` 作为稳定锚点，历史版使用条目 ID 压平后的日期锚点，例如 `/projects/#2026-04-01-whono-theme`。版本按日期、`versionOrder` 与条目 ID 依次排序，项目页只显示最新版卡片，弹窗内可以切换全部版本文档。

博客也获得同样的系列字段：`series` 把多篇文档归为同一系列，`versionLabel`、`versionName`、`versionSummary` 与 `versionOrder` 描述版本，公开路径仍以最新版与日期路径协作。归档开始按版本文档成行，并支持 `all` 与 `latest` 两种版本模式；`devlog` 增加 `projectSlug`，把开发记录关联回项目。

后台内容台同步支持五个集合的新建、编辑、草稿与删除能力矩阵，`about` 保持固定单页。项目文档与版本字段的 schema 约束、锚点规则与排序逻辑在这一版定型，后续版本只做界面收敛与资源整合。

[仓库](https://github.com/planetarium1001/astro-whono-tweaked) · [开发日志](/devlog/#whono-theme-2026-06-20-project-multi-version)
