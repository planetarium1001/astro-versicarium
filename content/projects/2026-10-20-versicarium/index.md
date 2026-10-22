---
title: Versicarium
subtitle: 首个预览候选
description: 更名与品牌重做，收束内容目录、项目版本、资源管理与主题更新，版本推进到 1.0.0-rc.1。
type: 主题
date: 2026-10-20
slug: versicarium
versionLabel: 1.0.0-rc.1
versionName: 首个预览候选
versionSummary: 统一品牌、重建示例内容，版本推进到首个预览候选；标签后来推到远端，Release 未创建。
versionOrder: 3
draft: false
---

1.0.0-rc.1 是首个预览候选，对应 10-20 05:38 的 `4d2fb3b`。它把前两周的结构收束成一次可公开的预览：统一品牌、重建示例内容、补齐媒体与分页，并把版本和 CHANGELOG 交给 Release Please 管理。

改名发生在 05:13 的 `7b8437f`。仓库、包名、站点名一起换成 Versicarium · 垄录，品牌资源按实心几何重做，示例站迁到 `planetarium1001.github.io/astro-versicarium/`。GitHub Pages 的子路径需要给站内 Markdown 链接、末尾链接组、上一篇/下一篇和图片补部署 base，漏一处就会在构建产物里留下缺段的地址。

内容侧维持五个集合与目录式条目。项目文档共享稳定 `slug`，最新版锚点是 `/projects/#versicarium`，历史版使用条目 ID 压平的日期锚点；博客系列支持版本字段；归档按年月组织，并可在全部版本与最新版之间切换。

后台覆盖概览、主题、写作、资源与快照。资源页把图片与附件放在同一工作区，支持集合级共享资源、引用状态、批量操作与整条目导入导出；写作页管理五个集合，生产构建中的后台退化为只读静态壳。分页按页面配置，首页、博客、动态、开发日志与归档各有开关与条数。

主题更新通过 `theme.json` 的基准提交做三方合并，纯文本按行交给 `git merge-file`，二进制文件整文件取舍，`content/`、设置、图片、字体与 `theme.json` 等站点自有路径不被覆盖。`main` 保持模板与更新来源，`demo` 承载完整示例站并部署到 GitHub Pages。

`v1.0.0-rc.1` 是带注释标签，落在 10-20 05:47 的 `f887527` 上。`4d2fb3b` 的提交说明当时写的是预览阶段不 push、不创建 Release；这个标签后来推到了远端，GitHub Release 仍未创建。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [示例站](https://planetarium1001.github.io/astro-versicarium/) · [开发日志](/devlog/#versicarium-2026-10-20-versicarium-rename)
