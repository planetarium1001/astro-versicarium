---
title: 字体按角色分层与生僻字 DLC
date: 2026-10-22
project: Versicarium
projectSlug: versicarium
kind: improvement
description: 自托管字体按角色生成基础分片，生僻字 DLC 按 unicode-range 按需加载，首屏字体从约 2.25 MB 降到约 305 KB。
draft: false
---

`185c2be`（10-22 00:34）重做自托管字体。按 text、display、meta 角色生成 base 分片，生僻字按 180 KB 目标切成 DLC，靠 `unicode-range` 按需加载；`global.css` 不再手写 `@font-face`，改为读取生成的 `fonts.generated.css` 与 `fonts.dlc.generated.css`。

新增 `font:fetch`、`font:roles`、`font:check`、`font:coverage`、`font:report` 与 `font:build` 编排，字体资产带内容哈希，旧的 9 个固定子集删除，`noto-sans-sc` 从 fontsource 整段文件迁入自托管管线。源字体沿用上游的 LXGW WenKai Lite v1.521 与 Noto Serif SC 2.003，子集保留 OFL 许可与元数据。

数字：常用页首屏从约 2.25 MB 降到约 305.6 KB（p50）、319.6 KB（p90）；`public/fonts/` 从 5.2 MB 涨到 22.69 MB（155 个 WOFF2），仓库净增约 17.5 MB。示例站同步主题要加 `--include-fonts`，否则字体资产不会跟着走。

后台「主题 → 排版字体」增加 `ui.fontCoverage`：`full` 默认，加载 base 与 DLC CSS；`common` 只加载 base，生僻字回退系统字体。源字体本身缺的字（Noto SC 子集缺部分 Ext B 字形，WenKai Lite 缺部分 Ext A）在 `full` 模式下也仍回退系统字体，`font:coverage` 把「源字体本来没有」和「管线漏覆盖」分开报。

`v1.0.0-rc.2` 标签停在 10-21 的 `89fc493` 上，这条提交在标签之后，包版本仍是 rc.2。标签要不要重打，发布收口时处理。

[项目 1.0.0-rc.2](/projects/#versicarium) · [仓库](https://github.com/planetarium1001/astro-versicarium)
