---
title: 发布与版本管理
description: 1.0.0-rc.1 预览版的 SemVer 含义、Release Please 工作流、模板获取方式与 main / demo 的分支职责。
date: 2026-10-20
publishedAt: 2026-10-20
tags: [发布, 版本]
draft: false
---

Versicarium · 垄录 用语义化版本标记主题发布，用 Git 分支区分模板与示例站。版本号回答“这次升级是否兼容”，Release 页面回答“如何取得这个版本的源码”，`theme.json` 回答“站点同步到了哪个主题提交”。三者职责不同，不能互相替代。

## SemVer 与 1.0.0-rc.1 预览版

主题版本写在 `package.json` 的 `version` 字段，Release 标签使用同一版本号。版本号按语义化版本解释：

| 变更类型 | 版本位 | 例子 |
| --- | --- | --- |
| 破坏性变更 | 主版本 | 修改 frontmatter 字段语义、删除设置项、改变公开路由或 `theme:update` 契约 |
| 向后兼容的功能 | 次版本 | 新增设置项、增加版本字段、扩展后台模块 |
| 向后兼容的修复 | 修订版本 | 修复渲染、布局、合并逻辑或文档错误 |

`1.0.0-rc.1` 是首个预览候选：版本号、CHANGELOG 与发布配置已按 `1.0.0-rc.1` 准备，Release 尚未创建。预览版表示发布范围与内容结构已经收敛，验证与文档补全后发布稳定版 `1.0.0`。

`theme.json` 的 `commit` 不是版本号。它记录站点已经吸收到的主题提交；同一个 1.0.0-rc.1 可以被不同站点在不同时间同步，各自的基准提交可以不同。

## Release Please

版本号与 CHANGELOG 由 Release Please 管理，不再手工维护。仓库使用约定式提交，合并到 `main` 的 `feat`、`fix` 等提交会被收集，Release Please 据此更新 `package.json` 与 `CHANGELOG.md`，并开出一个发布 PR。

- 发布 PR 合并后，Release Please 创建对应标签与 GitHub Release。
- `release-please-config.json` 与 `.release-please-manifest.json` 保存发布类型与当前版本；首个 `1.0.0-rc.1` 由维护者写入清单，此后由 Release Please 接管。
- 版本号不嵌入日期；日期只写入 CHANGELOG 条目与 Release 标题。
- 预览阶段不创建 GitHub Release；`v1.0.0-rc.1` 标签只保留在本地，不推送。
- `release-please-config.json` 使用 `versioning: prerelease`、`prerelease: true` 与 `prerelease-type: rc`，后续预览版本递增为 `1.0.0-rc.2`。发布稳定版时改回默认版本策略并关闭预发布标记。

## 模板与源码归档

Release 创建后，发布工作流会把模板打包为 zip 附件并生成 SHA256 校验文件。附件只包含仓库中的已跟踪文件，不包含 `node_modules`、`dist` 或站点自己的内容；解压后仍需 `npm install`，再按[主题快速开始](/blog/2026-10-20-theme-quick-start/)的步骤运行。

Release 页面同时提供该标签的源码归档，通常包含 zip 与 tar.gz 两种格式。源码归档没有 `.git` 目录；只阅读代码或做一次性构建时可以直接使用。准备长期维护站点时，应在解压目录初始化 Git，再添加自己的远端。

![项目弹窗中的版本历史与当前版本标记](/images/demo/projects-dialog.png)

## 获取模板

按用途选择一种方式：

1. **从模板创建**：在仓库页面选择 Use this template。得到的是独立历史的新仓库，后续用 `npm run theme:update` 接收主题更新。
2. **浅克隆 main**：只取模板分支的最新提交，适合从零开始管理站点。

   ```bash
   git clone --depth 1 --branch main --single-branch \
     https://github.com/planetarium1001/astro-versicarium.git my-site
   cd my-site
   npm install
   ```

   `--depth 1` 表示浅克隆，只保留最新提交，下载量小于完整历史。克隆得到的 `origin` 指向主题仓库，不能向它推送；要变成自己的站点，删除 `.git` 后重新初始化并添加自己的远端。浅克隆不会影响 `theme:update`，因为更新脚本按 `theme.json` 抓取主题提交，不依赖站点本地的历史深度。

3. **Fork**：保留与主题同源的历史，可以直接合并主题更新。

   ```bash
   git remote add theme https://github.com/planetarium1001/astro-versicarium.git
   git fetch theme main
   git merge theme/main
   ```

模板、浅克隆与 Fork 的区别在历史与远端，不在内容结构。三者都使用同一套 `content/`、设置文件与 `theme.json`。

## 分支职责

| 分支 | 内容 | 用途 |
| --- | --- | --- |
| `main` | 主题代码、少量种子内容、中性默认设置 | 模板与主题更新来源 |
| `demo` | 完整示例内容、示例截图、示例站点设置 | 部署到 GitHub Pages |

主题改动先在 `main` 完成，再在 `demo` 检出上执行 `theme:update` 同步。同步是单向的：`main` 到 `demo`。`demo` 合回 `main` 会把示例内容、示例设置与测试快照带回模板分支，不采用。

GitHub Pages 工作流固定在 `demo` 运行，`main` 不参与部署。工作流文件本身留在默认分支，因此仍可从 Actions 页面手动触发。示例站地址为 `https://planetarium1001.github.io/astro-versicarium/`，`SITE_URL` 与子路径 base 由工作流按仓库 owner 与仓库名推导；绑定自定义域名后改为固定值。

## 接收更新

站点升级建议按以下顺序操作：

1. 阅读目标版本的 Release 说明，确认没有需要手工迁移的字段。
2. 在干净的工作树上执行 `npm run theme:update -- --check`，查看将被更新的主题文件与被跳过的站点自有路径。
3. 执行 `npm run theme:update`。若报告冲突，按[主题更新与三方合并](/blog/2026-10-20-theme-update/)的流程解决后重跑。
4. 执行 `npm run verify`，确认类型、构建、测试与产物校验通过。
5. 提交站点自己的更新，把 `theme.json` 的新基准一并纳入版本控制。

预览阶段的 `1.0.0-rc.1` 覆盖内容目录、项目多版本文档、资源工作区与版本界面；这些能力的字段说明分别见[内容模型与目录式条目](/blog/2026-10-20-content-model/)与[后台控制台概览](/blog/2026-10-20-admin-console/)。
