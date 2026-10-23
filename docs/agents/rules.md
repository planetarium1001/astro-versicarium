# 约定与禁止

## 范围

本篇覆盖：必须执行的动作、禁止的动作、目录与提交边界、失败处理。前置：读过 [facts.md](facts.md) 与 [tasks.md](tasks.md)。

## 必须

- 改完代码或设置后运行 `npm run check`。
- 提交前运行 `SITE_URL=https://example.com npm run verify`，`SITE_URL` 换成站点真实地址。
- 改生成物时先改输入或脚本，再用对应命令重建，不手工修补产物。
- 提交前看 `git status --porcelain` 与 `git diff --stat`，确认改动范围。
- 快照变化时逐条核对是否由本次改动引起，再一起提交。

## 禁止

- 直接改 `src/styles/fonts.generated.css`、`src/styles/fonts.dlc.generated.css`。
- 直接改 `public/fonts/`、`tools/font-manifest.json`、`tools/charset-common.txt`、`tools/charset-roles.json`。
- 直接改 `tests/fixtures/` 下的快照文件。
- 跳过 `npm run verify` 直接提交。
- 提交 `node_modules/`、`dist/`、`.astro/`。
- 手改 `CHANGELOG.md` 与 `package.json` 的版本号。
- 把站点定制写进主题仓库。
- 在生产构建里依赖后台写入能力。
- 改动与本次任务无关的文件。

## 目录约定

- 内容在 `content/`，每个条目一个目录，主文件与图片、附件放在一起。
- 页面在 `src/pages/`，路由由目录结构决定。
- 样式在 `src/styles/`，组件样式在 `src/styles/components/`。
- 浏览器脚本在 `src/scripts/`，服务端与共享逻辑在 `src/lib/`。
- 设置 JSON 在 `src/data/settings/`，只通过设置字段改站点行为。

## 后台边界

- 后台五个页面只在开发环境可写，由 `import.meta.env.DEV` 门禁。
- 生产构建只输出静态页面，不渲染后台表单与脚本，`/api/admin/*` 返回 404 占位。
- 后台写入改仓库文件；配置对象存储时图片写入云端。
- 生产环境需要的改动走内容文件与设置文件，不走后台。

## 提交边界

- 主题仓库只放模板通用内容：主题代码、脚本、示例内容与文档。
- 个人定制放站点仓库：站点设置、内容、图片、头像、字体与站点 README。
- 站点自有路径在 `theme:update` 中不会被覆盖，见 [tasks.md](tasks.md)。
- 生成物与快照随改动一起提交，保证仓库可直接构建。
- 提交信息与流程见[开发文档](../developers/development.md)。

## 失败处理

- `npm run check` 失败先修类型与守卫报错，不要用跳过检查绕过。
- `npm run verify` 失败时按九步顺序定位，顺序见 [facts.md](facts.md)。
- `verify` 第 4 步会改写 `tests/fixtures/`，属于预期行为，检查差异后提交。
- 产物守卫失败先确认 `SITE_URL` 与 `ASTRO_VERSICARIUM_BASE_PATH`，再看 `dist/`。
- 构建失败与端口问题的排查见[常见问题](../faq.md)。
