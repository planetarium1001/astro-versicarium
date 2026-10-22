# 后台控制台

后台是本地内容与主题编辑入口，只在开发环境具备写权限，生产构建保持只读。

## 入口与页面

入口为 `/admin/`，只在 `npm run dev` 下可读写。生产构建输出只读静态壳，`/api/admin/*` 返回 404。路由定义在 `src/lib/admin-console/routes.ts`。

| 页面 | 路径 | 内容 |
| --- | --- | --- |
| 概览 | `/admin/` | 内容规模、标签分布、字数、最近条目；开发环境含草稿维护者视图 |
| 主题 | `/admin/theme/` | 七个设置分组，写入五个 JSON |
| 写作 | `/admin/content/`、`/admin/content/<collection>/_edit/<entryId>/` | 列表、筛选、新建与编辑 |
| 资源 | `/admin/resources/` | 图片与附件浏览、上传、批量操作与引用状态；旧地址 `/admin/images/` 重定向到此 |
| 快照 | `/admin/data/` | 设置快照的导出、校验与导入 |

概览的公开版本由 `site.json` 的 `adminOverview.publicVisible` 控制，关闭时显示 `hiddenMessage`。开发环境额外显示草稿数量与最近草稿。

![后台主题设置](images/admin-light.webp)

## 主题字段

主题页按七个分组编辑，服务端写入 `src/data/settings/` 的五个文件。

| 分组 | 设置来源 | 主要字段 |
| --- | --- | --- |
| 站点设置 | `site.json` | 标题、描述、语言、时区、页脚、备案、后台概览、站点图标、社交链接、窄屏标题宽度（10–100）、页面外缘间隙（32–160）、窄屏浮动列右侧距离（0–32） |
| 侧栏设置 | `shell.json`，`ui.json` 的 `layout.sidebarDivider`、`sidebarActions` | 侧栏站点名、窄屏标题（最多 60 字）、引语、导航标签与顺序、可见性、分隔线、RSS 与主题按钮 |
| 首页设置 | `home.json` | Hero 预设、图片与替代文本、导语、更多入口与链接 |
| 内页设置 | `page.json`，`ui.json` 的 `articleMeta`、`viewStats`、`floatStack`、`readingMode` | 各列表页标题与副标题、归档版本模式、列表 RSS、动态默认作者、文章元信息、浏览数据、浮动按钮、分页 |
| 条目版本 | `ui.json` 的 `entryVersionName` | 版本名称隐藏，或放在版本号前、版本号后 |
| 代码显示 | `ui.json` 的 `codeBlock` | 代码块行号 |
| 排版字体 | `ui.json` 的 `typography`、`fontCoverage` | readable、copy、mono、brand 四个字体角色；覆盖策略 `full`（默认，含 DLC）或 `common`（仅基础分片） |

站点图标只接受 PNG 上传；SVG 槽位需要手动把文件放进 `public/`，再写 `site.json`。规则见 [favicon.md](favicon.md)。

归档版本模式 `all` 显示全部项目版本文档，`latest` 只显示最新版；该设置不影响项目弹窗中的历史版本。分页开关与条数按首页、博客、动态、开发日志、归档分别配置，条数范围 1–100。

### 校验与保存

「检查配置」先做客户端校验，再以 `dryRun=1` 请求设置接口；「保存」提交完整设置快照与 `revision`。服务端在写锁内重新读取并比对 `revision`，通过后校验字段，用临时文件与重命名写入变更文件，再清理缓存。

检测到外部修改时返回 409，界面保留草稿并提示重新同步。「重置更改」回到最近一次读取的配置，「重新检测」刷新快照与 `revision`。读取诊断存在时控制台进入只读状态，列出损坏文件与字段，必须先修复 JSON 才能保存。

## 写作

内容控制台覆盖五个集合，能力矩阵定义在 `src/lib/admin-console/content-collections.ts`。

| 集合 | 新建 | 删除 | 草稿 | 正文图片上传 | 图片选择器 |
| --- | --- | --- | --- | --- | --- |
| `blog` | 是 | 是 | 是 | 是 | 否 |
| `projects` | 是 | 是 | 是 | 是 | 是 |
| `bits` | 是 | 是 | 是 | 否 | 是 |
| `devlog` | 是 | 是 | 是 | 是 | 是 |
| `about` | 否 | 否 | 否 | 否 | 否 |

- 新建时按标题与当前日期生成 `YYYY-MM-DD-title` 条目 ID；`bits` 由日期时间派生。
- 列表支持按集合、草稿状态、年份、标签、排序与正文搜索过滤，支持分页、批量状态、批量导出与删除。
- 编辑器提供 Markdown 编辑、预览、目录、图片插入、公式插入与草稿恢复；`about` 是固定单页，只编辑正文。
- `blog` 条目菜单提供「新建版本」，以系列最新版为模板生成草稿；其他集合不提供该动作。
- 删除、批量操作与版本创建都走内容写锁；`about` 不支持删除。

更新已有条目的 `slug`、目录名或 `projectSlug` 会影响公开路由、锚点或项目关联，发布后应保持稳定。frontmatter 字段见 [writing.md](writing.md)。

## 资源

`/admin/resources/` 把图片与附件放在同一工作区。左侧目录按集合 → 系列 → 版本/条目 → 目录展开，`content/<collection>/_shared/` 显示为集合级「共享资源」；目录宽度可拖拽，树可整体收起。

- 上传图片落到当前条目的 `images/`，附件落到 `files/`；选择共享资源时落到 `content/<collection>/_shared/images` 或 `files/`。
- 站点资源上传只覆盖标签页 PNG 与主屏 PNG 图标槽位，写入 `public/images/site/`；SVG 与 Hero 图需手动放入 `public/` 或 `src/assets/`，再在主题设置中选择。
- 筛选覆盖集合、系列、版本/条目、目录、引用状态、类型、日期与关键词，状态写入 URL 查询参数。
- 支持网格与列表视图、批量重命名、移动、删除前确认、详情抽屉、复制路径或 Markdown 引用、文本附件预览、整条目 ZIP 导入与导出。
- 引用状态分为已引用、未引用与孤儿，依据正文与 frontmatter 中的引用统计。
- 配置对象存储凭据时，图片列表会并入云端来源；未配置时只使用本地文件。

## 快照

`/admin/data/` 导出 `settings` 作用域的 JSON 快照，包含 `schemaVersion`、生成时间、包含范围与排除项（内容、图片、本地文件、凭据）。导入时先解析 manifest 并执行 dry-run，比对差异后再写入。快照不包含内容与图片，不能当作整站备份。

## 写入流程

后台写入落点分为：主题设置写 `src/data/settings/*.json`，内容与条目媒体写 `content/**`，站点图标写 `public/images/site/`，云端图片写入对象存储。

所有写入请求都校验同源 `Origin`/`Referer` 与 `Content-Type`；设置保存与内容更新必须带 `revision`，新建与删除按各自契约校验。服务端用各自的写队列串行化同类写入，以临时文件加备份重命名提交，失败回滚，成功后清理相关缓存。版本不一致、外部修改或文件已被替换时返回 409，不覆盖现有文件。

## 开发环境边界

可写能力由 `import.meta.env.DEV` 与 `output` 模式共同决定。生产构建中，后台页面不输出写入根节点、bootstrap 数据或后台导航，并带 `noindex,nofollow`；`check:prod-artifacts` 会断言这些边界。开发环境的界面偏好（顶部导航、侧栏导航模式、编辑器布局）保存在浏览器 localStorage，不写入仓库。
