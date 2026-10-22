---
title: 移动端真机回归
date: 2026-10-21
project: Versicarium
projectSlug: versicarium
kind: fix
description: rc.1 验收后的移动端集中修复。
draft: false
---

rc.1 真机验收后集中处理移动端问题，改动覆盖 78 个文件。窄屏布局、触屏交互、主题切换涟漪、搜索浮层、描述行与浮动操作列都在这一轮调整，并补了 `railOffsetPx` 这类布局参数，让浮动列在窄屏上避开内容与安全区。

问题多来自桌面尺寸下的假设：固定偏移、依赖悬停的反馈、触控区域过小。修复后窄屏上的阅读、搜索与回到顶部恢复可用，桌面端的视觉与行为保持不变；回归项按设备与页面分别核对，避免修好一处又破坏另一处。

这轮没有改内容模型与公开路由，属于预览发布前的质量收敛。验收以真机截图与实际触控为准，不只看响应式断点；浮动列与目录在窄屏上的位置也在同一轮统一，安全区与触控尺寸按实测调整。

此后移动端成为每条改动的必检项，rc.2 与后续版本都按真机验收。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [提交](https://github.com/planetarium1001/astro-versicarium/commit/8e63498)
