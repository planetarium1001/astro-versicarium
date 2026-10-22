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

0.1.0 是项目文档里的第一个版本节点，对应提交 `5b0914d`（2026-10-02 12:49）。这一版没有重写上游：保留双栏壳层、后台控制台、Markdown 扩展与字体子集流程，先把 fork 后的仓库整理成能长期维护的基线，明确主题代码与站点内容的边界。

最直接的变化在阅读体验。文章目录成为宽屏壳层的第 4 列，阅读模式下按 1024px 门槛展开，窄屏折叠在正文顶部；可以收起并记忆状态，滚动时高亮当前小节，跳转后短暂高亮目标章节。右下角新增浮动操作列，按需显示阅读模式、回到上次阅读位置与回到顶部。侧栏由 320px 收到 224px，主题切换改为以点击处为圆心的圆形展开过渡，并遵循系统的减少动态偏好。

工程侧补了两道基础门禁：首屏 critical CSS 漂移检查与 GitHub Pages 预览工作流。10-03 的 `0a7b5c3` 更新 README 并上传一批截图；10-04 的 `b06c6ae` 补上浏览数据的 PV/UV 槽位与工信部、公安备案信息，并修掉滚动条出现或消失时整页横向跳动的问题。

当时的 `package.json` 还是上游留下的 0.5.0，版本号到 10-16 才改成 1.0.0。项目文档里的 0.1.0 记的是这一阶段，不代表包版本。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [开发日志](/devlog/#versicarium-2026-10-02-article-toc-and-floating-actions)
