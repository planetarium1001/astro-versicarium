---
title: 内容模型与目录式条目
description: 五个集合、目录式条目、frontmatter、公开路由与全站归档的实际组织方式。
date: 2026-10-20
publishedAt: 2026-10-20
tags: [内容模型, 集合]
draft: false
---

Versicarium · 垄录 把作者内容全部放在仓库根目录的 `content/` 下，当前版本为 `1.0.0-rc.1` 预览版。每个条目是一个目录，目录内至少有一份 `index.md`，图片与附件作为同级目录存在。后台写作页、直接编辑 Markdown 与归档页面读取的都是同一份源文件。

![归档页，按年月组织的全站时间线](/images/demo/archive.png)

![主题首页，桌面宽度下的双栏布局与引导区](/images/demo/home-desktop.png)

![移动宽度下的首页布局](/images/demo/home-mobile.png)

## 五个集合

| 集合 | 源文件 | 公开路由 |
| --- | --- | --- |
| `blog` | `content/blog/<entry>/index.md` | `/blog/`、`/blog/<entryId>/` |
| `projects` | `content/projects/<entry>/index.md` | `/projects/`、`/projects/#<anchor>` |
| `bits` | `content/bits/<entry>/index.md` | `/bits/` 页内锚点 |
| `devlog` | `content/devlog/<projectSlug>/<entry>/index.md` | `/devlog/` 页内锚点 |
| `about` | `content/about/index.md` | `/about/` |

`blog` 是长文，`projects` 是项目文档，`bits` 是短动态，`devlog` 是按项目归档的开发记录，`about` 是固定单页。五者的 frontmatter 并不相同，字段以 `src/content.config.ts` 的 schema 为准；写入不在 schema 中的字段不会自动获得渲染行为。

## 目录式条目

一个博客条目与它的资源目录如下：

```text
content/blog/2026-10-20-theme-quick-start/
  index.md
  images/cover.webp
  files/checklist.txt
```

条目目录名同时是条目 ID，规范为 `YYYY-MM-DD-title`。日期与 frontmatter 的 `date` 对齐，标题段使用小写 kebab-case，允许中文。后台新建条目时按标题生成这个 ID；手工创建时也应遵循同一格式，避免条目在归档与后台列表中排在异常位置。

条目主文件按 `index.md`、唯一的 `.md`、唯一标记 `entry: true` 的文件顺序确定；集合根目录下散落的 Markdown 不属于任何条目，构建与后台都会拒绝。`devlog` 多一层项目目录：`content/devlog/<projectSlug>/<YYYY-MM-DD-title>/index.md`，这层目录决定页面锚点中的项目前缀。`about` 没有条目目录，只有一份 `content/about/index.md`。

图片与附件的写入位置由后台决定：条目图片进入 `images/`，附件进入 `files/`；集合级共享资源进入 `content/<collection>/_shared/`，图片与附件分目录存放。正文中的图片可以写以 `/` 开头的 public 路径，也可以写相对条目目录的路径；条目内附件在构建时复制到 `/content-assets/`。

## frontmatter

一篇博客的最小 frontmatter：

```yaml
---
title: 主题快速开始
description: 从环境要求到第一次构建。
date: 2026-10-20
tags: [快速开始, 环境]
draft: false
---
```

常用字段：

- `title` 与 `date` 必填，`description` 留空时按正文截取摘要。
- `tags` 是字符串数组，参与列表页与归档的标签筛选。
- `draft` 默认 `false`；草稿只在开发环境可见，生产构建、公开列表与 RSS 会过滤。
- `publishedAt`、`updatedAt` 用于区分发布时间与更新时间，`updatedAt` 不得早于 `date`。
- `slug` 覆盖默认公开路径，取值必须是小写 kebab-case，允许中文；`page` 与 `rss.xml` 是保留值。
- `series`、`versionLabel`、`versionName`、`versionSummary`、`versionOrder` 用于把同一系列的多篇文档组织成版本。

`projects` 的版本字段写在版本文档自己的 frontmatter 顶层。同一项目的多个文档共享一个非日期形式的 `slug`，`versionOrder` 决定同一日期的排序；旧的内联 `versions[]` 仅用于保留没有独立文档的历史元数据。`devlog` 用 `projectSlug` 关联项目。`bits` 额外支持 `images` 与 `author`，作者未填时使用 `page.json` 的 `bits.defaultAuthor`。`projects` 与 `devlog` 没有仓库、演示一类的链接字段，外链写在正文末尾的链接组。

## 公开路由

博客的默认公开路径使用完整条目 ID，例如目录 `2026-10-20-content-model` 发布到 `/blog/2026-10-20-content-model/`。frontmatter 的 `slug` 可以覆盖它，但必须满足小写 kebab-case 规则，且不能与 `/blog/` 下的静态路由冲突。

同一 `series` 的多篇文档被视为同一系列的不同版本，排序依据为日期倒序、`versionOrder` 倒序与条目 ID 升序。为系列版本设置 `slug` 时，所有版本必须使用同一个值，否则构建期报错；最新版获得 `/blog/<slug>/`，日期路径作为别名保留。不设置 `slug` 时，各版本都使用带日期的路径，最新版是 canonical，历史版本标记 `noindex` 并从 RSS 与 sitemap 中排除。系列的最新版才出现在列表、RSS 与 sitemap 中。

项目文档的锚点规则不同：最新版使用共享 `slug`，例如 `/projects/#versicarium`；历史版使用条目 ID 压平后的日期锚点，例如 `/projects/#2026-10-02-versicarium`。修改已发布项目的 `slug` 会改变公开锚点，并可能断开开发日志关联。

## 归档

`/archive/` 是跨集合的全站时间线，按年月分组，包含博客、项目与开发日志，不包含动态。项目按版本文档成行，而不是只出现最新版；页面顶部的范围筛选可以把项目版本收敛到最新版。

归档的版本模式由 `src/data/settings/page.json` 的 `archive.versionMode` 控制：`all` 显示全部版本文档，`latest` 每个项目只显示最新版。该设置与 `/projects/` 的版本弹窗相互独立，修改归档模式不会删除历史版本页面。

后台写作页、内容列表与资源页读取的是同一批目录条目。条目 ID、frontmatter 与资源目录一旦发布就应保持稳定；需要改标题时优先改 `title`，不要随意重命名目录。frontmatter 字段在后台中的对应位置见[后台控制台概览](/blog/2026-10-20-admin-console/)；系列与版本的发布约定见[发布与版本管理](/blog/2026-10-20-release-and-versioning/)。
