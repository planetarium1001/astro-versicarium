---
title: 字体按用途分层
date: 2026-10-22
project: Versicarium
projectSlug: versicarium
kind: improvement
description: 常用页字体约 385 KB，生僻字按 240 KB 分块按需加载。
draft: false
---

字体按角色分层分片，常用页字体约 385 KB，生僻字单独成包按需下载。

字体清单当前是 base 33 个加 DLC 82 个，共 115 个 WOFF2、23,431,664 字节；DLC 单块目标 240 KB。

分片依据字符范围与用途，正文、标题与辅助信息各取所需。字符范围之间不能重叠，否则同一个字会命中两份文件。

后台可在常用字与完整覆盖之间切换，默认完整；`font:coverage --strict` 在 `verify` 里校验缺字与范围漂移。代价是字体资产目录约 22 MB，仓库体积明显增加。

这次改动共 236 个文件，绝大多数是生成的字体与字符表，人工改动集中在生成脚本与样式引用。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [提交](https://github.com/planetarium1001/astro-versicarium/commit/185c2be)
