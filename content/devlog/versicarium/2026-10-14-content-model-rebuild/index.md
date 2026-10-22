---
title: 内容模型第一次重构
date: 2026-10-14
project: Versicarium
projectSlug: versicarium
kind: breaking
description: 集合改为五类，归档变成跨集合时间线。
draft: false
---

集合改为 blog、projects、bits、devlog、about 五个，essay 更名为 blog，memo 删除。归档从单集合列表改为跨集合时间线，按时间统一排布；列表的筛选与展示、后台控制台一并重做，内容仍是一个 Markdown 文件一条，尚未目录化。

这意味着内容模型不再跟随上游。项目与开发日志有了独立集合，后续的版本路由与条目资源目录才有落点；内容也不再只是若干篇四个集合的文章，而是分集合、有归属的条目。

对既有内容这是一次破坏性变更：旧集合名、旧路径与旧引用都需要迁移，后台的创建与编辑方式改变，列表页的筛选条件也依赖新的字段。原有文章需要批量改名再逐条核对。

迁移完成后，主题才具备独立演进的骨架。这次重构把集合划分、归档与筛选绑在一起，后续新增集合只需补内容与少量配置，不必再改列表逻辑。包版本仍停在 0.5.0，但内容结构已经与上游分开。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [提交](https://github.com/planetarium1001/astro-versicarium/commit/df93e3f)
