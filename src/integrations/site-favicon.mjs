import { copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAVICON_GENERATED_DIR, resolveFaviconProbePlan } from '../../scripts/favicon-shared.mjs';
import { getProjectRoot } from '../lib/project-root.ts';

/** `dist/` 里生成图标的位置，与 FAVICON_GENERATED_DIR 去掉 `public/` 前缀后一致。 */
const DIST_GENERATED_DIR = path.join('images', 'site', 'generated');

const stripBasePath = (pathname, base) => {
  if (!base || base === '/') return pathname;
  const prefix = base.endsWith('/') ? base.slice(0, -1) : base;
  if (pathname === prefix) return '/';
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
};

const sendNotFound = (req, res) => {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  if (req.method === 'HEAD') res.end();
  else res.end('Not found');
};

const createDevFaviconMiddleware = (plan, base) => ({
  name: 'astro-whono:site-favicon-dev',
  configureServer(server) {
    // 直接挂在 configureServer 里，先于 Vite 的 publicDir 静态中间件执行，
    // 才能拦住 public/ 下仍然存在的模板默认图标。
    server.middlewares.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      const url = new URL(req.url ?? '/', 'http://localhost');
      const entry = plan[stripBasePath(url.pathname, base)];
      if (!entry) return next();

      if (entry.remove) {
        sendNotFound(req, res);
        return;
      }

      const source = entry.generated
        ? path.join(getProjectRoot(), FAVICON_GENERATED_DIR, entry.generated)
        : entry.source;
      if (!source || !existsSync(source)) {
        sendNotFound(req, res);
        return;
      }

      const body = readFileSync(source);
      res.statusCode = 200;
      res.setHeader('Content-Type', entry.type);
      res.setHeader('Content-Length', String(body.byteLength));
      res.setHeader('Cache-Control', 'no-cache');
      res.end(req.method === 'HEAD' ? undefined : body);
    });
  }
});

/**
 * 把根路径图标计划应用到构建产物。
 *
 * 生成物缺失时移除目标文件而不是保留模板默认图标：宁可 404，也不让默认图标
 * 冒充用户配置的自定义图标。
 */
export const applyFaviconProbePlanToDist = (plan, distDirectory, logger = console) => {
  let replaced = 0;
  let removed = 0;

  for (const [urlPath, entry] of Object.entries(plan)) {
    const target = path.join(distDirectory, urlPath.replace(/^\/+/, ''));
    if (entry.remove) {
      if (existsSync(target)) {
        rmSync(target, { force: true });
        removed += 1;
      }
      continue;
    }

    const source = entry.generated
      ? path.join(distDirectory, DIST_GENERATED_DIR, entry.generated)
      : entry.source;
    if (!source || !existsSync(source)) {
      if (existsSync(target)) {
        rmSync(target, { force: true });
        removed += 1;
      }
      continue;
    }

    copyFileSync(source, target);
    replaced += 1;
  }

  if (replaced > 0 || removed > 0) {
    logger.info?.(`[site-favicon] 根图标已按自定义配置更新：替换 ${replaced}，移除 ${removed}`);
  }
};

export const siteFavicon = () => ({
  name: 'astro-whono:site-favicon',
  hooks: {
    'astro:config:setup': ({ config, updateConfig }) => {
      const plan = resolveFaviconProbePlan(getProjectRoot());
      if (!plan) return;
      updateConfig({ vite: { plugins: [createDevFaviconMiddleware(plan, config.base)] } });
    },
    'astro:build:done': ({ dir, logger }) => {
      const plan = resolveFaviconProbePlan(getProjectRoot());
      if (!plan) return;
      applyFaviconProbePlanToDist(plan, fileURLToPath(dir), logger);
    }
  }
});
