---
title: 版本与发布
description: 版本号、标签与变更记录如何对应；发版流程全部手动触发，模板包从 Release 下载并校验。
date: 2026-10-21
publishedAt: 2026-10-21
tags: [说明, 发布]
draft: false
---

主题用版本号标记兼容性，用标签与变更记录留下发布痕迹。版本号回答能不能直接更新，标签与 Release 回答哪一版、什么时候发。

仓库是 `private: true` 的模板仓库，不发布到 npm；版本号只用于标记兼容性、生成 `CHANGELOG.md` 与命名 Release 附件。两个发布工作流 `release-please.yml` 与 `release.yml` 都只手动触发，不随推送自动运行。

## 版本号与四个位置

版本号采用语义化版本：主版本表示需要重新配置的改动，次版本表示新增功能，修订版本表示修复。主版本变化意味着站点要跟着改配置或内容。

| 变更类型 | 版本位 | 例子 |
|---|---|---|
| 破坏性变更 | 主版本 | 修改字段含义、删除设置项、改变公开路径 |
| 向后兼容的功能 | 次版本 | 新增设置字段、后台模块或页面能力 |
| 向后兼容的修复 | 修订版本 | 修复渲染、布局或合并逻辑 |

同一个版本号写在四处，保持一致：

| 位置 | 内容 |
|---|---|
| `package.json` 的 `version` | 当前版本号 |
| Git 标签 | `v` 加版本号，例如 `v1.0.0-rc.2` |
| `CHANGELOG.md` | 面向使用者的变更记录 |
| `.release-please-manifest.json` | 发布工具读取的当前版本 |

标签去掉前缀 `v` 后应与 `package.json` 的版本号相同。版本号里不带日期：日期不说明兼容性，提交时间由 Git 记录。

## 当前版本

- 当前版本是 `1.0.0-rc.2`，第二个预览候选，变更记录日期为 2026-10-21。
- 预览候选用 `-rc.N` 后缀，表示正式版 `1.0.0` 之前还会调整。
- 仓库里已有两个标签：`v1.0.0-rc.1` 与 `v1.0.0-rc.2`；后者指向提交 `89fc493`。
- 标签停在 10-21 的提交上，字体分层与文档重写在标签之后。

`CHANGELOG.md` 记录 `v1.0.0-rc.2` 的 GitHub Release 尚未创建，模板包要等 Release 建好、打包工作流跑完才有。在这之前获取模板，用仓库页面的 **Use this template**，或浅克隆 `main`。

## 发布步骤

发布分两段：`release-please` 维护版本号与变更记录，`release` 打包并上传附件。两段都要在 Actions 页面手动运行。

<details>
<summary>两段命令的位置</summary>

```text
Actions → release-please → Run workflow
Actions → release → Run workflow（填入 tag）
```

</details>

1. 在 `main` 用 `feat`、`fix` 这类前缀提交并推送，确认 CI 通过。
2. 手动运行 `release-please`，它打开或更新一个发布 PR，写入新版本号与 `CHANGELOG.md` 条目。
3. 检查 PR 里的版本号与变更记录，然后合并。
4. 手动创建 `v<version>` 标签与对应的 GitHub Release。
5. 手动运行 `release` 工作流并填入同一个标签。
6. 工作流检出标签对应的提交，读取 `package.json` 的版本并与标签比较；不一致时直接失败。
7. 版本一致且 Release 已存在时，用 `git archive` 打包、生成 `SHA256SUMS`，上传到同一个 Release。
8. 到示例站执行 `npm run theme:update -- --include-fonts`，再按需运行 `npm run font:build`。

- 发布工具只开 PR，不合并、不打标签、不创建 Release。
- 两个预览候选的版本号、`CHANGELOG.md` 与 manifest 由维护者手动写入，不从发布 PR 产生。
- 发布稳定版时去掉 `release-please-config.json` 里的预发布配置，把 manifest 与 `package.json` 的版本改成 `1.0.0`。
- 自动检查不通过时，先修 `main` 上的改动，再重新走一遍流程。

## 产物命名

| 资产 | 命名 |
|---|---|
| 标签 | `v<version>`，例如 `v1.0.0-rc.2` |
| 模板压缩包 | `astro-versicarium-<version>.zip` |
| 校验文件 | `SHA256SUMS` |
| 解压目录 | `astro-versicarium-<version>/` |

压缩包打包的是标签提交的已跟踪文件，因此不含 `node_modules`、`dist` 或本地缓存。

## 下载模板包与校验

<details>
<summary>下载、校验并安装</summary>

```bash
VERSION=<VERSION>
BASE="https://github.com/planetarium1001/astro-versicarium/releases/download/v${VERSION}"
curl -LO "${BASE}/astro-versicarium-${VERSION}.zip"
curl -LO "${BASE}/SHA256SUMS"

sha256sum -c SHA256SUMS
# macOS
shasum -a 256 -c SHA256SUMS

unzip "astro-versicarium-${VERSION}.zip"
cd "astro-versicarium-${VERSION}"
npm ci
```

</details>

- `<VERSION>` 换成版本号，例如 `1.0.0-rc.2`。
- 校验文件列出压缩包的文件名与 SHA-256，文件名不一致时校验会失败。
- 校验失败时不要解压使用，重新下载两个文件再核对。
- 压缩包没有 `.git`，作为自有站点使用前先按[安装与运行](https://github.com/planetarium1001/astro-versicarium/blob/main/docs/install.md)初始化仓库。

## theme.json 基准

站点里的 `theme.json` 记录上一次合并到主题的哪个提交，`theme:update` 从这里继续。

<details>
<summary>theme.json 的三个字段</summary>

```json
{
  "repository": "https://github.com/planetarium1001/astro-versicarium",
  "branch": "main",
  "commit": "<BASE-COMMIT>"
}
```

</details>

- `commit` 记录的是提交，不是版本号；同一版本可能对应多次主题更新。
- 它不表示当前安装的版本，也不用手动修改。
- 合并出现冲突时命令不会改它，解决冲突后再跑一次即可。
- 从仓库复制出的站点带着这个值开始第一次合并，两者之间没有文件差异时内容不变，只更新基准。

发布完成后，示例站与自建站点各自执行一次主题更新，拿到新版本的主题文件。

完整流程见[版本与发布](https://github.com/planetarium1001/astro-versicarium/blob/main/docs/developers/release.md)。
