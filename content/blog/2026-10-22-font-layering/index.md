---
title: 字体分层：把首屏从 2.25 MB 压到 305 KB
description: 185c2be 把自托管字体按角色和字符层拆成 base 与 DLC，代价是仓库多出约 17.5 MB。
date: 2026-10-22
publishedAt: 2026-10-22
tags: [字体, 性能]
draft: false
---

10-22 00:34 的 `185c2be` 只做一件事：重做字体。

## 原来的字体

之前 `public/fonts/` 是 9 个固定子集，合计约 5.2 MB。每个页面都按同一组 face 加载，常用页首屏字体约 2.25 MB。中文正文的字形范围太大，整段加载不现实，按几刀切开的做法又和实际用字对不上。

## 分层方案

新方案拆成两层。第一层是 base 分片，按角色生成：text、display、meta，再加 latin 和品牌用途，所有页面按需加载。第二层是生僻字 DLC，按 180 KB 一片切，实测最大一片约 234 KB，只在覆盖策略为 `full` 时声明，浏览器按 `unicode-range` 命中才下载。base 和 DLC 的字符范围必须严格不重叠，否则同一个字会命中两片，谁先谁后说不清。

资产是生成物，不是手写文件。`font:fetch` 按清单下载并校验源字体，`font:roles` 从构建产物里提取 text/display/meta/brand 的角色字符集，`font:subset` 生成带内容哈希的 WOFF2、两份 CSS 和 `tools/font-manifest.json`，`font:build` 把这几步串起来跑两遍构建。`global.css` 里不再手写 `@font-face`。

| 指标 | 数值 |
| --- | --- |
| base 分片 | 34 个 face，约 2.21 MB |
| DLC 分片 | 121 个 face，约 20.48 MB |
| 字体文件合计 | 155 个 WOFF2，约 22.69 MB |
| 常用页首屏 | 305.6 KB（p50）、319.6 KB（p90） |

## 代价与遗留问题

代价直接写在提交说明里：`public/fonts/` 从 5.2 MB 涨到 22.69 MB，仓库净增约 17.5 MB，示例站同步主题时要加 `--include-fonts`，否则字体资产不会跟着走。Astro 会把 `public/` 全量复制进 `dist/`，部署目录也跟着变大。

后台「主题 → 排版字体」新增覆盖策略：`full` 是默认，加 DLC；`common` 只加载 base，生僻字回退系统字体，不请求 DLC。常用页 305 KB 是实际命中的字体分片之和，不是构建产物大小，两个数字容易混。

还有个没法完全解决的问题。源字体 Noto Sans SC 的子集只含少量 Ext B 字形，比如 `𠮷` 不在里面；WenKai Lite 也缺一些 Ext A 字形。这些字在 `full` 模式下仍然回退系统字体。`font:coverage` 会把「源字体本来没有」和「管线漏覆盖」分开报，否则每次构建都在一堆假失败里排查。源字体沿用上游的 LXGW WenKai Lite v1.521 和 Noto Serif SC 2.003，生成的子集保留 OFL 许可元数据。

![窄屏文章页，自托管字体的正文排版](/images/demo/mobile-article.webp)

标签的问题到这时变得明显：`v1.0.0-rc.2` 停在 10-21 的版本提交上，字体提交在标签之后。包版本还是 rc.2，标签没动。要不要重打标签，发布前再定。

字体分层的记录在开发日志里：[字体按角色分层与生僻字 DLC](/devlog/#versicarium-2026-10-22-font-layering)。
