# Changelog

本文件记录面向模板使用者的公共变更。版本号遵循 Semantic Versioning，日期使用 `YYYY-MM-DD`。

## [1.0.0-rc.3](https://github.com/planetarium1001/astro-versicarium/compare/v1.0.0-rc.2...v1.0.0-rc.3) (2026-10-20)


### ⚠ BREAKING CHANGES

* projects 不再支持 tags / repo / repoLabel / demo / demoLabel 字段， 仓库与演示链接需写在正文末尾（与链接之间留一个空行），归档的标签列表不再包含项目标签。 仓库内的存量项目内容已在本次改动中完成迁移。
* 内容模型与公开路由不兼容旧版。essay 集合更名为 blog； /memo/、/essay/*、/archive/<slug>/、/archive/tag/* 与 /bits/page/N/ 等路由移除， 归档改为全站时间线；内容目录需按 blog、projects、devlog 重组，条目文件名需符合 YYYY-MM-DD-title，博客列表页 RSS 由 /blog/rss.xml 提供。仓库内的存量内容与 图片已在本次改动中完成迁移。
* /essay/{slug}/ 路径不再直接渲染内容，已配置 301 重定向至 /archive/{slug}/，外部链接需更新

### Features

* About 支持友链交换信息块 ([e15bd5d](https://github.com/planetarium1001/astro-versicarium/commit/e15bd5dc9edb179f4f084e51134a522d007bbf7a))
* **admin:** add attachment console and file reference status ([ef75cf4](https://github.com/planetarium1001/astro-versicarium/commit/ef75cf4c2e5f2cf5cd518166a2e1d5320fbbc6b4))
* **admin:** add full media manager with archive import/export ([f6280ed](https://github.com/planetarium1001/astro-versicarium/commit/f6280edd9818bea390a73cb37cdd7b7891ad7a8f))
* **admin:** expose searchable media filter options ([cf0373f](https://github.com/planetarium1001/astro-versicarium/commit/cf0373f7fb7360fa516b3f21741a1ab69eba0749))
* **admin:** group content list by blog series and version ([72c792d](https://github.com/planetarium1001/astro-versicarium/commit/72c792dae5cf14e6dd56ede0f56b4b165a6a46f6))
* **admin:** unify resources console with searchable filters ([4279b02](https://github.com/planetarium1001/astro-versicarium/commit/4279b022dc746f2c51b9993da83e22a46d78411d))
* theme console 支持上传自定义站点图标  ([9f366e1](https://github.com/planetarium1001/astro-versicarium/commit/9f366e1c6fb5f0dfd7f681f21145a4a5da4a406d))
* Theme Console 支持配置排版字体 ([49af501](https://github.com/planetarium1001/astro-versicarium/commit/49af501c483e1926f7ce5d762e1ceb2c32b750f2))
* **theme:** 更名 Versicarium 并发布 1.0.0 预览 ([7b8437f](https://github.com/planetarium1001/astro-versicarium/commit/7b8437f33593dc43646c612ad592ab9fde797ade))
* 为归档与随笔页面添加客户端搜索功能 ([4c268cd](https://github.com/planetarium1001/astro-versicarium/commit/4c268cd286b5f20cbde438a9c529acdd783b2d42))
* 主题切换支持跟随系统模式 ([6a264e0](https://github.com/planetarium1001/astro-versicarium/commit/6a264e0f693eece2576ffe03d22aabc100ab2e9c))
* 主题协议优化与CI接入 ([41e2bca](https://github.com/planetarium1001/astro-versicarium/commit/41e2bca0cecdeab38c0ee564e5c95e045fe0d918))
* 优化 Admin 响应式导航与编辑器布局入口 ([0166b68](https://github.com/planetarium1001/astro-versicarium/commit/0166b68d71e6b25a4988ea756c5b1342c83d013b))
* 优化编辑器交互标题菜单与内容样式 ([638ca83](https://github.com/planetarium1001/astro-versicarium/commit/638ca839cde47702020680e9cf3d099d53ecd5a9))
* 全站页面输出默认分享图 ([778115d](https://github.com/planetarium1001/astro-versicarium/commit/778115d38f64765eb6e5b09be7aaed5d67621481))
* 动态卡片增加详情弹窗，项目卡片改版并修复阅读模式与页脚 ([a32657e](https://github.com/planetarium1001/astro-versicarium/commit/a32657eba99bcee8880cf9334461a576e5057dc5))
* 后台支持 S3 兼容图片存储 ([#53](https://github.com/planetarium1001/astro-versicarium/issues/53)) ([e97e5ef](https://github.com/planetarium1001/astro-versicarium/commit/e97e5efdff4cc3d081f4aaf8747f6b8707683f61))
* 后台支持批量发布、改草稿、下载和删除内容文件 ([4db7df3](https://github.com/planetarium1001/astro-versicarium/commit/4db7df349cd0032e13b385839fc3259e696317f8))
* 后台支持文章 updatedAt 更新日期字段及编辑器快捷操作 ([97282fb](https://github.com/planetarium1001/astro-versicarium/commit/97282fbb32c1d6704a69b7ade7dfe28392c6a13a))
* 后台支持新建 bits 动态 ([c13fa3f](https://github.com/planetarium1001/astro-versicarium/commit/c13fa3f6929fba7aa9bdebad9d4343c3418c94f6))
* 后台支持新建 essay 文章 ([d4a1d5a](https://github.com/planetarium1001/astro-versicarium/commit/d4a1d5a721814c86a18b35a68286a2e4b3fa9687))
* 增加文章目录与浮动操作列，并调整布局与阅读模式 ([5b0914d](https://github.com/planetarium1001/astro-versicarium/commit/5b0914da7cc8cbe66201e74b878077cf6252b9a9))
* 增加浏览数据与备案信息，修复滚动条引起的整页横跳 ([b06c6ae](https://github.com/planetarium1001/astro-versicarium/commit/b06c6ae7492fad3600f7980e456e3e21c5b8548b))
* 增强 essay 图片上传与列表编辑 ([9096497](https://github.com/planetarium1001/astro-versicarium/commit/90964978c51e7da847eb479d25b48261f9500d87))
* 增强 Theme Console 配置损坏检测与保护机制 ([1f9ddea](https://github.com/planetarium1001/astro-versicarium/commit/1f9ddea835ef7e52a9e6d0fe6d66859528e95e13))
* 增强列表浏览、年份筛选与搜索交互体验 ([ed7a892](https://github.com/planetarium1001/astro-versicarium/commit/ed7a89217026ef295cbc4062a7e1ba3df5041036))
* 备案显示范围开关、窄屏目录按钮与阅读模式文案修正 ([9df2d4b](https://github.com/planetarium1001/astro-versicarium/commit/9df2d4b87a1d7ea1aa466fdc1e98b6762495e355))
* 完善 About 页面内容结构与视觉交互体验 ([7c80573](https://github.com/planetarium1001/astro-versicarium/commit/7c80573385cbbf24ec34df7f840ce1e20ffab2fa))
* 完善 bits 图片行内编辑与管理端 smoke ([7ee12da](https://github.com/planetarium1001/astro-versicarium/commit/7ee12da40850f12ddbc6f116877c3f619fc88649))
* 完善内容编辑器布局切换与操作反馈 ([0dd0368](https://github.com/planetarium1001/astro-versicarium/commit/0dd036865f3999313442567d595861346cddb1db))
* 完善站点外观配置与 Theme Console 文档 ([b16d9f3](https://github.com/planetarium1001/astro-versicarium/commit/b16d9f318d17869108ef3e65e3f2895c4f020bb0))
* 完善编辑器 Markdown 插入与预览渲染 ([c79fe07](https://github.com/planetarium1001/astro-versicarium/commit/c79fe078e64a8845bd0e1bf1c953ceb22df37e69))
* 建立 admin content 编辑与预览基础 ([b0274e6](https://github.com/planetarium1001/astro-versicarium/commit/b0274e645f9fbcc0730d1a8ae64c7ac327fc1ad1))
* 建立 Icon 组件统一管理 SVG 资源并完善项目配置 ([07d01ba](https://github.com/planetarium1001/astro-versicarium/commit/07d01ba615138c3c5514f47f248ee5d308a07b07))
* 引入 Theme Console 基础能力与本地配置持久化 ([30f4d14](https://github.com/planetarium1001/astro-versicarium/commit/30f4d145ac3adc687790a2a5b9a61317b4aab411))
* 扩展 Theme Console 的导语、页面副标题与配置分组 ([c030053](https://github.com/planetarium1001/astro-versicarium/commit/c0300533905dfa3274f8ec726ae44212f8083d96))
* 扩展后台控制台，新增 Checks 与 Media 管理能力 ([8fec5ec](https://github.com/planetarium1001/astro-versicarium/commit/8fec5ec4749dfe2521f9e69a65bc7a3904992db8))
* 拆分后台多路由壳层并重构 theme 共享实现 ([8249f8c](https://github.com/planetarium1001/astro-versicarium/commit/8249f8c9834814c7ecb5ae0207e90a7da5f7a2f3))
* 支持 about Markdown-first 内容编辑 ([2b627f6](https://github.com/planetarium1001/astro-versicarium/commit/2b627f6712ce34741be336d42f280ce20a383df4))
* 支持 about 编辑器友链工具与联系链接占位指令 ([74f45d2](https://github.com/planetarium1001/astro-versicarium/commit/74f45d2db1ae29de17d2c7e4a1542469f69f2314))
* 支持 BASE_URL 子路径部署 ([483e12e](https://github.com/planetarium1001/astro-versicarium/commit/483e12e91600c0aee7a5552593ff3289c736da31))
* 支持 bits 编辑工作台与写入协议 ([3f3169d](https://github.com/planetarium1001/astro-versicarium/commit/3f3169db15ebf4089ca6cada215ae50fabdded52))
* 支持 memo 内容写入与编辑工作台 ([3485fb8](https://github.com/planetarium1001/astro-versicarium/commit/3485fb8545a131c0645cb6d48ccb665908152ae8))
* 支持可选文章更新时间 ([09a4006](https://github.com/planetarium1001/astro-versicarium/commit/09a400653f9edcb436b72c8818f11c6169d4b86e))
* 支持多图展示与草稿生成器优化 ([ca393f3](https://github.com/planetarium1001/astro-versicarium/commit/ca393f34d9ae24bce9c6e6604e86cb2d74c5c417))
* 支持自定义作者信息并优化头像显示 ([4babc16](https://github.com/planetarium1001/astro-versicarium/commit/4babc16b0fef0237d2a4d186f6b4d1edf170d3b8))
* 支持自定义社交链接与页脚年份配置 ([b91db43](https://github.com/planetarium1001/astro-versicarium/commit/b91db4303f686e25554145d9c01060ce3b18b36e))
* 支持页脚版权与基础社交链接配置 ([bd662a8](https://github.com/planetarium1001/astro-versicarium/commit/bd662a847c0f40274d2e1ee52aa50461e646e6ff))
* 支持首页 Hero 图片自定义配置 ([965194d](https://github.com/planetarium1001/astro-versicarium/commit/965194d0835e465e47e398d5b300489ed8a49a3e))
* 支持首页导语显示开关与固定页面标题配置 ([a175087](https://github.com/planetarium1001/astro-versicarium/commit/a175087eb5ca8c66ad8c71530e114d89c9680aee))
* 新增 about 固定页内容能力模型 ([83d7fdb](https://github.com/planetarium1001/astro-versicarium/commit/83d7fdb18e6121689d88d809b8c5413a3defc73b))
* 新增 about 页友链内容模型与展示区块 ([3245731](https://github.com/planetarium1001/astro-versicarium/commit/3245731fc1ff1ade0a802a42a7ba1ad1098bf481))
* 新增 CodeMirror 正文编辑器与显示偏好 ([4e206aa](https://github.com/planetarium1001/astro-versicarium/commit/4e206aa721dee8d7820a93d3e2ee9596533284c6))
* 新增 Content Console 与 frontmatter 写回能力 ([fb31a23](https://github.com/planetarium1001/astro-versicarium/commit/fb31a2330152038c9f53c6cbe08c038c511b702e))
* 新增 Data Console 与后台概览聚合数据读取层 ([28063af](https://github.com/planetarium1001/astro-versicarium/commit/28063afb8e4eb06d316dc16050994b48a4e67723))
* 新增 essay 编辑器目录面板与标题跳转 ([ebc6568](https://github.com/planetarium1001/astro-versicarium/commit/ebc656892dd70ea321a5e6c508207d718343d7a9))
* 新增 XSS 防护与安全响应头配置 ([44d378a](https://github.com/planetarium1001/astro-versicarium/commit/44d378a5b5bd03a734bbabd02bd4ff3090dbf1ef))
* 新增3500常用字基础表并更新字体子集 ([0b16f1d](https://github.com/planetarium1001/astro-versicarium/commit/0b16f1d60c6a06925531a8b679530efbcf1df1f4))
* 新增侧栏图标配置并整理后台样式 ([8253f68](https://github.com/planetarium1001/astro-versicarium/commit/8253f68526852e270d0ba5c188d7a33b2681e094))
* 新增内容导出删除与恢复机制 ([258840c](https://github.com/planetarium1001/astro-versicarium/commit/258840cf48b5e021c9d094fac31beea085b4a745))
* 新增内容编辑器多集合适配层 ([3a41075](https://github.com/planetarium1001/astro-versicarium/commit/3a410754a7a909abc88adfc587ccf08057edf469))
* 新增后台侧栏导航切换与本地偏好设置 ([72b7540](https://github.com/planetarium1001/astro-versicarium/commit/72b7540b73d73834bd0c3ca67b5e722a25d1a90e))
* 新增文章元信息显示配置选项 ([9f10404](https://github.com/planetarium1001/astro-versicarium/commit/9f10404d279e1fe428ad54f9d1b815d4ade6efaa))
* 新增编辑器语法侧栏与提示块插入 ([4120542](https://github.com/planetarium1001/astro-versicarium/commit/41205426e6ab3d723d1ad0b094fd65e1d2287bbd))
* 新增轻量图片预览功能并优化多图展示交互 ([60c200c](https://github.com/planetarium1001/astro-versicarium/commit/60c200ce714a8fa55bfc2104bec53c8824bb60e7))
* 校验 tag 路由键并移除 admin checks console ([#52](https://github.com/planetarium1001/astro-versicarium/issues/52)) ([cce5482](https://github.com/planetarium1001/astro-versicarium/commit/cce54821a9843879496303340c13335d728e36bb))
* 添加 sitemap 集成并优化 SEO 配置 ([ff139a8](https://github.com/planetarium1001/astro-versicarium/commit/ff139a8258e49fc391c1dbea4a008a40650f0d2d))
* 添加一键部署配置并支持环境变量 SITE_URL ([e5174fe](https://github.com/planetarium1001/astro-versicarium/commit/e5174fe5de48bc5c4034b8706f038b750c0e438c))
* 添加在线创作表单并支持地点标签展示 ([7babe94](https://github.com/planetarium1001/astro-versicarium/commit/7babe9458957bb608d9eb07fa1135fda36ca0116))
* 添加本地图片资源并配置路径别名 ([21627b1](https://github.com/planetarium1001/astro-versicarium/commit/21627b1e35a730aa618e63fd71ea3707b64d37fa))
* 添加标签筛选与静态标签路由支持 ([e217d57](https://github.com/planetarium1001/astro-versicarium/commit/e217d57f3204f6679ea1c73eda7f8f61acb52cf0))
* 移动端适配及细节优化 ([f09f9f0](https://github.com/planetarium1001/astro-versicarium/commit/f09f9f01e218a51b8292e7e73555e5d649f9e948))
* 窄屏标题、拖拽排序、分割线贯通与品牌链接收敛 ([0ae6a54](https://github.com/planetarium1001/astro-versicarium/commit/0ae6a544766841f89f282a825a701de65f132752))
* 简化路由结构，将所有随笔文章的详情页统一收敛到 /archive/{slug}/ 入口 ([401207d](https://github.com/planetarium1001/astro-versicarium/commit/401207df00045a18e4aabe1253ce8227b21a29a7))
* 统一内容查询、路由生成与 RSS 验证逻辑 ([37122d8](https://github.com/planetarium1001/astro-versicarium/commit/37122d818a74ca25eea27ca0d6fb36373d8d65e8))
* 重构 Data Console 导入导出界面与客户端逻辑 ([6b3ca12](https://github.com/planetarium1001/astro-versicarium/commit/6b3ca12a97fd1190dccf13a95c19d6a8e0e217db))
* 重构内容模型与导航，重做列表筛选与后台控制台 ([df93e3f](https://github.com/planetarium1001/astro-versicarium/commit/df93e3f598a98ae8990f48f07a6de39595b3561b))
* 重构后台概览页并新增公开配置展示 ([7f59e48](https://github.com/planetarium1001/astro-versicarium/commit/7f59e4835e523fc0d6d5e2cb55af5219de9bcdfb))
* 重构并统一图片预览功能 ([d300533](https://github.com/planetarium1001/astro-versicarium/commit/d300533769ce8f1b02329e8d05798009ac0e5cd1))
* 阅读模式保留页脚版权与备案信息 ([0c347cb](https://github.com/planetarium1001/astro-versicarium/commit/0c347cb34f9e7c9c514a1b991cb5314fb2ac6a79))
* 页面外缘间隙可配置，projects/devlog 改用正文末尾链接组 ([ea4b322](https://github.com/planetarium1001/astro-versicarium/commit/ea4b322ba42bfc2c8ba3d43d30456a8ad9d8eb0c))


### Bug Fixes

* **admin:** use Chinese title for resources console ([8c76d1b](https://github.com/planetarium1001/astro-versicarium/commit/8c76d1ba0cb71d309e2cdeb40c7c22dad21bdf22))
* **archive:** drive scope pills from page title settings ([e12cafa](https://github.com/planetarium1001/astro-versicarium/commit/e12cafadb8cf496b6bc16b4ac3ebefd3d57eadff))
* **archive:** match scope pills to sidebar nav labels ([1f87703](https://github.com/planetarium1001/astro-versicarium/commit/1f87703d0c16b83e67ed47740d8d764b8b50944e))
* bump fast-xml-parser to 5.5.7 ([9061265](https://github.com/planetarium1001/astro-versicarium/commit/9061265c3bd8cab7f70dc27c99895026973a9e05))
* **favicon:** 简化单图复用并整理图标文档 ([3d8b376](https://github.com/planetarium1001/astro-versicarium/commit/3d8b37692b44bb3da454d1fa29374e49658c041b))
* harden URL handling and CI permissions ([abba236](https://github.com/planetarium1001/astro-versicarium/commit/abba236f4420f259287560b597ebf40139131538))
* **mobile:** 修复 rc.1 真机验收回归并补齐浮动列设置 ([8e63498](https://github.com/planetarium1001/astro-versicarium/commit/8e63498f0828e64726e4c757602bc0b53a374269))
* theme:update 二进制合并补上相等短路 ([f6e8e40](https://github.com/planetarium1001/astro-versicarium/commit/f6e8e40c7c7354790e6d50d9df47a3714279f1e6))
* theme:update 正确处理二进制文件 ([250f220](https://github.com/planetarium1001/astro-versicarium/commit/250f220c4c05057e2b3c5022d8f1260872854236))
* **ui:** 防止列表 badge 被长标题挤压换行 ([#32](https://github.com/planetarium1001/astro-versicarium/issues/32)) ([2e3fae9](https://github.com/planetarium1001/astro-versicarium/commit/2e3fae99f51c6c49a6e7455d901a5efc77f7326d))
* verify 先刷新 fixture 再跑用例 ([60e2310](https://github.com/planetarium1001/astro-versicarium/commit/60e2310224d31aea1ea3b21ff3131632d59c5c09))
* 优化文章与 admin 体验，并补齐 prose/figure 烟测 ([13c94ae](https://github.com/planetarium1001/astro-versicarium/commit/13c94aef3c0c1c8010f01051b89352f98adffb05))
* 保留 essay publishedAt 缺失时的已有值 ([f5cc6d8](https://github.com/planetarium1001/astro-versicarium/commit/f5cc6d84fbd56aca863dfb145c319cd640e1be46))
* 修复 Theme Console 校验误报并收紧配置写入保护 ([055ab6a](https://github.com/planetarium1001/astro-versicarium/commit/055ab6ae0cc939da7cacc8a8f3f64bf699e87931))
* 修复列表搜索过滤、索引缓存与日期显示异常 ([7247ab9](https://github.com/planetarium1001/astro-versicarium/commit/7247ab9c900b94c66b9184dc6b9e2ddf136c7fb6))
* 修复单图卡片无法打开预览与列表搜索路径重复拼接问题 ([0a675f9](https://github.com/planetarium1001/astro-versicarium/commit/0a675f97c963b56de6723bc963ee87c949774d5c))
* 修复后台内容编辑器冲突与无障碍问题 ([f7c9330](https://github.com/planetarium1001/astro-versicarium/commit/f7c9330f06e5ddd73ebbd3595903616afec52f32))
* 修复后台图片预览安全告警 ([7909dfd](https://github.com/planetarium1001/astro-versicarium/commit/7909dfdf570eea631e94f9859c66904edea551c4))
* 修复多处可访问性问题并优化交互体验 ([a21f872](https://github.com/planetarium1001/astro-versicarium/commit/a21f8724797d19f9cae254974061b830d0aaae2f))
* 修复头像路径验证并增强首页字体加载 ([d70ddfb](https://github.com/planetarium1001/astro-versicarium/commit/d70ddfb9fc012da043305690c70a388656d57a0b))
* 修复子路径部署下 Sitemap 地址及产物校验 ([624ab79](https://github.com/planetarium1001/astro-versicarium/commit/624ab796257dd12b718d096623b4ff1a8932fa0e))
* 修复异常标签可能生成错误路由与统计的问题 ([d988dca](https://github.com/planetarium1001/astro-versicarium/commit/d988dca84986ad1a8a33dfbf76173ecb4fbe4f10))
* 修复社交链接排序冲突并优化后台样式加载 ([162deea](https://github.com/planetarium1001/astro-versicarium/commit/162deeac1667d26cf10b3e54e74d29f6ff976f0d))
* 修复移动端文字缩放与标题元信息过早换行问题 ([4dcfe36](https://github.com/planetarium1001/astro-versicarium/commit/4dcfe36023e9a507316a40ef2aebbeceee4b5816))
* 修复自定义社交链接保存时可能静默覆盖已有名称的问题 ([5b160c9](https://github.com/planetarium1001/astro-versicarium/commit/5b160c9ed15aa13839cf1f37130969a5d37f2906))
* 修整 HTML 实体解码与 figure 图片解析规则 ([8687ff8](https://github.com/planetarium1001/astro-versicarium/commit/8687ff8a54b08894f5805711aa01884131df6362))
* 修正 og:image 的默认图与绝对化 ([b6ec56f](https://github.com/planetarium1001/astro-versicarium/commit/b6ec56fa198d0fe74a9d580c73e1dd4a9b0aaad3))
* 兼容 essay.date ISO 8601 datetime 输入 ([08ecdb3](https://github.com/planetarium1001/astro-versicarium/commit/08ecdb312fd5e0267d6c4d56d46df48fdc740ce7))
* 分割线在首页与后台贯通，并补上快照漂移守卫 ([2304072](https://github.com/planetarium1001/astro-versicarium/commit/230407285ba894501221d498a2440148b586c733))
* 后台两个列表按编号排序渲染，拖拽锚点移到行首，X 不再默认出现 ([cbe0d5c](https://github.com/planetarium1001/astro-versicarium/commit/cbe0d5c8612bc89fa1b29112a7fd9962835a4b7d))
* 增加 admin editor dev 缓存恢复入口 ([541aee4](https://github.com/planetarium1001/astro-versicarium/commit/541aee4b3ba93ce0b86f551b7b1225195a669ef5))
* 完善云端图片上传与列表的错误处理 ([3344c07](https://github.com/planetarium1001/astro-versicarium/commit/3344c07469d35c32a0d6e793df2c8f3fe620f577))
* 容器焦点环、触屏正文对称与窄屏页脚贴底，并合并重复样式 ([5adef63](https://github.com/planetarium1001/astro-versicarium/commit/5adef632cc7f408e1e8a7ab18e3c31dfbaaee23d))
* 强制 essay.date 使用纯日期契约 ([3ee30b5](https://github.com/planetarium1001/astro-versicarium/commit/3ee30b5fb30b60cfb9b1da81296ade700baef14e))
* 恢复 markdown smoke 检查所用示例图并同步字符集指纹 ([ba8f939](https://github.com/planetarium1001/astro-versicarium/commit/ba8f9397e1f62da3fab9df65663a403e8a304ea6))
* 改用 DOM 节点传递 bits 图片预览元数据 ([0a58d84](https://github.com/planetarium1001/astro-versicarium/commit/0a58d843c935ad0282d29937b2318a3b3e68d117))
* 条件渲染 canonical 与 og:url 避免输出无效链接 ([b0f7319](https://github.com/planetarium1001/astro-versicarium/commit/b0f731960a691ef24bb7542ec507cff713428fea))
* 浮动列按钮点击不再被过期状态吞掉 ([2f87743](https://github.com/planetarium1001/astro-versicarium/commit/2f87743b860acd9f064f8f6edc499bebb2705f82))
* 窄屏正文右侧间距与目录按钮的开关行为 ([f3e9c32](https://github.com/planetarium1001/astro-versicarium/commit/f3e9c3212d20e130de05ff386c7f8f36d7ac8165))
* 窄屏表格不再撑宽整页，避免移动端缩放到看不见浮动列 ([11d27d6](https://github.com/planetarium1001/astro-versicarium/commit/11d27d67abd47181dd62352df125b4428c80e581))
* 窄屏表格规则移到基础规则之后才生效 ([e253d4c](https://github.com/planetarium1001/astro-versicarium/commit/e253d4c7778d932cd595b3c9fca68ad17c79156a))
* 窄屏顶栏图标锚定标题首行，不再随标题折行上下移动 ([f1e70dc](https://github.com/planetarium1001/astro-versicarium/commit/f1e70dcb3bcdb1134fd8a4be1fb1092f4ebb2909))
* 窄屏顶栏统一为两行网格、消除横向溢出与点击高亮，并补目录过渡 ([2b269cf](https://github.com/planetarium1001/astro-versicarium/commit/2b269cf47f87093d1c65be57f1396a76dc6d55aa))
* 窄屏顶栏覆盖规则被基础规则同特异性覆盖 ([c17f978](https://github.com/planetarium1001/astro-versicarium/commit/c17f978cf5f725241b78d51e7412cf5e0d89c6d3))
* 统一图片预览地址校验与空值隐藏逻辑 ([96d67a2](https://github.com/planetarium1001/astro-versicarium/commit/96d67a284ec90ccba84d82ae97a4b5d49f427c2f))
* 补强后台图片预览地址解析 ([4b6e106](https://github.com/planetarium1001/astro-versicarium/commit/4b6e1065a156437d63b9c9ec98fb01bf2386632f))
* 页脚贴底在首页与后台同样成立 ([31eed45](https://github.com/planetarium1001/astro-versicarium/commit/31eed4560e3f217535c1c56d6cad4ead27ec48f1))


### Performance Improvements

* 优化 LXGW WenKai Lite 字体加载策略 ([1c51556](https://github.com/planetarium1001/astro-versicarium/commit/1c515562390627222447fccd749a5fa00b1e0602))
* 优化公开页样式加载方式，减少 HTML 体积开销 ([a8b0560](https://github.com/planetarium1001/astro-versicarium/commit/a8b05602767670f7dff6ce2dc5300908e9a9d3bc))
* 优化首页首屏加载并重构页面样式结构 ([7d3481d](https://github.com/planetarium1001/astro-versicarium/commit/7d3481d5a7ec3c5ca252ce6b172c43409182a434))
* 构建时强制内联样式表减少首屏阻塞 ([325ae0f](https://github.com/planetarium1001/astro-versicarium/commit/325ae0f0cb6801726c4a18d6e1bc607e9852252d))
* 自托管 Noto Serif SC 字体并实现子集化加载 ([81eb0dd](https://github.com/planetarium1001/astro-versicarium/commit/81eb0dd55faa2cef5354a2e89438c4ba395aa149))

## [1.0.0-rc.2] - 2026-10-21

第二个预览候选：修复 rc.1 真机验收发现的移动端回归，并新增窄屏浮动列右侧距离设置。

本条目对应本地提交，尚未创建 GitHub Release。

### Added

- 后台「主题 → 站点设置」新增「窄屏浮动列右侧距离」（`site.railOffsetPx`，0–32px，默认 6），构建期输出 `--rail-action-offset-narrow`，窄屏浮动列按配置贴边。
- 浮动列四个按钮增加触摸 pointer 兜底：部分内核吞掉 click 时，按住抬起仍能一次触发，并保留鼠标与键盘的原生 click 路径。

### Fixed

- 修复窄屏横向溢出与右侧滚动条槽残留：窄屏只在桌面启用 `scrollbar-gutter`，布局视口由 body 裁剪兜底；后台概览的窄屏结构行不再撑宽整页。
- 修复文章版本提示的未发布状态圆点与窄屏换行：窄屏提示排成两行，不再挤出容器。
- 修复窄屏动作图标的提示气泡被顶部裁切：提示改到按钮下方并对齐右缘。
- 修复 bits 卡片日期在纯日期条目显示 `00:00` 与多余分隔符的问题，日期按 frontmatter 粒度显示。
- 修复触屏点按后公开页面残留悬停高亮、导航链接残留默认焦点描边与细下划线的问题；窄屏当前页下划线统一为桌面档粗细与位置。
- 修复主题切换涟漪在移动端圆心偏出按钮的问题：用命名快照探针校正快照原点偏移，并加超时兜底清理。
- 修复窄屏浮动列点击困难：相邻 44px 热区留出净空、触控热区不再朝右缘外溢，并支持后台配置贴边距离。
- 修复窄屏导航的胶囊设计残留与焦点视觉冲突：窄屏导航改为普通文字链接，保留 44px 触控高度与当前页下划线。
- 修复列表页搜索浮层的不透明遮罩与生硬开合：改为半透明模糊 + 四角径向渐隐蒙版，内容层淡入与轻微位移，遵循 reduced-motion。
- 修复描述行回退两行时的孤立分隔符；一行显示时描述点与计数组内部点距一致。

## [1.0.0-rc.1] - 2026-10-20

首个预览候选，项目更名为 Versicarium · 垄录。稳定版 `1.0.0` 将在预览验证与文档补全后发布。上游基于 [cxro/astro-whono](https://github.com/cxro/astro-whono)（MIT）。

本条目对应本地标签 `v1.0.0-rc.1`，尚未创建 GitHub Release。

### Added

- 项目支持文档级多版本文档：同一项目可共享稳定 `slug`，每个版本独立成文，并可在 `/projects/` 弹窗中切换查看。
- 后台资源库支持集合级共享资源、资源状态与共享目录上传。
- 归档支持项目版本行与项目名过滤，开发日志与归档共用同一套摘要派生。
- 文章版本界面增加版本历史入口与退出动画，项目版本弹窗支持深链与版本切换。
- Release Please 管理版本与 CHANGELOG；Release 创建后打包模板源码压缩包与 SHA-256 校验文件。
- 完整的开发者向示例内容：主题手册系列、项目版本、开发日志与动态。
- Versicarium · 垄录品牌资源：logo、avatar、favicon、apple touch icon 与 hero 图。

### Changed

- 项目、仓库与包名迁移到 `astro-versicarium`；示例站部署在 `https://planetarium1001.github.io/astro-versicarium/`。
- 行文与界面文案改写为 Versicarium · 垄录口径；旧名字只保留在上游致敬与必要历史说明中。
- `main` 作为最小模板分支，`demo` 作为完整示例站；主题更新继续按文件三方合并。
- 条目排版统一为分类、标题与版本号的固定顺序，版本名称位置可配置。
- 后台主题设置、内容列表、媒体资源与错误提示统一为同一套界面语言。
- 主题文档、README 与示例内容围绕开发者使用场景重写。

### Fixed

- 版本历史下划线位置、关闭按钮焦点与弹窗滚动条遮挡文字。
- 开发日志时间线断线、归档与开发日志摘要不一致。
- 后台资源状态长期停留在“准备中”。
- 构建期重复 `description` 字段与若干注释残留。

### Removed

- 上游示例内容、示例图片、头像与截图。
- 已废弃的条目格式组合器与相关后台字段。
- 内部设计草稿、临时文档与未使用的静态资源。
- 旧的 `1.1.0` 版本记录与 `v*` 标签发布流程。
