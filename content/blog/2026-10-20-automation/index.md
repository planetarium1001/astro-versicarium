---
title: 自动化校验
description: 用脚本与 CI 保持模板结构稳定。
date: 2026-10-20
publishedAt: 2026-10-20
tags: [模板, 自动化]
draft: false
---

模板通过源码守卫与产物守卫检查类型、样式、图片引用、布局几何与触控尺寸。修改主题代码后执行 `npm run verify`，不要只跑构建。

## 守卫

`npm run check` 负责源码级检查，`npm run verify` 再执行构建、快照刷新、测试与产物检查。

## 约定

新增脚本放在 `scripts/`，在 `package.json` 中登记命令，并把需要长期保留的检查接入 `check` 或 `verify`。
