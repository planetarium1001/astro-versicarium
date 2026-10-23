# 开发文档

## 范围

本篇覆盖：开发文档的篇目、每篇职责与常见改动入口。前置：Node.js 22.12.0+，仓库能运行，见[安装与运行](../install.md)。

## 篇目

| 文档 | 内容 |
| --- | --- |
| [architecture.md](architecture.md) | 目录分层、模块边界、数据流、路由模型、运行模式、设置解析、布局与样式、Markdown 管线、构建流程 |
| [development.md](development.md) | 环境与 Node 解析、35 个命令、`verify` 九步、源码与产物检查、字体管线、测试组织、浏览器约定、CI 与发布联动 |
| [content.md](content.md) | 五个集合与条目加载、日期解析与显示、各集合字段、系列与版本路由、图片与附件、Markdown 插件、末尾链接组、关于页指令 |
| [admin.md](admin.md) | 五个后台页面、七组设置、保存与冲突、写作、资源、快照、API 分组、生产边界 |
| [deploy.md](deploy.md) | 产物与运行模式、`main` / `demo` 分支、四个工作流、构建期变量、Pages 与 base 推导、其他托管 |
| [release.md](release.md) | 版本策略、Release Please、Release 工作流、产物命名、发布清单、`theme.json` 基准、下载与校验 |
| [provenance.md](provenance.md) | 与 Whono 的派生关系、MIT 许可、脱离 fork network、`theme:update` 三方合并、站点自有路径 |
| [favicon.md](favicon.md) | 图标字段校验、生成器输出、渲染回退、后台上传、反向代理放行 |

## 改动入口速查

| 要改什么 | 看哪篇 |
| --- | --- |
| 加内容字段、改日期显示、改路由 | [content.md](content.md) |
| 改后台页面、设置校验、写入接口 | [admin.md](admin.md) |
| 加命令、改检查链、改字体生成 | [development.md](development.md) |
| 改部署分支、工作流、构建期变量 | [deploy.md](deploy.md) |
| 改版本号、Release 配置、附件命名 | [release.md](release.md) |
| 改主题同步范围或合并行为 | [provenance.md](provenance.md) |
| 改页面结构、模块边界、样式组织 | [architecture.md](architecture.md) |
| 改站点图标、上传限制、图标不显示 | [favicon.md](favicon.md) |

## 约定

- 事实以源码与 `package.json` 为准，命令、路径、版本都能在仓库核实。
- `src/styles/fonts.generated.css`、`public/fonts/`、`tools/font-manifest.json`、`tests/fixtures/`、`dist/` 是生成物，不手改。
- 提交前跑 `npm run verify`，九步顺序见 [development.md](development.md#verify-的九个步骤)。

使用文档见[使用文档索引](../README.md)。
