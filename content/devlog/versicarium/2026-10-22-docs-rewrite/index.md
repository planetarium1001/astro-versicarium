---
title: 文档与 README 重写
date: 2026-10-22
project: Versicarium
projectSlug: versicarium
kind: docs
description: README 与 8 份主题文档重写，示例站截图更新。
draft: false
---

README 与 8 份主题文档重写，示例站截图同步更新。文档按使用模板的人重新组织：获取方式、命令、内容结构、后台、部署与发布各自成篇，开发与实现细节移入 developers 一层。

此前文档跟着功能演进逐段追加，命令与目录说明停在旧版本，示例站截图也是旧主题。重写后的文档与当前 rc.2 的行为一致，截图换成现有效果，文档条目与代码树对齐，读者不必再按旧路径寻找内容。

使用文档面向部署与写作，开发者文档解释内容模型、路由与后台边界，两层分开后各读各的。重写的文档不再重复 README 的快速开始，只在命令变化时互相引用，减少两处同时过期。文档不改变站点运行结果，但决定模板能否被独立使用。

此后新增能力先补使用文档，再补开发者文档，截图与命令随版本一起更新，避免示例站与说明脱节。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [提交](https://github.com/planetarium1001/astro-versicarium/commit/f938069)
