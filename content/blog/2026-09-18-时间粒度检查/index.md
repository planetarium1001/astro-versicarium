---
title: "时间粒度检查: 日期与时间"
description: 说明日期与时间粒度的显示方式，以及字段缺失时的回退规则。
date: 2026-09-18
publishedAt: 2026-09-18T16:45:00+08:00
updatedAt: 2026-09-20
tags: [时间, 设置]
badge: 指南
dateGranularity: datetime
draft: false
---

时间字段既可以是日期，也可以精确到时间。这一篇说明页面如何选择显示粒度，以及字段缺失时的回退顺序。

## 字段与粒度

- `date` 是必填字段，决定文章在列表与归档中的位置。
- `publishedAt` 与 `updatedAt` 可以写日期，也可以带时间。
- 本篇设置 `dateGranularity: datetime`，覆盖全局默认的 `date`。

## 显示与回退

- 元信息按发布时间与更新时间显示，时间存在时保留到分钟。
- 文章没有 `publishedAt` 时回退到 `date`；没有时间部分时只显示日期。
- 列表卡片与文章页共用同一套粒度设置，避免同一篇内容出现两种格式。

## 检查清单

- 确认时区偏移写在时间字符串里。
- 检查 `updatedAt` 不早于 `date`。
- 对比列表与详情页，确认时间格式一致。
