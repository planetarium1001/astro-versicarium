---
title: 项目、动态与日志
description: 项目多版本、动态短记录与按项目归档的开发日志，三种内容的字段、公开位置与写法。
date: 2026-10-19
publishedAt: 2026-10-19
tags: [说明, 项目]
draft: false
---

除文章之外，站点还有三个内容区：项目、动态与开发日志。三者共用 `content/` 下的条目目录，主文件同样是 `index.md`，字段比文章少一些，但各有固定的用途。

## 项目

项目用来介绍作品，一个项目可以有多个版本。

- 单版本项目只需要一个目录。
- 多版本项目给每个版本建一个目录，所有版本填同一个不带日期的 `slug`。
- `title` 与 `date` 必填；`subtitle`、`description`、`type`、`image`、`icon` 可选。
- 版本字段包括 `versionLabel`、`versionName`、`versionSummary` 与 `versionOrder`。

<details>
<summary>三个版本条目的目录</summary>

```text
content/projects/<PROJECT-ID>/index.md
content/projects/<DATE-LATEST>/index.md
content/projects/<DATE-OLD>/index.md
```

</details>

版本按日期降序排序，日期相同时看 `versionOrder`。`subtitle` 与 `description` 会出现在卡片与弹窗里，`type` 是标题前的分类标签。

`/projects/` 每个项目只显示最新版卡片，点开卡片可以在弹窗里切换到其他版本。单版本项目不写版本字段也能正常显示。

项目没有标签、仓库与演示字段。仓库、演示这类外链写在正文末尾的链接组里，与正文之间空一行。

## 动态

动态是短记录，放在 `content/bits/`，不进入归档。

- `date` 必填，`title` 可以省略。
- 支持 `description`、`tags`、`images`、`author` 与 `draft`。
- 目录名按日期与时间命名，便于按时间排序；`npm run new:bit` 会生成 `bits-<日期>-<时间>` 形式的草稿。
- 公开位置是 `/bits/`，页面按时间列出，并支持按标签筛选。

动态适合一两段随手记录：一条进展、一张图、一句结论。`images` 的顺序就是页面上的显示顺序，`alt` 写一句图片说明；`author.avatar` 相对 `public/` 填写。两者规则不同，写法见[卡片图、分享图与末尾链接](/blog/2026-10-22-card-images-and-links/)。

也可以运行 `npm run dev` 后在后台的写作页新建。动态不追求完整结构，需要标题、目录与长文时，写成文章更合适。

## 开发日志

开发日志按项目归档，放在 `content/devlog/<项目>/<条目>/`。

<details>
<summary>一条开发日志的目录</summary>

```text
content/devlog/<PROJECT-SLUG>/<DATE-ENTRY>/
  index.md
```

</details>

- `title`、`date` 与 `project` 必填，`project` 是项目显示名，不生成链接。
- `projectSlug` 可选，用来把日志挂到具体项目上。
- `kind` 可选，用 `feature`、`fix`、`improvement`、`breaking` 或 `docs`。

`kind` 标注这次变化的性质：`feature` 是新功能，`fix` 是修复，`improvement` 是改进，`breaking` 是需要调整用法的改动，`docs` 是文档。它用于归类，不改变页面结构。

日志的页面位置是 `/devlog/#<压平后的条目 ID>`，条目目录里的斜杠换成连字符。打开项目弹窗时，会一起列出该项目的开发日志，这是日志与项目关联的主要入口。

日志写方向性的变化与影响，例如能力边界、行为调整与使用方式的变化，不逐条罗列提交。一次日志对应一个阶段，标题说清这一阶段做了什么。

## 三者的分工

- 项目回答「这是什么、有哪些版本」。
- 动态回答「最近发生了什么」。
- 开发日志回答「某一个阶段改了什么」。

同一件事可以分别落在三处：项目文档记录最终能力，日志记录过程，动态发一条简短的进展。三者面向的读者也不同：项目文档面向第一次了解作品的人，日志面向持续跟踪进展的人，动态面向偶尔路过的人。

三个区都支持 `draft`，草稿只在开发环境可见。项目与开发日志正文的末尾可以放链接组，动态与文章不走这套机制。末尾链接组必须是正文最后一段，每行只由链接与分隔符组成，格式见[卡片图、分享图与末尾链接](/blog/2026-10-22-card-images-and-links/)。

项目、动态与日志的正文以说明为主，通常不放代码块；需要展示代码或写完整教程时，用文章更合适。目录名同样参与页内定位，改名会让旧链接失效。

字段全表见[内容与写作](https://github.com/planetarium1001/astro-versicarium/blob/main/docs/content.md)。
