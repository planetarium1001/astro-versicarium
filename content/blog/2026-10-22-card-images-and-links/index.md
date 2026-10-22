---
title: 卡片图、分享图与末尾链接
description: 项目卡片图与图标、动态配图与作者头像、文章分享图，以及只对项目与日志生效的末尾链接组。
date: 2026-10-22
publishedAt: 2026-10-22
tags: [说明, 图片]
draft: false
---

卡片图、分享图与末尾链接组都不在正文里，分别写在条目的开头设置与正文最后一段。这些字段分布在不同集合，写错不会让页面打不开，只会让卡片缺图、分享卡片缺少图片，或链接不显示。

三类字段的路径基准并不相同：项目与文章里的图片字段相对条目目录，动态的作者头像相对 `public/`，末尾链接组则写在正文文本里。

## 字段示例

项目与文章的图片字段都写在开头设置里：

```yaml
# projects 条目
image: images/preview.webp
icon: images/icon.svg

# blog 条目
ogImage: images/share.webp
ogImageAlt: 项目版本弹窗截图
```

## 项目卡片图与图标

项目有两个图片字段：`image` 是卡片缩略图，`icon` 是卡片上的图标。两者都接受条目内的相对图片，或 `https://` 开头的外链。

图片放在条目目录的 `images/` 里，路径相对条目目录，不写 `public/`，也不写前导斜杠。外链只接受 `https://`，用外链时图片不随站点一起发布，托管方访问不到或链接失效时卡片会缺图，能放进仓库的图片优先放本地。

`image` 不填时卡片不显示缩略图，`icon` 不填时卡片不显示图标。项目列表只显示最新版卡片，历史版在弹窗里各自读取自己条目目录的图片，因此每个版本可以配不同的图。

## 动态配图与作者头像

动态用 `images` 数组配图，每项写 `src`，可以再写 `alt`。`author` 有 `name` 与 `avatar` 两项。

```yaml
images:
  - src: images/hero.webp
    alt: 主题首页截图
author:
  name: Versicarium
  avatar: author/avatar.svg
```

`images[].src` 与项目图片一样，是条目内相对路径或 `https://` 地址；多张图片按数组顺序排列。`alt` 会作为图片的替代文本，图片无法显示时仍有说明。一条动态只有文字时，`images` 整个字段可以省略。

`author.avatar` 的规则不同：它相对 `public/`，不写前导斜杠，不写 `public/`，也不能写成网址。上面的 `author/avatar.svg` 实际指向 `public/author/avatar.svg`。头像扩展名限 avif、gif、jpg、jpeg、png、svg、webp；不填时使用后台设置的动态默认作者。不同动态可以署名不同作者。

## 文章分享图

分享图字段只在文章集合里：`ogImage` 与 `ogImageAlt`。`ogImage` 写条目内的相对路径或 `https://` 地址，也可以用 `ogImage: none` 显式关闭这一篇的分享图。`ogImageAlt` 是分享图的替代文本，配合 `ogImage` 使用，写一句能说明图片内容的话即可。

没有填写时不输出分享图，每篇文章单独设置。分享图不影响页面正文，只在分享卡片与页面元信息里出现。分享图地址依赖构建时的站点地址 `SITE_URL`；不填 `SITE_URL` 时，页面里的正式地址与分享图都不输出，发布前的检查会失败。

## 末尾链接组

项目与开发日志可以在正文末尾放一组外链，渲染成右对齐的链接行。规则有两条：链接组前空一行，链接组是正文最后一段，每行只由 Markdown 链接与分隔符组成。

```markdown
项目的最后一段正文。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [文档](https://github.com/planetarium1001/astro-versicarium/tree/main/docs)
```

一行可以放多个链接，链接之间用 `·`、`|`、`、`、`,`、`，`、`/` 或空白分隔；渲染时只保留等距间隔，不输出分隔符。链接组必须是文末连续的行，混入普通文字就按普通段落渲染。带协议的链接只接受 `http`、`https`、`mailto` 与 `tel`，其他协议会被丢弃。

链接组适合放仓库、文档、演示这类固定的地址。正文里只有链接组一行也可以，但前面通常要保留正文。多行链接组会按顺序合成一行显示，每行同样只能有链接与分隔符。

链接组只对 `projects` 与 `devlog` 生效。`blog` 与 `bits` 不走这套机制，正文里的链接按普通 Markdown 渲染。链接组不会进入摘要，也不会在正文里重复出现。

## 常见写错

- 项目图片写成 `public/images/preview.webp`：图片字段按条目目录解析，应写 `images/preview.webp`。
- 作者头像写成 `/author/avatar.svg`：前导斜杠会被拒绝，去掉斜杠，写成 `author/avatar.svg`。
- 把 `ogImage` 写在项目或动态条目上：这两个集合没有分享图字段，分享图只属于文章。
- 末尾链接组前没有空行：会按普通段落渲染，不会变成右对齐的链接行。
- 在 `blog` 里等末尾链接组生效：这套机制只对项目与开发日志生效。

## 写入位置

| 字段 | 集合 | 路径基准 |
| --- | --- | --- |
| `image`、`icon` | `projects` | 条目目录，或 `https://` |
| `images[].src` | `bits` | 条目目录，或 `https://` |
| `author.avatar` | `bits` | `public/` |
| `ogImage`、`ogImageAlt` | `blog` | 条目目录，或 `https://` |
| 末尾链接组 | `projects`、`devlog` | 正文文本 |

图片路径写错时，`npm run check:image-references` 会列出无法解析的引用，卡片图与分享图都走这项检查。提交前运行一次即可。

字段细节见[内容与写作](https://github.com/planetarium1001/astro-versicarium/blob/main/docs/writing.md)。
