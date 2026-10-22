---
title: 目录式内容根与媒体管理器
date: 2026-10-19
project: Versicarium
projectSlug: versicarium
kind: refactor
description: 内容根迁入 content/，条目按目录承载版本与媒体，后台补上完整媒体管理器与归档导入导出。
draft: false
---

`4575975`（2026-10-19 00:19）把内容根从 `src/content/` 迁到仓库根目录的 `content/`，集合与主题代码彻底分离。条目改为目录式存放，`index.md` 与条目的 `images/`、`files/` 同级；博客支持系列与版本字段，项目支持多版本文档，日期按站点时区解析并区分日期与时间。

同一提交加入文章版本抽屉、归档版本模式、每条目图片与附件路径、favicon 生成，以及后台的版本与文件接口。前台能感知的是文章页出现版本提示与版本抽屉，历史版与最新版各有公开地址。

`f6280ed`（2026-10-19 00:50）补上完整的媒体管理器。后台把图片与附件放进同一工作区，支持搜索与筛选、批量重命名和移动、引用状态统计，以及整条目归档的导入与导出。内容台、媒体台与前台正文从此对准同一套条目目录。

[项目 1.0.0-rc.1](/projects/#2026-10-20-versicarium) · [仓库](https://github.com/planetarium1001/astro-versicarium)
