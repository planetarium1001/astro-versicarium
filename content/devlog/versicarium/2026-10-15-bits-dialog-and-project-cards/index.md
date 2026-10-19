---
title: 动态弹窗与项目卡片改版
date: 2026-10-15
project: Versicarium
projectSlug: versicarium
kind: feature
description: 动态卡片可展开全文，项目卡片整卡可点并把末尾链接固定在右下角。
draft: false
---

`a32657e`（2026-10-15）给 `/bits/` 的卡片加上详情弹窗。点卡片主体会打开完整正文、全部标签与全部图片，关闭按钮、Esc 与遮罩都可以关闭；内容超出上限时在弹窗内部滚动，不把页面撑长。卡片上的标签变为可点的筛选入口，摘要按行数温和截断，在右下角给出“查看全文”提示。

`/projects/` 的卡片改为整卡可点，末尾链接固定在卡片右下角，同一行卡片因此对齐。卡片头部改成“图标 + 胶囊标题 + 小号副标题”的两列结构，新增可选展示图，文字从缩略图右侧绕排。

同一提交修复了卡片弹窗的多余滚动条、阅读模式的左栏收拢与页脚位置，并统一项目与动态两个弹窗的宽度。交互逻辑抽到共享的 `dialog-controller`，头像与标签行拆成独立组件。

[项目 0.5.0](/projects/#2026-10-14-versicarium) · [仓库](https://github.com/planetarium1001/astro-versicarium)
