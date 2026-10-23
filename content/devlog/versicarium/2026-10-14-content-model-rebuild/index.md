---
title: 内容模型第一次重构
date: 2026-10-14
project: Versicarium
projectSlug: versicarium
kind: breaking
description: 集合改为五类，归档变成跨集合时间线。
draft: false
---

集合改为 blog、projects、bits、devlog、about 五个，`essay` 更名 `blog`，`memo` 删除。

归档从单集合列表改为跨集合时间线，按时间统一排布；列表的筛选与展示、后台控制台一并重做。

内容仍是一个 Markdown 文件一条，尚未目录化，图片也没有跟着条目走。

对既有内容这是一次破坏性变更：旧集合名、旧路径与旧引用都要迁移，后台的创建与编辑方式改变。包版本仍停在 0.5.0，但内容结构已经与来源分开。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [提交](https://github.com/planetarium1001/astro-versicarium/commit/df93e3f)
