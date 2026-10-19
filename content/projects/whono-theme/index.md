---
title: Whono Theme
subtitle: 开发者向的 Astro 博客主题
description: 当前发布版本，整合项目文档多版本、资源工作区、版本界面与主题更新通道。
type: 主题
date: 2026-10-18
slug: whono-theme
versionLabel: 1.1.0
versionName: 当前发布
versionSummary: 面向开发者的完整主题版本，内容、资源、版本与更新通道在同一套结构中收束。
versionOrder: 3
draft: false
---

1.1.0 是 Whono Theme 的当前发布版本。主题以 Astro 构建，保留上游的双栏壳层、后台控制台与 Markdown 扩展，在内容模型、项目文档、资源管理与主题更新上形成一套面向开发者的完整结构。

内容侧提供五个集合与目录式条目。项目文档共享稳定 `slug`，最新版与历史版各有公开锚点；博客系列支持版本字段；归档按年月组织，并可在全部版本与最新版之间切换。版本界面只保留必要信息：文章页显示版本提示与版本抽屉，列表不再堆叠历史胶囊，版本名称的显示位置由后台设置控制。

后台覆盖概览、主题、写作、资源与快照。资源页把图片与附件放在同一工作区，支持集合级共享资源、引用状态、批量操作与整条目导入导出；写作页管理五个集合，生产构建中的后台退化为只读静态壳。主题设置按七个分组写入五个 JSON 文件，保存前经过字段校验与版本检查。

主题更新通过 `theme.json` 的基准提交做三方合并，文本文件使用 `git merge-file`，二进制文件整文件取舍，`content/`、设置、图片、字体与 `theme.json` 等站点自有路径不被覆盖。`main` 保持模板与更新来源，`demo` 承载完整示例站并部署到 GitHub Pages。

当前仓库同时作为示例站运行，内容覆盖快速开始、内容模型、后台、主题更新、发布流程与 Markdown 语法。版本历史可在项目弹窗中切换。

[仓库](https://github.com/planetarium1001/astro-whono-tweaked) · [发布](https://github.com/planetarium1001/astro-whono-tweaked/releases) · [演示](https://planetarium1001.github.io/astro-whono-tweaked/)
