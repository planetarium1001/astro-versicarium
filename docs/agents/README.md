# Agent 文档

## 范围

本篇覆盖：Agent 文档的用途、五个文件的索引、仓库地图、关键入口与生成物边界。前置：能读取仓库文件，Node.js 22.12.0+。

## 用途

- 面向本地 LLM 与代码 Agent，提供可核对的事实、改动入口与限制。
- 事实以仓库文件为准；与描述冲突时以源码与 `package.json` 为准。
- 使用步骤见[使用文档](../README.md)，实现细节见[开发文档](../developers/README.md)。
- 进入新仓库：先读 [facts.md](facts.md)，再按改动类型读 [tasks.md](tasks.md)。
- 只接浏览数据：直接读 [view-stats.md](view-stats.md)。
- 动笔或提交前：核对 [rules.md](rules.md) 的禁止项。

## 文件索引

| 文件 | 内容 |
|---|---|
| [facts.md](facts.md) | 版本、环境、35 个命令、`verify` 九步、环境变量、后台路由、设置文件、字体数字、生成物 |
| [view-stats.md](view-stats.md) | PV / UV 槽位契约、写入 API、就绪事件、取数提示词 |
| [tasks.md](tasks.md) | 八类改动的文件、注意事项与验证命令 |
| [rules.md](rules.md) | 必须做与禁止做、目录约定、后台与提交边界 |

## 仓库地图

| 目录 | 职责 |
|---|---|
| `content/` | 作者内容：`about/`、`bits/`、`blog/`、`devlog/`、`projects/` |
| `src/` | 主题代码：组件、布局、页面、库、插件、样式、浏览器脚本 |
| `src/data/settings/` | 五个设置 JSON：`site.json`、`shell.json`、`home.json`、`page.json`、`ui.json` |
| `public/` | 静态资源：图标、头像、字体、图片与 `_headers` |
| `scripts/` | 构建、检查、字体、内容与主题同步脚本 |
| `tests/` | Vitest 用例与 `fixtures/` 页面快照 |
| `tools/` | 字符集基线、字体清单与源字体缓存 |
| `docs/` | 使用文档、开发文档、Agent 文档与截图 |
| `.github/workflows/` | `ci.yml`、`pages.yml`、`release-please.yml`、`release.yml` |

- 分层、数据流与路由模型见[架构](../developers/architecture.md)，这里只给目录职责。
- `src/` 细分：`components/` 展示组件，`layouts/` 壳层与文章布局，`pages/` 页面与接口，`lib/` 数据与后台逻辑，`plugins/` Markdown 处理，`integrations/` 构建期复制附件，`styles/` 样式，`scripts/` 浏览器脚本。

## 关键入口

| 用途 | 起始文件 |
|---|---|
| 站点壳层与 head | `src/layouts/BaseLayout.astro` |
| 文章页 | `src/layouts/ArticleLayout.astro` |
| 首页与列表页 | `src/pages/index.astro`、`src/pages/blog/index.astro` |
| 后台页面 | `src/pages/admin/index.astro` 与 `src/pages/admin/` 下四个页面 |
| 后台接口 | `src/pages/api/admin/` |
| 集合声明 | `src/content.config.ts` |
| 条目加载 | `src/lib/content-loader.ts`、`src/lib/content-entry-files.ts` |
| 设置解析 | `src/lib/theme-settings.ts` |
| 浏览数据槽位 | `src/components/ViewStats.astro`、`src/lib/view-stats.ts`、`src/scripts/view-stats.ts` |
| 构建配置 | `astro.config.mjs`、`site.config.mjs` |
| 主题同步 | `scripts/theme-update.mjs` |

## 生成物边界

- 下列路径由脚本生成，不手改：字体 CSS、`public/fonts/`、`tools/font-manifest.json`、`tools/charset-common.txt`、`tools/charset-roles.json`、`tools/favicon-generated.json`、`public/images/site/generated/`、`tests/fixtures/`、`dist/`。
- 手改会在下一次生成时被覆盖；生成命令与重建顺序见 [facts.md](facts.md)。
- `node_modules/`、`dist/`、`.astro/` 不入库。
