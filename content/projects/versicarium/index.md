---
title: Versicarium
subtitle: 当前预览版
description: 1.0.0-rc.2 预览候选，五个集合、多版本、本地后台五页、七组设置与分层字体都在这一版。
type: 主题
date: 2026-10-22T00:00:00.000Z
slug: versicarium
versionLabel: "1.0.0-rc.2"
versionName: 目录式内容与字体分层
versionSummary: 中英文名改为 Versicarium · 垄录，后台可管理资源，中文字体按角色分层加载。
versionOrder: 3
image: images/preview.webp
draft: false
---

`1.0.0-rc.2` 是当前预览版，示例站运行的就是它。仓库、包名与站点名在 10-20 一起改为 Versicarium · 垄录，图标随之更换。

## 五个集合

内容都在仓库根的 `content/`，一个条目一个目录，主文件是 `index.md`。

| 集合 | 内容 | 位置 |
|---|---|---|
| 文章 | 长文与系列版本 | `content/blog/` |
| 项目 | 项目介绍与历史版本 | `content/projects/` |
| 动态 | 短记录、图片与作者 | `content/bits/` |
| 开发日志 | 按项目归档的开发进展 | `content/devlog/` |
| 关于 | 固定的单页介绍 | `content/about/` |

- 目录名写成 `2026-05-01-标题`，动态用 `bits-2026-05-01-0930`，`npm run new:bit` 按当前时间生成。
- 图片与附件放在条目目录里，正文用相对路径引用。
- `draft: true` 的条目只在本机可见，构建后的站点、列表与订阅源都会跳过。

## 多版本

- 文章用 `series` 串起各版，项目用不带日期的 `slug` 归并，每个版本有自己的地址。
- 项目列表只显示最新版，卡片弹窗里切换历史版本；文章在侧边抽屉里切换。
- 最新版占稳定地址，旧版留在日期路径上，归档把它们按年月排进同一条时间线。

## 本地后台

`npm run dev` 后打开 `/admin/`，后台分五个页面：

| 页面 | 路由 | 作用 |
|---|---|---|
| 概览 | `/admin/` | 内容数量、热门标签、总字数、最近条目与写作活动 |
| 主题 | `/admin/theme/` | 七组主题设置 |
| 写作 | `/admin/content/` | 五个集合的条目管理 |
| 资源 | `/admin/resources/` | 图片与附件管理 |
| 快照 | `/admin/data/` | 设置的导出与导入 |

后台只在开发环境可写，构建产物只有静态页面。资源页显示每张图片的引用状态，支持批量重命名、移动与删除，也能整条目导入导出 ZIP；配置对象存储后图片直接进云端。

## 主题设置

七组设置写在 `src/data/settings/` 的五个文件里，后台保存或直接改文件，刷新页面生效。

- 站点、侧栏、首页、内页、条目版本、代码显示、排版字体，共七组。
- 内页设置含列表分页、订阅源、动态默认作者、浮动操作列与浏览数据。
- 排版字体分正文、文案、等宽与品牌四个用途，覆盖策略可选完整或常用字。
- 换字体要重启 `npm run dev`，只刷新页面不生效。

## 字体分层

- 中文字体随构建发布，页面不向外部字体服务请求。
- base 分片 33 个，DLC 分片 82 个，合计 115 个 WOFF2，23,431,664 字节。
- 常用页只下载命中的分片，生僻字在页面出现时才下载。
- 分片按站点自己的内容算出来，内容大改后跑 `npm run font:build` 重建。

## 部署与更新

- Node.js 最低 `>=22.12.0`，`.nvmrc` 建议 `24.22.1`。
- 构建需要 `SITE_URL`；部署在子目录时再加 `ASTRO_VERSICARIUM_BASE_PATH`。
- 示例站由 `.github/workflows/pages.yml` 在推送到 `demo` 分支后构建发布，也可以手动运行。
- `release-please.yml` 与 `release.yml` 都是手动触发，后者需要 `tag` 输入。
- 主题更新用 `npm run theme:update`，按文件三方合并，站点自有路径不被覆盖。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [文档](https://github.com/planetarium1001/astro-versicarium/tree/main/docs)
