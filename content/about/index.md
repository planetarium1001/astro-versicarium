---
---

Versicarium · 垄录 是一个以内容目录为边界的 Astro 博客主题，面向工程记录与项目展示。品牌句是“一行一垄，一版一录。”：每一次版本转向都会留下几行记录，站点的职责是把这些短行收存成册。当前版本 1.0.0，处于预览阶段。

## 名字

拉丁语 `versus` 的本义是犁沟与转向。古人书写如牛耕，写完一行必须转向下一行，“行”“诗行”与“犁沟”由此共用同一个词。`versiculus` 是它的指小形式，指可以被抛出、等待回应的短句；后缀 `-arium` 指向具体的存放场所。合起来，Versicarium 是把一次次转向留下的短行收存起来的地方。

中文名“垄录”接住同一个动作：垄是犁沟，也是代码行与日志行；录是收存、应答与归档。博客、项目、动态与开发日志分别对应长文、版本、短句与开发记录，共用同一套条目结构。

## 站点定位

这个主题假设站点首先是工程记录，而不是写作平台。文章、项目、动态与开发日志分别建模；同一项目可以维护多份版本文档；后台提供内容、资源与设置控制台。若目标只是尽快发布纯文字博客，上游主题或更轻的模板会更直接。

- 内容与代码分离：作者内容集中在 `content/`，主题代码留在 `src/`，升级主题时不覆盖站点内容。
- 结构化集合：`blog`、`projects`、`bits`、`devlog`、`about` 五个集合各有路由与 frontmatter 约束。
- 可用性优先：列表、归档、项目弹窗与版本提示共用同一套条目排版，前台关键交互不依赖客户端框架。
- 可重复更新：`theme:update` 按文件三方合并主题变更，站点自有路径保持原样。

## 来源与致谢

本项目从 [cxro/astro-whono](https://github.com/cxro/astro-whono)（MIT）开始。上游提供了双栏壳层、后台控制台、Markdown 扩展与字体子集流程；本仓库保留其提交历史与许可，在内容模型、项目版本、资源管理与主题更新上继续改造。上游是设计起点，不是本站的版本。

站点使用 [Astro](https://astro.build/) 构建，完整许可与版权声明见仓库中的 LICENSE。

::site-info{name="Versicarium · 垄录" url="https://github.com/planetarium1001/astro-versicarium" description="面向工程记录与项目展示的 Astro 博客主题，支持内容版本、项目文档与三方合并更新。"}

## 常见问题

:::faq{question="它和上游主题是什么关系？"}
本仓库保留上游 cxro/astro-whono 的提交历史与核心结构，在其上增加项目多版本文档、资源控制台、主题更新通道与站点设置项。上游更新通过普通 git 合并吸收，主题更新通过 `theme:update` 分发到站点。
:::

:::faq{question="适合直接用来写博客吗？"}
可以，但默认结构偏向工程记录与项目展示。只有 Markdown 文章时，`blog` 集合即可满足；项目、动态与开发日志可以留空。
:::

:::faq{question="主题更新会覆盖我的内容吗？"}
不会。`content/`、`src/data/settings/`、`public/images/`、`public/author/`、`public/fonts/`、`tools/`、`tests/fixtures/` 与 `theme.json` 等站点自有路径不参与覆盖，`theme:update` 只在报告中列出。
:::

## 联系

Versicarium 的作者是 Planetarium（[planetarium1001](https://github.com/planetarium1001)），主题改造、示例内容与文档都在公开仓库中进行。

- 邮箱：[me@planetarium1001.com](mailto:me@planetarium1001.com)
- 仓库：[github.com/planetarium1001/astro-versicarium](https://github.com/planetarium1001/astro-versicarium)
- 示例站：[planetarium1001.github.io/astro-versicarium](https://planetarium1001.github.io/astro-versicarium/)
- 问题与建议：[提交 Issue](https://github.com/planetarium1001/astro-versicarium/issues)
