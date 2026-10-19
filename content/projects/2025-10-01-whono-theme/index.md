---
title: Whono Theme
subtitle: 从上游模板到自有基线
description: 保留上游双栏壳层与后台框架，建立独立的内容目录、设置边界与主题更新基线。
type: 主题
date: 2025-10-01
slug: whono-theme
versionLabel: 0.1.0
versionName: 基础版本
versionSummary: 完成仓库从上游示例到自有主题基线的收敛，确定内容与代码的分层。
versionOrder: 1
draft: false
---

v0.1.0 是 astro-whono-tweaked 脱离上游示例状态后的第一个自有基线。此版本的目标不是增加功能，而是把仓库整理成可以长期维护的主题模板：保留上游的双栏壳层、后台控制台、Markdown 扩展与字体子集流程，清理与站点自有内容冲突的示例文件，并确定主题代码与站点内容的边界。

这一版把后续工作拆成三条线：内容模型负责集合、条目与版本；后台能力负责写作、资源与设置；主题分发负责把主题改进安全地送到已有站点。v0.1.0 只完成基础收敛，不包含项目文档级多版本、资源工作区整合与条目版本界面，这些能力在 v0.5.0 与 1.1.0 中逐步落地。

版本的公开范围保持克制：先保证主题可以安装、构建与部署，再增加结构性功能。内容组织方式与项目版本模型在 v0.5.0 定型，主题更新通道在后续版本补齐二进制处理与冲突边界。

[仓库](https://github.com/planetarium1001/astro-whono-tweaked) · [开发日志](/devlog/#whono-theme-2026-02-05-main-demo-split)
