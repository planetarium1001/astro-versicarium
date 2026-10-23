---
date: 2026-10-22
title: 字体分层
description: 中文字体按角色分层分片，常用页字体约 385 KB，生僻字改为按需下载。
tags: [字体, 性能]
images:
  - src: images/fonts.webp
    alt: 文章页，右侧目录与浮动按钮
author:
  name: Versicarium
  avatar: author/avatar.svg
draft: false
---

中文字体按用途分成 text、display 与 meta 三类角色，常用页字体约 385 KB，生僻字按 240 KB 目标切成独立分片按需下载。

字体清单当前是 base 33 个加 DLC 82 个，共 115 个 WOFF2、23,431,664 字节；分片按内容哈希命名，字体 CSS 与清单一起生成。

后台可在常用与完整覆盖之间切换，默认完整；覆盖率检查会区分源字体缺字与管线漏覆盖。`185c2be`，10-22。
