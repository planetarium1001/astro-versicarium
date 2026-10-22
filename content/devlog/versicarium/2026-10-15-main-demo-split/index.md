---
title: main 与 demo 双分支
date: 2026-10-15
project: Versicarium
projectSlug: versicarium
kind: chore
description: main 回到模板形态，示例站迁到 demo 分支。
draft: false
---

main 回到模板形态：示例内容与示例截图移出，只保留最小种子内容，站点设置改回中性默认值。部署工作流改为发布 demo 分支，持续集成同时覆盖 main 与 demo，两边的构建都走同一套检查。

双分支模型由此确定。main 面向使用模板的人，干净、可直接复制；demo 承载示例站与逐日积累的变更记录，截图、文档核对与内容重建都在这里进行。示例站的地址与部署记录留在 demo，不再反过来影响模板。

两边职责分开后，模板发布不必等待示例站内容收敛，示例站也能保留完整历史。此后与示例站相关的提交都留在 demo，与主题能力相关的改动再挑回 main。

代价是同步成本：同一改动有时要在两边各出现一次，提交顺序也需要留意。但这个代价换来的是模板的可复用性与示例站的可追溯性，后续版本都按这条边界组织。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [提交](https://github.com/planetarium1001/astro-versicarium/commit/d17570c)
