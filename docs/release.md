# 发布

## 版本号

主题使用 Semantic Versioning。版本号写入 `package.json` 的 `version`；Git 标签加 `v` 前缀，`CHANGELOG.md` 记录面向使用者的变更，三者使用同一版本号。

| 变更类型 | 版本位 | 示例 |
| --- | --- | --- |
| 破坏性变更 | 主版本 | 修改 frontmatter 字段语义、删除设置项、改变公开路由或 `theme:update` 契约 |
| 向后兼容的功能 | 次版本 | 新增设置项、版本字段、后台模块或页面能力 |
| 向后兼容的修复 | 修订版本 | 修复渲染、布局、合并逻辑或文档错误 |

当前版本为 1.1.0，标签为 `v1.1.0`。

### 版本号选择

1.0.0 是首个公开主题版本。1.1.0 增加项目文档级多版本、资源工作区、条目版本显示与列表分页设置，没有要求已有站点迁移内容或设置。因此它是次版本，不是主版本或修订版本。

不采用 0.x：主题已经以固定 frontmatter、公开路由、设置字段与 `theme:update` 协议作为对外契约，1.x 表示这些契约已经稳定。0.x 会让使用者把每次次版本更新理解为可能破坏兼容。

不采用日期版本：日期不能表达“是否兼容”，也无法让 `v*` 标签、`package.json` 与 Release 资产共用同一个可比较的版本号。提交时间与基准提交已由 Git 和 `theme.json` 记录，不需要重复编码进版本号。

## 发布清单

1. 在 `main` 上更新 `package.json` 的 `version` 与 `CHANGELOG.md`，确认文档描述与代码一致。
2. 确认 `theme.json` 的 `repository`、`branch`、`commit` 正确；`commit` 是本次发布前站点应已吸收的基准。
3. 在干净工作树上执行完整验证：

   ```bash
   SITE_URL=https://planetarium1001.github.io npm run ci
   ```

4. 提交发布内容，创建与 `package.json` 一致的标签：

   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```

5. 等待 `release` 工作流完成，确认 Release 附带 `astro-whono-tweaked-1.1.0.zip` 与 `SHA256SUMS`。
6. 在 `demo` 检出上执行 `npm run theme:update` 并提交；本次同步会把 `demo/theme.json` 的基准推进到 `main` 当前提交。
7. 确认 `main/theme.json` 的 `commit` 仍指向发布提交之前的基线。它不能指向自身；等下一次发布前再推进到本次标签对应的提交。

标签一旦发布不要移动或重写。版本号写错时，修正后发布新的修订版本。

## 标签与工作流

`release.yml` 由 `v*` 标签触发，权限为 `contents: write`，步骤依次为：

1. 检出触发标签的提交；
2. 按 `.nvmrc` 安装 Node 与依赖；
3. 以 `SITE_URL=https://planetarium1001.github.io` 执行 `npm run ci`；
4. 比较标签去掉 `v` 后的值与 `package.json` 的 `version`，不一致则失败；
5. 用 `git archive --format=zip --prefix=astro-whono-tweaked-${VERSION}/` 打包，生成 `SHA256SUMS`；
6. 调用 `gh release create` 创建 Release，附带 `--generate-notes`。

工作流检出标签对应的提交，并校验该提交位于 `main` 上；`git archive HEAD` 打包的是这个提交，而不是 `main` 当前 HEAD。因此标签必须打在实际发布提交上。`git archive` 只包含已跟踪文件，不包含 `node_modules`、`dist`、未跟踪的示例站截图或本地缓存。

## 下载与校验

Release 页面：<https://github.com/planetarium1001/astro-whono-tweaked/releases/tag/v1.1.0>

```bash
curl -LO https://github.com/planetarium1001/astro-whono-tweaked/releases/download/v1.1.0/astro-whono-tweaked-1.1.0.zip
curl -LO https://github.com/planetarium1001/astro-whono-tweaked/releases/download/v1.1.0/SHA256SUMS

sha256sum -c SHA256SUMS
# macOS
shasum -a 256 -c SHA256SUMS

unzip astro-whono-tweaked-1.1.0.zip
cd astro-whono-tweaked-1.1.0
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
