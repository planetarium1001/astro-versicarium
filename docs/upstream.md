# 与上游的关系

本仓库基于 [cxro/astro-whono](https://github.com/cxro/astro-whono)（MIT）。主题结构、五个内容集合、后台、Markdown 扩展与字体子集化流程沿用上游，本分支只做增量改造。上游的文档里集合名为随笔 / 絮语 / 小记 / 关于，源目录为 `src/content/essay`、`src/content/memo`；本仓库的集合为 `blog`、`projects`、`bits`、`devlog`、`about`，以本仓库的 [architecture.md](architecture.md) 为准。

## 相对上游的增量

| 改造 | 内容 |
| --- | --- |
| 文章目录 | 宽屏（≥ 1280px）作为壳层第 4 列，阅读模式下门槛降到 1024px；滚动高亮当前小节，跳转后目标小节短暂高亮；收起状态存 localStorage 并在首次绘制前生效 |
| 浮动操作列 | 文章与列表页右下角常驻阅读模式、回到上次阅读位置、回到顶部，按需出现 |
| 阅读位置记忆 | 按路径存 localStorage（最近标题加段内偏移，滚动比例兜底），本次会话内用位置栈原路返回 |
| 主题切换涟漪 | 以点击处为圆心圆形展开；不支持 View Transitions API 或系统偏好减少动效时直接切换 |
| 侧栏与壳层 | 侧栏由 320px 收窄到 224px，壳层宽度随视口自适应，前后台共用同一组间距 token；`html` 固定滚动条槽位 |
| 页面外缘间隙 | 后台可配 `site.pageGapPx`，构建期把 `--page-gap-inline` 与 `--page-inline` 以内联属性输出到 `<html>` |
| 浏览数据槽位 | 文章元信息行与页脚之上预留 PV / UV 槽位，见 [analytics.md](analytics.md) |
| 备案信息 | 页脚居中显示工信部与公安联网备案号，链接与图标可配置 |
| 卡片弹窗 | 项目与动态卡片整卡可点，弹窗展示完整正文、标签与图片；项目卡片增加 `image` 缩略图与统一头部 |
| 末尾链接组 | `projects` 与 `devlog` 的外链写在正文末尾，渲染为右对齐链接行，见 [writing.md](writing.md) |

本分支未保留上游的絮语草稿生成器，动态草稿改用 `npm run new:bit` 生成。

## 同步上游

```bash
git remote add upstream https://github.com/cxro/astro-whono.git
git fetch upstream --tags
git checkout main
git merge upstream/main
npm run check
```

`demo` 分支承载示例站与 Pages 部署，合并后同样需要把 `main` 的改动带入 `demo`。

## 合并后的检查

`npm run check` 包含首屏 critical CSS 的漂移检查。`src/pages/index.astro` 的 `homeHeadCriticalCss` 是手写快照，在 head 中位于 `global.css` 之后，同优先级声明会长期覆盖真实样式；上游若改动了侧栏或壳层尺寸，该检查会报错，需要把对应的声明同步进快照。改动这些尺寸后，`npm run check:layout-geometry` 与构建产物上的几何断言也需通过。

上游改动 `src/plugins/` 下的 Markdown 管线时，实例内容可能包含不再被白名单放行的 HTML；`npm run build` 与 `npm run check:markdown-smoke` 能暴露这类问题。
