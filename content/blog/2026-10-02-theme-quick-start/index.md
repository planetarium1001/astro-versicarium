---
title: 快速开始
description: 0.5.0 时期的上手说明：npm install 起站，内容放在 src/content/ 的四集合里，后台沿用上游 Admin Console。
date: 2026-10-02
publishedAt: 2026-10-02
tags: [快速开始]
series: theme-quick-start
slug: theme-quick-start
versionLabel: "0.5.0"
versionName: 四集合时期
versionSummary: 内容在 src/content/，集合为 essay / bits / memo / about，一个 Markdown 文件就是一条内容。
versionOrder: 1
draft: false
---

这份说明对应 2026-10-02 的仓库状态。当时仓库名为 `astro-whono-tweaked`，从 `cxro/astro-whono` 分出，内容组织仍是上游留下的四个集合，改动集中在阅读体验与布局尺寸。

## 环境

需要 Node.js 22.12.0 或更高版本。仓库带 `.nvmrc`，使用 nvm 时直接 `nvm use` 切换到对应版本。

```bash
npm install
npm run dev
```

开发服务器在 `http://localhost:4321`。后台入口是 `/admin/`，只在开发环境可写。生产构建只输出静态页面，`/admin/` 按设置显示只读概览或关闭态文案，其他后台页面与写入接口不输出。

## 内容放在哪

内容在 `src/content/` 下，按集合分目录：

| 目录 | 放什么 |
| --- | --- |
| `src/content/essay/` | 长文，随笔，一条一个 `.md` |
| `src/content/bits/` | 短动态，絮语，一条一个 `.md` |
| `src/content/memo/index.md` | 小记，固定单页 |
| `src/content/about/index.md` | 关于页，固定单页 |

随笔的文件名决定地址，例如 `essay/markdown-guide.md` 的详情页在 `/archive/markdown-guide/`；`/essay/<slug>/` 会 301 跳到这里。随笔同时出现在 `/essay/` 列表与随笔订阅里。配图放在 `public/` 下，正文用绝对路径引用，例如 `![截图](/images/my-post/cover.webp)`。

## 写一篇

在 `src/content/essay/` 新建一个 `.md` 文件，开头写 frontmatter，`title` 与 `date` 必填：

```markdown
---
title: 标题
date: 2026-10-02
tags: [标签]
---

正文。
```

`draft: true` 只在本地开发中可见，生产构建、公开列表与订阅都会过滤。随笔还可以写 `archive: false`，让它退出归档聚合，但详情页与列表里仍然存在。`tags` 会用于归档页的标签筛选，可以写多个。`memo` 与 `about` 是固定单页，不要标草稿。

短动态不用手写，`npm run new:bit` 会按当前时间生成一个 `bits-YYYY-MM-DD-HHMM.md`。

## 阅读与主题

站点默认是双栏布局，左侧固定侧栏，右侧内容区。文章详情页右侧有目录，右下角有浮动操作列：阅读模式、回到上次阅读位置与回到顶部。切换浅色与深色时，新主题以点击处为圆心展开涟漪；浏览器不支持相关接口时直接切换。字体使用自托管的 Noto Serif SC 与 LXGW WenKai Lite 子集，不依赖外部字体服务。

订阅分两路：`/archive/rss.xml` 跟进归档，随笔与絮语也有各自的分栏订阅。

## 后台

`/admin/` 是站点概览。往后分成四个控制台：`/admin/theme/` 改站点信息、侧栏、首页与内页文案；`/admin/content/` 新建与编辑各集合内容；`/admin/images/` 浏览图片资源并复制路径；`/admin/data/` 导出设置快照或导入。后台写出的文件与手写格式一致，可以直接进版本库。

## 常用命令

```bash
npm run dev       # 开发服务器
npm run build     # 构建到 dist/
npm run preview   # 预览构建结果
npm run new:bit   # 生成一条动态草稿
npm run verify    # 类型检查、测试等维护校验
```

## 部署

`npm run build` 的产物是纯静态文件，把 `dist/` 整个上传即可。部署到 GitHub Pages 时，仓库需要是公开的（Free 计划下私有仓库不能用 Pages），然后在 Settings → Pages 里把 Source 选为 GitHub Actions，不需要额外的 `gh-pages` 分支。首次 push 前最好先设好 Pages，否则第一次运行的 deploy 步骤会因 Pages 未启用而失败；遇到失败可以在 Actions 里对这次运行点 Re-run all jobs 重试。

工作流按仓库名推导站点地址与部署子路径，改仓库名后地址随之变化；仓库名恰好是 `<owner>.github.io` 时发布在根路径。绑定自定义域名后，要把工作流里的 `SITE_URL` 与 base 改成固定值。

## 这一版的边界

内容只能一个文件一条，没有条目目录的概念。项目与开发日志没有独立集合，只能当作长文写进随笔。系列与版本都不存在，同一篇内容更新只能新发一篇。

归档是随笔的目录视图，按时间从新到旧排列，有分页与标签筛选，动态不进归档。主题更新没有命令，只能手工对照上游 diff 合并；主题与站点也没有分开，上游改动与站点改动混在同一个仓库里，合并时得人工分辨。这个限制到 10-15 的 `theme:update` 之后才解除。
