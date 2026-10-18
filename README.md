# astro-whono-tweaked

基于 [cxro/astro-whono](https://github.com/cxro/astro-whono)（MIT）的 Astro 博客主题模板，沿用上游的双栏壳层、后台控制台与 Markdown 扩展，并针对长文阅读做增量改造。

主题更新通过 `theme:update` 三方合并，站点无需共享 git 历史。

- 仓库：<https://github.com/planetarium1001/astro-whono-tweaked>
- 示例站点：<https://planetarium1001.github.io/astro-whono-tweaked/>
- 上游项目：<https://github.com/cxro/astro-whono>

## 特性

| 特性 | 说明 |
| --- | --- |
| 双栏壳层 | 侧栏 224px，滚动条槽位固定，页面外缘间隙可配 |
| 内容模型 | `blog`、`projects`、`bits`、`devlog`、`about` 五个集合，另有全站归档 |
| 长文阅读 | 目录、阅读模式、浮动操作列、阅读位置记忆、主题切换 |
| 后台控制台 | 开发环境可读写：概览、主题、写作、图片、快照 |
| 主题同步 | 按文件三方合并，站点自有路径不覆盖 |
| 自托管字体 | WOFF2 子集，按字符集加载 |

## 环境与命令

Node.js ≥ 22.12.0，版本基线见 `.nvmrc` 与 `package.json` 的 `engines`。

```bash
npm install
npm run dev       # 开发服务器，后台入口 /admin/
npm run build     # 输出到 dist/
npm run preview   # 预览构建结果
```

`npm run dev` 下 `/admin/` 与 `/api/admin/*` 可读写；生产构建中的后台是只读静态壳。

## 获取模板

按用途选择一种方式。

1. 从模板创建：在仓库页面点「Use this template」，得到独立历史，后续用 `npm run theme:update` 获取主题更新。
2. 克隆 `main` 写作：只取一个分支，适合从零开始管理站点。

   ```bash
   git clone --branch main --single-branch https://github.com/planetarium1001/astro-whono-tweaked.git my-site
   cd my-site
   npm install
   ```

   克隆得到的 `origin` 指向主题仓库，不能向它推送。要变成自己的站点，删除 `.git` 后重新初始化；`theme.json` 与主题更新不依赖 git 历史。

   ```bash
   rm -rf .git
   git init -b main
   git add -A
   git commit -m "chore: 初始化站点"
   git remote add origin <你的仓库地址>
   git push -u origin main
   ```

3. Fork：保留与主题同源的历史，可直接合并主题更新。

   ```bash
   git remote add theme https://github.com/planetarium1001/astro-whono-tweaked.git
   git fetch theme main
   git merge theme/main
   ```

## 目录结构

```text
content/            作者内容：按集合分目录，条目含 index.md 与 images/、files/
src/pages/          路由；admin/ 与 api/admin/ 仅开发环境可用
src/layouts/        BaseLayout、ArticleLayout
src/components/     展示组件；admin/ 为后台界面
src/lib/            设置解析、内容读取与后台逻辑
src/scripts/        前台脚本；admin-*/ 为后台专用
src/styles/         样式入口与各组件样式
src/plugins/        Markdown 管线：remark / rehype 插件与 HTML 白名单
src/utils/          格式化、日期、slug 规则等通用工具
src/data/settings/  主题设置 JSON
public/             静态资源：fonts/、author/ 等
scripts/            维护脚本：字体子集、校验、new:bit、theme:update
tools/              字体字符集基线与指纹
tests/              Vitest 用例与页面快照
docs/               仓库文档
```

分层与数据流见 [docs/architecture.md](docs/architecture.md)。

## 主题设置

设置以 JSON 保存在 `src/data/settings/`，按领域分成五个文件。

| 文件 | 内容 |
| --- | --- |
| `site.json` | 站点标题与描述、语言、页脚、备案、favicon、社交链接、后台概览、标题宽度与页面间隙 |
| `shell.json` | 侧栏站点名、窄屏标题、引用文案、导航项 |
| `home.json` | 首页引导语、更多入口、Hero 图 |
| `page.json` | 各列表页标题与副标题、动态页默认作者、列表页 RSS 开关 |
| `ui.json` | 代码块行号、阅读模式、浮动操作列、浏览数据、侧栏动作、文章元信息、字体角色 |

推荐通过 `/admin/theme/` 修改；直接编辑 JSON 同样有效，字段缺失或非法时回退默认值。字段分组见 [docs/admin-console.md](docs/admin-console.md)，站点图标见 [docs/favicon.md](docs/favicon.md)。

## 内容模型

| 集合 | 源文件 | 路由 |
| --- | --- | --- |
| `blog` | `content/blog/<entry>/index.md` | `/blog/`、`/blog/<slug>/` |
| `projects` | `content/projects/<entry>/index.md` | `/projects/`（页内锚点） |
| `bits` | `content/bits/<entry>/index.md` | `/bits/`（页内锚点） |
| `devlog` | `content/devlog/<projectSlug>/<entry>/index.md` | `/devlog/`（页内锚点） |
| `about` | `content/about/index.md` | `/about/` |

`/archive/` 是跨博客、项目与更新的全站时间线，按年月分组，不含动态。写作入口有三种：后台写作页、直接新增 Markdown 文件、`npm run new:bit` 生成动态草稿。frontmatter、图片路径与 Markdown 扩展见 [docs/writing.md](docs/writing.md)。

## 主题同步

`theme:update` 读取 `theme.json` 记录的主题仓库、分支与基准提交，拉取主题新版本，按文件做三方合并：

```bash
npm run theme:update -- --check   # 只报告将要发生的变更
npm run theme:update              # 执行合并，并更新 theme.json 的基准提交
```

| 情况 | 处理 |
| --- | --- |
| 站点未改动该文件 | 直接取主题新版本 |
| 主题未改动该文件 | 保留站点版本 |
| 双方都改动 | `git merge-file` 合并，冲突保留标记并列出 |
| 文件为二进制 | 整文件取舍；双方都改过则保留站点版本并报冲突 |
| 站点自有路径 | 不覆盖，仅在报告中列出 |

站点自有路径包括 `content/`、`src/data/settings/`、`public/images/`、`public/author/`、`public/fonts/`、`tools/`、`tests/fixtures/`、`README.md`、`.github/workflows/pages.yml` 与 `theme.json`。

存在冲突时命令以非零状态退出，且不更新 `theme.json`；解决后重跑。主题删除的文件不会自动移除，报告会列出待确认项。合并完成后执行 `npm run verify`。

## 开发与验证

```bash
npm run check     # 类型检查与源码类守卫
npm test          # Vitest
npm run verify    # check → build → test:fixtures → test → 产物 / 布局 / 触控校验
npm run ci        # 等价于 verify，CI 使用
```

产物类校验读取 `dist/`，必须在构建后执行。`SITE_URL` 为空时 sitemap 不生成，`check:prod-artifacts` 会失败；CI 与发布构建必须提供该变量。

校验脚本清单、测试组织与命名规范见 [docs/development.md](docs/development.md)。

## 部署

`main` 是模板分支，只保留种子内容与中性默认设置；`demo` 是完整示例站，承载 GitHub Pages 部署。主题改动在 `main` 完成后单向同步到 `demo`，不反向合并。

| 工作流 | 触发 | 作用 |
| --- | --- | --- |
| `ci.yml` | push / PR 到 `main`、`demo` | `npm ci` 后执行 `npm run ci` |
| `pages.yml` | push 到 `demo`、手动触发 | 构建并发布到 GitHub Pages |

| 变量 | 作用 |
| --- | --- |
| `SITE_URL` | 站点 origin，用于 RSS、canonical、og 与 sitemap |
| `ASTRO_WHONO_BASE_PATH` | 部署子路径，默认 `/`；项目页部署时由 Pages 工作流推导 |

GitHub Pages 配置、自有站点部署与其他静态托管见 [docs/deployment.md](docs/deployment.md)。

## 文档

| 文档 | 内容 |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | 目录分层、集合与路由、壳层与布局几何、字体子集流程 |
| [docs/development.md](docs/development.md) | 环境、命令、验证流水线、fixture 与守卫脚本、命名规范 |
| [docs/deployment.md](docs/deployment.md) | 分支模型、GitHub Pages、自有站点与其他静态托管 |
| [docs/writing.md](docs/writing.md) | 各集合 frontmatter、图片路径、末尾链接组与 Markdown 扩展 |
| [docs/admin-console.md](docs/admin-console.md) | 后台模块、主题页分组、校验与排序规则 |
| [docs/favicon.md](docs/favicon.md) | 站点图标槽位、单图复用、反向代理下的图标请求 |
| [docs/analytics.md](docs/analytics.md) | 浏览数据槽位契约、统计接入、备案字段 |
| [docs/upstream.md](docs/upstream.md) | 与上游的关系、增量范围、同步方向 |
| [docs/llm-view-stats-prompt.md](docs/llm-view-stats-prompt.md) | 浏览数据取数脚本的提示词模板 |

## 许可与致谢

本仓库基于 [cxro/astro-whono](https://github.com/cxro/astro-whono)（MIT）改造，使用 [Astro](https://astro.build/) 构建。许可证见 [LICENSE](LICENSE)。
