# 常见改动入口

## 范围

本篇覆盖：八类改动的文件、注意事项与验证命令。前置：读过 [facts.md](facts.md)，能运行 `npm run check`。

## 改站点设置

- 改哪些文件
  - `src/data/settings/site.json`：标题、描述、时区、页脚
  - `src/data/settings/shell.json`：侧栏站点名、导航
  - `src/data/settings/home.json`：首页导语与主图
  - `src/data/settings/page.json`：列表页标题与分页
  - `src/data/settings/ui.json`：排版、浏览数据、阅读模式
- 注意
  - 七组设置与文件的对应见 [facts.md](facts.md)。
  - 默认值与校验在 `src/lib/theme-settings.ts`，非法值会被修补并产生诊断。
  - 开发环境改完刷新即可；生产构建缓存解析结果，需要重新构建。
- 验证
  - `npm run check`
  - `npm run dev` 后查看对应页面
- 字段说明见[主题设置](../settings.md)。

## 加一条内容

- 改哪些文件
  - 博客：`content/blog/<YYYY-MM-DD>-<SLUG>/index.md`
  - 动态：`content/bits/<YYYY-MM-DD>-<SLUG>/index.md`，或用 `npm run new:bit` 生成草稿
  - 开发日志：`content/devlog/<PROJECT>/<YYYY-MM-DD>-<SLUG>/index.md`
  - 项目：最新版 `content/projects/<SLUG>/index.md`，历史版 `content/projects/<YYYY-MM-DD>-<SLUG>/index.md`
  - 关于页：`content/about/index.md`，固定单页
- 注意
  - 目录名以 `YYYY-MM-DD` 开头，`<SLUG>` 换成地址标识，`<PROJECT>` 换成项目目录名。
  - 开发日志的文件开头需要 `project`，项目与博客可带 `series`、`versionLabel` 等版本字段。
  - 条目主文件顺序：`index.md` → 目录内唯一 `.md` → 唯一标了 `entry: true` 的文件。
  - 图片与附件放条目目录的 `images/`、`files/`、`assets/`，不要放进 `public/`。
- 验证
  - `npm run check`
  - `npm run check:image-references`
  - `npm run build`
- 文件开头的字段与正文写法见[内容与写作](../content.md)。

## 改样式

- 改哪些文件
  - `src/styles/global.css`：全局入口
  - `src/styles/` 下的页面样式：`home.css`、`article.css`、`bits-page.css` 等
  - `src/styles/components/`：组件样式，后台样式在其下的 `admin/`
  - `src/pages/index.astro`：首页 critical CSS 快照
- 注意
  - 不改 `src/styles/fonts.generated.css` 与 `src/styles/fonts.dlc.generated.css`。
  - 改首页布局要同步 critical CSS 快照。
  - 窄屏规则从 `900px` 及以下生效，桌面规则从 `901px` 起。
- 验证
  - `npm run check:home-critical-css`
  - `npm run check:layout-geometry`
  - `npm run check:touch-targets`
  - `npm run check:viewport-overflow`

## 加一个页面

- 改哪些文件
  - `src/pages/`：新增页面，路由由目录与文件名决定
  - `astro.config.mjs`：新增顶层路由时同步 `SITEMAP_ROUTE_ROOTS`
- 注意
  - `trailingSlash` 固定 `always`，页面路径以 `/` 结尾。
  - 普通页面用 `src/layouts/BaseLayout.astro`，文章类页面用 `src/layouts/ArticleLayout.astro`。
  - 站内链接用 `createWithBase()`（`src/utils/format.ts`）拼接部署 base，不手写前缀。
  - 页面需要内容数据时走 `src/lib/content.ts` 的查询函数，不直接读文件。
- 验证
  - `npm run check`
  - `npm run build`
  - `npm run check:prod-artifacts`

## 改字体

- 改哪些文件
  - `src/data/settings/ui.json` 的 `typography`：四个字体角色
  - `src/lib/fonts/registry.ts`：可选字体与注册
  - 生成物：`public/fonts/`、两个字体 CSS、`tools/font-manifest.json` 与字符集文件
- 注意
  - 重建用 `npm run font:build`，顺序是拉取、字符集、构建、角色、子集、再构建。
  - 字体管线需要 Python，解释器路径用 `FONT_PYTHON` 指定。
  - CI 不运行 `font:build`，字体资产必须由维护者提交。
  - 换字体后要重启 `npm run dev` 才会生效。
- 验证
  - `npm run check:font-charset`
  - `npm run font:check`
  - `npm run font:coverage -- --strict`

## 发版

- 改哪些文件
  - `package.json`：版本号，由 Release Please 维护
  - `CHANGELOG.md`：由 Release Please 生成
  - `theme.json`：站点合并基准
- 注意
  - 版本号与 `CHANGELOG.md` 不手改，在 Actions 页面手动运行 `release-please.yml` 开 PR。
  - 标签形如 `v1.0.0-rc.2`；创建 Release 后手动运行 `release.yml` 打包模板 zip 与 `SHA256SUMS`。
  - `theme.json` 的 `commit` 是站点合并基准，发版时同步为发布提交。
- 验证
  - `SITE_URL=https://example.com npm run verify`
  - `npm run check:subpath`
- 工作流与产物命名见[版本与发布](../developers/release.md)。

## 同步主题

- 改哪些文件
  - `theme.json`：合并基准提交
  - 主题代码与脚本：按远端更新
  - 站点自有路径：保留本地版本
- 注意
  - 先看变更：`npm run theme:update -- --check`。
  - 再合并：`npm run theme:update`，按文件三方合并并更新基准提交。
  - `--include-fonts` 会把字体资产纳入合并，只给主题演示站使用。
  - 站点自有路径不覆盖：`content/`、`src/data/settings/`、`public/images/`、`public/author/`、`public/fonts/`、`tools/`、`tests/fixtures/`。
  - 站点自有文件不覆盖：`README.md`、`theme.json`、`.github/workflows/pages.yml`。
  - 生成的字体样式表（`src/styles/fonts[.<分层>].generated.css`）按模式识别，与 `public/fonts/` 的分片同源，必须整套同进同出。
  - 冲突按文件报告，需要手工处理后重新运行。
- 验证
  - `npm run check`
  - `SITE_URL=https://example.com npm run verify`
- 步骤与冲突处理见[主题更新](../update.md)。

## 改后台设置字段

- 改哪些文件
  - `src/lib/admin-console/theme-shared/`：服务端校验（`validate.ts`）、归一化（`guards.ts`）与规范化（`canonicalize.ts`）
  - `src/lib/theme-settings.ts`：解析与默认值
  - `src/components/admin/`：表单控件
  - `src/scripts/admin-console/controls.ts`：控件引用
  - `src/scripts/admin-console/form-codec/`：表单编码（入口 `index.ts`）
  - `src/pages/api/admin/settings.ts`：写入接口
- 注意
  - 服务端归一化与客户端编码要保持一致，两处都要改。
  - 保存需提交完整快照与 `revision`，过期返回 409。
  - 生产构建只读，字段只在开发环境可写，见 [rules.md](rules.md)。
- 验证
  - `npm run check`
  - `npm test`
  - `npm run dev` 下保存一次，确认回写
- 实现细节见[后台实现](../developers/admin.md)。
