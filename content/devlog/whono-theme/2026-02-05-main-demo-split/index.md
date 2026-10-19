---
title: 拆分 main 与 demo 并建立主题更新通道
date: 2026-02-05
project: Whono Theme
projectSlug: whono-theme
kind: feature
description: 用 theme.json 记录基准提交，让站点按文件三方合并主题更新，同时保留示例站与模板的边界。
draft: false
---

主题仓库最初同时承担模板与示例站两种角色，示例内容、示例设置和测试快照会跟着主题代码一起进入模板。拆分后，`main` 只保留主题代码、少量种子内容与中性默认设置，`demo` 承载完整示例站并负责 GitHub Pages 部署。主题改动先在 `main` 完成，再在 `demo` 检出上同步，方向固定为单向。

同步机制落在 `scripts/theme-update.mjs`。站点根目录的 `theme.json` 记录主题仓库、跟踪分支与上一次合并到的提交；脚本先检查工作树是否干净，再抓取主题分支，比较基准提交与新提交之间的文件变更。每个变更文件都读取基准版本、主题新版本与站点当前版本，文本文件交给 `git merge-file --diff3` 做三方合并。

站点自有路径不参与覆盖，包括 `content/`、`src/data/settings/`、`public/images/`、`public/author/`、`public/fonts/`、`tools/`、`tests/fixtures/`、`README.md`、`.github/workflows/pages.yml` 与 `theme.json`。二进制文件无法逐行合并，按整文件取舍；只有双方都改过时才记为冲突并保留站点版本。

存在冲突时，文本文件写入带标记的合并结果，二进制文件保留站点版本；脚本以非零状态退出，并且不更新 `theme.json` 的基准提交。解决冲突后重跑同一命令即可基于原基准再次合并。`--check` 模式只报告变更，不写文件；主题删除的文件只进入报告，不自动移除。合并完成后执行 `npm run verify`，避免把类型、构建或快照问题带进下一次提交。

[主题更新说明](/blog/2026-10-07-theme-update/) · [项目](/projects/#whono-theme)
