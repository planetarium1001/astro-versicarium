---
title: 主题快速开始
description: 从环境要求、安装与开发命令到目录结构，完成 astro-whono-tweaked 的第一次运行。
date: 2026-10-01
publishedAt: 2026-10-01
tags: [快速开始, 环境]
series: theme-quick-start
versionLabel: "1.1.0"
versionName: 当前版本
versionSummary: 覆盖安装、开发、构建与目录结构的最新快速开始。
versionOrder: 2
draft: false
---

astro-whono-tweaked 是一个以内容目录为边界、主题代码可独立更新的 Astro 博客主题。本文从空目录开始，完成依赖安装、开发预览与构建，并说明第一次使用时需要认识的关键目录。

## 环境要求

- Node.js 22.12.0 或更高版本，仓库的 `.nvmrc` 与 `package.json` 的 `engines` 字段给出同一基线。
- npm，依赖与锁文件均使用 npm 维护。
- Git。只阅读源码可以不装，但主题更新、模板索取与版本管理都依赖 Git。

克隆仓库前先确认 Node 版本。使用 nvm 或同类版本管理器时，在仓库根目录执行 `nvm use` 即可读取 `.nvmrc`。

## 安装

从主题仓库取得一份可运行的站点：

```bash
git clone --depth 1 --branch main --single-branch \
  https://github.com/planetarium1001/astro-whono-tweaked.git my-site
cd my-site
npm install
```

`--depth 1` 只取 `main` 的最新提交，适合快速开始；需要完整历史时去掉该参数。克隆得到的 `origin` 指向主题仓库，不能向它推送。准备把它作为自有站点时，删除 `.git` 后重新初始化，再添加自己的远端：

```bash
rm -rf .git
git init -b main
git add -A
git commit -m "chore: 初始化站点"
# 再添加你自己的远端
```

主题更新只依赖 `theme.json` 与工作树，不要求站点与主题共享提交历史。

## 开发与构建

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器，终端会输出本地地址 |
| `npm run dev:clean` | 清理构建缓存后启动 |
| `npm run build` | 生成静态产物到 `dist/` |
| `npm run preview` | 预览已构建的产物 |
| `npm run check` | 类型检查与源码类守卫 |
| `npm run verify` | 依次执行检查、构建、刷新快照、测试与产物校验 |

开发服务器启动后，前台入口是 `/`，后台入口是 `/admin/`。后台在开发环境可读写，生产构建中的后台是只读静态壳，写入接口不会输出。后台各模块的职责见[后台控制台概览](/blog/2026-10-05-admin-console/)。

构建期需要提供 `SITE_URL`，它决定 RSS、canonical、分享图与 sitemap 使用的站点 origin。为空时 sitemap 不生成，`check:prod-artifacts` 会失败；本地只看页面时可以省略，准备发布或跑完整校验时必须提供实际域名。

```bash
SITE_URL=https://planetarium1001.github.io npm run build
```

上面的写法只演示变量位置，实际部署子路径还要配合 `ASTRO_WHONO_BASE_PATH`；GitHub Pages 工作流会根据仓库名推导这两个值。

## 目录结构

```text
content/            作者内容：五个集合，条目含 index.md 与 images/、files/
src/pages/          路由；admin/ 与 api/admin/ 仅开发环境可用
src/layouts/        BaseLayout、ArticleLayout
src/components/     展示组件；admin/ 为后台界面
src/lib/            设置解析、内容读取与后台逻辑
src/scripts/        前台脚本；admin-*/ 为后台专用
src/styles/         样式入口与各组件样式
src/plugins/        Markdown 管线：remark / rehype 插件与 HTML 白名单
src/data/settings/  主题设置 JSON
public/             静态资源
scripts/            字体子集、校验、new:bit、theme:update
tests/              测试用例与页面快照
docs/               仓库文档
```

第一次改动前先区分两类路径：`content/` 与 `src/data/settings/` 属于站点自有内容，`src/` 的其余部分属于主题代码。主题更新不会覆盖站点自有路径，但会合并主题代码；把站点定制写进 `src/` 会增加后续合并成本。

## 第一次检查

安装完成后建议按顺序执行：

1. `npm run dev`，确认首页、`/blog/`、`/projects/`、`/devlog/` 与 `/archive/` 可访问。
2. 打开 `/admin/`，确认开发环境的后台可读写。
3. `npm run check`，确认类型与源码守卫通过。
4. 发布前执行 `npm run verify`，并确保 `SITE_URL` 已设置。

内容目录如何组织、frontmatter 写哪些字段，见[内容模型与目录式条目](/blog/2026-10-03-content-model/)；主题代码如何更新，见[主题更新与三方合并](/blog/2026-10-07-theme-update/)。
