---
title: 快速开始
description: 当前版本的上手说明：npm ci 起站，内容写在仓库根的 content/ 条目目录里，构建用 SITE_URL 与子路径变量。
date: 2026-10-22
publishedAt: 2026-10-22
tags: [快速开始]
series: theme-quick-start
slug: theme-quick-start
versionLabel: "1.0.0-rc.2"
versionName: 当前版本
versionSummary: npm ci 起站，五个集合，条目目录自带图片与附件，主题更新按文件合并。
versionOrder: 2
draft: false
---
<h1 align="center">Versicarium · 垄录</h1>
<p align="center">面向开发者的内容与版本管理博客主题，基于 Astro 构建，修改自<a href="https://github.com/cxro/astro-whono">Whono</a>。</p>
<div align="center">
  <div style="display:inline-grid; grid-template-columns:auto auto auto auto auto; justify-items:center; column-gap:.6em;">
    <div><b>Versicarium</b></div><div>=</div><div><b><code>versiculus</code></b></div><div>+</div><div><b><code>arium</code></b></div>
    <div></div><div></div><div>诗行短句</div><div></div><div>收卷之匣</div>
  </div>
</div>

这份说明对应 `1.0.0-rc.2`。内容根在仓库根的 `content/`，五个集合，条目以目录为单位；后台在开发环境下可写，生产构建只输出静态页面。

## 环境

需要 Node.js 22.12.0 或更高版本，仓库带 `.nvmrc`，`package.json` 的 `engines` 也写着同一下限。获取模板有三种方式：在仓库页面选择 Use this template，得到历史独立的仓库；浅克隆 `main` 分支；fork 后手工合并上游。

```bash
git clone --depth 1 --branch main --single-branch \
  https://github.com/planetarium1001/astro-versicarium.git my-site
cd my-site
npm ci
npm run dev
```

启动后访问 `http://localhost:4321`，开发环境下访问 `/admin/` 进入后台。`npm ci` 按 lockfile 安装依赖，不会改动 `package.json`，适合在克隆后与 CI 里使用。

## 作为自己的站点

浅克隆只取 `main` 的最新提交，`origin` 仍指向主题仓库。作为自有站点时删除 `.git` 后重新初始化，再换成自己的远端：

```bash
rm -rf .git
git init -b main
git add -A
git commit -m "chore: 初始化站点"
git remote add origin <你的仓库地址>
git push -u origin main
```

## 内容放在哪

一个条目一个目录，主文件通常是 `index.md`，图片、附件与素材放在同级的 `images/`、`files/`、`assets/`：

| 集合 | 位置 | 公开地址 |
| --- | --- | --- |
| 文章 | `content/blog/<条目>/` | `/blog/`、`/blog/<条目>/` |
| 项目 | `content/projects/<条目>/` | `/projects/` |
| 动态 | `content/bits/<条目>/` | `/bits/` |
| 开发日志 | `content/devlog/<项目>/<条目>/` | `/devlog/` |
| 关于 | `content/about/index.md` | `/about/` |

正文图片用相对路径引用，例如 `![封面](images/cover.webp)`；附件放 `files/`，构建时只复制被正文引用的文件。目录名即条目 ID，规范写成 `YYYY-MM-DD-title`；集合根目录下的 Markdown 文件不会被收为条目。

主文件通常叫 `index.md`，也可以是目录内唯一的 `.md` 文件，或标了 `entry: true` 的文件。`draft: true` 的条目只在开发环境可见，生产构建、列表与订阅都会跳过。动态条目可以没有标题；关于页是固定单页，只有一个 `index.md`。归档页把文章、项目版本与日志按年月放在一起，支持筛选与标签组合。

## 构建与部署

```bash
SITE_URL=https://example.com npm run build
SITE_URL=https://example.com ASTRO_VERSICARIUM_BASE_PATH=/blog/ npm run build
```

`SITE_URL` 只写站点地址，不带路径；部署到子目录时另设 `ASTRO_VERSICARIUM_BASE_PATH`，例如 `/blog/`。不填 `SITE_URL` 时页面里的正式地址与分享图不输出，站点地图不生成，`npm run verify` 会失败。

产物在 `dist/`，是纯静态文件，Netlify、Cloudflare Pages 与自己架设的静态服务器都能直接托管；构建命令是 `npm run build`，发布目录是 `dist/`。

## 主题更新

`theme.json` 记录主题仓库、分支与基准提交。先运行 `npm run theme:update -- --check` 查看变更，再运行 `npm run theme:update` 执行合并。合并按文件做三方合并，`content/`、`src/data/settings/`、`public/fonts/` 等站点自有路径不会被覆盖；有冲突时命令以非零状态退出，解决后重跑。

改了内容之后要重跑 `npm run font:build`，否则字体仍按旧字符集生成。

## 后台

`npm run dev` 后打开 `/admin/`，后台分概览、主题、写作、资源与快照五个页面。主题设置分七组，写作页带实时预览与字段检查。资源页统一管理图片与附件，支持上传、批量重命名、移动与删除，显示引用状态，也支持整条目 ZIP 导入导出。生产构建不包含写入接口，线上改内容要先在本地改完再重新部署。

## 字体

中文字体按角色分层分片：常用字随页面加载，生僻字在需要时下载。常用页面的首屏字体约 305 KB，生僻字切片按内容实际用字生成。后台可以在常用覆盖与完整覆盖之间切换。

## 常用命令

`npm run check` 做类型检查与源码守卫，`npm test` 跑测试，`npm run verify` 是提交前的完整检查，`npm run preview` 预览构建产物。`verify` 依次执行类型检查、构建、快照刷新、测试与产物检查，包含图片引用、布局尺寸、触控尺寸与字体覆盖。

内容模型在这一版不再有大改：条目目录、文章系列与项目版本、可写后台、按文件主题更新都已就位。日常使用时只需要记住两件事：内容写在 `content/` 的条目目录里，提交前跑一次 `npm run verify`。
