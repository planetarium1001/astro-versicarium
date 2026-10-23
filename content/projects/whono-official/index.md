---
title: Whono
subtitle: 本站主题的设计起点
description: 一个极简双栏的 Astro 博客主题，本站的双栏布局、本地后台与字体子集流程都从这里来。
type: 参考
date: 2026-08-13T00:00:00.000Z
slug: whono-official
image: https://raw.githubusercontent.com/cxro/astro-whono/main/public/preview-light.png
draft: false
---

Whono 是一个极简双栏的 Astro 博客主题，用于个人写作与轻量内容发布。侧栏导航配内容区，桌面与移动端各自成版，内容分随笔、絮语、小记与关于四个集合。

- 本地后台在 `/admin/` 管理站点配置、内容与图片资源，只在开发环境可写。
- 絮语页可以一键生成 Markdown，支持多图并自动读取尺寸。
- 归档与分栏 RSS、浅色与深色模式、阅读模式都是自带能力。

## 派生关系

本站主题从 Whono 分出来，双栏布局、本地后台、Markdown 扩展与字体子集流程都沿用它。第一版只做长文阅读增量，内容模型在之后的版本里才与上游分开。

- Whono 是设计起点，不是需要跟随的仓库。
- 本仓库已脱离它的 fork network，不再跟踪它的提交。
- 更新只取 `planetarium1001/astro-versicarium`，Issue 与 PR 也只指向这个仓库。
- `theme.json` 记录主题来源仓库、分支与基准提交，供 `theme:update` 三方合并。

Whono 以 MIT 许可发布，本站保留其版权声明，见 `LICENSE`。

[Whono 仓库](https://github.com/cxro/astro-whono) · [Whono 演示](https://astro.whono.me)
