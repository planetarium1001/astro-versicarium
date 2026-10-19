---
title: 主题快速开始
description: 安装、开发与构建的最小步骤。
date: 2026-10-01
publishedAt: 2026-10-01
tags: [快速开始]
draft: false
---

从仓库取得模板后，安装依赖并启动开发服务器。生产构建输出静态文件，可部署到任意静态托管。

## 安装

```bash
npm ci
npm run dev
```

## 构建

```bash
SITE_URL=https://example.com npm run build
```

`SITE_URL` 用于 RSS、canonical 与 sitemap。没有它时 sitemap 不生成，产物校验会失败。

## 下一步

阅读 `docs/writing.md` 了解 frontmatter 与图片路径，阅读 `docs/deployment.md` 了解部署配置。
