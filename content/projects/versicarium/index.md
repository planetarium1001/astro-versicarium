---
title: Versicarium
subtitle: 1.0.0 预览版
description: 当前预览版本，收束内容模型、项目版本、资源管理与主题更新，并统一为 Versicarium · 垄录。
type: 主题
date: 2026-10-20
slug: versicarium
versionLabel: 1.0.0
versionName: 当前预览
versionSummary: 首次公开版本的内容基线，尚未发布 GitHub Release。
versionOrder: 3
draft: false
---

1.0.0 是当前预览版本，尚未发布 GitHub Release。它把 0.1.0 与 0.5.0 的结构收束为可公开的首次版本：统一品牌、重建示例内容、补齐媒体与分页，并把版本与 CHANGELOG 交给 Release Please 管理。

内容侧维持五个集合与目录式条目。项目文档共享稳定 `slug`，最新版锚点为 `/projects/#versicarium`，历史版使用条目 ID 压平的日期锚点；博客系列支持版本字段；归档按年月组织，并可在全部版本与最新版之间切换。

后台覆盖概览、主题、写作、资源与快照。资源页把图片与附件放在同一工作区，支持集合级共享资源、引用状态、批量操作与整条目导入导出；写作页管理五个集合，生产构建中的后台退化为只读静态壳。分页改为按页面配置，首页、博客、动态、开发日志与归档各有开关与条数。

主题更新通过 `theme.json` 的基准提交做三方合并，纯文本按行交给 `git merge-file`，二进制文件整文件取舍，`content/`、设置、图片、字体与 `theme.json` 等站点自有路径不被覆盖。`main` 保持模板与更新来源，`demo` 承载完整示例站并部署到 GitHub Pages。

本次预览包含改名与品牌重做：英文名 Versicarium，中文名垄录，仓库地址改为 `planetarium1001/astro-versicarium`，示例站部署在 `planetarium1001.github.io/astro-versicarium/`。首次公开版本号为 `1.0.0`，标签 `v1.0.0` 保留在本地；当前处于预览阶段，Release 尚未发布。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [示例站](https://planetarium1001.github.io/astro-versicarium/) · [开发日志](/devlog/#versicarium-2026-10-20-versicarium-rename)
