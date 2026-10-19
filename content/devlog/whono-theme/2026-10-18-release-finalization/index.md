---
title: 1.1.0 发布收尾：文档、资源与内容
date: 2026-10-18
project: Whono Theme
projectSlug: whono-theme
kind: docs
description: 收敛版本界面与分页设置，重写文档和示例内容，补齐合并边界后以 1.1.0 发布。
draft: false
---

1.1.0 收尾阶段先处理版本界面。归档、博客卡片与首页移除了重复的历史胶囊，版本上下文只保留在文章页的版本提示与版本抽屉中；条目版本名称改为由后台设置控制，可选择不显示、显示在标题后或版本号后。列表分页同时改为按页面配置，首页、博客、动态、开发日志与归档各有自己的开关与条数。

随后处理合并边界。`theme:update` 的二进制处理补上整文件取舍，提交 `250f220` 修正了二进制文件的合并路径，`f6e8e40` 又在其中加入相等短路，避免站点与主题内容相同时被误判为冲突。文本文件继续使用 `git merge-file --diff3`，存在冲突时不更新 `theme.json` 的基准提交。

文档与内容同步重写。README 收敛环境、命令、主题同步与分支模型；`docs/writing.md` 对齐五个集合的实际 frontmatter 与目录规则；`docs/admin-console.md` 按概览、主题、内容、资源、快照重新组织。示例站内容改为围绕主题自身的快速开始、内容模型、后台、更新、发布与 Markdown 六篇指南，项目与开发日志使用同一套多版本文档结构。

发布前以 `npm run verify` 作为门禁，依次执行类型检查、构建、刷新测试快照、运行测试与产物校验。版本号在 `package.json` 中更新为 1.1.0，Release 说明列出功能范围与升级步骤；`main` 保持模板与更新来源，`demo` 部署示例站，同步仍为单向。

[发布与版本管理](/blog/2026-10-09-release-and-versioning/) · [仓库](https://github.com/planetarium1001/astro-whono-tweaked)
