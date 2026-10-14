#!/usr/bin/env node
/**
 * 刷新客户端行为测试用的页面快照。
 *
 * 客户端行为测试需要真实渲染后的 HTML（SSR 输出的 data-* 属性、inline JSON 数据脚本、
 * 脚本加载顺序），这些只有构建产物里才完整；快照随构建更新，测试因而无需运行中的 dev server。
 *
 * 用法：`SITE_URL=... npm run build && node ./scripts/refresh-client-test-fixtures.mjs`
 */

import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'tests', 'fixtures');

const SOURCES = [
  ['dist/bits/index.html', 'bits-page.dev.html'],
  ['dist/bits/index.json', 'bits-index.dev.json'],
  ['dist/blog/index.html', 'blog-page.dev.html'],
  ['dist/blog/index.json', 'blog-index.dev.json'],
  ['dist/archive/index.html', 'archive-page.dev.html'],
  ['dist/archive/index.json', 'archive-index.dev.json'],
  // 文章详情页：只有构建产物才带 data-article-toc / data-toc-toggle 结构。
  ['dist/blog/2026-06-13-content-console-使用指南/index.html', 'article-page.dev.html'],
  ['dist/devlog/index.html', 'devlog-page.dev.html']
];

await mkdir(OUT, { recursive: true });

let copied = 0;
const missing = [];
for (const [from, to] of SOURCES) {
  const source = path.join(ROOT, from);
  if (!existsSync(source)) {
    missing.push(from);
    continue;
  }
  await copyFile(source, path.join(OUT, to));
  copied += 1;
}

if (missing.length > 0) {
  console.error('[refresh-client-test-fixtures] 缺少构建产物，请先 `SITE_URL=... npm run build`：');
  for (const item of missing) console.error(`  - ${item}`);
  process.exit(1);
}

console.log(`[refresh-client-test-fixtures] 已刷新 ${copied} 个快照到 tests/fixtures/`);
