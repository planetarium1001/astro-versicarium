---
title: 组件与样式边界
description: 页面、组件与样式目录的职责划分。
date: 2026-10-20
publishedAt: 2026-10-20
tags: [模板, 组件]
draft: false
---

页面负责取数与路由，组件负责展示，样式按页面或组件拆分。公共交互放在 `src/scripts/`，后台脚本只在开发环境加载。

## 组件

展示组件放在 `src/components/`，后台组件放在 `src/components/admin/`，避免公开页面引入后台代码。

## 样式

`src/styles/` 以页面和组件为边界组织，公共变量在 `global.css`。新增选择器前先确认是否已有可复用规则。
