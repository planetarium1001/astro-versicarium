---
title: 内容与代码分离
description: 保持 content 与 src 的边界，降低主题更新成本。
date: 2026-10-20
publishedAt: 2026-10-20
tags: [模板, 内容]
draft: false
---

作者内容放在 `content/`，主题代码留在 `src/`。主题更新只覆盖主题文件，站点内容、设置与图片属于站点自有路径。

## 内容目录

每个条目是一个目录，包含 Markdown 主文件与同级资源目录。条目 ID 一旦发布就应保持稳定。

## 更新

合并主题更新后执行 `npm run verify`，并检查 `theme.json` 的基准提交是否已推进。
