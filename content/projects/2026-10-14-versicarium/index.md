---
title: Versicarium
subtitle: 内容模型与导航重构
description: 五个集合落位，条目改成目录，列表筛选、归档与后台控制台同步重做。
type: 主题
date: 2026-10-14
slug: versicarium
versionLabel: 0.5.0
versionName: 内容模型
versionSummary: 集合改为 blog / projects / bits / devlog / about，条目进入目录式存储。
versionOrder: 2
draft: false
---

0.5.0 对应提交 `df93e3f`（2026-10-14 13:46），主题在这一版完成内容模型与导航的重构。这是一次破坏性变更：`essay` 更名为 `blog`，`memo` 集合移除，新增 `projects` 与 `devlog`，`/archive/` 改为跨集合的全站时间线，动态不进归档。

内容组织从单文件转向目录式条目：每条内容一个目录，`index.md` 与 `images/`、`files/` 同级；条目 ID 规范为 `YYYY-MM-DD-title`，公开路径默认使用完整条目 ID（含日期前缀），frontmatter 的 `slug` 可覆盖成短路径。图片落点统一为 `public/images/<collection>/<slug>/`，上传、重命名与引用校验共用同一套规则。这套图片路径在 10-19 又被条目目录取代。

列表与筛选在同一版重做。标签筛选改为控件条加弹窗，支持 AND/OR 复合表达式、URL 持久化与实时计数；列表页取消服务端分页，改为全量渲染后在客户端分页与筛选，禁用 JavaScript 时仍可阅读。归档加入作用域胶囊，动态支持年份筛选，开发日志支持项目筛选。

后台控制台收敛为概览、主题、写作、图片、数据五个模块，仅开发环境可写，生产构建输出只读静态壳。主题设置沿用站点、侧栏、首页、内页、界面五份 JSON，按新集合调整字段与后台控件，保存前校验字段并给出变更预览。`package.json` 在这一阶段仍沿用上游的 0.5.0。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [示例站](https://planetarium1001.github.io/astro-versicarium/) · [开发日志](/devlog/#versicarium-2026-10-14-content-model-and-navigation)
