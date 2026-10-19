---
---

astro-whono-tweaked 是一个基于 Astro 的双栏博客主题，面向希望以代码和项目为主组织内容的开发者。它在 [cxro/astro-whono](https://github.com/cxro/astro-whono)（MIT）的基础上改造，保留上游的壳层、后台控制台、Markdown 扩展与字体子集流程，并围绕内容版本、项目文档与主题更新做了增量实现。

## 面向的读者

这个主题假设站点首先是一个工程记录与项目展示空间，而不是写作平台。文章、项目、动态与开发日志分别建模；项目可以按独立文档维护多个版本；后台提供内容、资源与设置控制台。若目标只是尽快发布纯文字博客，上游主题或更轻的模板会更直接。

## 设计取向

- 内容与代码分离：作者内容集中在 `content/`，主题代码留在 `src/`，升级主题时不覆盖站点内容。
- 结构化集合：`blog`、`projects`、`bits`、`devlog`、`about` 五个集合各有路由与 frontmatter 约束。
- 可用性优先：列表、归档、项目弹窗与版本提示共用同一套条目排版，前台关键交互不依赖客户端框架。
- 可重复更新：`theme:update` 按文件三方合并主题变更，站点自有路径保持原样。

## 来源与致谢

本项目基于 [cxro/astro-whono](https://github.com/cxro/astro-whono)（MIT）改造，初始提交来自上游。感谢上游作者在双栏布局、后台控制台与 Markdown 管线上打下的基础。站点使用 [Astro](https://astro.build/) 构建，许可证见仓库中的 LICENSE。

::site-info{name="astro-whono-tweaked" url="https://github.com/planetarium1001/astro-whono-tweaked" description="面向开发者的双栏 Astro 博客主题，支持内容版本、项目文档与三方合并更新。"}

## 常见问题

:::faq{question="它和上游主题是什么关系？"}
本仓库保留上游的提交历史与核心结构，在其上增加项目多版本文档、资源控制台、主题更新通道与站点设置项。上游更新通过普通 git 合并吸收，主题更新通过 `theme:update` 分发到站点。
:::

:::faq{question="适合直接用来写博客吗？"}
可以，但它的默认结构偏向工程记录与项目展示。只有 Markdown 文章时，`blog` 集合即可满足；项目、动态与开发日志可以留空。
:::

:::faq{question="主题更新会覆盖我的内容吗？"}
不会。`content/`、`src/data/settings/`、`public/images/`、`public/author/`、`public/fonts/`、`tools/`、`tests/fixtures/` 与 `theme.json` 等站点自有路径不参与覆盖，`theme:update` 只在报告中列出。
:::

## 联系

- 邮箱：[me@planetarium1001.com](mailto:me@planetarium1001.com)
- 仓库：[github.com/planetarium1001/astro-whono-tweaked](https://github.com/planetarium1001/astro-whono-tweaked)
- 问题与建议：[提交 Issue](https://github.com/planetarium1001/astro-whono-tweaked/issues)
