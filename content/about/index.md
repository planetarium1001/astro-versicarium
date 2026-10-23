---
---

Versicarium 是一个面向开发者的静态站点主题，基于 Astro 构建，派生自 [cxro/astro-whono](https://github.com/cxro/astro-whono)。

站点把长文、项目版本、开发日志与短动态放进同一套内容结构，配一套只在本地可写的后台。构建产物是纯静态文件，可以放到任意静态托管。

## 主题能力

- 双栏布局：桌面端固定侧栏与内容区，内容区带目录树与浮动操作列。
- 亮色与暗色：跟随系统或手动切换，切换时新主题从点击处向外展开，另有专注阅读模式。
- 多版本：文章系列与项目版本各自有地址，最新版占稳定地址，历史版本可以切换。
- 五个集合：文章、项目、动态、开发日志与关于共用一套条目结构。
- 归档时间线：把文章版本、项目版本与日志按年月排在一起，支持筛选、搜索与标签组合。
- 本地后台：概览、主题、写作、资源、快照五个页面，只在开发环境可写。
- 主题设置：七组字段，保存前校验，改动直接写回 `src/data/settings/`。
- 资源管理：上传、批量重命名、移动与删除，显示引用状态，支持整条目 ZIP 与对象存储。
- 字体分层：中文字体按用途与常用程度分片，常用字随页面加载，生僻字按需下载。
- 纯静态产物：构建结果没有服务端依赖，后台在线上只读。

## 内容结构

内容都在仓库根的 `content/`，一个条目一个目录，主文件是 `index.md`。

| 集合 | 内容 | 位置 |
|---|---|---|
| 文章 | 长文与系列版本 | `content/blog/` |
| 项目 | 项目介绍与历史版本 | `content/projects/` |
| 动态 | 短记录、图片与作者 | `content/bits/` |
| 开发日志 | 按项目归档的开发进展 | `content/devlog/` |
| 关于 | 这一页 | `content/about/` |

图片与附件放在条目目录里，正文用相对路径引用，条目删除时一起清理。需要长期更新的内容用系列或项目版本管理，各版共用标识，页面里可以切换。

正文用 Markdown，支持提示块、图注、画廊、公式、折叠与摘要分隔，代码块带高亮、行号与复制按钮。少量受控 HTML 也能写，脚本会被移除。

## 后台与构建

`npm run dev` 后打开 `http://localhost:4321/admin/`，后台分概览、主题、写作、资源与快照五页。它直接读写仓库文件，不需要数据库，也不会自动提交。

- 写作页覆盖五个集合，新建条目默认是草稿，取消草稿即发布。
- 主题页按七组展示设置，保存前先校验；设置文件格式有错时进入只读。
- 资源页管理图片与附件，改名或移动会同步改写正文引用。
- 快照页只导入导出设置，不含内容与图片，不能当作整站备份。

构建命令是 `npm run build`，产物在 `dist/`。构建需要 `SITE_URL`；部署在子目录时再加 `ASTRO_VERSICARIUM_BASE_PATH`。本地检查用 `npm run verify`，九步覆盖代码、构建、字体、测试与产物。

## 适合对象

- 同时维护文章、项目文档与开发日志，需要一套现成的字段与页面。
- 想用本地后台写内容，但不想为站点部署数据库或服务端。
- 愿意把内容留在仓库里，用 git 完成备份与迁移。

只想发纯文字博客时，这套结构偏重；需要多人协作、账号与权限控制时也不合适。

## 命名由来

Versicarium 由拉丁语 `versiculus` 与 `-arium` 组成。`versiculus` 是 `versus` 的指小形式，`versus` 出自动词 `vertere`（转动）。

古人用牛耕式书写，写到行尾要转回行首，一次次转动留下痕迹。`versus` 既是翻开的犁沟，也是落下的诗行；`versiculus` 是每次转动切分出的最小单元。`-arium` 指收存物品的场所，合起来是把短行与版本收进同一处的地方。

中文名垄录对应这一意象：垄指垄亩与笔耕，录是记录与归档。一行一垄，一版一录。

## 来源与许可

主题派生自 [cxro/astro-whono](https://github.com/cxro/astro-whono)，以 MIT 许可发布。本站保留原作者的版权声明，`LICENSE` 同时列出原始版权与本站修改。

本仓库已脱离 Whono 的 fork network，没有可跟踪的上游。Issue、PR 与 push 只指向 [planetarium1001/astro-versicarium](https://github.com/planetarium1001/astro-versicarium)。

`theme.json` 记录主题来源仓库、分支与基准提交，`npm run theme:update` 用它做三方合并，只更新主题文件，站点自有路径保持原样。

## 友链

:::friend{name="Whono" url="https://astro.whono.me"}
上游主题的演示站，双栏布局与本地后台的设计从这里来。
:::

:::friend{name="Astro" url="https://astro.build"}
主题使用的静态站点框架，集成与生态入口都在这里。
:::

:::friend{name="Astro 文档" url="https://docs.astro.build"}
框架的官方文档，改模板与接入集成时先查这里。
:::

:::friend{name="GitHub Pages" url="https://pages.github.com"}
示例站使用的托管方式，推送后自动构建发布。
:::

## 常见问题

:::faq{question="怎么改主题设置？"}
在后台主题页按组修改，或直接改 `src/data/settings/` 下的五个设置文件，保存后刷新页面生效。换字体是例外，要重启 `npm run dev`。字段说明见[主题设置](https://github.com/planetarium1001/astro-versicarium/blob/main/docs/settings.md)。
:::

:::faq{question="字体什么时候需要重建，怎么重建？"}
内容大改、换字体或调整覆盖策略后重建一次。运行 `npm run font:build`，需要本机有 Python 3 与 `fonttools`、`brotli`。生成物会改写 `public/fonts/`、两个生成 CSS 与 `tools/font-manifest.json`，一起提交。日常开发与构建不需要重建。
:::

:::faq{question="部署到子目录要改什么？"}
设置 `SITE_URL` 为站点地址，再用 `ASTRO_VERSICARIUM_BASE_PATH` 指定子目录前缀，例如 `/blog/`。只设地址不设子目录，站内链接会指向站点根目录。Windows 的 Git Bash 要在命令前加 `MSYS_NO_PATHCONV=1`，完整步骤见[部署上线](https://github.com/planetarium1001/astro-versicarium/blob/main/docs/deploy.md)。
:::

:::faq{question="怎么把主题更新到新版本？"}
先跑 `npm run theme:update -- --check` 看会改什么，再跑 `npm run theme:update` 按文件合并。站点自有路径不会被覆盖，冲突会写进对应文件，处理完重跑一次。说明见[主题更新](https://github.com/planetarium1001/astro-versicarium/blob/main/docs/update.md)。
:::

:::faq{question="需要什么版本的 Node.js？"}
最低 `>=22.12.0`，低于这个版本安装依赖会失败。`.nvmrc` 里是建议版本 `24.22.1`，用 nvm 时执行 `nvm use` 即可。环境说明见[安装与运行](https://github.com/planetarium1001/astro-versicarium/blob/main/docs/install.md)。
:::

:::faq{question="内容里的图片路径怎么写？"}
放在条目目录里，用相对路径引用，例如 `images/diagram.webp`；`public/` 里的图片用 `/` 开头的路径。路径写错时 `npm run verify` 会报错。写法见[内容与写作](https://github.com/planetarium1001/astro-versicarium/blob/main/docs/content.md)。
:::

## 站点信息

::site-info{name="Versicarium · 垄录" url="https://planetarium1001.github.io/astro-versicarium/" description="用 Astro 搭的工程记录站点，文章、项目版本、开发日志与短动态共用一套内容结构。"}

## 联系

::contact-links
