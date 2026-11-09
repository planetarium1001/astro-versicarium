---
title: 写一篇属于系列的文章
description: 一个 series 值、一个阅读次序，就能让同一主题下的文章连成一条线。
date: 2026-11-07
publishedAt: 2026-11-07
tags: [主题, 写作]
series: upgrade-to-0-2
seriesName: 升级到 0.2.0
seriesOrder: 2
draft: false
---

系列不需要额外目录，也不需要新建集合。想在篇章之间建立顺序，只要在文件开头写三个字段：

- `series`：系列标识，同一系列各篇保持一致；
- `seriesOrder`：阅读次序，从小到大；
- `seriesName`：系列显示名，可省略，省略时用 `series` 的值。

次序只在系列内部生效：`seriesOrder` 缺省的文章排在最后，再按日期升序、目录名兜底，所以后补的文章不会插到最前面。系列也不改变文章自己的地址——它仍然是 `YYYY-MM-DD-slug`，或者你指定的 `slug`。

需要改版本是另一件事：同一篇内容改版时填 `versionGroup`，再配 `versionLabel` 与 `versionOrder`。两者混在一篇文章上也没问题，版本抽屉与同系列抽屉各管各的。
