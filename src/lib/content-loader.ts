import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Loader, LoaderContext } from 'astro/loaders';
import { CONTENT_ROOT } from '../../site.config.mjs';
import { splitMarkdownFrontmatter } from './frontmatter';
import { readRawFrontmatter, resolveCollectionEntryFiles } from './content-entry-files';
import { getProjectRoot } from './project-root';

type EntryDirLoaderOptions = {
  collection: string;
  fixedPage?: {
    entryId: string;
    sourcePath: string;
  };
};

const WATCH_DEBOUNCE_MS = 120;

const toProjectRelativePath = (filePath: string): string =>
  path.relative(getProjectRoot(), filePath).replace(/\\/g, '/');

export const entryDirLoader = ({
  collection,
  fixedPage
}: EntryDirLoaderOptions): Loader => {
  const root = path.join(getProjectRoot(), CONTENT_ROOT, collection);
  let watcherAttached = false;
  let debounceTimer: NodeJS.Timeout | null = null;
  let syncChain: Promise<void> = Promise.resolve();

  const sync = async (context: LoaderContext): Promise<void> => {
    const files = await resolveCollectionEntryFiles(getProjectRoot(), root, fixedPage?.sourcePath);
    const untouched = new Set(context.store.keys());

    for (const { entryId, filePath } of files) {
      const source = await readFile(filePath, 'utf8');
      const section = splitMarkdownFrontmatter(source);
      const data = readRawFrontmatter(source);
      const fileUrl = pathToFileURL(filePath);
      const rendered = await context.renderMarkdown(source, { fileURL: fileUrl });
      const digest = context.generateDigest(source);
      const parsedData = await context.parseData({
        id: fixedPage?.entryId ?? entryId,
        data,
        filePath
      });

      untouched.delete(fixedPage?.entryId ?? entryId);
      context.store.set({
        id: fixedPage?.entryId ?? entryId,
        data: parsedData,
        body: section.bodyText,
        filePath: toProjectRelativePath(filePath),
        digest,
        rendered,
        ...(rendered.metadata?.imagePaths ? { assetImports: rendered.metadata.imagePaths } : {})
      });
    }

    for (const staleId of untouched) {
      context.store.delete(staleId);
    }
  };

  const enqueueSync = (context: LoaderContext): Promise<void> => {
    syncChain = syncChain
      .catch(() => undefined)
      .then(() => sync(context));
    return syncChain;
  };

  return {
    name: `entry-dir-loader:${collection}`,
    load: async (context) => {
      await enqueueSync(context);

      if (watcherAttached || !context.watcher) return;
      watcherAttached = true;
      context.watcher.add(root);
      context.watcher.on('all', (_event, changedPath) => {
        const normalized = path.resolve(changedPath);
        if (normalized !== root && !normalized.startsWith(`${root}${path.sep}`)) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          void enqueueSync(context).catch((error) => {
            context.logger.error(error instanceof Error ? error.message : String(error));
          });
        }, WATCH_DEBOUNCE_MS);
      });
    }
  };
};
