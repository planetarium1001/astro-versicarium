---
title: 版本号 1.0.0 与 main 回归模板
date: 2026-10-16
project: Versicarium
projectSlug: versicarium
kind: release
description: main 去掉示例内容回到模板形态，版本号定到 1.0.0，theme:update 补上二进制合并边界。
draft: false
---

`d17570c`（10-15 21:40）先让 `main` 回归模板形态：示例内容和示例截图移除，每类只留几条种子内容，设置回到中性默认值，`pages.yml` 改为只部署 `demo`，`ci.yml` 覆盖两个分支，测试不再读取示例文件。同晚 `6751344` 重写 README 与文档，补上主题更新通道。

`33bbfbc`（10-16 22:18）把 `package.json` 版本定到 1.0.0，并收紧上一轮新增的六处注释；同一分钟的 `e45dfeb` 把 `theme.json` 的基准推进到这个 v1.0.0 提交。版本号先于预览候选落位，后来在 10-20 改过一次，再收敛到 rc 预发布。

当天凌晨还补了 `theme:update` 的两个边界：`250f220`（01:46）让二进制文件整文件取舍，`f6e8e40`（01:48）补上相等短路。文本合并用 `git merge-file`，二进制走同一套逻辑会写坏文件，所以内容相同就直接跳过，不同时只选一方并记为冲突。

[项目 1.0.0-rc.1](/projects/#2026-10-20-versicarium) · [仓库](https://github.com/planetarium1001/astro-versicarium)
