---
title: 主题更新改为按文件合并
date: 2026-10-15
project: Versicarium
projectSlug: versicarium
kind: feature
description: 新增 theme.json 与 theme:update，升级不再整体覆盖站点定制。
draft: false
---

新增 theme.json 与 `npm run theme:update`，主题更新改为按文件三方合并，站点自有路径不被覆盖。README 与 docs 在同一次提交里重写，说明哪些文件会被更新、哪些留给站点。

此前从上游同步只能手工对照差异，改过的页面和样式很容易被整体替换。按文件合并把“哪些文件属于主题、哪些属于站点”变成显式规则，升级时只处理主题文件，站点定制留在原处；合并冲突会落到具体文件，而不是一次整体覆盖。

这是主题分发方式的关键转折：主题开始作为可升级的模板维护，而不是一次性分叉的代码副本。使用模板的人可以持续拿到主题修复，同时保留自己的设置与内容。

更新路径从此写进命令：按主题仓库与基准提交拉取文件，逐文件比较，只替换没有本地改动的部分，其余留给使用者判断。后续的正式版本与预览候选都沿用这套更新路径，theme.json 记录仓库与基准提交，成为更新时的起点坐标。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [提交](https://github.com/planetarium1001/astro-versicarium/commit/6751344)
