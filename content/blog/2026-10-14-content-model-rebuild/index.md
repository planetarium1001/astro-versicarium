---
title: 重做内容模型：五个集合与一条破坏性变更
description: df93e3f 把 essay / memo 换成 blog / projects / devlog，条目变成目录，筛选和后台一起重做。
date: 2026-10-14
publishedAt: 2026-10-14
tags: [内容模型, 重构]
draft: false
---

2026-10-14 13:46 的 `df93e3f` 是一次带 `!` 的提交。上游留下的 `essay`、`bits`、`memo`、`about` 四个集合，用到第二周就不够用：项目需要独立文档，开发记录需要按项目串起来，短动态也不想和长文共用一套详情页。这次改成 `blog`、`projects`、`bits`、`devlog`、`about`。

`essay` 更名 `blog`，详情页从 `/archive/<slug>/` 迁到 `/blog/<slug>/`；`memo` 整个删除，路由、样式和后台分支一起清掉；新增 `projects` 和 `devlog`，两者都是列表型集合，用页内锚点定位，不单独开详情页。`/archive/` 改成跨博客、项目、开发日志的全站时间线，按年月分组，动态不进归档。

内容从单文件变成目录条目。目录名就是条目 ID，规范是 `YYYY-MM-DD-title`，公开路径默认使用完整条目 ID（含日期前缀），要短路径就在 frontmatter 写 `slug` 覆盖。图片落点统一到 `public/images/<collection>/<slug>/`，上传、重命名和引用校验共用一套规则。这套约定在 10-19 又被推翻一次，那是后话。

列表和筛选是另一半工作量。标签筛选改成控件条加弹窗，支持 AND/OR 复合表达式，状态写进 URL，计数实时更新。分页不再由服务端出，列表全量渲染后在客户端分页和筛选，所以关掉 JavaScript 也能读。代价是列表页的 DOM 明显变大，内容量上去之后首屏要付账。

后台跟着收敛为概览、主题、写作、图片、数据五个模块，只在开发环境可写，生产构建输出只读静态壳。主题设置沿用站点、侧栏、首页、内页、界面五份 JSON，并按新集合调整字段与后台控件，保存前校验字段并给出变更预览。

```text
content/
  blog/2026-10-14-content-model-rebuild/index.md
  projects/versicarium/images/preview.webp
  devlog/versicarium/2026-10-14-content-model-and-navigation/index.md
```

提交说明最后一节直接写了 BREAKING CHANGE：旧内容目录、`/memo/`、`/essay/*`、`/archive/<slug>/` 全部不兼容。仓库里的存量内容当天迁完了，但真正的收尾拖了一周。10-15 的 `ea4b322` 把项目上的 tags 和 repo/demo 字段拿掉，外链改到正文末尾；`a32657e` 重做动态卡片和项目卡片；10-16 的 `0ae6a54` 补窄屏标题和后台拖拽排序；当天晚上又是一串窄屏修复（`2b269cf`、`11d27d6`、`2f87743`、`f1e70dc`、`c17f978`）。

文档被重写了两遍。`6751344` 和 `012b450` 都发生在功能还在动的时候，第一版刚写完就过时了。这不算谁的失误，但下一次大改结构时，文档应该排在功能停下之后。

![归档页，按年月组织的全站时间线](/images/demo/archive-light.webp)

重构本身没留下独立的开发日志；那天的记录在这里：[内容模型与导航重构](/devlog/#versicarium-2026-10-14-content-model-and-navigation)。
