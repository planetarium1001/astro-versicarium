---
title: 项目文档级多版本与稳定锚点
date: 2026-06-20
project: Whono Theme
projectSlug: whono-theme
kind: feature
description: 同一项目的多份版本文档共享 slug，最新版与历史版各有稳定锚点，并接入归档与开发日志。
draft: false
---

项目原先用内联 `versions[]` 保存版本元数据，只能显示版本历史，无法为每个版本提供独立正文。新模型把版本提升为独立文档：每个版本一个目录与一份 `index.md`，所有文档共享一个非日期形式的 `slug`。当前版本的字段写在 frontmatter 顶层，`versions[]` 只保留没有独立文档的旧历史元数据；存在 `versions[]` 时必须提供 `versionLabel`，避免历史版本没有当前版本号可对照。

路由逻辑集中在 `src/lib/project-routing.ts`。最新版锚点使用共享 `slug`，例如 `/projects/#whono-theme`；历史版锚点使用条目 ID 压平后的日期形式，例如 `/projects/#2026-04-01-whono-theme`。分组按日期倒序、`versionOrder` 倒序、条目 ID 升序排列，保证同一日期下顺序稳定。项目页只渲染最新版卡片，点击后打开弹窗，弹窗内可以切换全部版本文档并显示“历史版本”提示。

同一套分组也供归档与开发日志使用。归档按版本文档成行，并可通过 `src/data/settings/page.json` 的 `archive.versionMode` 收敛到最新版；开发日志用 `projectSlug` 关联项目，未解析的非空值会在构建期告警。修改已发布项目的 `slug` 会改变公开锚点并可能断开关联，因此 slug 在发布后保持稳定。新增版本只需要复制目录与 frontmatter，不改动旧版正文。

[项目当前版本](/projects/#whono-theme) · [内容模型](/blog/2026-10-03-content-model/)
