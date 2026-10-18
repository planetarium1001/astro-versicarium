---
title: "内容流程: 初版"
description: 记录内容目录与日期字段的初始约定，作为系列的起点。
date: 2026-08-04
publishedAt: 2026-08-04T10:00:00+08:00
series: content-workflow
versionLabel: v1.0
versionName: 初版
versionSummary: 建立目录与日期字段的初始约定。
versionOrder: 1
tags: [内容, 流程, 示例]
badge: 示例
draft: false
---

初版先固定文章目录与日期字段，让后续版本有稳定的对照。

## 本版要点

- 每篇文章使用独立目录，入口文件为 `index.md`。
- 目录名以日期开头，方便按时间排序。
- `date` 是必填字段，列表与归档都用它定位。
- 标签写成数组，数量控制在三个以内。

## 目录约定

- 单篇文章直接放在 `content/blog/` 下。
- 系列内容按版本分目录，目录名带版本后缀。
- 图片放在条目内的 `images/`，附件放在 `files/`。

## 与下一版的差异

初版没有 `slug`，只保留 `series` 与版本字段，也没有旧版提示。下一版会补充稳定路径与旧版说明，让同一主题的多个版本可以互相跳转。
