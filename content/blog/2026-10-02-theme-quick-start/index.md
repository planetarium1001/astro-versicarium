---
title: 主题快速开始
description: 0.1.0 时期的做法：内容放在 src/content/ 的单文件里，集合还叫 essay、bits、memo。
date: 2026-10-02
publishedAt: 2026-10-02
tags: [快速开始, 版本]
series: theme-quick-start
versionLabel: "0.1.0"
versionName: 单文件内容根（旧版）
versionSummary: 内容在 src/content/，集合为 essay / bits / memo / about，一篇文章就是一个 Markdown 文件。
versionOrder: 1
draft: false
---

这是旧版做法，对应 2026-10-02 的仓库状态。现在的代码已经读不了 `src/content/` 下的 `essay` 和 `memo`，这份步骤只作为版本对照保留。当前做法见[目录式内容根](/blog/2026-10-19-theme-quick-start/)。

## 取一份主题

```bash
git clone --depth 1 --branch main <主题仓库地址> my-site
cd my-site
npm install
npm run dev
```

当时包名还是 `astro-whono`，`package.json` 版本为 0.5.0。开发服务器起来后前台在 `/`，后台在 `/admin/`，且只有开发环境能写。

## 写第一篇文章

文章放在 `src/content/essay/`，一个条目就是一份 Markdown 文件，文件名是英文 slug：

```text
src/content/essay/my-first-post.md
```

frontmatter 用 `title`、`date`、`tags`、`draft`，可选 `description`、`badge`、`updatedAt`。公开地址是 `/archive/<slug>/`，`/archive/` 同时是文章列表。

图片放在集合目录下的子目录，正文用相对路径引用：

```markdown
![截图](./my-first-post/cover.webp)
```

对应文件 `src/content/essay/my-first-post/cover.webp`。动态用 `npm run new:bit` 生成，写出 `src/content/bits/bits-YYYY-MM-DD-HHMM.md` 这样一个文件。

## 当时的检查

`npm run verify` 只有三步：`check` → `test` → `build`。没有图片引用检查，也没有主题更新命令，主题更新靠 git 合并。
