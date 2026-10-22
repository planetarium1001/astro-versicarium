---
title: 更名 Versicarium 与首个预览
description: 从 whono 到 Versicarium · 垄录：品牌重做、仓库改名、GitHub Pages 子路径修复，以及同一天改了两次的版本号。
date: 2026-10-20
publishedAt: 2026-10-20
tags: [品牌, 预览]
draft: false
---

10-20 凌晨 05:13，`7b8437f` 把仓库、包名和站点名一起改了：Versicarium · 垄录。

名字来自 versus。拉丁语里它既是犁沟也是转向，古人写一行要转回来犁下一行，“诗行”和“犁沟”共用一个词。`versiculus` 是它的指小形式，指可以被抛出、等待回应的短句；`-arium` 是存放这些东西的地方。中文名“垄录”接同一个动作：垄是犁沟，也是代码行和日志行；录是收存和应答。

品牌资源按实心几何重做：深色圆角方壳、白色活页纸、左侧三枚打孔、里面三条记录行，中间一条高亮成蓝色。产出 logo、头像、favicon（SVG 和 PNG）、apple touch icon、默认分享图，以及 21:9 的浅色和深色 hero 各一张。旧名只留在上游致敬和必要的迁移说明里。

仓库地址换成 `planetarium1001/astro-versicarium`，示例站部署在 `planetarium1001.github.io/astro-versicarium/`。GitHub Pages 的子路径带来一批小问题：站内 Markdown 链接、正文末尾的链接组、上一篇/下一篇和图片路径，都要补上部署 base，否则构建出来的地址会缺一段。

内容也围绕真实提交重建了一遍：项目 0.1.0、0.5.0、1.0.0-rc.1 三份版本文档，开发日志按提交记录，动态和博客同步新名字。README 与文档重写。`main` 和 `demo` 的分支职责写清楚了：`main` 是模板和更新来源，`demo` 承载示例站，部署只在 `demo` 跑。

![首页暗色，品牌图形与双栏布局](/images/demo/home-dark.webp)

![窄屏首页，站点标题换成窄屏版本](/images/demo/mobile-home.webp)

版本号在同一天改了两次。02:04 的 `8ca2839` 已经把 `main` 作为 1.1.0 最小模板发过一次；更名后，首个公开版本定为 1.0.0，旧的 1.1.0 记录并进 1.0.0 预览，不再单独存在。05:38 的 `4d2fb3b` 再把包版本推到 `1.0.0-rc.1`，Release Please 配置切到 rc 预发布策略。标签是带注释的 `v1.0.0-rc.1`，落在 05:47 那个修动态卡片日期时区用例的提交 `f887527` 上——测试先稳了，版本才定。

当时只做了本地提交，没有 push，也没有创建 Release；`main` 和 `v1.0.0-rc.1` 标签后来才推上远端。品牌、版本号、标签在同一天各定了一次，代价是 README 和文档当天重写了两轮。

更名的记录在开发日志里：[改名 Versicarium 与 1.0.0-rc.1 预览](/devlog/#versicarium-2026-10-20-versicarium-rename)。
