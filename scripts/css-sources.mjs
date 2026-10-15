import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// 构建产物里的样式源：dist/_astro 下的 CSS 与各页面内联 <style>。
// 返回顺序即加载顺序。
export const collectDistStyleSources = async (root) => {
  const sources = [];
  const astroDir = path.join(root, 'dist', '_astro');
  if (existsSync(astroDir)) {
    for (const name of (await readdir(astroDir)).sort()) {
      if (!name.endsWith('.css')) continue;
      sources.push({
        label: path.join('dist', '_astro', name),
        css: await readFile(path.join(astroDir, name), 'utf8')
      });
    }
  }

  const walkHtml = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkHtml(full);
        continue;
      }
      if (!entry.name.endsWith('.html')) continue;
      const html = await readFile(full, 'utf8');
      const styles = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi), (m) => m[1]).join('\n');
      if (styles.trim()) sources.push({ label: path.relative(root, full), css: styles });
    }
  };
  if (existsSync(path.join(root, 'dist'))) await walkHtml(path.join(root, 'dist'));

  return sources;
};

// 构建产物会把伪元素规范化为单冒号（lightningcss：::after → :after），
// 登记与查询统一用单冒号。
export const normalizePseudoSelector = (selector) =>
  selector.replace(/::(before|after|marker|placeholder)/g, ':$1');

// 按出现顺序展开全部声明（跨来源顺序 = 加载顺序，来源内 = 书写顺序）。
// selector 保持原文。
export const collectOrderedDeclarations = (sources) => {
  const ordered = [];
  for (const { css } of sources) {
    for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectorText = match[1].trim().replace(/\s+/g, ' ');
      if (!selectorText || selectorText.startsWith('@')) continue;
      for (const rawDecl of match[2].split(';')) {
        const decl = rawDecl.trim();
        const separator = decl.indexOf(':');
        if (separator <= 0) continue;
        const property = decl.slice(0, separator).trim();
        const value = decl.slice(separator + 1).trim();
        if (!property || !value) continue;
        for (const one of selectorText.split(',')) {
          const selector = one.trim();
          if (!selector) continue;
          ordered.push({ selector, property, value });
        }
      }
    }
  }
  return ordered;
};

// 选择器（单冒号规范化）→ 属性 → 值，同名后者覆盖前者。
export const toSelectorTable = (ordered) => {
  const table = new Map();
  for (const { selector, property, value } of ordered) {
    const key = normalizePseudoSelector(selector);
    if (!table.has(key)) table.set(key, new Map());
    table.get(key).set(property, value);
  }
  return table;
};

export const parsePx = (value) => {
  const match = /^(-?\d+(?:\.\d+)?)px$/.exec(value);
  return match ? Number(match[1]) : null;
};
