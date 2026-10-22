---
date: 2026-10-14
title: 五个集合
description: 内容模型换成五个集合，归档改为跨集合时间线，列表筛选与后台控制台跟着重做。
tags: [内容模型]
images:
  - src: images/content-model.webp
    alt: 后台主题设置，亮色
author:
  name: Versicarium
  avatar: author/avatar.svg
draft: false
---

集合从四个换成五个：`essay` 改名 `blog`，删掉 `memo`，新增 `projects` 与 `devlog`，`about` 保留。归档改成跨集合的时间线，按年月分组，不再包含动态。

删除 `memo` 时，它的路由、样式与后台分支一并清理。列表页取消服务端分页，改成在浏览器里筛选与分页，标签支持与或组合，并从地址栏恢复。写作页覆盖五个集合，项目与开发日志都能正常写回。`df93e3f`，10-14 13:46。旧内容路径不兼容，存量文章要重新放一遍。
