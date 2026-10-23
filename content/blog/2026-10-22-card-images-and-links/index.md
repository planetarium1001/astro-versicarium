---
title: 卡片图、分享图与末尾链接
description: 项目卡片图与图标、动态配图与作者头像、文章分享图，以及只对项目与日志生效的末尾链接组。
date: 2026-10-22
publishedAt: 2026-10-22
tags: [说明, 图片]
draft: false
---

卡片图、分享图与末尾链接组都不在正文里，分别写在条目的开头设置与正文最后一段。写错不会让页面打不开，只会让卡片缺图、分享卡片缺少图片，或链接不显示。

三类字段的路径基准并不相同：项目与文章里的图片字段相对条目目录，动态的作者头像相对 `public/`，末尾链接组写在正文文本里。

## 字段一览

| 字段 | 集合 | 路径基准 |
|---|---|---|
| `image`、`icon` | `projects` | 条目目录，或 `https://` |
| `images[].src` | `bits` | 条目目录，或 `https://` |
| `author.avatar` | `bits` | `public/` |
| `ogImage`、`ogImageAlt` | `blog` | 条目目录，或 `https://` |
| 末尾链接组 | `projects`、`devlog` | 正文文本 |

## 项目卡片图与图标

`image` 是卡片右侧的缩略图，也用在项目弹窗里；`icon` 是标题前的图标。

<details>
<summary>项目卡片的设置</summary>

```markdown
---
title: <PROJECT-NAME>
date: <DATE>
image: images/cover.webp
icon: images/icon.svg
---
```

</details>

- 两者都可以写条目目录里的相对路径或 `https://` 地址，都不填时显示纯文字卡片。
- 路径相对条目目录，不写 `public/`，也不写前导斜杠。
- 外链只接受 `https://`；用外链时图片不随站点一起发布，托管方访问不到或链接失效时卡片会缺图。
- 项目列表只显示最新版卡片，历史版在弹窗里各自读取自己条目目录的图片，因此每个版本可以配不同的图。

## 动态配图与作者头像

`images` 按书写顺序显示，`author.name` 是署名，`author.avatar` 是头像路径。

<details>
<summary>带图片与作者的动态</summary>

```markdown
---
date: <DATE-TIME>
images:
  - src: images/shot.webp
    alt: <ALT>
author:
  name: <AUTHOR>
  avatar: author/avatar.svg
---
```

</details>

- `src` 写条目内的相对路径或 `https://` 地址；`alt` 是图片说明，图片无法显示时仍有替代文本。
- 一条动态只有文字时，`images` 整个字段可以省略。
- 头像路径相对 `public/`，不写 `public/`，也不以 `/` 开头，不能写成网址；上面的 `author/avatar.svg` 实际指向 `public/author/avatar.svg`。
- 头像扩展名限 avif、gif、jpg、jpeg、png、svg、webp。
- 不填时使用动态页设置里的默认作者；不同动态可以署名不同作者。

## 文章分享图

分享图字段只在文章集合里：`ogImage` 与 `ogImageAlt`。

- `ogImage` 写条目内的相对路径或 `https://` 地址，写 `none` 时关闭这一篇的分享图。
- `ogImageAlt` 是分享图的替代文本，写一句能说明图片内容的话。
- 分享图不会显示在页面上，只出现在链接预览与页面元信息里。
- 没有配置 `SITE_URL` 时不输出分享图。

## 末尾链接组

项目与开发日志可以在正文末尾放一组外链：最后一段只放 Markdown 链接，前面空一行。

<details>
<summary>末尾链接组的写法</summary>

```markdown
项目的最后一段正文。

[仓库](https://github.com/<USER>/<REPO>) · [演示](https://example.com)
```

</details>

- 链接之间用 `·` 分隔，`|`、`、`、`,`、`，`、`/` 与空白也接受，渲染时只保留等距间隔。
- 只支持 `http`、`https`、`mailto` 与 `tel`，其他协议会被丢弃。
- 链接组必须是文末连续的行；混入普通文字就按普通段落渲染。
- 链接组不进入摘要，也不会在正文里重复出现。
- 一行可以放多个链接，多行会按顺序合成一行显示。

链接组只对 `projects` 与 `devlog` 生效。`blog` 与 `bits` 不走这套机制，正文里的链接按普通 Markdown 渲染。

## 常见写错

- 项目图片写成 `public/images/cover.webp`：图片字段按条目目录解析，应写 `images/cover.webp`。
- 作者头像写成 `/author/avatar.svg`：前导斜杠会被拒绝，去掉斜杠，写成 `author/avatar.svg`。
- 把 `ogImage` 写在项目或动态条目上：分享图只属于文章集合。
- 末尾链接组前没有空行：会按普通段落渲染，不会按链接组渲染。
- 在 `blog` 里等末尾链接组生效：这套机制只对项目与开发日志生效。

图片路径写错时，`npm run check:image-references` 会列出无法解析的引用，卡片图与分享图都走这项检查；`npm run verify` 里包含它。

字段细节见[内容与写作](https://github.com/planetarium1001/astro-versicarium/blob/main/docs/content.md)。
