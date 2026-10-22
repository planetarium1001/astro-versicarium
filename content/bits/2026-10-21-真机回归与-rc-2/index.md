---
date: 2026-10-21
title: 真机回归与 rc.2
tags: [移动端, 版本]
author:
  name: Planetarium
draft: false
---

`8e63498`（10-21）收敛 rc.1 真机验收的移动端回归：窄屏滚动条槽只在桌面启用、浮动列 44px 热区留出净空、触屏 click 被内核吞掉时补一次 pointer 兜底、涟漪圆心按命名快照校正、搜索浮层换成半透明模糊蒙版。新增 `check:viewport-overflow` 守卫。

窄屏浮动列贴边距离进了后台设置（`site.railOffsetPx`，0–32，默认 6）。同批提交把版本推到 `1.0.0-rc.2`；`v1.0.0-rc.2` 标签后来推到了远端，GitHub Release 仍未创建。
