---
date: 2026-10-14
title: 内容模型重构
tags: [内容模型, 重构]
author:
  name: Planetarium
draft: false
---

`df93e3f`（10-14 13:46）把集合改成 `blog`、`projects`、`bits`、`devlog`、`about`，条目目录规范为 `YYYY-MM-DD-title`。列表筛选支持 AND/OR 表达式和 URL 持久化；服务端分页取消，改为全量渲染后在客户端分页，关掉 JavaScript 也能读。

提交带 `!`，旧内容路径不兼容。后台同期收敛成五个模块，设置沿用五份 JSON，并按新集合调整字段与后台控件。
