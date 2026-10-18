---
title: "内容流程: 稳定版"
description: 用三篇文章记录内容目录、版本字段与发布前检查清单，并收拢为稳定版约定。
date: 2026-09-02
publishedAt: 2026-09-02T10:30:00+08:00
updatedAt: 2026-09-05
series: content-workflow
slug: content-workflow
versionLabel: v2.0
versionName: 稳定版
versionSummary: 补齐检查清单，固定目录与版本约定。
versionOrder: 3
tags: [内容, 流程, 示例]
badge: 指南
draft: false
---

稳定版把前两版的约定收拢成一份可执行的清单，适合作为日常写作的入口。

## 背景

内容变多以后，列表、系列与版本路由容易混在一起。这个系列用三篇文章记录同一套流程的演进，每一版都保留当时的目录与字段。

## 目录约定

- 每篇文章放在 `content/blog/<entry>/index.md`。
- 旧版目录带日期与版本后缀，最新版目录保留日期与系列名。
- 图片与附件留在条目目录，正文用相对路径引用。

## 版本约定

- `series` 使用稳定的小写名称，最新版写 `slug`。
- `versionOrder` 从 1 开始递增，`versionLabel` 与 `versionName` 一一对应。
- 旧版不写 `slug`，通过日期路径访问。

## 检查清单

- 标题、日期、标签与徽标是否完整。
- 最新版是否保留稳定路径。
- 正文中的链接与附件是否可访问。

稳定版没有新增字段，只把检查项写全，后续内容可以直接沿用。
