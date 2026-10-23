---
title: 内容根迁到仓库根
date: 2026-10-19
project: Versicarium
projectSlug: versicarium
kind: refactor
description: 内容根迁到仓库根，条目变成目录，版本能力补齐。
draft: false
---

内容根从 `src/content/` 迁到仓库根 `content/`，主题代码与作者内容分开。

条目变成目录，`index.md` 旁边带 `images/` 与 `files/`，图片和附件跟着条目走，复制与迁移只需带走一个目录。

同一次改动补齐版本能力：博客系列与版本路由、项目多版本的文档与版本抽屉、时区日期、归档模式、favicon 生成，后台增加版本与文件 API。

稳定地址留给最新版，历史版本留在日期路径并标注规范地址；项目按稳定标识归并多份文档，卡片点开是版本弹窗。

代价是迁移与兼容成本，旧路径、旧引用和后台操作方式都要调整，构建期的路径校验也更严格。这些改动构成 1.0.0 的主要内容，也确定了内容与代码分层的边界。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [提交](https://github.com/planetarium1001/astro-versicarium/commit/4575975)
