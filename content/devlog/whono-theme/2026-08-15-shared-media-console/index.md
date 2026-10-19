---
title: 资源工作区整合图片与共享媒体
date: 2026-08-15
project: Whono Theme
projectSlug: whono-theme
kind: improvement
description: 把图片与附件合并到 /admin/resources/，引入集合级共享资源、引用状态与整条目导入导出。
draft: false
---

资源页最初只管理图片，附件与共享媒体分散在内容目录里。整合后的 `/admin/resources/` 把两者放进同一工作区，旧地址 `/admin/images/` 由 301 指向新地址。左侧内容库按集合、系列、版本或条目、目录展开，右侧预览与详情抽屉处理具体文件，树与预览之间可以横向滚动查看长条目名。

上传落点按当前选择决定：图片进入条目的 `images/`，附件进入 `files/`；选中共享资源时写入 `content/<collection>/_shared/images` 或 `_shared/files`。内容库把 `content/<collection>/_shared/` 与 `public/images/<collection>/_shared/` 一起归入集合级共享资源节点，共享资源不要求条目已经有 Markdown 主文件，因此可以先上传素材，再写正文。

筛选覆盖集合、系列、版本或条目、目录、引用状态、类型、日期与关键词，状态写入 URL，刷新或分享链接后仍能恢复当前视图。批量操作支持重命名、移动、删除，选择状态跟随当前筛选；详情抽屉提供复制路径、复制 Markdown 引用、导出条目 ZIP 与文本附件预览。引用状态统计正文与 frontmatter 的引用次数，区分已引用、未引用与孤儿，帮助清理没有入口的素材。

资源接口与内容写入共用同一套版本检查与文件事务，开发环境可写，生产构建不输出写入入口。整合后，内容台、资源台与前台正文对同一个条目目录达成一致，不再需要分别记忆图片与附件的两套路径。

[后台控制台概览](/blog/2026-10-05-admin-console/) · [项目](/projects/#whono-theme)
