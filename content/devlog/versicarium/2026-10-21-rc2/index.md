---
title: 第二个预览候选
date: 2026-10-21
project: Versicarium
projectSlug: versicarium
kind: release
description: 版本改为 1.0.0-rc.2，发布工作流固定为手动触发。
draft: false
---

版本号改为 1.0.0-rc.2，并补齐面向使用者的 rc.2 变更说明与当前版本引导。

相较 rc.1，这一版没有新的内容模型，主要是移动端回归修复与随之调整的交互细节；标签 v1.0.0-rc.2 停在 10-21 的提交上。

发布流程在这一轮固定下来：先修回归，再收版本号与说明，最后打标签并更新示例站。`release-please.yml` 与 `release.yml` 都是手动触发。

版本说明按使用者的动作组织，覆盖升级、配置与已知限制。标签之后仍有字体与文档改动，这部分留给后续版本统一处理。

[仓库](https://github.com/planetarium1001/astro-versicarium) · [提交](https://github.com/planetarium1001/astro-versicarium/commit/89fc493) · [在线演示](https://planetarium1001.github.io/astro-versicarium/)
