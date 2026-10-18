---
title: 写作与发布流程
date: 2026-02-02
description: 从本地预览到静态部署的完整流程。
tags: [写作]
---

主题是纯静态输出，写作与发布之间只隔一次构建。

## 本地预览

```bash
npm run dev
```

开发服务器默认运行在 `http://localhost:4321`，后台入口为 `/admin/`。

## 构建与部署

```bash
SITE_URL=https://example.com npm run build
```

构建结果在 `dist/`，可直接交给任意静态托管。`SITE_URL` 影响 RSS、canonical 与 sitemap 的绝对地址。
