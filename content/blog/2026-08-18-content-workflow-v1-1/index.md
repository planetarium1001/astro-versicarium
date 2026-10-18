---
title: "内容流程: 修订版"
description: 在初版基础上补充版本字段与旧版路径说明，并记录下一版要补齐的检查项。
date: 2026-08-18
publishedAt: 2026-08-18T10:00:00+08:00
series: content-workflow
versionLabel: v1.1
versionName: 修订版
versionSummary: 补充版本字段说明，旧版继续走日期路径。
versionOrder: 2
tags: [内容, 流程, 示例]
badge: 示例
draft: false
---

修订版保留初版的目录结构，重点补充系列字段与版本路径的说明。

## 本版要点

- 明确 `series` 用于把同一主题的多个版本归入一组。
- 最新版写 `slug`，旧版不写，避免占用稳定路径。
- `versionOrder` 按发布时间递增，`versionLabel` 与 `versionName` 保持一致。
- 正文引用图片与附件时，优先使用条目内的相对路径。

## 版本约定

- `v1.0` 只说明目录与日期，没有写版本摘要。
- `v1.1` 补齐 `versionSummary`，让版本抽屉能显示一句话说明。
- 旧版页面仍在角落提示“历史版本”，并提供回到最新版的链接。

## 与下一版的差异

下一版会把检查清单写全，并把系列的稳定路径固定下来。本版暂不新增字段，只调整说明顺序，方便对照前后变化。
