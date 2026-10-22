---
title: rc.1 真机回归与 rc.2
date: 2026-10-21
project: Versicarium
projectSlug: versicarium
kind: fix
description: 收敛真机验收发现的移动端问题，新增窄屏浮动列贴边设置与视口溢出守卫，版本推进到 1.0.0-rc.2。
draft: false
---

`8e63498`（10-21）收敛 rc.1 真机验收发现的移动端问题。窄屏只在桌面启用滚动条槽，横向裁剪交给 body，并新增 `check:viewport-overflow` 守卫；交互层用 `data-input` 记录输入模态，触屏不再保留悬停描边，浮动列四个按钮加触摸 pointer 兜底，click 被内核吞掉时也能一次触发。

浮动列本身也改了：44px 热区向内收、相邻留净空，原生提示移除，提示气泡改到按钮下方并对齐右缘。涟漪用命名快照探针校正移动端圆心偏移并加超时清理，搜索浮层换成半透明模糊蒙版。后台新增 `site.railOffsetPx`，窄屏浮动列到右缘的距离可配，0–32px，默认 6。

`f027d5a` 同步文档：`development.md` 补 `check:viewport-overflow` 与触屏基线，`admin-console.md` 补新设置项，`architecture.md` 补 `--rail-action-offset-narrow` 的构建期链路。

`89fc493` 把版本推到 `1.0.0-rc.2`，CHANGELOG 新增 rc.2 条目，`.release-please-manifest.json` 同步，轻量标签 `v1.0.0-rc.2` 打在 `89fc493` 上。提交说明当时写的是预览阶段不推送标签、不创建 Release；实际 `v1.0.0-rc.2` 后来推到了远端，GitHub Release 仍未创建。

[项目 1.0.0-rc.2](/projects/#versicarium) · [仓库](https://github.com/planetarium1001/astro-versicarium)
