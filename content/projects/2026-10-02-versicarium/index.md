---
title: Versicarium
subtitle: 从上游示例到自有基线
description: 保留上游双栏壳层与后台框架，确定内容目录、设置边界与主题更新的独立基线。
type: 主题
date: 2026-10-02
slug: versicarium
versionLabel: 0.1.0
versionName: 基础基线
versionSummary: fork 后的第一次提交，仓库从上游示例状态转为可长期维护的自有站点。
versionOrder: 1
draft: false
---

0.1.0 是 fork 后的第一个自有基线，对应提交 `5b0914d`（2026-10-02 12:49）。这一版没有重写上游，而是先把仓库从直接沿用示例的状态整理成可长期维护的主题：保留双栏壳层、后台控制台、Markdown 扩展与字体子集流程，明确主题代码与站点内容的边界。

最直接的变化在阅读体验。文章目录成为宽屏壳层的第 4 列，阅读模式下按 1024px 门槛展开，窄屏折叠在正文顶部；目录可以收起并记忆状态，滚动时高亮当前小节，跳转后短暂高亮目标章节。长文从此有了稳定的定位入口。

右下角新增浮动操作列，按需显示阅读模式、回到上次阅读位置与回到顶部。布局同时收紧：侧栏由 320px 收为 224px，壳层宽度随视口自适应，前后台侧栏内边距统一；主题切换改为以点击处为圆心的圆形展开过渡，并遵循系统的减少动态偏好。

工程侧补了两道基础门禁：首屏 critical CSS 漂移检查与 GitHub Pages 预览工作流。此后每次提交都有可复现的构建与样式对照，为后续内容模型重构提供稳定起点。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [开发日志](/devlog/#versicarium-2026-10-02-article-toc-and-floating-actions)
