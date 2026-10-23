/**
 * 仓库根目录的唯一实现。
 *
 * 测试可用 `ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT` 指向夹具目录，否则取 `process.cwd()`；
 * 全仓曾有 16 份逐字相同的副本。
 *
 * 这里刻意不 import `node:path`：`src/utils/site-timezone.ts` 会被编辑器 Svelte 岛间接引入，
 * 浏览器侧求值时不能出现 node 内置模块。路径拼接请在各自的服务端模块里用 `node:path`，
 * 或复用 `src/lib/admin-console/content-entry-source.ts` 的
 * `toAdminContentAbsoluteProjectPath` / `toAdminContentRelativeProjectPath`。
 */
export const getProjectRoot = (): string =>
  process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT?.trim() || process.cwd();
