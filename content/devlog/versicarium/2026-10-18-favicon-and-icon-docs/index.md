---
title: 图标复用与图标文档整理
date: 2026-10-18
project: Versicarium
projectSlug: versicarium
kind: fix
description: 触摸图标留空时复用标签页 PNG，默认图标按文件存在性输出，并补齐图标与部署文档。
draft: false
---

`3d8b376`（2026-10-18）整理了站点的图标链路。触摸槽位留空时复用标签页 PNG，默认链接按文件是否存在输出，避免生成指向不存在图片的 `link` 标签。

共享默认图标路径与上传槽位类型，移除 favicon 的死别名；测试补上单图、SVG-only 与缺文件三种情形，后台预览与清除文案跟随复用规则。装饰性注释与状态 emoji 同时清理。

文档侧新增 favicon 与部署两篇说明，README 结构重新整理。这一提交也是 `me@planetarium1001.com` 首次作为提交邮箱出现。

[项目 0.5.0](/projects/#2026-10-14-versicarium) · [仓库](https://github.com/planetarium1001/astro-versicarium)
