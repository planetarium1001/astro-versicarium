---
title: 主题快速开始
description: 0.1.0 时期的安装与运行说明，已被 1.0.0 预览版取代。
date: 2026-10-02
publishedAt: 2026-10-02
tags: [历史版本, 快速开始]
series: theme-quick-start
versionLabel: "0.1.0"
versionName: 首个版本
versionSummary: 只覆盖 fork 后的克隆、安装与开发命令。
versionOrder: 1
draft: false
---

0.1.0 是 Versicarium · 垄录 的历史版本，对应 fork 后的第一次提交 `5b0914d`，内容只覆盖当时的克隆、安装与开发命令。内容结构、后台入口与主题更新方式在此后都发生过变化，历史版本不作为新站点的操作依据。

## 安装与运行

当时的安装流程只有三步：

```bash
git clone --depth 1 --branch main \
  https://github.com/planetarium1001/astro-versicarium.git my-site
cd my-site
npm install
npm run dev
```

这一步只确认站点可以启动，没有环境基线、构建校验与目录结构清单。

## 与当前版本的差异

1.0.0 预览版补齐了环境要求、构建校验、目录结构与第一次检查，并加入主题更新与发布流程。当前说明见[主题快速开始](/blog/2026-10-20-theme-quick-start/)，其中包含 `npm run verify`、`SITE_URL` 与后台入口的完整步骤。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [示例站](https://planetarium1001.github.io/astro-versicarium/)
