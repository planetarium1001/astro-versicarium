---
title: 开始使用这个模板
description: 从内容目录、开发命令到第一次构建，了解模板的最小结构。
date: 2026-10-20
publishedAt: 2026-10-20
tags: [介绍, 模板]
draft: false
---

这是模板的种子文章，用于验证文章路由、目录、代码块与页面样式。删除它不会影响主题代码，但请保留至少一篇文章以便本地构建与测试快照正常工作。

## 目录与内容

作者内容放在 `content/` 下。每个条目是一个目录，主文件为 `index.md`，图片与附件放在同级目录。`blog`、`projects`、`bits`、`devlog` 与 `about` 各自有独立的 schema 与路由。

## 开发与构建

```bash
npm ci
npm run dev
npm run build
```

开发服务器启动后，前台入口是 `/`，后台入口是 `/admin/`。发布前执行 `npm run verify`，并在环境中提供 `SITE_URL`。

## 下一步

阅读仓库中的 `README.md` 与 `docs/`，按自己的站点替换内容、设置与品牌资源。
