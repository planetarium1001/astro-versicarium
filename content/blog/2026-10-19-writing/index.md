---
title: 写作与内容约定
description: 内容放在 content/ 的条目目录里，文件开头写标题与日期，图片与附件跟着条目走，正文支持提示块、图注、画廊与公式。
date: 2026-10-19
publishedAt: 2026-10-19
tags: [说明, 写作]
draft: false
---

内容放在 `content/`，每条内容是一个目录，正文写在目录里的主文件。文件开头的设置决定标题、日期与是否公开。

## 内容与条目

`content/` 下分成五个区。

| 分区 | 位置 | 内容 |
|---|---|---|
| 文章 | `content/blog/` | 长文，可以组成系列 |
| 项目 | `content/projects/` | 项目介绍，可以有多个版本 |
| 动态 | `content/bits/` | 短句、图片与随手记录，可以没有标题 |
| 开发日志 | `content/devlog/<项目>/` | 按项目记录的开发进展 |
| 关于页 | `content/about/index.md` | 固定单页 |

- 一个条目一个目录，主文件通常叫 `index.md`，图片和附件放在同级目录。
- 目录名会参与默认网址或页内定位，建议写成 `2026-05-01-标题`：日期在前，标题用小写与连字符，中文也可以。
- 动态按日期时间命名，开发日志放在对应项目目录下。
- 目录里只有一个 Markdown 文件时，主文件可以不叫 `index.md`；有多个时给主文件标 `entry: true`。

新建内容有两种方式。一是运行 `npm run dev` 后打开 `/admin/`，进入写作页，选好区再新建，后台会生成目录、主文件与常用设置。二是在对应区里手动建目录和 `index.md`。

草稿不会出现在线上：开发环境可以看到，构建后的站点、列表与订阅源都会跳过草稿。需要先写好再发布时，把 `draft` 设为 `true`，准备好后再改回 `false`。

正文是普通的 Markdown 文件，不需要经过数据库或额外工具。写完保存，刷新页面就能看到结果；发布则靠重新构建。

## 文件开头的设置

| 字段 | 用途 |
|---|---|
| `title` | 标题。动态可以不写。 |
| `date` | 日期。写 `2026-05-01` 或 `2026-05-01 09:30`，格式写错时构建报错。 |
| `description` | 一句话摘要，列表与搜索会用到。 |
| `tags` | 标签列表，例如 `[记录, 整理]`。 |
| `draft` | 草稿。写 `true` 时只在本机可见。 |
| `ogImage` | 分享图。写条目内的图片路径或 `https://` 地址；写 `none` 关闭。 |

各区的必填项不同：文章与项目要 `title` 与 `date`，动态只要 `date`，开发日志要 `title`、`date` 与 `project`，关于页不需要任何字段。

<details>
<summary>一篇文章的开头</summary>

```markdown
---
title: <TITLE>
date: <DATE>
description: <SUMMARY>
tags: [<TAG-1>, <TAG-2>]
draft: false
ogImage: images/share.webp
---

正文从这里开始。
```

</details>

- `<TITLE>`、`<DATE>`、`<SUMMARY>` 换成标题、日期与摘要。
- `<TAG-1>`、`<TAG-2>` 换成标签。
- `images/share.webp` 是示意路径，换成条目目录里的文件。

只写日期时页面只显示日期，写了时分则按日期时间显示。

## 文章系列与项目版本

普通文章不需要额外设置。同一篇内容需要保留多次改版时，才用文章系列。

- 每个版本放在自己的目录里，各自写上日期，所有版本填同一个 `series` 值。
- 再分别写 `versionLabel`、`versionName`、`versionSummary` 与 `versionOrder`。
- 排序先看日期，日期相同看 `versionOrder`；排在最前的就是当前版本。
- 需要固定地址时，同系列共用一个 `slug`。

<details>
<summary>两个版本的设置</summary>

```markdown
---
title: <TITLE>
date: <DATE>
series: <SERIES-ID>
versionLabel: <VERSION-LABEL>
versionOrder: 2
slug: <SERIES-ID>
---
```

</details>

项目保留多个版本时做法相同：每个版本一个目录，所有版本填同一个地址标识，再分别写 `versionLabel` 与 `versionName`。项目列表只显示最新版，点开卡片可以切换其他版本。

## 图片、附件与共享资源

| 类型 | 位置与写法 |
|---|---|
| 正文图片 | 放在条目目录，用相对路径引用，例如 `images/diagram.webp` |
| `public/` 里的图片 | 用 `/` 开头的路径引用 |
| 分享图、项目图标与缩略图 | 条目内的相对路径，或 `https://` 地址 |
| 附件 | 放在条目目录，例如 `files/checklist.pdf`，正文里用普通链接 |
| 多个条目共用的图片 | 放在该区的 `_shared/images/`，例如 `content/blog/_shared/images/` |

- 附件只在被正文链接时复制到构建结果，没引用的不会上传。
- 共享资源用相对路径从条目引用，例如 `../_shared/images/logo.webp`。
- 图片路径写错时，`npm run verify` 会报错。

## 正文写法

正文用 Markdown，标题、列表、链接、引用、表格、加粗与斜体都是标准写法。少量 HTML 也能写，但只保留白名单里的标签与属性，脚本会被移除。

### 提示块

四种类型：`note`、`tip`、`info`、`warning`，方括号里的标题可以省略。

```markdown
:::tip[提示]
这是一段提示。
:::
```

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
  <li><figure><img src="images/a.webp" alt="" /><figcaption>图注</figcaption></figure></li>
</ul>
```

`gallery` 类必须保留，`cols-2` 或 `cols-3` 指定列数。

### 公式

行内公式把 `$$...$$` 写在同一行里，块级公式让 `$$` 单独占一行。单个 `$` 不是公式标记。

```markdown
$$
\int_0^1 x^2 \, dx
$$
```

### 代码块

围栏代码块标上语言，站点会高亮，并显示语言名、行数与复制按钮。行号可以在主题设置的代码显示里关掉。

### 折叠

```markdown
<details>
<summary>标题</summary>

折叠的正文。

</details>
```

### 摘要分隔

在正文里单独写一行 `<!-- more -->`，它之前的内容用于列表与卡片的摘要；不写时从全文截取。标记只影响摘要，正文照常显示。

字段全表与扩展写法见[内容与写作](https://github.com/planetarium1001/astro-versicarium/blob/main/docs/content.md)。
