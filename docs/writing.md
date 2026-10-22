# 内容与写作

> 本文档为使用文档，不涉及代码、开发等内容。代码分层、命令参数与实现细节见[开发文档：内容与写作](developers/writing.md)。

内容放在 `content/`。每条内容是一个目录，正文写在目录里的主文件；文件开头的设置（frontmatter）决定标题、日期与是否公开。

## 内容放在哪

`content/` 下分成五个区：

| 分区 | 内容 | 位置 |
| --- | --- | --- |
| 文章 | 长文，可以组成系列 | `content/blog/` |
| 项目 | 项目介绍，可以有多份版本文档 | `content/projects/` |
| 动态 | 短句、图片与随手记录，可以没有标题 | `content/bits/` |
| 开发日志 | 按项目记录的开发进展 | `content/devlog/<项目>/` |
| 关于页 | 固定单页 | `content/about/index.md` |

一个条目一个目录，主文件通常叫 `index.md`。图片和附件放在同级目录。

新建内容有两种方式：

- 在后台新建：运行 `npm run dev` 后打开 `/admin/`，进入写作页，选好区再新建。后台会生成目录、主文件与常用设置。
- 手动新建：在对应区里建目录和 `index.md`，自己写开头的设置。

目录名会参与默认网址或页内定位，建议写成 `2026-05-01-标题`：日期在前，标题用小写与连字符，中文也可以。动态按日期时间命名，开发日志放在对应项目目录下。

草稿不会出现在线上：开发环境可以看到，构建后的站点、列表和订阅源都会跳过草稿。需要先写好再发布时，把 `draft` 设为 `true`，准备好后再改回 `false`。

## 文件开头的常用设置

| 设置 | 用途 |
| --- | --- |
| `title` | 标题。动态可以不写。 |
| `date` | 日期。写 `2026-05-01` 或 `2026-05-01 09:30`，不要写错格式。 |
| `description` | 一句话摘要，列表与搜索会用到。 |
| `tags` | 标签列表，例如 `[记录, 整理]`。 |
| `draft` | 草稿。写 `true` 时只在本机可见。 |
| `ogImage` | 分享图。写条目内的图片路径或 `https://` 地址；写 `none` 关闭。 |

最小示例：

```markdown
---
title: 一次内容整理
date: 2026-05-01
description: 把旧文章按主题重新归档。
tags: [整理, 记录]
draft: false
ogImage: images/share.webp
---
正文从这里开始。
```

示例里的图片路径是示意，换成你自己目录里的文件。每个区还有各自的设置：文章和项目的版本号、开发日志对应的项目等。完整字段表见[开发版](developers/writing.md)。

## 文章系列与项目版本

普通文章不需要额外设置。只有同一篇内容需要保留多次改版时，才用文章系列：

- 每个版本放在自己的目录里，最好分别写上日期；在文件开头的设置里，给所有版本填同一个 `series` 值，再分别写 `versionLabel`、`versionName`、`versionSummary` 与 `versionOrder`。
- 需要稳定地址时，同一系列的版本共用一个 `slug`；最新版占 `/blog/<slug>/`，旧版本留在日期地址上。不填 `slug` 时，最新版也留在日期地址。
- 排序时先看日期，日期相同再看版本号（`versionOrder`）；排在最前的就是当前版本。旧版本仍可从版本入口查看，页面只显示版本日期。

项目需要多份版本文档时，做法相同：每个版本一个目录，在每份文档里填同一个项目标识，再分别写版本号 `versionLabel` 与版本名称 `versionName`。项目列表只显示最新版，点开卡片可以切换到其他版本。单版本项目不需要这些设置。

![文章页，右侧目录、浮动按钮与版本信息](images/article-light.webp)

![项目版本弹窗](images/projects-dialog-light.webp)

## 项目卡片与末尾链接

项目卡片可以配一张缩略图和一个图标，都写在文件开头的设置里。图片放在条目目录，也可以写 `https://` 地址。

```yaml
---
title: 示例项目
date: 2026-05-01
slug: example-project
image: images/cover.webp
icon: images/icon.svg
---
```

`image` 显示在卡片右侧，也用于项目弹窗；`icon` 显示在标题前。两者都不填时只显示文字卡片。

项目与开发日志的正文末尾可以放一组外链。写法是最后一段只放 Markdown 链接，前面空一行：

```markdown
[仓库](https://github.com/example/project) · [演示](https://example.com)
```

链接组会被单独排成一行，不出现在正文段落里，也不参与摘要。只支持 `http`、`https`、`mailto` 与 `tel` 链接；这一段不要混入其他文字。文章与动态不使用这种写法，链接直接写在正文里。

## 动态的图片与作者

动态可以在文件开头配置多张图片与作者信息：

```yaml
---
date: 2026-05-01 09:30
title: 一次发布
images:
  - src: images/shot.webp
    alt: 发布页截图
  - src: https://example.com/shot.webp
    alt: 外部图片
author:
  name: 作者名
  avatar: author/avatar.svg
---
```

图片按书写顺序显示。`images[].src` 可以是条目内的相对路径，也可以是 `https://` 地址；`alt` 用于图片说明。`author.avatar` 是相对 `public/` 的路径，不写 `public/`，也不以 `/` 开头；不填时使用动态页设置里的默认作者。

## 分享图

文章可以单独设置分享图，用于链接预览，不会显示在页面上：

```yaml
---
ogImage: images/share.webp
ogImageAlt: 文章分享图
---
```

`ogImage` 接受条目内的相对路径或 `https://` 地址；写成 `none` 时显式关闭分享图。本地路径相对于条目目录，例如 `images/share.webp`。没有配置 `SITE_URL` 时不会输出分享图。

## 图片、附件与共享资源

| 放什么 | 怎么放 |
| --- | --- |
| 正文图片 | 放在条目目录里，用相对路径引用，例如 `images/diagram.webp`；放到 `public/` 的图片用 `/` 开头引用 |
| 分享图、项目图标与缩略图 | 条目内的相对路径，或 `https://` 地址 |
| 附件 | 放在条目目录，例如 `files/checklist.pdf`，正文里用普通链接 |
| 多个条目共用的图片 | 放在该区的 `_shared/images/`，例如 `content/blog/_shared/images/` |

附件只在被正文链接时复制到构建结果，没引用的不会上传。

共享资源用相对路径从条目引用，例如 `../_shared/images/logo.webp`。图片路径写错时，提交前的检查会报错，具体命令见[本地运行与检查](development.md)。

## 正文写法

正文用 Markdown。标题、列表、链接、引用、表格、加粗与斜体都是标准写法。需要更细的排版时，可以用下面这些扩展；少量 HTML 也能写，但只保留白名单里的标签和属性，脚本会被移除。

### 提示块

```markdown
:::tip[提示]
这是一段提示。
:::
```

四种类型：`note`、`tip`、`info`、`warning`。方括号里的标题可以省略。

### 图注

```html
<figure class="figure figure--md figure--center">
  <img src="images/diagram.webp" alt="示意图" />
  <figcaption>图注文字</figcaption>
</figure>
```

`figure` 类必须保留。`figure--sm`、`figure--md`、`figure--lg`、`figure--full` 控制宽度，`figure--left`、`figure--center`、`figure--right` 控制位置；不写时居中。

### 画廊

```html
<ul class="gallery cols-2">
  <li>
    <figure>
      <img src="images/a.webp" alt="" />
      <figcaption>图注</figcaption>
    </figure>
  </li>
</ul>
```

`gallery` 类必须保留，`cols-2` 或 `cols-3` 指定列数。

### 公式

行内公式用 `$$...$$`，块级公式让 `$$` 单独占一行；单个 `$` 不是公式标记，代码里的 `$$` 会原样显示。

```markdown
行内公式 $$a^2 + b^2 = c^2$$。

$$
\int_0^1 x^2 \, dx
$$
```

### 代码块

围栏代码块标上语言，站点会高亮，并显示语言名、行数与复制按钮。行号可以在后台的设置里关掉。

### 折叠

```markdown
<details>
  <summary>标题</summary>

  折叠的正文。

</details>
```

### 摘要分隔

在正文里单独写一行 `<!-- more -->`，它之前的内容会用于列表与卡片的摘要；不写时从全文截取。标记只影响摘要，正文照常显示。

