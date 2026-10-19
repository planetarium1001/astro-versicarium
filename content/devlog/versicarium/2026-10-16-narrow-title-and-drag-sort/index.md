---
title: 窄屏标题与后台拖拽排序
date: 2026-10-16
project: Versicarium
projectSlug: versicarium
kind: feature
description: 站点标题支持窄屏单独设置，后台导航与社交链接可以拖拽排序，分割线改为贯通。
draft: false
---

`0ae6a54`（2026-10-16）新增窄屏标题。站点标题可以单独设置窄屏版本，留空或全空白时回落到宽屏标题；后台“站点设置”同步增加该输入项与长度校验，两个标题都走同一套富文本白名单渲染。

后台侧栏导航与社交链接的条目列表加入拖拽锚点，支持鼠标拖拽与方向键移动；放下后按新的 DOM 顺序把序号输入框重写为 1 到 N，提交与编解码逻辑不变。窄屏下安排导航顺序不再需要手工改序号。

同一提交把侧栏与内容区之间的分割线改为贯通壳层上下，去掉两端 50px 留白；社交链接默认只保留 GitHub 与 email，站点标题、描述、页脚版权与仓库链接改为指向本仓库。about 页同时补上对上游 cxro/astro-whono 与设计来源的致谢。

[项目 0.5.0](/projects/#2026-10-14-versicarium) · [仓库](https://github.com/planetarium1001/astro-versicarium)
