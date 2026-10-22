# 与上游的关系

> 本页面向开发者，包含实现细节与命令。使用说明见[使用版](../upstream.md)，全部开发文档见[索引](README.md)。

这一层负责两件事：本仓库与上游的关系，以及 `theme:update` 的合并实现。内容包括 `theme.json` 字段、远端拉取、逐文件合并、冲突与失败行为、站点自有路径与手工合并上游。部署见 [deployment.md](deployment.md)，版本发布见 [release.md](release.md)。

上游是分叉起点，不是本项目的旧版本。本仓库保留上游的 MIT 许可与部分兼容名称，内容模型、后台、字体与发布流程由本仓库维护。

## 来源与许可

- 上游仓库是 [cxro/astro-whono](https://github.com/cxro/astro-whono)。
- `LICENSE` 保留 cxro 的版权声明，另有一行 Planetarium (modifications)，MIT 条文未改。
- 本仓库的提交历史从 `66ded04`（2026-01-17，cxro）开始，cxro 的提交止于 `b6bc4f9`（2026-08-13）；`git rev-parse 5b0914d^` 为 `b6bc4f9`，即 `5b0914d`（2026-10-02，Planetarium）紧跟其后，从这一提交起由本项目维护。
- 部分兼容名称仍在使用。用户可见的是 `ASTRO_WHONO_BASE_PATH`，站点时区环境变量是 `SITE_TIMEZONE`；代码里的 Shiki 处理名是 `astro-whono-code-toolbar`。改用户可见的名称会破坏现有站点配置，内部名只影响代码。

## 相对上游的结构

| 范围 | 本仓库的实现 |
| --- | --- |
| 内容位置 | 作者内容在 `content/`，主题代码在 `src/`，两者分开 |
| 集合 | `blog`、`projects`、`bits`、`devlog`、`about`，定义在 `src/content.config.ts` |
| 路由 | 博客版本与项目版本的公开路径由 `src/lib/blog-routing.ts` 与 `src/lib/project-routing.ts` 计算 |
| 后台 | 开发环境可写的页面在 `src/pages/admin/`，写入接口在 `src/pages/api/admin/`；生产构建切到 `static` |
| 字体 | 分层子集放在 `public/fonts/`，生成脚本在 `scripts/font-*.mjs`，字符集清单在 `tools/` |
| 主题更新 | `theme.json` 记录基准提交，`npm run theme:update` 按文件合并 |
| Markdown | 处理流程与 HTML 白名单在 `src/plugins/` |

集合名、路由与设置结构以本仓库代码为准。判断某一层时用 `src/content.config.ts`、`src/lib/` 与 `src/data/settings/`，不要把上游的目录或字段直接套到本站。

## 关键文件与入口

| 文件 | 作用 |
| --- | --- |
| `theme.json` | 主题仓库、跟踪分支与合并基准提交 |
| `scripts/theme-update.mjs` | 更新入口；负责拉取、合并、冲突报告与基准推进 |
| `scripts/font-build.mjs` | `demo` 同步后按内容重新生成字体资产 |
| `.github/workflows/pages.yml` | 站点自有文件，`theme:update` 不覆盖 |
| `src/content.config.ts` | 集合与字段定义，上游结构对照时的准绳 |
| `src/lib/blog-routing.ts`、`src/lib/project-routing.ts` | 博客与项目版本路由模型 |
| `src/plugins/` | Markdown 处理流程与 HTML 白名单 |

## 同步方向

| 方向 | 方式 |
| --- | --- |
| 上游 → 本仓库 | 手工 Git 合并，在 `main` 上解决冲突并验证 |
| `main` → `demo` | `npm run theme:update -- --include-fonts`，单向 |
| 主题 → 站点 | `npm run theme:update`，按 `theme.json` 的基准提交逐文件合并 |

不要反向合并 `demo` 到 `main`。`demo` 包含完整示例内容与测试快照，反向合并会把模板重新变成示例站。站点跟踪 `main`，不要直接合并 `demo`。

## theme.json 字段与读取

`theme.json` 只有三个字段：`repository`、`branch`、`commit`。`commit` 是上一次合并到的主题提交，作为逐文件合并的基准，不是版本号或标签。

```json
{
  "repository": "https://github.com/planetarium1001/astro-versicarium",
  "branch": "main",
  "commit": "89fc493"
}
```

`readManifest` 在启动时读取并校验：文件不存在时报 `missing theme.json: this repository is not tracked as a theme instance`；缺任一字段时报 `theme.json requires repository, branch and commit fields`。当前 `main` 的值是 `89fc493`（`v1.0.0-rc.2` 标签提交），`demo` 的值由最近一次更新写入，当前为 `909831a`。

## theme:update 执行流程

1. 读取并校验 `theme.json`。
2. 执行 `git status --porcelain`；有输出即中止，提示先提交或暂存。`--check` 同样要求工作树干净。
3. 执行 `git fetch --no-tags --force <repository> <branch>`，用 `git rev-parse FETCH_HEAD` 取目标提交。
4. 目标提交等于 `commit` 时打印「已是最新」并退出，不写任何文件。
5. 用 `git diff --name-status <base> <head>` 列出改动文件；用 `git diff --numstat` 中 `-/-` 的行标记二进制文件。
6. 逐个文件：先判断是否站点自有路径，是则跳过并记入报告；否则用 `git show <commit>:<path>` 读基准与主题版本，用工作树读站点版本，文件不存在记为 `null`。
7. 文本文件走三方合并：站点侧缺失取主题版本；主题侧删除返回 `null`，记为「主题已删除」；站点侧等于基准取主题版本；主题侧等于基准保留站点版本；双方都改过时写入临时目录并执行 `git merge-file -p --diff3`，退出码非零即冲突，输出里带冲突标记。
8. 二进制文件不做逐行合并：一边未改动取另一边，双方都改过保留站点版本并记为冲突。
9. `--check` 以外的模式把合并结果写回工作树；冲突结果也会写入，方便手工处理。`--check` 不写文件。
10. 结果按「取主题新版本」「已合并双方改动」「主题已删除」「站点自有，未覆盖」「存在冲突，需手工处理」分组打印。
11. 有冲突时进程退出码为 `1`，不更新 `theme.json`，提示解决后重跑。
12. 无冲突且非 `--check` 时，把 `theme.json` 写成两空格缩进的 JSON（追加换行），`commit` 改为目标提交，并提示运行 `npm run verify`。

临时文件放在系统临时目录，循环结束后删除。`git` 输出上限设为 64 MB，避免字体清单等大输出被当成失败或截断。

## 失败行为

| 情形 | 行为 |
| --- | --- |
| `theme.json` 不存在或缺字段 | 启动即报错，退出码 `1` |
| 工作树有未提交改动 | 中止，不拉取、不写入 |
| 远端不可达或权限不足 | `git` 报错信息写进错误输出，退出码 `1` |
| 目标提交与基准相同 | 打印「已是最新」，正常退出 |
| 合并冲突 | 冲突标记写入文件，退出码 `1`，`theme.json` 不变 |
| 主题删除文件 | 只列入报告，不删除工作树文件 |
| `--check` | 只输出报告，不写工作树与 `theme.json` |

## 站点自有路径

`SITE_OWNED_PREFIXES` 中的前缀：`content/`、`src/data/settings/`、`public/images/`、`public/author/`、`public/fonts/`、`tools/`、`tests/fixtures/`。`SITE_OWNED_FILES` 中的文件：`README.md`、`theme.json`、`.github/workflows/pages.yml`。

`content/` 的目录名来自 `site.config.mjs` 的 `CONTENT_ROOT`，修改内容根时要同步更新脚本里的路径判断。

`--include-fonts` 只影响 `THEME_FONT_PATHS`：`public/fonts/` 与 `tools/` 下的 `font-sources.json`、`font-manifest.json`、`charset-base.txt`、`charset-common.txt`、`charset-common.sha256`、`charset-roles.json`、`charset-frequency.txt`。这些文件在 `--include-fonts` 下不再被当作站点自有路径；`SITE_OWNED_FILES` 与其余前缀仍然跳过。

## 常见改动要同时改哪里

| 改动 | 要一起改的位置 |
| --- | --- |
| 新增站点自有路径 | `scripts/theme-update.mjs` 的 `SITE_OWNED_PREFIXES` 或 `SITE_OWNED_FILES`，以及本页的路径列表与 [使用者版](../upstream.md) |
| 新增主题字体清单文件 | `scripts/theme-update.mjs` 的 `THEME_FONT_PATHS`，以及 [development.md](development.md) 的字体说明 |
| 修改 `theme.json` 字段 | `readManifest` 的校验、`main` 与 `demo` 两个分支的 `theme.json`，以及 [release.md](release.md) 的基准说明 |
| 改变内容根名称 | `site.config.mjs` 的 `CONTENT_ROOT`，以及依赖它的路径判断与文档 |
| 推进基准 | `main` 侧由维护者在发布或同步提交里手动更新；`demo` 与站点由 `theme:update` 成功后自动写入 |

## 手工合并上游

```bash
git remote add upstream https://github.com/cxro/astro-whono.git
git fetch upstream --tags
git checkout main
git merge upstream/main
```

冲突处理原则：

- 站点自有路径保留本站版本，包括 `content/`、`src/data/settings/`、`public/` 下自己的资源与 `theme.json`。
- 上游的集合、字段或路由与本仓库不同时，以本仓库的字段定义与路由模型为准。
- 上游改动布局时同步 `src/pages/index.astro` 的首屏样式快照，`check:home-critical-css` 会指出对不上。
- 上游改动 Markdown 处理或 HTML 白名单时，先构建，再用 `npm run check:markdown-smoke` 检查产物里的标记是否被清洗。

合并完成后在 `main` 提交，再在 `demo` 执行 `npm run theme:update -- --include-fonts`。`theme:update` 不合并上游，这一步只能手工完成。

## 检查与验证

```bash
npm run theme:update -- --check   # 只报告，不写入
git status --porcelain            # 工作树必须为空
git show HEAD:theme.json          # 确认基准提交
git rev-list -n1 v1.0.0-rc.2      # 标签与提交的对应关系
npm run verify                    # 合并后的完整检查
```

仓库里没有针对该脚本的独立测试，验证依赖 `--check` 的输出、`git status` 与合并后的 `verify`。手工合并上游后至少再跑一次 `npm run check` 与构建。
