# 基本事实台账

## 范围

本篇覆盖：版本与环境、35 个命令、`verify` 九步、环境变量、后台路由、设置文件、字体数字与生成物。前置：仓库已检出，能读 `package.json` 与 `tools/font-manifest.json`。

## 版本与环境

| 项 | 值 | 来源 |
|---|---|---|
| 主题版本 | `0.1.0-rc.1` | `package.json` |
| 版本清单 | `{".": "0.1.0-rc.1"}` | `.release-please-manifest.json` |
| 最新变更记录 | `[0.1.0-rc.1] - 2026-10-31` | `CHANGELOG.md` |
| 标签 | 旧版本线 `v1.0.0-rc.1`、`v1.0.0-rc.2`；0.x 版本线发布后再创建 `v0.1.0-rc.x` | `git tag` |
| Node 要求 | `>=22.12.0` | `package.json` 的 `engines` |
| `.nvmrc` | `24.22.1` | `.nvmrc` |
| 包管理器 | npm，锁文件 `package-lock.json` | 仓库根 |
| 仓库地址 | `https://github.com/planetarium1001/astro-versicarium` | `package.json` 的 `repository` |
| 许可 | MIT | `LICENSE` |
| 主题基准 | 仓库、分支与基准提交字段 | `theme.json` |

## 命令全表

`package.json` 共 35 个 script。

开发与构建：

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动开发服务器与本地后台 |
| `npm run predev` | 启动前生成站点图标 |
| `npm run dev:clean` | 清理 Vite 缓存后启动 |
| `npm run build` | 构建静态产物到 `dist/` |
| `npm run prebuild` | 构建前生成站点图标 |
| `npm run preview` | 预览构建产物 |

检查与测试：

| 命令 | 作用 |
|---|---|
| `npm run check` | `astro check` 与 7 个检查脚本 |
| `npm test` | Vitest 全量用例 |
| `npm run verify` | 九步完整检查 |
| `npm run ci` | 等同 `npm run verify` |
| `npm run audit:prod` | 生产依赖高危漏洞审计，手动运行 |
| `npm run test:fixtures` | 刷新 `tests/fixtures/` 快照 |
| `npm run smoke:cloud-images` | 对象存储上传冒烟，需 `ASTRO_WHONO_CLOUD_SMOKE=1` |

源码守卫：

| 命令 | 作用 |
|---|---|
| `npm run check:svelte` | Svelte 组件检查 |
| `npm run check:admin-content-source-boundary` | 后台内容源码边界 |
| `npm run check:admin-editor-emoji-boundary` | 编辑器 emoji 边界 |
| `npm run check:home-critical-css` | 首页 critical CSS 与样式漂移 |
| `npm run check:image-references` | 图片引用存在性 |
| `npm run check:font-charset` | 字符集基线 |

产物守卫：

| 命令 | 作用 |
|---|---|
| `npm run check:prod-artifacts` | 生产产物不泄漏后台与接口数据 |
| `npm run check:layout-geometry` | 产物布局间距与热区净空 |
| `npm run check:touch-targets` | 触控目标不小于 44px |
| `npm run check:viewport-overflow` | 窄屏溢出与滚动条槽 |
| `npm run check:subpath` | 子路径真实构建并扫描重复 base |
| `npm run check:markdown-smoke` | Markdown 渲染冒烟，按需运行 |

字体：

| 命令 | 作用 |
|---|---|
| `npm run font:fetch` | 拉取源字体到 `tools/fonts-src/` |
| `npm run font:charset` | 生成常用字字符集 |
| `npm run font:roles` | 从 `dist/` 提取角色字符集 |
| `npm run font:subset` | 生成 WOFF2、字体 CSS 与清单 |
| `npm run font:build` | 串起上述字体步骤并重建两次 `dist/` |
| `npm run font:check` | 字体配置与清单校验 |
| `npm run font:coverage` | 覆盖率报告，`--strict` 校验角色字符集新鲜度 |
| `npm run font:report` | 字体体积报告，调试用 |

内容与主题：

| 命令 | 作用 |
|---|---|
| `npm run new:bit` | 按当前时间生成一条动态草稿 |
| `npm run theme:update` | 按 `theme.json` 基准逐文件同步主题 |

- `npm run check` 链：`astro check`、`check:svelte`、`check:admin-content-source-boundary`、`check:admin-editor-emoji-boundary`、`check:home-critical-css`、`check:image-references`、`check:font-charset`、`font:check`。
- `theme:update` 支持 `--check` 与 `--include-fonts`；`font:coverage` 支持 `--strict`。
- `font:build` 支持 `--skip-fetch`、`--skip-build`、`--skip-final-build`；`font:subset` 支持 `--plan-only`、`--from-result`。
- 脚本定义与门禁说明见[开发文档](../developers/development.md)。

## verify 九步

顺序固定，任一步失败即中止：

1. `npm run check`
2. `npm run build`
3. `npm run font:coverage -- --strict`
4. `npm run test:fixtures`
5. `npm test`
6. `npm run check:prod-artifacts`
7. `npm run check:layout-geometry`
8. `npm run check:touch-targets`
9. `npm run check:viewport-overflow`

- `npm run ci` 等同 `npm run verify`。
- `check:subpath` 只在 CI 与手动运行，不在 `verify` 内。
- 第 4 步会改写 `tests/fixtures/` 快照，属于预期行为。
- `verify` 需要非空 `SITE_URL`，否则产物守卫会因缺少 sitemap 失败。

## 环境变量

| 变量 | 作用 | 读取位置 |
|---|---|---|
| `SITE_URL` | 站点完整地址；为空时不注册 sitemap、不写 canonical | `site.config.mjs` |
| `ASTRO_VERSICARIUM_BASE_PATH` | 子目录部署前缀，例如 `/blog/` | `astro.config.mjs` |
| `SITE_TIMEZONE` | 站点时区，优先于 `site.json` | `scripts/new-bit.mjs`、`src/utils/site-timezone.ts` |
| `FONT_PYTHON` | 字体管线使用的 Python 解释器 | `scripts/font/python.mjs` |
| `ASTRO_WHONO_CLOUD_SMOKE` | 设为 `1` 才执行云端图片冒烟 | `scripts/smoke-admin-image-cloud.mjs` |
| `ASTRO_WHONO_IMAGE_STORAGE` | 设为 `s3` 启用对象存储 | `src/lib/admin-console/image-cloud-storage.ts` |
| `ASTRO_WHONO_S3_*`（9 个） | 对象存储连接、凭据与公开地址 | 同上 |
| `MSYS_NO_PATHCONV` | Windows Git Bash 下阻止路径改写 | Git Bash 行为 |

- `ASTRO_WHONO_S3_*` 共 9 个：`ASTRO_WHONO_S3_ENDPOINT`、`ASTRO_WHONO_S3_REGION`、`ASTRO_WHONO_S3_BUCKET`、`ASTRO_WHONO_S3_ACCESS_KEY_ID`、`ASTRO_WHONO_S3_SECRET_ACCESS_KEY`、`ASTRO_WHONO_S3_SESSION_TOKEN`、`ASTRO_WHONO_S3_PUBLIC_BASE_URL`、`ASTRO_WHONO_S3_PREFIX`、`ASTRO_WHONO_S3_FORCE_PATH_STYLE`。
- `SITE_URL` 与 `ASTRO_VERSICARIUM_BASE_PATH` 的用法见[部署](../deploy.md)。
- Git Bash 下的子目录写法见[常见问题](../faq.md)。

## 后台路由

五个页面定义在 `src/lib/admin-console/routes.ts` 的 `ADMIN_ROUTES`。

| 侧栏名称 | 路由 | 作用 |
|---|---|---|
| 概览 | `/admin/` | 后台首页 |
| 主题 | `/admin/theme/` | 主题设置 |
| 写作 | `/admin/content/` | 内容管理 |
| 资源 | `/admin/resources/` | 图片与附件管理 |
| 快照 | `/admin/data/` | 设置导入导出 |

- 只在开发环境可写，由 `import.meta.env.DEV` 门禁；生产构建只渲染只读提示。
- 生产构建不输出控制台根节点与 bootstrap 数据，`/api/admin/*` 只返回 404 占位。
- 资源页是单页工作区，实现是 `src/scripts/admin-resources/index.ts`。
- 后台只有这五个页面，没有图片浏览器、媒体控制台或附件控制台。
- 页面与接口边界见[后台使用](../admin.md)，接口分组与写入流程见[后台实现](../developers/admin.md)。

## 设置文件与七组设置

| 文件 | 设置组 |
|---|---|
| `src/data/settings/site.json` | 站点设置 |
| `src/data/settings/shell.json` | 侧栏设置 |
| `src/data/settings/home.json` | 首页设置 |
| `src/data/settings/page.json` | 内页设置 |
| `src/data/settings/ui.json` | 条目版本、代码显示、排版字体 |

- 七组依次为：站点设置、侧栏设置、首页设置、内页设置、条目版本、代码显示、排版字体。
- 解析与默认值在 `src/lib/theme-settings.ts`；字段说明见[主题设置](../settings.md)。

## 字体清单

数字来自 `tools/font-manifest.json`，由 `npm run font:build` 生成。

| 项 | 值 |
|---|---|
| base 分片 | 33 个 WOFF2，2,338,700 字节 |
| DLC 分片 | 82 个 WOFF2，21,092,964 字节 |
| 合计 | 115 个 WOFF2，23,431,664 字节 |
| 常用页估算 | 385,348 字节 |
| 单个 DLC 分片上限 | 319,836 字节 |
| 生成时间 | 2026-10-22T21:23:54.233Z |

- 字体 CSS 为 `src/styles/fonts.generated.css` 与 `src/styles/fonts.dlc.generated.css`。
- 字体文件在 `public/fonts/base/` 与 `public/fonts/dlc/`。
- 改字体的步骤见 [tasks.md](tasks.md)。

## 生成物清单

| 生成物 | 生成命令 |
|---|---|
| `src/styles/fonts.generated.css`、`src/styles/fonts.dlc.generated.css` | `npm run font:build` |
| `public/fonts/base/`、`public/fonts/dlc/` | `npm run font:build` |
| `tools/font-manifest.json`、`tools/charset-common.txt`、`tools/charset-roles.json` | `npm run font:build` |
| `tools/favicon-generated.json`、`public/images/site/generated/` | `predev` 与 `prebuild` 的 `scripts/favicon.mjs` |
| `tests/fixtures/` | `npm run test:fixtures` |
| `dist/` | `npm run build` |
| `.astro/` | `npm run dev` 与 `npm run build` 的缓存 |

- 以上文件不手改；需要调整时改输入或脚本，再运行对应命令。
- `tools/fonts-src/` 由 `npm run font:fetch` 生成，已在 `.gitignore` 中忽略。
- 根路径图标接管由 `src/integrations/site-favicon.mjs` 在构建与开发服务器执行，共享的默认路径与接管计划在 `scripts/favicon-shared.mjs`。
