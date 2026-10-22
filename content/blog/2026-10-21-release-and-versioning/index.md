---
title: 发布与版本：从 1.0.0 到 rc.2
description: 版本号怎么从 1.0.0 走到 rc.2，Release Please 管什么、不管什么，以及标签和 Release 现在还差哪一步。
date: 2026-10-21
publishedAt: 2026-10-21
tags: [发布, 版本]
draft: false
---

主题的版本号不是装饰。它决定站点升级时要不要改内容：frontmatter 字段语义、公开路由、`theme:update` 的合并契约，任何一样变了都是主版本；新增设置项和版本字段是次版本；渲染和布局修复是修订版本。

10-16 22:18 的 `33bbfbc` 先把 `package.json` 定到 1.0.0。那时 `main` 已经在 10-15 晚上 `d17570c` 回归模板形态：示例内容和示例截图移除，每类只留几条种子内容，设置回到中性默认值，`pages.yml` 只部署 `demo`，`ci.yml` 同时覆盖两个分支，测试也不再读示例文件。模板和示例站从那天起分家。

10-20 凌晨版本号又改了两次。02:04 的 `8ca2839` 把 `main` 作为 1.1.0 最小模板发过一版；更名之后首个公开版本定为 1.0.0，1.1.0 的记录并进 1.0.0 预览。05:38 的 `4d2fb3b` 再推到 `1.0.0-rc.1`，`release-please-config.json` 设成 `versioning: prerelease`、`prerelease: true`、`prerelease-type: rc`，`include-v-in-tag` 打开，manifest 的 `initial-version` 记 1.0.0-rc.1。

Release Please 是流程里的一环，不是全部。它监听 `main` 的推送，按约定式提交收集 `feat`、`fix`，更新 `package.json` 和 `CHANGELOG.md` 并开出版本 PR。首个预览候选是手工写进去的：版本号、CHANGELOG 条目和 manifest 三处一起改，再打标签。`v1.0.0-rc.1` 是带注释标签，落在 10-20 05:47 的 `f887527` 上。

10-21 凌晨，rc.1 的真机验收结果回来了。移动端一串回归在 `8e63498` 修掉：窄屏滚动条槽、44px 热区、触屏 hover 残留、涟漪圆心、搜索浮层、窄屏浮动列贴边距离。`f027d5a` 同步文档，`89fc493` 把版本推到 `1.0.0-rc.2`，CHANGELOG 新增条目，轻量标签 `v1.0.0-rc.2` 打在 `89fc493` 上。

真正装包的动作在 `.github/workflows/release.yml`。GitHub Release 发布后触发，先核对标签和 `package.json` 的版本一致，再用 `git archive` 把该标签的已跟踪文件打成 `astro-versicarium-<版本>.zip`，生成 `SHA256SUMS`，一起挂到同一个 Release。`git archive` 只看已跟踪文件，所以 `node_modules`、`dist`、本地缓存天然进不了包。

预览阶段的打算是标签不推、Release 不建：`4d2fb3b` 和 `89fc493` 的提交说明都这么写。实际两个标签后来都推到了远端，GitHub Release 仍然是空的。远端 `main` 停在 `89fc493`，10-22 的字体提交 `185c2be` 还在本地，`1.0.0-rc.2` 的包版本已经包含它，但 `v1.0.0-rc.2` 标签停在 10-21 的提交上。重建标签，还是把字体算进下一个候选，发布收口时再决定。

同一天还有一件仓库外的事：`blog` 站点从旧主题迁到 1.0.0-rc.2，备案、Forgejo 部署和 Umami 统计都保留，随后由维护者手动部署到 planetarium1001.com。迁移提交在另一个仓库里，不在主题仓库。

版本推进的记录在开发日志里：[rc.1 真机回归与 rc.2](/devlog/#versicarium-2026-10-21-mobile-regression-and-rc2)。
