---
title: Versicarium
subtitle: 移动端回归与字体分层
description: 当前预览版本，修复 rc.1 真机验收的移动端问题，并把自托管字体按角色分层。
type: 主题
date: 2026-10-21
slug: versicarium
versionLabel: 1.0.0-rc.2
versionName: 回归修复与字体分层
versionSummary: 修 rc.1 真机回归，新增窄屏浮动列贴边设置与字体覆盖策略，字体资产改为 base + DLC。
versionOrder: 4
image: images/preview.webp
draft: false
---

1.0.0-rc.2 是当前预览版本，对应 10-21 01:58 的 `89fc493`。它收掉 rc.1 真机验收发现的问题，并把字体换成按角色分层加载。10-22 00:34 的字体提交 `185c2be` 仍记在这个包版本名下。

移动端修复来自 `8e63498`。窄屏只在桌面启用滚动条槽，横向裁剪交给 body；触屏的悬停与点按描边按输入模态关闭，浮动列四个按钮加 pointer 兜底，44px 热区向内收并留净空；涟漪用命名快照探针校正圆心，搜索浮层换成半透明模糊蒙版。后台新增 `site.railOffsetPx`，窄屏浮动列到右缘的距离可配，0–32px，默认 6。构建侧新增 `check:viewport-overflow`，`f027d5a` 同步了文档。

字体改动把 base 与 DLC 分开：按 text、display、meta 角色生成基础分片，生僻字按 180 KB 切片，靠 `unicode-range` 按需下载；`font:build` 串起下载、字符集、子集和两遍构建，资产带内容哈希。常用页首屏从约 2.25 MB 降到约 305.6 KB（p50）、319.6 KB（p90）。`public/fonts/` 从 5.2 MB 涨到 22.69 MB，示例站同步主题要加 `--include-fonts`。后台「排版字体」新增 `ui.fontCoverage`，`full` 默认，`common` 只加载基础分片。

发布状态：`v1.0.0-rc.1` 是带注释标签，`v1.0.0-rc.2` 是轻量标签，两个标签都已推到远端；GitHub Release 仍未创建。`4d2fb3b`、`89fc493` 的提交说明当时写的是预览阶段不推送标签、不创建 Release，后来两个标签才推上去。远端 `main` 停在 `89fc493`，10-22 的字体提交 `185c2be` 还在本地，没有进标签。标签要不要重打、字体算进哪个版本，等发布收口时再定。10-21 `blog` 站点迁到 rc.2，备案、Forgejo 部署与 Umami 统计保留，随后由维护者手动部署到 planetarium1001.com。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [示例站](https://planetarium1001.github.io/astro-versicarium/) · [开发日志](/devlog/#versicarium-2026-10-21-mobile-regression-and-rc2) · [字体分层](/devlog/#versicarium-2026-10-22-font-layering)
