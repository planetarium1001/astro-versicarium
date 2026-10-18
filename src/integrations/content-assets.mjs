import { existsSync, readdirSync, readFileSync, copyFileSync, mkdirSync, createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTENT_ROOT } from '../../site.config.mjs';
import {
  CONTENT_ASSET_URL_PREFIX,
  isAttachmentAssetPath,
  resolveContentAssetReference,
  stripBasePath
} from '../lib/content-asset-paths.mjs';

const ASSET_DIR_NAMES = new Set(['images', 'files', 'assets']);
const MARKDOWN_EXT_RE = /\.md$/i;
const MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

const getProjectRoot = () =>
  process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT?.trim() || process.cwd();

const getContentRoot = () => path.join(getProjectRoot(), CONTENT_ROOT);

const hasEntryMarker = (source) => /^---[\s\S]*?\bentry\s*:\s*true\b[\s\S]*?\n---/m.test(source);

const stripCodeFences = (source) =>
  source
    .replace(/^([ \t]*)(```|~~~)[\s\S]*?^\1\2[^\n]*$/gm, '')
    .replace(/`[^`\n]*`/g, '');

const MARKDOWN_LINK_RE = /(!?)\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const HTML_LINK_RE = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi;

const collectAttachmentPaths = () => {
  const contentRoot = getContentRoot();
  const paths = new Set();
  if (!existsSync(contentRoot)) return paths;

  const collections = readdirSync(contentRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => path.join(contentRoot, entry.name));

  for (const collectionRoot of collections) {
    const markdownFiles = collectMainMarkdownFilesSync(collectionRoot);
    for (const sourceFilePath of markdownFiles) {
      const source = stripCodeFences(readFileSync(sourceFilePath, 'utf8'));
      const references = [];
      for (const match of source.matchAll(MARKDOWN_LINK_RE)) {
        if (match[1] === '!') continue;
        references.push(match[3]);
      }
      for (const match of source.matchAll(HTML_LINK_RE)) {
        references.push(match[1]);
      }

      for (const reference of references) {
        const resolved = resolveContentAssetReference({
          reference,
          sourceFilePath,
          projectRoot: getProjectRoot(),
          contentRoot
        });
        if (!resolved || resolved.kind !== 'local') continue;
        if (!isAttachmentAssetPath(resolved.absolutePath)) continue;
        paths.add(resolved.absolutePath);
      }
    }
  }

  return paths;
};

// collectMainMarkdownFiles 的同步版本，供构建期扫描使用。
const collectMainMarkdownFilesSync = (directory, files = []) => {
  if (!existsSync(directory)) return files;
  const entries = readdirSync(directory, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && MARKDOWN_EXT_RE.test(entry.name))
    .map((entry) => path.join(directory, entry.name));

  if (markdownFiles.length > 0) {
    const indexFile = markdownFiles.find((file) => path.basename(file).toLowerCase() === 'index.md');
    if (indexFile) {
      files.push(indexFile);
    } else if (markdownFiles.length === 1) {
      files.push(markdownFiles[0]);
    } else {
      const marked = markdownFiles.filter((file) => hasEntryMarker(readFileSync(file, 'utf8')));
      if (marked.length === 1) files.push(marked[0]);
    }
    return files;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || ASSET_DIR_NAMES.has(entry.name)) continue;
    collectMainMarkdownFilesSync(path.join(directory, entry.name), files);
  }
  return files;
};

const copyReferencedAttachments = (distDirectory, logger) => {
  const contentRoot = getContentRoot();
  let copied = 0;
  for (const absolutePath of collectAttachmentPaths()) {
    const relativePath = path.relative(contentRoot, absolutePath).replace(/\\/g, '/');
    const targetPath = path.join(distDirectory, 'content-assets', ...relativePath.split('/'));
    try {
      mkdirSync(path.dirname(targetPath), { recursive: true });
      copyFileSync(absolutePath, targetPath);
      copied += 1;
    } catch (error) {
      logger.warn(`failed to copy content attachment ${relativePath}: ${error instanceof Error ? error.message : error}`);
    }
  }
  if (copied > 0) logger.info(`copied ${copied} referenced content attachment(s)`);
};

const createDevMiddleware = (base) => ({
  name: 'astro-whono:content-assets-dev',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      const url = new URL(req.url ?? '/', 'http://localhost');
      const pathname = stripBasePath(url.pathname, base);
      if (!pathname.startsWith(CONTENT_ASSET_URL_PREFIX)) return next();

      const relativePath = decodeURIComponent(pathname.slice(CONTENT_ASSET_URL_PREFIX.length));
      const segments = relativePath.split('/').filter(Boolean);
      if (segments.some((segment) => segment === '.' || segment === '..')) {
        res.statusCode = 400;
        res.end('Invalid content asset path');
        return;
      }

      const absolutePath = path.join(getContentRoot(), ...segments);
      if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
        res.statusCode = 404;
        res.end('Content asset not found');
        return;
      }

      res.setHeader('Content-Type', MIME_TYPES[path.extname(absolutePath).toLowerCase()] ?? 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      if (req.method === 'HEAD') {
        res.statusCode = 200;
        res.end();
        return;
      }
      createReadStream(absolutePath).pipe(res);
    });
  }
});

export const contentAssets = () => ({
  name: 'astro-whono:content-assets',
  hooks: {
    'astro:config:setup': ({ updateConfig, config }) => {
      updateConfig({
        vite: {
          plugins: [createDevMiddleware(config.base)]
        }
      });
    },
    'astro:build:done': ({ dir, logger }) => {
      copyReferencedAttachments(fileURLToPath(dir), logger);
    }
  }
});
