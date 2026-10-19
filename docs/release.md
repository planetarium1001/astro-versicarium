# 发布

## 版本策略

主题使用 Semantic Versioning。版本号写在 `package.json` 的 `version`，Git 标签加 `v` 前缀，`CHANGELOG.md` 记录面向使用者的变更，三者保持同一版本号。

| 变更类型 | 版本位 | 示例 |
| --- | --- | --- |
| 破坏性变更 | 主版本 | 修改 frontmatter 字段语义、删除设置项、改变公开路由或 `theme:update` 契约 |
| 向后兼容的功能 | 次版本 | 新增设置项、版本字段、后台模块或页面能力 |
| 向后兼容的修复 | 修订版本 | 修复渲染、布局、合并逻辑或文档错误 |

当前版本为 1.0.0，是首次公开版本，标签为 `v1.0.0`。本次为预览版准备，仓库尚未创建 Release。

不采用 0.x：主题已经以固定 frontmatter、公开路由、设置字段与 `theme:update` 协议作为对外契约，1.x 表示这些契约已经稳定。版本号不嵌入日期：日期不表达兼容性，提交时间与 `theme.json` 的基准提交已由 Git 记录。

## Release Please

版本号与 `CHANGELOG.md` 由 Release Please 维护，提交遵循 Conventional Commits。

| 提交类型 | 版本影响 |
| --- | --- |
| `feat` | 次版本 |
| `fix`、`perf` | 修订版本 |
| `feat!`、`fix!` 或 footer 写 `BREAKING CHANGE` | 主版本 |
| `docs`、`refactor`、`chore`、`ci`、`build` | 默认不改变版本；是否进入变更记录由 Release Please 配置决定 |

`.github/workflows/release-please.yml` 在推送到 `main` 时运行 `googleapis/release-please-action`，读取 `release-please-config.json` 与 `.release-please-manifest.json`，`release-type` 为 `node`，权限为 `contents: write` 与 `pull-requests: write`。

Release Please 会持续更新一个 release PR：更新 `package.json` 的版本与 `CHANGELOG.md`。合并该 PR 后，工作流创建与版本一致的 `v*` 标签和 GitHub Release。首次 1.0.0 由人工写入 `package.json`、`CHANGELOG.md` 与 manifest，标签在预览确认后创建；之后的版本交给 Release Please。

release PR 合并前检查三处一致：`package.json` 的版本、`CHANGELOG.md` 的条目、文档中引用的版本号。

## Release 工作流

`.github/workflows/release.yml` 由 `release: published` 事件触发，权限为 `contents: write`：

1. 检出 Release 标签对应的提交；
2. 比较标签去掉 `v` 后的值与 `package.json` 的 `version`，不一致则失败；
3. 用 `git archive --format=zip --prefix=astro-versicarium-${VERSION}/` 打包模板；
4. 生成 `SHA256SUMS`，把 `astro-versicarium-${VERSION}.zip` 与校验文件上传到该 Release。

`git archive` 只包含已跟踪文件，不包含 `node_modules`、`dist`、未跟踪的示例站截图或本地缓存。Release notes 由 Release Please 依据提交生成；本工作流只校验标签版本并上传附件，不重新执行构建验证。

## 产物命名

| 资产 | 命名 |
| --- | --- |
| Release 标签 | `v<version>`，例如 `v1.0.0` |
| 模板压缩包 | `astro-versicarium-<version>.zip` |
| 校验文件 | `SHA256SUMS` |

压缩包解压后目录为 `astro-versicarium-<version>/`，与标签和版本号一致。

## 发布清单

正式发布时按以下顺序执行。本次 1.0.0 预览只做本地提交，`v1.0.0` 标签保留在本地，不创建 Release、不推送。

1. 在 `main` 上按 Conventional Commits 提交并推送，确认 CI 通过。
2. 等 Release Please 打开或更新 release PR，检查版本号、CHANGELOG 与文档一致。
3. 合并 release PR，确认创建了 `v<version>` 标签与 GitHub Release。
4. 等待 `release` 工作流完成，确认 Release 附带模板 zip 与 `SHA256SUMS`。
5. 在 `demo` 检出上执行 `npm run theme:update` 并提交，把示例站的 `theme.json` 基准推进到新的 `main` 提交。

标签一旦发布不要移动或重写。版本号写错时，修正后由 Release Please 发布新的修订版本。

## 下载与校验

Release 页面：<https://github.com/planetarium1001/astro-versicarium/releases>

Release 创建后按版本下载并校验：

```bash
VERSION=1.0.0
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

校验失败时不要解压使用；重新下载资产并核对 `SHA256SUMS` 中的文件名与下载文件名。压缩包没有 `.git`，准备长期维护时按 [../README.md](../README.md) 的浅克隆步骤初始化仓库。

## theme.json 基线

`theme.json` 的 `commit` 不是版本号，而是 `theme:update` 做三方合并的基准提交。发布后需要让新模板从正确位置开始接收更新：

| 对象 | 操作 |
| --- | --- |
| `main` | 保持 `theme.json.commit` 指向发布提交之前的基线；不要指向自身。下一次发布前再推进，新的 Release 会携带新基线 |
| `demo` | 在 `demo` 检出执行 `npm run theme:update`，脚本成功后自动写入新的 `commit` |
| 新站点 | 首次 `theme:update` 会从包内基线推进到主题最新提交；若两者之间只有已包含的变更，文件内容不变，只更新基线 |

不要在同一个提交里让 `theme.json.commit` 指向该提交自身。基线记录的是已经吸收的主题提交，允许比当前发布提交旧一个版本；下一次发布再推进。存在合并冲突时脚本不会更新 `theme.json`，解决冲突后重跑。

## main 与 demo

发布始终从 `main` 产生。`main` 是最小模板，不包含示例站内容；`demo` 是完整示例站，也是 GitHub Pages 的部署分支。`demo` 通过 `theme:update` 单向接收 `main` 的变更，不能反向合并。发布资产只从 `main` 打包，不包含 `demo` 的示例内容、截图与站点设置。

发布流程与部署工作流的完整配置见 [deployment.md](deployment.md)，与上游的同步见 [upstream.md](upstream.md)。
