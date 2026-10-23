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

这份说明对应 `1.0.0-rc.2`。内容根在仓库根的 `content/`，五个集合，条目以目录为单位；后台在开发环境下可写，生产构建只输出静态页面。

## 环境

- Node.js 22.12.0 或更高版本，`package.json` 的 `engines` 写着同一下限。
- `.nvmrc` 里是建议版本 `24.22.1`，用 nvm 时执行 `nvm use` 即可。
- 首次安装依赖需要联网，之后日常运行可以离线。

<details>
<summary>安装依赖并启动</summary>

```bash
npm ci
npm run dev
```

</details>

`npm ci` 按 `package-lock.json` 安装，不会改动 `package.json`，适合克隆后与 CI 里使用；需要更新依赖时改用 `npm install`。

启动后访问 `http://localhost:4321`，开发环境下访问 `/admin/` 进入后台。端口 4321 被占用时用 `npm run dev -- --port 4322` 换一个。

## 获取主题

两条路径，任选一条。

<details>
<summary>用模板建仓库</summary>

在仓库页面选择 **Use this template**，得到一份保留主题代码与示例内容的新仓库，历史独立。

```bash
git clone <YOUR-REPO> my-site
cd my-site
```

</details>

<details>
<summary>浅克隆模板仓库</summary>

```bash
git clone --depth 1 --branch main --single-branch \
  https://github.com/planetarium1001/astro-versicarium.git my-site
cd my-site
```

`--depth 1` 只取最新一次提交。作为自己的站点使用时，先删掉模板自带的提交历史与发布工作流，再重新初始化：

```bash
rm -rf .git .github/workflows/release-please.yml .github/workflows/release.yml
git init -b main
git add -A
git commit -m "chore: 初始化站点"
git remote add origin <YOUR-REPO>
git push -u origin main
```

</details>

完整说明见[安装与运行](https://github.com/planetarium1001/astro-versicarium/blob/main/docs/install.md)。

## 内容组织

一个条目一个目录，主文件是 `index.md`，图片与附件放在同级的 `images/`、`files/`。

| 集合 | 位置 | 公开地址 |
|---|---|---|
| 文章 | `content/blog/<条目>/` | `/blog/`、`/blog/<条目>/` |
| 项目 | `content/projects/<条目>/` | `/projects/` |
| 动态 | `content/bits/<条目>/` | `/bits/` |
| 开发日志 | `content/devlog/<项目>/<条目>/` | `/devlog/` |
| 关于 | `content/about/index.md` | `/about/` |

- 目录名即条目 ID，规范写成 `YYYY-MM-DD-title`；集合根目录下的 Markdown 文件不会被收为条目。
- 目录里只有一个 Markdown 文件时，主文件可以不叫 `index.md`；有多个时给主文件标 `entry: true`。
- 正文图片用相对路径引用，例如 `![封面](images/cover.webp)`；附件放 `files/`，构建时只复制被正文引用的文件。
- `draft: true` 的条目只在开发环境可见，生产构建、列表与订阅都会跳过。

新建内容有两种方式：运行 `npm run dev` 后在写作页选区新建，或手动建目录与 `index.md`。字段全表见[内容与写作](https://github.com/planetarium1001/astro-versicarium/blob/main/docs/content.md)。

## 构建与部署

<details>
<summary>带站点地址构建</summary>

```bash
SITE_URL=<SITE-URL> npm run build
SITE_URL=<SITE-URL> ASTRO_VERSICARIUM_BASE_PATH=/<SUBDIR>/ npm run build
```

</details>

- `SITE_URL` 只写站点地址，不带路径。
- 部署到子目录时另设 `ASTRO_VERSICARIUM_BASE_PATH`，例如 `/blog/`。
- 不填 `SITE_URL` 时页面里的正式地址与分享图不输出，站点地图不生成，`npm run verify` 会失败。

产物在 `dist/`，是纯静态文件，任何静态托管都能放。GitHub Pages 的改法见[部署上线](https://github.com/planetarium1001/astro-versicarium/blob/main/docs/deploy.md)。

## 主题更新

`theme.json` 记录主题仓库、分支与基准提交。

<details>
<summary>查看与执行更新</summary>

```bash
npm run theme:update -- --check
npm run theme:update
```

</details>

- `--check` 只列清单，不写文件。
- 合并按文件做三方合并，`content/`、`src/data/settings/`、`public/fonts/` 等站点自有路径不会被覆盖。
- 有冲突时命令以非零状态退出，解决后重跑。
- 合并完成后执行 `npm run verify`。

## 后台

`npm run dev` 后打开 `/admin/`，后台分概览、主题、写作、资源与快照五个页面。

- 主题设置分七组：站点设置、侧栏设置、首页设置、内页设置、条目版本、代码显示、排版字体。
- 写作页带实时预览与字段检查，保存博客正文时校验本地图片是否存在。
- 资源页统一管理图片与附件，支持上传、批量重命名、移动与删除，也支持整条目 ZIP 导入导出。
- 生产构建不包含写入接口，线上改内容要先在本地改完再重新部署。

## 字体

中文字体按用途与常用程度分层分片，随构建一起发布。

- 基础分片 33 个，合计 2,338,700 字节，随页面加载。
- 生僻字分片 82 个，合计 21,092,964 字节，单块目标 240 KB，页面出现生僻字时才下载。
- 合计 115 个 WOFF2，共 23,431,664 字节；常用页实际下载约 385 KB。
- 覆盖策略在后台的排版字体里切换；新写大量内容或换字体后，用 `npm run font:build` 按当前内容重建。

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动开发服务器与本地后台 |
| `npm run build` | 构建静态产物到 `dist/` |
| `npm run preview` | 预览上一次构建的产物 |
| `npm run check` | 类型检查与源码守卫 |
| `npm test` | 运行测试用例，不构建 |
| `npm run verify` | 完整检查：代码、构建、字体、测试与产物 |
| `npm run new:bit` | 生成一条动态草稿 |
| `npm run theme:update` | 同步主题新版本 |
| `npm run font:build` | 按当前内容重新生成字体 |

`verify` 依次执行 `check`、`build`、`font:coverage --strict`、`test:fixtures`、`test`、`check:prod-artifacts`、`check:layout-geometry`、`check:touch-targets` 与 `check:viewport-overflow`。提交前跑一次，页面记录有变化时一起提交。
