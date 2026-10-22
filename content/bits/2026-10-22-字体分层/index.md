---
date: 2026-10-22
title: 字体分层
description: 中文字体按角色分层分片，首屏字体体积降到约八分之一，生僻字改为按需下载。
tags: [字体, 性能]
images:
  - src: images/fonts.webp
    alt: 文章页，右侧目录与浮动按钮
author:
  name: Versicarium
  avatar: author/avatar.svg
draft: false
---

中文字体按用途分成 text、display 与 meta 三类角色，常用页首屏字体从约 2.25 MB 降到约 305 KB。生僻字按 180 KB 目标切成独立分片，按需下载；分片按内容哈希命名，两份字体 CSS 与字体清单一起生成。

字体资产目录从 5.2 MB 增至 22.69 MB。后台可在常用与完整覆盖之间切换，默认完整；覆盖率检查会区分源字体缺字与管线漏覆盖，字体选择默认值不变，视觉没有变化。`185c2be`，10-22 00:34。
