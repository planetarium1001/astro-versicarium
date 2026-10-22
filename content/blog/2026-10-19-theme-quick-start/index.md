---
title: 主题快速开始
description: 当前做法：内容根在仓库根的 content/，一个条目一个目录，图片和附件跟着条目走。
date: 2026-10-19
publishedAt: 2026-10-19
tags: [快速开始, 版本]
series: theme-quick-start
versionLabel: "1.0.0-rc.1"
versionName: 目录式内容根
versionSummary: 内容根迁到仓库根 content/，五个集合，条目目录自带 index.md、images/ 与 files/。
versionOrder: 2
draft: false
---

这份步骤对应 10-19 的 `4575975`，内容结构随后随 `1.0.0-rc.1` 发布。旧版内容根的做法见[2026-10-02 的版本](/blog/2026-10-02-theme-quick-start/)。

## 取一份主题

```bash
git clone --depth 1 --branch main --single-branch \
  https://github.com/planetarium1001/astro-versicarium.git my-site
cd my-site
npm install
npm run dev
```

`npm run dev` 之前会先跑 `scripts/favicon.mjs` 生成图标。前台在 `/`，后台在 `/admin/`；写作页是 `/admin/content/`，图片与附件的管理工作区是 `/admin/resources/`。

## 写第一篇文章

内容根在仓库根目录的 `content/`，和主题代码分开。一个条目是一个目录，目录名就是条目 ID，规范 `YYYY-MM-DD-title`：

```text
content/blog/2026-10-19-my-first-post/
  index.md
  images/cover.webp
  files/checklist.txt
```

frontmatter 的 `title` 与 `date` 必填，`description` 留空时按正文截取；`slug` 可以覆盖公开路径。公开地址默认是 `/blog/<条目ID>/`，例如 `/blog/2026-10-19-my-first-post/`。

图片写在条目的 `images/` 目录，正文引用相对路径：

```markdown
![封面](images/cover.webp)
```

附件放进 `files/`，构建时复制到 `/content-assets/`。同一系列的多篇文章用 `series` 关联，并用 `versionLabel`、`versionSummary`、`versionOrder` 标出版本；项目可以维护多份版本文档，共享一个非日期形式的 `slug`，开发日志按 `content/devlog/<projectSlug>/<条目>/` 存放。

日期按站点时区解析，纯日期和带时分两种写法都支持。`/archive/` 变成跨集合的时间线，按年月分组。

后台的新建条目会按标题和当天日期生成目录名。也可以直接建目录、写 `index.md`，两条路落到同一份源文件。

## 当前检查

`npm run verify` 的顺序扩到 `check` → `build` → `test:fixtures` → `test` → `check:prod-artifacts` → `check:layout-geometry` → `check:touch-targets`；`check` 里已经包含图片引用检查，图挂了会在构建前被拦下。rc.2 起又加了两步：`check:viewport-overflow`，以及构建后的 `font:coverage -- --strict`。

主题更新改成 `npm run theme:update`，按 `theme.json` 的基准提交做文件级三方合并，先用 `-- --check` 看会动哪些文件。
