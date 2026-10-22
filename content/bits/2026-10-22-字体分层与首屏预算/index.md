---
date: 2026-10-22
title: 字体分层与首屏预算
tags: [字体, 性能]
author:
  name: Planetarium
draft: false
---

`185c2be`（10-22 00:34）把自托管字体按 text / display / meta 角色分片，生僻字 DLC 按 `unicode-range` 按需加载，常用页首屏从约 2.25 MB 降到约 305 KB。

代价是 `public/fonts/` 从 5.2 MB 涨到 22.69 MB（155 个 WOFF2），仓库净增约 17.5 MB，示例站同步要加 `--include-fonts`。后台「排版字体」可切 `full` / `common`，默认 `full`。
