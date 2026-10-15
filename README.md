# astro-whono-tweaked

基于 [cxro/astro-whono](https://github.com/cxro/astro-whono) 的 Astro 博客主题模板，面向长文阅读做了增量改造：文章目录、右下角浮动操作列、阅读位置记忆、主题切换涟漪、浏览数据槽位与备案信息。主题结构、内容集合、后台与 Markdown 扩展沿用上游。

- 示例站点：<https://planetarium1001.github.io/astro-whono-tweaked/>
- 上游项目：<https://github.com/cxro/astro-whono>

## 分支模型

| 分支 | 内容 | 用途 |
| --- | --- | --- |
| `main` | 主题代码 + 每类一到数条种子内容 + 中性默认设置 | 模板与更新来源 |
| `demo` | 完整示例内容、示例截图与站点设置 | 部署到 GitHub Pages |

`main` 不参与部署。`pages.yml` 固定在 `demo` 分支运行，工作流文件本身留在默认分支，因此仍可从 Actions 页面手动触发。

改动方向是单向的：主题改动先在 `main` 完成，再同步到 `demo`。不要创建 `demo` 合并回 `main` 的请求——两个分支在内容、设置与测试快照上刻意不同，合并会把模板重新变成示例站，并在 `tests/fixtures/` 与 `theme.json` 上产生冲突。

## 使用方式

### 从模板创建

在仓库页面点「Use this template」创建自己的仓库。这样得到的是独立历史，不含主题的提交记录。

之后通过 `npm run theme:update` 获取主题更新，无需共享 git 历史。

### Fork 本仓库

Fork 本仓库后，`main` 与主题保持同源历史，可直接用 git 合并：

```bash
git remote add theme https://github.com/planetarium1001/astro-whono-tweaked.git
git fetch theme main
git merge theme/main
```

### 同步主题更新

两种方式都指向同一件事：把主题的新版本合并进站点，而不覆盖自己的内容与设置。

```bash
npm run theme:update -- --check   # 只报告将要发生的变更
npm run theme:update              # 执行合并，并更新 theme.json 的基准提交
```

`theme:update` 读取 `theme.json` 记录的主题仓库与基准提交，拉取主题新版本，按文件做三方合并：

| 情况 | 处理 |
| --- | --- |
| 站点未改动该文件 | 直接取主题新版本 |
| 主题未改动该文件 | 保留站点版本 |
| 双方都改动 | `git merge-file` 合并，冲突保留标记并列出 |
| 站点自有路径 | 不覆盖，仅在报告中列出 |

站点自有路径包括 `src/content/`、`src/data/settings/`、`public/images/`、`public/author/`、`public/fonts/`、`tools/`、`tests/fixtures/`、`README.md`、`.github/workflows/pages.yml` 与 `theme.json`。

主题发布后会把 `theme.json` 的 `commit` 指向该次发布，这是下一次合并的基准。

## 快速开始

环境要求：Node.js ≥ 22.12.0，见 `.nvmrc` 与 `package.json` 的 `engines`。

```bash
npm install
npm run dev       # 开发服务器，后台入口 /admin/
npm run build     # 输出到 dist/
npm run preview   # 预览构建结果
```

`npm run dev` 下的后台可读写；生产产物中的后台是只读静态壳。

## 配置

### 构建期环境变量

| 变量 | 作用 |
| --- | --- |
| `SITE_URL` | 站点 origin，用于 RSS、canonical、og 与 sitemap。为空时 RSS 回落到 `https://example.invalid`，canonical 与 og:url、og:image 省略，sitemap 不生成 |
| `ASTRO_WHONO_BASE_PATH` | 部署子路径，默认 `/`。项目页部署在仓库子路径时由 Pages 工作流推导 |

产物校验会断言 sitemap 存在，因此 CI 与发布构建必须提供 `SITE_URL`；本地仅预览时可省略，代价是没有 sitemap，canonical 与 og 也会缺失。

### 站点常量

`site.config.mjs` 提供站点标题、作者与描述的回退值（实际取值优先来自 `src/data/settings/`），并定义列表页每页条目数（`PAGE_SIZE_BLOG`、`PAGE_SIZE_BITS`、`PAGE_SIZE_ARCHIVE`）。服务端分页已取消，这三个值是前端每页条目数，由列表页写入 `[data-entry-filters][data-page-size]` 供客户端读取。

### 主题设置

可配置项以 JSON 保存在 `src/data/settings/`，按领域分为五组：

| 文件 | 内容 |
| --- | --- |
| `site.json` | 站点标题与描述、站点语言、页脚版权、备案信息、favicon、社交链接、后台概览可见性、窄屏标题宽度上限、页面外缘间隙 |
| `shell.json` | 侧栏站点名、引用文案、导航项（标签、装饰符、顺序、可见性） |
| `home.json` | 首页引导语、更多入口、Hero 图 |
| `page.json` | 各列表页标题与副标题、动态页默认作者、列表页 RSS 开关 |
| `ui.json` | 代码块行号、阅读模式入口、浮动操作列、浏览数据、侧栏动作、文章元信息、侧栏分隔线、字体角色 |

推荐用后台主题页（`/admin/theme/`）修改；直接编辑 JSON 同样有效，字段缺失时回落到默认值。开发环境下修改 `ui.json` 的字体需要重启。

浏览数据（PV / UV）只渲染位置与样式，数字由站点自行接入；备案号默认不显示。两者的字段说明见 [docs/analytics.md](docs/analytics.md)。

## 内容模型

| 集合 | 源文件 | 路由 |
| --- | --- | --- |
| 博客 `blog` | `src/content/blog/*.md` | `/blog/`、`/blog/<slug>/` |
| 项目 `projects` | `src/content/projects/*.md` | `/projects/`（页内锚点） |
| 动态 `bits` | `src/content/bits/*.md` | `/bits/`（页内锚点） |
| 更新 `devlog` | `src/content/devlog/*.md` | `/devlog/`（页内锚点） |
| 关于 `about` | `src/content/about/index.md` | `/about/` |

`/archive/` 是跨博客、项目、更新的全站时间线，按年月分组，不含动态。

三种写作入口：后台写作页新建与编辑；在对应目录直接新增 `.md`；`npm run new:bit` 生成动态草稿。frontmatter 字段、图片路径约定与 Markdown 扩展写法见 [docs/writing.md](docs/writing.md)。

## 目录结构

```
src/content/        内容源文件，按集合分目录
src/pages/          路由；admin/ 与 api/admin/ 仅开发环境可用
src/layouts/        BaseLayout、ArticleLayout
src/components/     展示组件；admin/ 为后台界面
src/lib/            设置解析、内容读取与后台逻辑；admin-console/ 为后台专用
src/scripts/        前台脚本；admin-*/ 为后台专用
src/styles/         样式入口与各组件样式
src/plugins/        Markdown 渲染管线：remark / rehype 插件与 HTML 白名单
src/utils/          格式化、日期、slug 规则等通用工具
src/data/settings/  主题设置 JSON
public/             静态资源：fonts/、author/ 等
scripts/            仓库维护脚本：字体子集、各项校验、new:bit、theme:update
tools/              字体字符集基线与指纹
tests/              Vitest 用例与页面快照
docs/               仓库文档
```

分层与数据流见 [docs/architecture.md](docs/architecture.md)。

## 开发与校验

```bash
npm run check     # 类型检查与各项守卫脚本
npm test          # Vitest
npm run verify    # check、test、build 与产物类校验依次执行
npm run ci        # 等价于 verify，CI 使用
```

产物类校验（`check:prod-artifacts`、`check:layout-geometry`、`check:touch-targets`）读取 `dist/`，必须在构建后执行。

字体子集按内容字符集生成。修改内容后运行 `npm run check:font-charset` 确认，必要时用 `npm run font:build` 重新生成；该命令需要 `pyftsubset` 与放在 `tools/fonts-src/` 的源字体。

改动侧栏或壳层尺寸后，需要同步 `src/pages/index.astro` 中 `homeHeadCriticalCss` 的对应声明，`npm run check:home-critical-css` 会指出不一致项。

校验脚本清单、测试组织与命名规范见 [docs/development.md](docs/development.md)。

## 部署

仓库自带两个 GitHub Actions 工作流，都不需要配置 secret：

| 工作流 | 触发 | 作用 | 权限 |
| --- | --- | --- | --- |
| `ci.yml` | push / PR 到 `main`、`demo` | `npm ci` 后执行 `npm run ci` | `contents: read` |
| `pages.yml` | push 到 `demo`、手动触发 | 构建并发布到 GitHub Pages | `contents: read`、`pages: write`、`id-token: write` |

启用 Pages：仓库设为 public（Free 计划下私有仓库无法使用 Pages）；Settings → Pages → Source 选 GitHub Actions。若 `github-pages` 环境的部署分支策略限制了分支，需要在 Settings → Environments 中放行 `demo`。

站点地址由工作流按仓库名推导：项目页发布在 `https://<owner>.github.io/<repo>/`，仓库名为 `<owner>.github.io` 时发布在根路径。绑定自定义域名后，把工作流中的 `SITE_URL` 与 `ASTRO_WHONO_BASE_PATH` 改为固定值（`https://你的域名` 与 `/`），否则资源路径会带上仓库子路径而 404。

其他静态托管：构建产物 `dist/` 可直接发布，仓库自带 Netlify 配置（`npm run build` + 发布 `dist`）。

## 文档

| 文档 | 内容 |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | 目录分层、集合与路由、服务端与客户端边界、后台模块边界、构建期流水线 |
| [docs/development.md](docs/development.md) | 环境、命令、校验脚本、测试与快照、内容命名规范、CI |
| [docs/writing.md](docs/writing.md) | 各集合 frontmatter、图片路径约定、末尾链接组、Markdown 扩展 |
| [docs/admin-console.md](docs/admin-console.md) | 后台五个模块的职责与常见操作路径 |
| [docs/analytics.md](docs/analytics.md) | 浏览数据槽位契约、统计接入、备案字段 |
| [docs/upstream.md](docs/upstream.md) | 与上游的关系、增量改造清单、同步上游的步骤 |
| [docs/llm-view-stats-prompt.md](docs/llm-view-stats-prompt.md) | 浏览数据取数脚本的提示词模板 |

## 许可

MIT，见 [LICENSE](LICENSE)。
