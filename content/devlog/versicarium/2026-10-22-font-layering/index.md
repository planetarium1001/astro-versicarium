---
title: 字体按用途分层
date: 2026-10-22
project: Versicarium
projectSlug: versicarium
kind: improvement
description: 首屏字体从 2.25 MB 降到约 305 KB，生僻字按需加载。
draft: false
---

字体按角色分层分片。常用页首屏字体从约 2.25 MB 降到约 305 KB，生僻字单独成包按需加载，后台可在常用字与完整覆盖之间切换。

代价是字体资产目录涨到 22.69 MB，仓库体积明显增加。分片依据字符范围与用途，正文、标题与辅助信息各取所需，不再让每个页面下载同一组字体；字符范围之间不能重叠，否则同一个字会命中两份文件。

这次改动共 236 个文件、约 12.9 万行，绝大多数是生成的字体与字符表，人工改动集中在生成脚本与样式引用。构建时会校验字符表与覆盖范围，缺字或范围漂移在检查阶段暴露。

首屏预算因此重新可算，弱网与小屏设备的加载体验改善最明显。样式层只需按用途引用对应分片，页面不再整体引入完整字体；字体覆盖范围成为可切换的选项，站点可以在完整字形与体积之间取舍。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [提交](https://github.com/planetarium1001/astro-versicarium/commit/185c2be)
