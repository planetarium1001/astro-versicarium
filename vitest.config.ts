import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    preserveSymlinks: true
  },
  test: {
    environment: 'node',
    pool: 'threads',
    include: ['tests/**/*.test.ts']
    // vitest 4 移除了 environmentMatchGlobs：需要 DOM 的用例在文件顶部写
    // `// @vitest-environment jsdom`。
  }
});
