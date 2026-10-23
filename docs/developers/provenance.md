# 来源与主题同步

## 范围

本篇覆盖：与 Whono 的派生关系与 MIT 许可、脱离 fork network 的事实、`theme:update` 的三方合并实现、站点自有路径清单、失败行为、常见改动要同时改哪里。前置：仓库有 `theme.json`，能执行 `git fetch`。

## 派生关系与许可

- 主题派生自 [cxro/astro-whono](https://github.com/cxro/astro-whono)，保留 MIT 许可与版权声明。
- `LICENSE` 的版权行是 `Copyright (c) 2026 cxro` 与 `Copyright (c) 2026 Planetarium (modifications)`，MIT 条文未改。
- 仓库提交历史保留了 cxro 的原始提交（从 `66ded04`，2026-01-17 起），此后由本仓库维护。
- 内容模型、后台、字体与发布流程按本仓库代码演进，集合名、路由与设置结构以本仓库为准。
- 部分兼容名称仍在使用：部署子路径变量已改名为 `ASTRO_VERSICARIUM_BASE_PATH`，旧名 `ASTRO_WHONO_BASE_PATH` 全仓 0 处读取；`ASTRO_WHONO_*` 下的对象存储与冒烟测试变量是代码实际读取的名字。

## 无上游可跟踪

- 本仓库已脱离 Whono 的 fork network，不再跟踪上游仓库。
- 没有 `upstream` 远端：`git remote -v` 只有 `origin`，指向 `planetarium1001/astro-versicarium`。
- Issue、PR、push 与 Release 只指向 `planetarium1001/astro-versicarium`。
- 同步主题的方式是按提交做三方合并，不是拉取上游分支；合并范围由 `theme.json` 与 `scripts/theme-update.mjs` 的站点自有路径清单决定。

## theme.json 与三方合并

`theme.json` 只有三个字段，`commit` 是上一次合并到的主题提交，作为逐文件合并的基准。

```json
{
  "repository": "https://github.com/planetarium1001/astro-versicarium",
  "branch": "main",
  "commit": "89fc493"
}
```

`npm run theme:update` 的执行流程（`scripts/theme-update.mjs`）：

1. `readManifest()` 读取并校验三个字段；缺文件或字段立即报错。
2. `git status --porcelain` 有输出即中止，`--check` 同样要求工作树干净。
3. `git fetch --no-tags --force <repository> <branch>`，用 `git rev-parse FETCH_HEAD` 取目标提交。
4. 目标提交等于 `commit` 时打印「已是最新」并退出，不写任何文件。
5. `git diff --name-status <base> <head>` 列出改动文件；`git diff --numstat` 中的 `-/-` 行标记二进制文件。
6. 逐个文件判断是否站点自有路径，是则跳过并记入报告。
7. 文本文件走三方合并：站点侧缺失取主题版本；主题侧删除返回 `null`；站点侧等于基准取主题版本；主题侧等于基准保留站点版本；双方都改过时写入临时目录并执行 `git merge-file -p --diff3`。
8. 二进制文件不做逐行合并：一边未改动取另一边，双方都改过保留站点版本并记为冲突。
9. 非 `--check` 模式把合并结果写回工作树；冲突结果也会写入，方便手工处理。
10. 无冲突且非 `--check` 时把 `theme.json` 的 `commit` 改为目标提交，并提示运行 `npm run verify`。

- 结果按「取主题新版本」「已合并双方改动」「主题已删除」「站点自有，未覆盖」「存在冲突，需手工处理」分组打印。
- 有冲突时进程退出码为 `1`，不更新 `theme.json`。
- 临时文件放在系统临时目录，循环结束后删除；`git` 输出上限设为 64 MB，避免字体清单等大输出被截断。
- 仓库里没有针对该脚本的独立测试，验证依赖 `--check` 输出、`git status` 与合并后的 `verify`。

## 站点自有路径

`SITE_OWNED_PREFIXES`（`scripts/theme-update.mjs:24`）：

| 前缀 | 含义 |
| --- | --- |
| `content/` | 站点内容，目录名取自 `site.config.mjs` 的 `CONTENT_ROOT` |
| `src/data/settings/` | 站点设置 |
| `public/images/`、`public/author/` | 站点图片与作者头像 |
| `public/fonts/` | 站点字体资产 |
| `tools/` | 字符集、字体清单与生成标记 |
| `tests/fixtures/` | 页面快照 |

`SITE_OWNED_FILES`：`README.md`、`theme.json`、`.github/workflows/pages.yml`。

- 命中任一清单的文件在同步时只列入报告，不覆盖站点版本。
- `--include-fonts` 只影响 `THEME_FONT_PATHS`：`public/fonts/` 与 `tools/` 下的 `font-sources.json`、`font-manifest.json`、`charset-base.txt`、`charset-common.txt`、`charset-common.sha256`、`charset-roles.json`、`charset-frequency.txt`。
- 这些文件在 `--include-fonts` 下不再被当作站点自有路径；`SITE_OWNED_FILES` 与其余前缀仍然跳过。
- `content/` 的目录名来自 `CONTENT_ROOT`，修改内容根时要同步更新脚本里的路径判断。

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

## 常见改动要同时改哪里

| 改动 | 需要同步的位置 |
| --- | --- |
| 新增站点自有路径 | `scripts/theme-update.mjs` 的 `SITE_OWNED_PREFIXES` 或 `SITE_OWNED_FILES`，以及本页路径表 |
| 新增主题字体清单文件 | `scripts/theme-update.mjs` 的 `THEME_FONT_PATHS`，以及 [development.md](development.md#字体管线) |
| 修改 `theme.json` 字段 | `readManifest` 的校验、`main` 与 `demo` 两个分支的 `theme.json`，以及 [release.md](release.md#themejson-基准) |
| 改变内容根名称 | `site.config.mjs` 的 `CONTENT_ROOT`，以及依赖它的路径判断 |
| 推进基准 | `main` 侧由维护者在发布或同步提交里手动更新；`demo` 与站点由 `theme:update` 成功后自动写入 |
| 改变合并策略 | `scripts/theme-update.mjs` 的 `mergeFile`、`mergeBinary`，以及本页流程与失败行为表 |

## 检查与验证

```bash
npm run theme:update -- --check   # 只报告，不写入
git status --porcelain            # 工作树必须为空
git show HEAD:theme.json          # 确认基准提交
npm run verify                    # 合并后的完整检查
```

同步完成后先看 `--check` 报告里的「站点自有，未覆盖」与「存在冲突」两组，再处理冲突并重跑。
