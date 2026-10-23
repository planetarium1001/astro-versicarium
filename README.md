# Versicarium · 垄录

Versicarium 主题的示例站，用完整示例内容展示内容模型与页面形态。

- 在线站点：<https://planetarium1001.github.io/astro-versicarium/>
- 主题仓库：<https://github.com/planetarium1001/astro-versicarium>
- 主题版本：`1.0.0-rc.2`

## 分支定位

- `main` 是模板与更新来源，放主题代码、默认设置与全部文档。
- `demo` 是示例站，放完整示例内容与示例设置，部署到 GitHub Pages。
- 同步方向只有 `main` → `demo`，由 `npm run theme:update -- --include-fonts` 按文件合并。
- 站点自有路径不被覆盖：`content/`、`src/data/settings/`、`public/images/`、`public/author/`、`public/fonts/`、`tools/`、`tests/fixtures/`、`README.md`、`theme.json`。

## 展示内容

- 文章：主题介绍与上手指南按系列保留多个版本，另有写作、后台、部署、更新等教程。
- 项目：项目介绍与历史版本，卡片弹窗里切换版本，每个版本有独立地址。
- 动态：短文本、配图与作者信息。
- 开发日志：按项目归档的方向性记录。
- 关于：独立单页，含友链、常见问题与联系入口。
- 归档：文章版本、项目版本与日志按年月汇总，支持筛选、搜索与标签组合。

## 本地运行

需要 Node.js 22.12.0 或更高版本；`.nvmrc` 里的 `24.22.1` 是建议版本。

```bash
npm ci
npm run dev
```

启动后访问 `http://localhost:4321`，后台在 `/admin/`。

## 部署

`demo` 分支推送后由 `.github/workflows/pages.yml` 构建 `dist/` 并发布到 <https://planetarium1001.github.io/astro-versicarium/>，站点在 `/astro-versicarium/` 子路径下。

工作流里写死了两处配置：

- `env.SITE_URL`：`https://planetarium1001.github.io`
- `env.BASE_PATH`：`/astro-versicarium/`

也可以在 Actions 页面手动运行 `pages` 工作流。

## 文档

主题的使用、开发与 Agent 文档都在 `docs/`：

- [使用文档](docs/README.md)
- [开发文档](docs/developers/README.md)
- [Agent 文档](docs/agents/README.md)

## 版本状态

当前版本 `1.0.0-rc.2`，属于预览候选。示例站内容随主题一起调整。

## 许可

MIT，见 [LICENSE](LICENSE)。主题派生自 [cxro/astro-whono](https://github.com/cxro/astro-whono)，保留原版权声明。
