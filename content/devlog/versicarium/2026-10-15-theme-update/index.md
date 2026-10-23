---
title: 主题更新改为按文件合并
date: 2026-10-15
project: Versicarium
projectSlug: versicarium
kind: feature
description: 新增 theme.json 与 theme:update，升级不再整体覆盖站点定制。
draft: false
---

新增 `theme.json` 与 `npm run theme:update`，主题更新改为按文件三方合并，站点自有路径不被覆盖。

此前同步只能手工对照差异，改过的页面和样式容易被整体替换。按文件合并把「哪些文件属于主题、哪些属于站点」变成显式规则。

合并范围由 `theme.json` 的仓库、分支与基准提交决定，冲突会落到具体文件并返回非零退出码；工作树不干净时命令直接中止。

README 与文档在同一次提交里重写，说明哪些文件会被更新、哪些留给站点。主题从此作为可升级的模板维护，而不是一次性分叉的代码副本。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [提交](https://github.com/planetarium1001/astro-versicarium/commit/6751344)
