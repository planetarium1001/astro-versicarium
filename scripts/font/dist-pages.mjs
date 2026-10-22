import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

import { listFiles, readText } from './io.mjs';
import { extractRoleCharsets, setToSortedString } from './roles.mjs';

/* 读取 dist 下全部 HTML 的逐页角色字符集：font:coverage 与 font:report 共用。
   jsdom 只用于解析构建产物，不参与运行期。 */

const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', () => {});

export const listDistHtml = async (distDir) => listFiles(distDir, ['.html']);

export const readDistPages = async (distDir, { onProgress } = {}) => {
  const files = await listDistHtml(distDir);
  const pages = [];
  for (const [index, filePath] of files.entries()) {
    const html = await readText(filePath);
    const dom = new JSDOM(html, { virtualConsole });
    const sets = extractRoleCharsets(dom.window.document);
    dom.window.close();
    const relative = path.relative(distDir, filePath).split(path.sep).join('/');
    pages.push({
      file: relative,
      url: `/${relative.replace(/index\.html$/, '')}`,
      roles: {
        text: setToSortedString(sets.text),
        textOnly: setToSortedString(sets.textOnly),
        display: setToSortedString(sets.display),
        meta: setToSortedString(sets.meta),
        brand: setToSortedString(sets.brand)
      },
      counts: {
        text: sets.text.size,
        textOnly: sets.textOnly.size,
        display: sets.display.size,
        meta: sets.meta.size,
        brand: sets.brand.size
      }
    });
    if (onProgress && (index + 1) % 50 === 0) onProgress(index + 1, files.length);
  }
  return { fileCount: files.length, pages };
};

/** 页面角色字符集合并（font:coverage 用）。 */
export const mergePageRoleCharsets = (pages) => {
  const merged = { text: new Set(), textOnly: new Set(), display: new Set(), meta: new Set(), brand: new Set() };
  for (const page of pages) {
    for (const key of Object.keys(merged)) {
      for (const ch of page.roles[key]) merged[key].add(ch);
    }
  }
  return merged;
};
