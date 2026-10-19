# 与上游的关系

Astro Whono Tweaked 基于 [cxro/astro-whono](https://github.com/cxro/astro-whono)（MIT）改造。仓库保留上游的初始提交、双栏壳层、后台框架、Markdown 扩展与字体子集流程，并在此基础上调整内容模型、后台能力与更新方式。上游的 MIT 许可证与版权声明保留在 [../LICENSE](../LICENSE)。

## 相对上游的改造

| 范围 | 本仓库的实现 |
| --- | --- |
| 内容根 | 作者内容移到 `content/`，与 `src/` 主题代码分离；条目为目录，包含 Markdown 主文件与资源目录 |
| 集合 | 固定为 `blog`、`projects`、`bits`、`devlog`、`about`，另有跨集合归档 |
| 项目文档 | 同一项目可有多个版本文档，共享稳定 `slug`，最新版与历史版各有公开锚点与弹窗 |
| 博客版本 | `series` 分组、共享稳定 `slug`、历史版本日期路径与文章页版本抽屉 |
| 后台 | 主题、写作、资源、快照统一为开发环境可写的控制台；生产环境只保留只读壳 |
| 资源 | 集合与条目级图片、附件、共享资源、引用状态、批量操作与整条目导入导出 |
| 主题更新 | `theme.json` 记录基准提交，`theme:update` 按文件三方合并；站点自有路径不覆盖 |
| 界面 | 侧栏、浮动操作列、目录、版本界面、分页与字体角色按本项目的使用场景调整 |

上游已有的集合名称、路由与设置结构与本仓库不同。本仓库以 `src/content.config.ts`、`src/lib/project-routing.ts`、`src/lib/blog-routing.ts` 与 `src/data/settings/` 为准；不要把上游的目录或字段直接套用到本站文档。

## 同步方向

| 方向 | 方式 |
| --- | --- |
| 上游 → 本仓库 | 手工 Git 合并，在 `main` 上解决冲突并验证 |
| 本仓库 `main` → `demo` | `npm run theme:update`，单向 |
| 本仓库 → 站点 | `npm run theme:update`，按 `theme.json` 的基准提交三方合并 |

不要反向合并 `demo` 到 `main`。`demo` 包含完整示例内容、示例设置与测试快照，反向合并会把模板重新变成示例站。也不要让站点直接合并本仓库的 `demo` 分支；站点应跟踪 `main`。

## 手工合并上游

```bash
git remote add upstream https://github.com/cxro/astro-whono.git
git fetch upstream --tags
git checkout main
git merge upstream/main
```

合并后处理冲突，再执行：

```bash
SITE_URL=https://planetarium1001.github.io npm run verify
```

上游改动可能集中在壳层、Markdown 管线或后台契约，冲突处理原则如下：

- `content/`、`src/data/settings/`、`public/images/`、`public/author/`、`public/fonts/` 与 `theme.json` 属于站点自有范围，保留本站版本。
- 上游集合或字段与本仓库不同时，以本仓库 schema 与路由模型为准，吸收上游的实现思路而不是目录名。
- 上游改动壳层尺寸时，同步 `src/pages/index.astro` 的 critical CSS 快照；`check:home-critical-css` 与 `check:layout-geometry` 会指出漂移。
- 上游改动 `src/plugins/` 时，检查白名单是否仍允许本站内容使用的 HTML；`check:markdown-smoke` 与构建会暴露被清洗掉的标记。
- 合并完成后在 `main` 上提交，再在 `demo` 检出执行 `theme:update`，不要直接把 `main` 的提交 cherry-pick 到 `demo`。

上游提供了本项目的初始结构，在此致谢。上游的新版本不保证与本仓库的内容模型或设置结构兼容，合并属于手工维护工作，不纳入 `theme:update`。
