# 版本与发布

## 范围

本篇覆盖：版本策略与当前版本、关键文件与入口、Release Please 配置、数据流、Release 工作流、产物命名、发布清单、`theme.json` 基准、下载与校验。前置：能访问 GitHub 仓库并推送 `main`，部署分支见 [deploy.md](deploy.md)。

## 版本策略与当前版本

- 仓库是 `private: true` 的模板仓库，不发布到 npm；版本号只用于标记兼容性、生成 `CHANGELOG.md` 与命名 Release 附件。
- 主题使用 Semantic Versioning，四处保持同一个版本号：`package.json` 的 `version`、Git 标签（`v` 前缀）、`CHANGELOG.md` 的最新条目、`.release-please-manifest.json`。

| 变更类型 | 版本位 | 示例 |
| --- | --- | --- |
| 破坏性变更 | 主版本 | 修改 frontmatter 字段含义、删除设置项、改变公开路径或 `theme:update` 行为 |
| 向后兼容的功能 | 次版本 | 新增设置字段、后台模块或页面能力 |
| 向后兼容的修复 | 修订版本 | 修复渲染、布局、合并逻辑或文档错误 |

| 位置 | 当前值 |
| --- | --- |
| `package.json` 的 `version` | `1.0.0-rc.2` |
| `.release-please-manifest.json` | `1.0.0-rc.2` |
| `CHANGELOG.md` 最新条目 | `1.0.0-rc.2`（2026-10-21），前一条为 `1.0.0-rc.1`（2026-10-20） |
| 版本标签 | `v1.0.0-rc.1`（annotated tag）、`v1.0.0-rc.2`（lightweight tag） |

- `v1.0.0-rc.2` 指向 `89fc493`（`git rev-list -n1 v1.0.0-rc.2`），该提交的 `package.json` 版本为 `1.0.0-rc.2`。
- 版本序列从 `1.0.0` 的预览候选 `1.0.0-rc.1` 开始，当前处于预览阶段。
- 版本号里不写日期：日期不表达兼容性，提交时间由 Git 记录。

## 关键文件与入口

| 文件 | 作用 |
| --- | --- |
| `package.json` | `version` 是版本来源；`private: true`；`repository` 提供 GitHub 仓库地址 |
| `CHANGELOG.md` | 面向使用者的变更记录，按版本分节 |
| `.release-please-manifest.json` | Release Please 读取的当前版本 |
| `release-please-config.json` | Release Please 配置：发布类型、标签格式、预发布模式 |
| `.github/workflows/release-please.yml` | 手动触发，维护发布 PR |
| `.github/workflows/release.yml` | 手动触发，打包并上传 Release 附件 |
| `theme.json` | 主题合并基准，发布清单第 5 步会同步它 |
| `scripts/theme-update.mjs` | 推进 `theme.json` 基准、按文件合并主题更新 |
| `scripts/font-build.mjs` | `demo` 内容与模板不同时重新生成字体资产 |

## Release Please

`.github/workflows/release-please.yml` 由 `workflow_dispatch` 触发，在 Actions 页面手动运行后执行 `googleapis/release-please-action@v4`，读取 `release-please-config.json` 与 `.release-please-manifest.json`。

| 配置字段 | 值 |
| --- | --- |
| `release-type` | `node` |
| `initial-version` | `1.0.0-rc.1` |
| `include-v-in-tag` | `true` |
| `include-component-in-tag` | `false` |
| `versioning` | `prerelease` |
| `prerelease` | `true` |
| `prerelease-type` | `rc` |
| `packages["."]` | `package-name` 为 `astro-versicarium`，`changelog-path` 为 `CHANGELOG.md` |

配置没有覆盖 `changelog-sections`，版本位按 Release Please 默认规则判断：

| 提交类型 | 版本影响 |
| --- | --- |
| `feat` | 次版本 |
| `fix`、`perf` | 修订版本 |
| `feat!`、`fix!` 或 footer 写 `BREAKING CHANGE` | 主版本 |
| `docs`、`refactor`、`chore`、`ci`、`build` | 不改变版本 |

- 工作流维护一个发布 PR，更新 `package.json` 的版本与 `CHANGELOG.md`；手动运行才执行，不随推送自动触发。
- 两个预览候选的版本号、CHANGELOG 与 manifest 由维护者手动写入，不从发布 PR 产生。
- 发布稳定版时去掉 `versioning`、`prerelease`、`prerelease-type`，把 manifest 与 `package.json` 的版本改成 `1.0.0`；仓库里没有对应脚本。

## 数据流

1. 向 `main` 推送符合 Conventional Commits 的提交。
2. 在 Actions 页面手动运行 `release-please`，它打开或更新一个发布 PR，写入新版本号与 `CHANGELOG.md` 条目。
3. 检查并合并发布 PR。
4. 手动创建 `v<version>` 标签与 GitHub Release。
5. 手动运行 `release` 工作流并填入同一个标签。
6. 工作流检出标签对应提交，读取 `package.json` 的版本并与标签比较。
7. 版本一致时用 `git archive` 打包、生成校验文件，上传到同一个 Release。
8. 发布完成后在 `demo` 执行 `npm run theme:update -- --include-fonts`，推进 `theme.json` 基准。

## Release 工作流

`.github/workflows/release.yml` 由带 `tag` 输入的 `workflow_dispatch` 触发，权限为 `contents: write`：

1. 检出输入标签对应的提交，`fetch-depth: 0`，标签名放进 `RELEASE_TAG`。
2. 解析 Node 版本（`.nvmrc`，缺失回退 `22`），只用于读取 `package.json`。
3. 比较标签去掉 `v` 后的值与 `package.json` 的 `version`，不一致时该步骤失败，后续打包不会执行。
4. 用 `gh release view` 确认该标签已有 GitHub Release，缺失时给出可读错误并退出。
5. 用 `git archive --format=zip --prefix=astro-versicarium-<version>/` 打包，并用 `sha256sum` 生成 `SHA256SUMS`。
6. 用 `gh release upload --clobber` 上传压缩包与校验文件。

- 打包对象是标签提交的已跟踪文件，因此不含 `node_modules`、`dist` 或本地缓存；`docs/images/` 下的截图已被跟踪，会随模板包分发。
- 工作流里没有 `npm ci`、构建或测试步骤，也不创建 Release，只上传附件。
- 触发方式是手动：先创建 Release，再在 Actions 页面运行 `release` 并填入同一个标签。
- `--clobber` 允许在同一 Release 上重跑并覆盖同名附件。
- 附件名与解压目录由打包步骤里的 `name` 变量决定（`astro-versicarium-${VERSION}`），改名时要同步本页、下载命令与使用文档。

## 产物命名

| 资产 | 命名 |
| --- | --- |
| 标签 | `v<version>`，例如 `v1.0.0-rc.2` |
| 模板压缩包 | `astro-versicarium-<version>.zip` |
| 校验文件 | `SHA256SUMS` |
| 解压目录 | `astro-versicarium-<version>/` |

## 发布清单

1. 在 `main` 用 Conventional Commits 提交并推送，确认 CI 通过。
2. 等 Release Please 打开或更新发布 PR，核对版本号、`CHANGELOG.md` 与文档中的版本引用；预览候选由维护者手动写入时跳过这一步。
3. 合并发布 PR，或手动提交版本变更并创建 `v<version>` 标签。
4. 创建并发布对应的 GitHub Release，等待 `release` 工作流完成，确认附件是模板压缩包与 `SHA256SUMS`。
5. 在 `demo` 执行 `npm run theme:update -- --include-fonts`，按需再跑 `npm run font:build`；脚本会把 `theme.json` 的基准推进到新的 `main` 提交。

## theme.json 基准

- `theme.json` 的 `commit` 是 `theme:update` 的合并基准，不是版本号或标签。
- 脚本启动时读取 `repository`、`branch`、`commit`，缺任一字段会报错（`scripts/theme-update.mjs` 的 `readManifest`）。
- 当前 `main` 的值是 `89fc493`，也就是 `v1.0.0-rc.2` 标签指向的提交；`demo` 的值由最近一次 `theme:update` 写入，随同步提交变化。
- `main` 上的基准通常停在最近一次发布提交，之后的新提交不会自动推进它。
- 从仓库复制出的站点带着这个值开始第一次合并：从基准合并到主题最新提交，两者之间没有文件差异时内容不变，只更新基准。
- 合并有冲突时脚本不写 `theme.json`，解决后重跑。

## 常见改动要同时改哪里

| 改动 | 需要同步的位置 |
| --- | --- |
| 提升版本号 | `package.json`、`.release-please-manifest.json`、`CHANGELOG.md`、README 徽章与文档中引用的版本 |
| 改变标签格式 | `release-please-config.json` 的 `include-v-in-tag`、`include-component-in-tag`，以及本页 |
| 改变附件命名 | `release.yml` 的 `name` 变量、下载命令、产物命名表与使用文档 |
| 改变发布流程 | `release-please.yml`、`release.yml`，以及 [deploy.md](deploy.md) 的工作流表 |
| 改变 `theme.json` 字段 | `scripts/theme-update.mjs` 的 `readManifest`、全部站点的 `theme.json`，以及 [provenance.md](provenance.md) |

## 下载与校验

```bash
VERSION=1.0.0-rc.2
BASE="https://github.com/planetarium1001/astro-versicarium/releases/download/v${VERSION}"
curl -LO "${BASE}/astro-versicarium-${VERSION}.zip"
curl -LO "${BASE}/SHA256SUMS"
sha256sum -c SHA256SUMS          # macOS 用 shasum -a 256 -c SHA256SUMS
unzip "astro-versicarium-${VERSION}.zip"
cd "astro-versicarium-${VERSION}" && npm ci
```

- 校验失败时不要解压使用，重新下载并核对 `SHA256SUMS` 中的文件名与下载文件名。
- 压缩包没有 `.git`，作为自有站点使用前按 [仓库 README](../../README.md) 的获取模板步骤初始化仓库。
- 发布后确认附件时，在能访问 GitHub 的环境执行 `gh release view v1.0.0-rc.2`；这一步依赖网络与登录状态，不在仓库内校验。
- 本地核对版本链：

```bash
node -p "require('./package.json').version"
cat .release-please-manifest.json
git tag -l
git rev-list -n1 v1.0.0-rc.2
npm run ci
```
