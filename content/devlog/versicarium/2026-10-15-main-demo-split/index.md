---
title: main 与 demo 双分支
date: 2026-10-15
project: Versicarium
projectSlug: versicarium
kind: chore
description: main 回到模板形态，示例站迁到 demo 分支。
draft: false
---

main 回到模板形态：示例内容与示例截图移出，只保留最小种子内容，站点设置改回中性默认值。

部署工作流改为发布 demo 分支，持续集成同时覆盖 main 与 demo，两边的构建都走同一套检查。

双分支模型由此确定。main 面向使用模板的人，干净、可直接复制；demo 承载示例站与逐日积累的变更记录。

代价是同步成本：同一改动有时要在两边各出现一次，提交顺序也要留意。此后示例站相关的提交留在 demo，主题能力相关的改动再合回 main。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [提交](https://github.com/planetarium1001/astro-versicarium/commit/d17570c)
