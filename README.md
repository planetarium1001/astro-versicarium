<h1 align="center">Versicarium · 垄录</h1>

<p align="center">面向开发者的内容与版本管理博客主题。</p>

<p align="center">
  <a href="https://github.com/planetarium1001/astro-versicarium">Repository</a> ·
  <a href="https://planetarium1001.github.io/astro-versicarium/">Live Demo</a> ·
  <a href="https://github.com/planetarium1001/astro-versicarium/tree/main/docs">Documentation</a>
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-22C55E?style=flat-square" alt="License: MIT"></a>
  <a href="./CHANGELOG.md"><img src="https://img.shields.io/badge/version-1.0.0--rc.2-F59E0B?style=flat-square" alt="Version 1.0.0-rc.2"></a>
</p>

Versicarium 是一个基于 Astro 的静态站点主题。它把技术文章、多版本项目文档、开发日志与短动态整合在同一套内容模型中，并自带一套本地内容管理后台。当前版本 `1.0.0-rc.2`，预览候选。

## 功能概览

主题默认包含文章、项目、动态、日志与关于五个内容模块，支持跨模块归档。开发环境提供完整的内容管理后台；生产环境只输出静态页面，不保留写入能力。

内容与主题代码分开存放：内容写在 `content/` 下的文件里，页面与样式在 `src/`。不需要数据库，也不需要账号系统。

## 核心特性

- **侧栏与内容区**：桌面端采用固定侧栏与内容区结构。内容区附带目录树与浮动操作列，滚动时高亮当前段落，并记住阅读位置。
- **亮色与暗色**：内置亮色与暗色模式，可跟随系统或手动切换。切换带过渡，并提供专注阅读模式。
- **多版本文档**：项目与博客系列支持多版本。项目在弹窗里切换历史版本，文章在侧边抽屉里切换；每个版本有独立地址。
- **项目与日志**：项目页用卡片网格展示，支持图标与封面；日志按项目分目录归档，便于追踪单个项目的变化。
- **动态与关于**：动态支持短文本、图片与作者信息；关于页是独立单页，可展示站点信息、友链与常见问题。
- **归档**：把文章版本、项目版本与日志按年月放在同一条时间线上，支持筛选、搜索与标签组合。
- **本地后台**：开发环境提供概览、主题、写作、资源与快照五个页面。主题设置分七组，写作页带实时预览与字段检查。
- **资源管理**：统一管理图片与附件，支持上传、批量重命名、移动与删除，显示引用状态，支持整条目 ZIP 导入导出与对象存储。
- **中文字体按需加载**：字体按用途与常用程度分层，常用字随页面加载，生僻字在需要时下载。

## 预览

截图来自示例站。桌面为 1440×810，窄屏为 780×1688。

<table>
  <tr>
    <td width="50%"><img src="docs/images/home-light.webp" alt="首页，亮色，左侧导航与首屏导语"></td>
    <td width="50%"><img src="docs/images/article-light.webp" alt="文章页，右侧目录与浮动按钮"></td>
  </tr>
  <tr>
    <td align="center">首页</td>
    <td align="center">文章</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/images/projects-dialog-light.webp" alt="项目版本弹窗，列出同一项目的全部版本"></td>
    <td width="50%"><img src="docs/images/admin-light.webp" alt="后台主题设置，亮色"></td>
  </tr>
  <tr>
    <td align="center">项目版本</td>
    <td align="center">后台设置</td>
  </tr>
</table>

<table>
  <tr>
    <td width="50%"><img src="docs/images/mobile-home.webp" alt="窄屏首页，单列布局" width="240"></td>
    <td width="50%"><img src="docs/images/mobile-article.webp" alt="窄屏文章页，浮动按钮贴右缘" width="240"></td>
  </tr>
  <tr>
    <td align="center">窄屏首页</td>
    <td align="center">窄屏文章</td>
  </tr>
</table>

更多截图在 `docs/images/`。

## 快速开始

需要 Node.js 22.12.0 或更高版本。

### 使用模板

在仓库页面选择 **Use this template**，得到一个历史独立的仓库，保留主题代码与 `main` 上的示例条目。

### 克隆并运行

```bash
git clone --depth 1 --branch main --single-branch \
  https://github.com/planetarium1001/astro-versicarium.git my-site
cd my-site
npm ci
npm run dev
```

启动后访问 `http://localhost:4321`；开发环境下访问 `/admin/` 进入后台。

### 作为自己的站点

浅克隆只取 `main` 的最新提交，`origin` 仍指向主题仓库。作为自有站点时，删除 `.git` 后重新初始化：

```bash
rm -rf .git
git init -b main
git add -A
git commit -m "chore: 初始化站点"
git remote add origin <你的仓库地址>
git push -u origin main
```

构建静态产物：

```bash
SITE_URL=https://example.com npm run build
```

`SITE_URL` 只写站点地址，不带路径。部署到子目录时另设 `ASTRO_WHONO_BASE_PATH`，例如 `/blog/`。不填 `SITE_URL` 时页面里的正式地址与分享图不输出，站点地图不生成，订阅源使用示例域名，`npm run verify` 会失败。

## 内容结构

每个条目是一个目录，主文件通常是 `index.md`，也可以是目录内唯一的 `.md` 或标了 `entry: true` 的文件；图片、附件与素材放在同级的 `images/`、`files/`、`assets/`。

| 模块 | 内容 | 位置 |
| --- | --- | --- |
| 文章 | 文章、上手说明、教程，可按系列分版本 | `content/blog/<条目>/index.md` |
| 项目 | 项目介绍与多版本内容 | `content/projects/<条目>/index.md` |
| 动态 | 短动态，可配图与作者 | `content/bits/<条目>/index.md` |
| 日志 | 按项目归档的开发日志 | `content/devlog/<项目>/<条目>/index.md` |
| 关于 | 关于页 | `content/about/index.md` |

归档页汇总文章版本、项目版本与日志，按年月排列；草稿只在开发环境可见。字段、版本规则与写作方式见[内容与写作](docs/writing.md)。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器与本地后台 |
| `npm run build` | 构建静态产物到 `dist/` |
| `npm run preview` | 预览构建产物 |
| `npm run verify` | 提交前的完整检查 |
| `npm test` | 运行测试用例 |
| `npm run new:bit` | 生成一条动态草稿 |
| `npm run theme:update` | 按文件同步主题更新 |
| `npm run font:build` | 按当前内容重新生成字体 |

完整命令与检查项见[本地运行与检查](docs/development.md)。

## 文档

文档默认面向使用者，只讲怎么用。需要代码细节时，每页顶部可以切到开发者版。

- [站点结构](docs/architecture.md)
- [本地运行与检查](docs/development.md)
- [内容与写作](docs/writing.md)
- [后台使用](docs/admin-console.md)
- [部署上线](docs/deployment.md)
- [版本与发布](docs/release.md)
- [主题更新](docs/upstream.md)
- [站点图标](docs/favicon.md)

全部开发者文档见 [docs/developers/](docs/developers/README.md)。

## 许可与致谢

MIT 许可，见 [LICENSE](LICENSE)。

主题基于 [cxro/astro-whono](https://github.com/cxro/astro-whono) 改造。上游是起点，不是本项目的旧版本；侧栏与内容区的布局、后台框架、Markdown 扩展与字体子集的做法最初来自那里。
