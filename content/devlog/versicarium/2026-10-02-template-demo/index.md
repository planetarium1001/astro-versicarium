---
title: 一条开发日志的写法
date: 2026-10-02
project: Versicarium
projectSlug: versicarium
kind: docs
description: 演示开发日志的字段、目录位置与正文写法。
draft: false
---

这篇日志用来演示开发日志的字段与正文写法，可以整条替换成自己的记录。

开发日志放在 `content/devlog/<项目>/<条目>/`，每个项目一个目录。文件开头的字段写标题、日期、项目显示名与项目标识：`project` 是显示用的名称，`projectSlug` 用于把日志挂到项目上，`kind` 标注类型，说明这次是新增、修复、改进还是文档。`description` 是一句话摘要，会出现在列表与搜索里。

正文写方向性的变化与影响，例如新增了什么能力、哪些行为调整了、使用时要注意什么。一次日志写一个阶段，不必逐条罗列提交。需要引用代码或设置时，用行内代码或短代码块说明即可。

标题写清这一阶段做了什么，日期与实际时间保持一致。日志会按项目出现在开发日志列表和项目弹窗里，读者可以据此跟踪项目的进展。写完把 `draft` 改为 `false` 即可发布。

[写作与内容结构](/blog/2026-10-01-writing-and-content-structure/) · [项目](/projects/#versicarium)
