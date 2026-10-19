---
title: Astro 7 升级与构建链调整
date: 2026-03-12
project: Astro
kind: improvement
description: 升级 Astro 主版本并收敛构建期配置，保持现有页面与内容接口不变。
draft: false
---

Astro 7 的内容加载器与图片管线带来了一些默认值变化。升级时先固定 `output` 与 `trailingSlash`，再逐项核对 Markdown 处理器、字体注册与 sitemap 过滤，避免构建结果在页面结构上出现漂移。

升级后重新生成了测试快照与字体字符集，并确认后台编辑器岛在开发环境与生产构建中的边界没有变化。内容目录和 frontmatter 不需要迁移。

[仓库](https://github.com/planetarium1001/astro-whono-tweaked)
