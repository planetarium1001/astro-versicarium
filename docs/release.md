# 版本与发布

> 本文档为使用文档，不涉及代码、开发等内容。代码分层、命令参数与实现细节见[开发者文档：版本与发布](developers/release.md)。

主题用版本号标记兼容性，用标签和变更记录留下发布痕迹。发一个新版本要经过提交、发布用的合并请求、GitHub Release 与附件打包几步；模板包从 Release 页面下载。

用主题建站时，通常不需要自己发版。站点关心的是什么时候同步新版本，见[主题更新](upstream.md)。

## 版本号、标签与变更记录

版本号采用语义化版本：主版本表示需要重新配置的改动，次版本表示新增功能，修订版本表示修复。面向使用者有三处要同步：

| 位置 | 内容 |
| --- | --- |
| 版本文件（`package.json`） | 当前版本号 |
| 版本标签 | `v` 加版本号，例如 `v1.0.0-rc.2` |
| `CHANGELOG.md` | 面向使用者的变更记录 |

常规发布时，发布工具还会同步一份内部版本清单，不需要手动改；预览候选由维护者手动写入。

版本号里不带日期。日期不说明兼容性，提交时间由 Git 记录。

## 当前版本

当前版本是 `1.0.0-rc.2`，第二个预览候选，变更记录日期为 2026-10-21。预览候选表示正式版 `1.0.0` 之前还会调整。

仓库里已有两个版本标签：`v1.0.0-rc.1` 与 `v1.0.0-rc.2`。`CHANGELOG.md` 记录两者的 GitHub Release 尚未创建（截至当前仓库状态）。

## 发布一个新版本

1. 在 `main` 上提交改动并推送。提交信息用 `feat`、`fix` 这类前缀，发布工具据此判断这次改动算新功能还是修复；自动检查要能通过。
2. 等发布工具更新发布用的合并请求，里面会改版本号与 `CHANGELOG.md`。预览候选的版本是手动写入的，不需要这一步。
3. 检查合并请求里的版本号与变更记录，然后合并。
4. 合并后发布工具会创建对应的 GitHub Release，标签与版本号对应。
5. 等自动打包完成，确认 Release 上带着模板压缩包与校验文件。
6. 到示例站（`demo` 分支）同步主题：执行 `npm run theme:update -- --include-fonts`，再执行 `npm run font:build` 重新生成示例站字体。

## 下载模板包与校验

Release 创建后，页面会提供模板压缩包和校验文件。当前两个预览候选还没有 Release，暂时没有可下载的模板包。

按版本写入地址，下载并校验：

```bash
VERSION=1.0.0-rc.2
BASE="https://github.com/planetarium1001/astro-versicarium/releases/download/v${VERSION}"
curl -LO "${BASE}/astro-versicarium-${VERSION}.zip"
curl -LO "${BASE}/SHA256SUMS"

sha256sum -c SHA256SUMS
# macOS
shasum -a 256 -c SHA256SUMS
```

校验通过后解压并安装依赖：

```bash
unzip "astro-versicarium-${VERSION}.zip"
cd "astro-versicarium-${VERSION}"
npm ci
```

校验失败时不要解压使用。重新下载两个文件，确认校验文件里的文件名与下载到的文件名一致。

## 主题基准文件

站点里的主题基准文件（`theme.json`）记录上一次合并到主题的哪个提交。执行一次 `npm run theme:update` 后，它会推进到新的位置，下一次更新从这里继续。

它不表示版本号，也不用手动修改。合并出现冲突时命令不会改它，解决冲突后再跑一次即可。

