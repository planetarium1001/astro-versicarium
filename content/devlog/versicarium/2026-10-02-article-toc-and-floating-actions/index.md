---
title: 文章目录与浮动操作列
date: 2026-10-02
project: Versicarium
projectSlug: versicarium
kind: feature
description: fork 后第一次提交，补上目录定位、右下角浮动入口与更紧凑的壳层布局。
draft: false
---

`5b0914d`（2026-10-02）是 fork 后的第一次提交。仓库从直接沿用上游示例，转为可以长期维护的自有站点：保留双栏壳层与后台，先补阅读体验与基础门禁。

文章目录进入宽屏壳层第 4 列，阅读模式下按 1024px 门槛展开，窄屏折叠在正文顶部。目录可以收起并记忆状态，滚动时高亮当前小节，跳转后短暂高亮目标章节；读长文时不必来回滚动寻找位置。

右下角新增浮动操作列，按需显示阅读模式、回到上次阅读位置与回到顶部。侧栏由 320px 收为 224px，壳层宽度随视口自适应；主题切换改为以点击处为圆心的圆形展开过渡。

同一提交加入首屏 critical CSS 漂移检查与 GitHub Pages 预览工作流，后续每次提交都有可复现的构建与样式对照。

[项目 0.1.0](/projects/#2026-10-02-versicarium) · [仓库](https://github.com/planetarium1001/astro-versicarium)
