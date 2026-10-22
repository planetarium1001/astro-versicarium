---
date: 2026-10-19
title: 条目目录与版本
description: 内容根移到仓库根，条目自带图片与附件，博客系列与项目版本各自有地址。
tags: [内容根, 版本]
images:
  - src: images/versions.webp
    alt: 项目版本弹窗，列出同一项目的全部版本
author:
  name: Versicarium
  avatar: author/avatar.svg
draft: false
---

内容根从 `src/content/` 移到仓库根的 `content/`，主题代码与作者内容分开。条目变成目录，`index.md` 旁边可以放 `images/` 与 `files/`，图片和附件跟着条目走。

博客有了系列与版本，最新版占稳定地址，旧版留在日期路径；项目也能写多份版本文档，共用一个 `slug`，卡片点开是版本弹窗，文章页用侧边抽屉切换。后台补上版本与文件接口。图片与附件的相对路径在构建前校验，写错时检查会报错。`4575975`，10-19 00:19。
