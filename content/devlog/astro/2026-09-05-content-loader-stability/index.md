---
title: 内容加载器稳定性调整
date: 2026-09-05
project: Astro
kind: fix
description: 修复目录式条目加载与主文件选择在异常目录下的边界问题。
draft: false
---

内容加载器按 `index.md`、唯一 `.md`、唯一 `entry: true` 的顺序选择主文件。遇到集合根目录下的散落 Markdown 或同目录多个候选时，加载器现在会给出明确诊断，而不是静默选中其中一个。

这项调整只影响异常目录，正常条目保持原路径与条目 ID。构建期的集合校验和后台内容列表共用同一份规则。

[仓库](https://github.com/planetarium1001/astro-whono-tweaked)
