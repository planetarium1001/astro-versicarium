---
title: 内容模型与导航重构
date: 2026-10-14
project: Versicarium
projectSlug: versicarium
kind: refactor
description: 集合改为 blog / projects / bits / devlog / about，列表筛选、归档与后台控制台同步重做。
draft: false
---

`df93e3f`（2026-10-14）重构了内容模型与导航。这是一次破坏性变更：`essay` 更名为 `blog`，`memo` 集合移除，新增 `projects` 与 `devlog`，`/archive/` 改为跨集合的全站时间线。

内容从单文件改为目录式条目，每条一个目录，`index.md` 与 `images/`、`files/` 同级；条目 ID 规范为 `YYYY-MM-DD-title`，公开路径默认使用完整条目 ID（含日期前缀），frontmatter 的 `slug` 可以覆盖。图片落点统一为 `public/images/<collection>/<slug>/`，上传、重命名与引用校验共用同一套规则。

列表筛选同步重做：标签筛选支持 AND/OR 复合表达式、URL 持久化与实时计数；服务端分页取消，改为全量渲染后在客户端分页与筛选，禁用 JavaScript 时仍可阅读。归档加入作用域胶囊，动态支持年份筛选，开发日志支持项目筛选。

后台控制台收敛为概览、主题、写作、图片、数据五个模块，仅开发环境可写，生产构建输出只读静态壳。主题设置沿用五份 JSON，按新集合调整字段与后台控件，保存前校验字段并给出变更预览。

[项目 0.5.0](/projects/#2026-10-14-versicarium) · [仓库](https://github.com/planetarium1001/astro-versicarium)
