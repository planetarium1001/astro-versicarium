---
title: 分叉后的阅读改造
date: 2026-10-02
project: Versicarium
projectSlug: versicarium
kind: feature
description: 从上游分叉，补上文章目录、浮动操作列与阅读模式。
draft: false
---

仓库从 cxro/astro-whono 分叉，第一轮改动集中在长文阅读。双栏壳层、后台控制台与 Markdown 扩展沿用上游，新增文章目录与右下角浮动操作列，把阅读模式、回到上次位置、回到顶部收在一处，主题切换也补了涟漪过渡。阅读位置记忆与浏览数据槽位保留，正文排版没有改动。

侧栏从 320px 收到 224px，正文获得更多横向空间。内容仍是 essay、bits、memo、about 四个集合，放在 `src/content/`，图片走 `public/`；后台入口是 `/admin/`，构建与预览命令与上游一致，Node.js 22.12.0 以上即可运行。

这一版没有项目与开发日志集合，也没有独立的主题更新命令，从上游同步只能手工对照差异合并。部署仍是 GitHub Pages 项目页，仓库名也还带着上游痕迹。

定位是保留上游全部能力、只做阅读增量，因此仓库是下游分支而不是新主题。后续的内容模型重构、改名与版本化都从这一支开始。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [提交](https://github.com/planetarium1001/astro-versicarium/commit/5b0914d)
