---
title: 主题更新与三方合并
description: theme:update 如何按 theme.json 的基准提交做三方合并，哪些路径不会被覆盖，以及冲突如何处理。
date: 2026-10-20
publishedAt: 2026-10-20
tags: [主题更新, 工作流]
draft: false
---

Versicarium · 垄录 的主题更新通道解决的是“站点已经改过主题代码，如何继续接收主题改进”的问题。1.0.0-rc.1 预览版不要求站点与主题共享 Git 历史，而是用 `theme.json` 记录基准提交，再按文件做三方合并。

## theme.json

站点根目录的 `theme.json` 有三个字段：

| 字段 | 含义 |
| --- | --- |
| `repository` | 主题仓库地址，当前为 `https://github.com/planetarium1001/astro-versicarium` |
| `branch` | 跟踪的主题分支，本仓库为 `main` |
| `commit` | 上一次同步到的主题提交，作为三方合并的基准 |

`commit` 不是站点版本号，也不是主题发布版本号。它只表示“站点当前已经吸收到哪一个主题提交”。每次成功合并后，脚本会把 `theme.json` 更新到新的主题提交；存在冲突时不会更新。

## 执行更新

更新前必须让工作树干净。脚本会先检查 `git status --porcelain`，有未提交改动就拒绝执行，避免把站点正在进行的修改混进合并结果。

```bash
npm run theme:update -- --check   # 只报告将要发生的变更
npm run theme:update              # 执行合并并更新 theme.json
```

`--check` 只读取与比较，不写入任何文件，适合在升级前确认影响范围。正式执行时脚本会：

1. 从 `theme.json` 的仓库与分支抓取最新提交。
2. 比较基准提交与新提交之间的文件变更。
3. 对每个变更文件读取基准版本、主题新版本与站点当前版本。
4. 按文件合并，写出非冲突文件。
5. 全部无冲突后，把 `theme.json` 的 `commit` 更新到新提交。

如果最新提交与基准相同，脚本直接报告“已是最新”，不产生文件改动。

## 合并规则

| 情况 | 处理 |
| --- | --- |
| 站点未改动该文件 | 直接采用主题新版本 |
| 主题未改动该文件 | 保留站点版本 |
| 双方都改动 | 交给 `git merge-file --diff3` 合并 |
| 文件为二进制 | 整文件取舍；双方都改过则保留站点版本并记为冲突 |
| 站点自有路径 | 不覆盖，只在报告中列出 |

文本冲突会保留 diff3 标记，脚本把冲突文件列入报告并以非零状态退出。此时不要继续执行后续更新；逐个解决冲突、删除标记、确认文件可构建，然后重新运行 `npm run theme:update`。冲突状态下 `theme.json` 没有被更新，所以重跑会基于同一个基准再次合并。

主题删除的文件不会自动从站点移除。脚本只把它们列入“主题已删除”报告，是否删除由站点决定，避免误删站点仍在引用的文件。

## 站点自有路径

以下路径不参与覆盖，只在报告中列出：

- `content/`
- `src/data/settings/`
- `public/images/`
- `public/author/`
- `public/fonts/`
- `tools/`
- `tests/fixtures/`
- `README.md`
- `.github/workflows/pages.yml`
- `theme.json`

这份清单决定了站点的安全边界：把内容、设置、图片与字体放在这些路径下，主题更新就不会碰它们。反过来，如果把站点定制写进 `src/components/` 或 `src/styles/`，后续更新会把这些文件当作主题文件参与三方合并，需要自己承担冲突处理成本。

## 合并之后

合并完成并不等于更新完成。至少执行：

```bash
npm run check
npm run verify
```

`verify` 会重新构建、刷新测试快照并跑产物校验；它需要 `SITE_URL`，否则 sitemap 相关的产物检查会失败。若主题改动涉及设置字段或 frontmatter，先阅读对应版本的发布说明，再检查站点自己的 `src/data/settings/` 与 `content/` 是否需要补字段。设置缺失时渲染会回退默认值，但不会自动写出新字段。

## main 与 demo

主题仓库有两个长期分支。`main` 承载主题代码、种子内容与中性默认设置，是模板与更新来源；`demo` 承载完整示例站，部署到 GitHub Pages。主题改动先在 `main` 完成，再在 `demo` 检出上执行 `theme:update` 同步。

同步方向是单向的：`main` 到 `demo`。不要把 `demo` 合回 `main`，否则示例内容、示例设置与测试快照会进入模板分支，把模板重新变成示例站。`demo` 的 `theme.json` 指向 `main`，站点自有路径保护让示例内容在同步时保持不变。

发布版本与分支职责的完整说明见[发布与版本管理](/blog/2026-10-20-release-and-versioning/)。
