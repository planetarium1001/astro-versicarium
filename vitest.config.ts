import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    preserveSymlinks: true
  },
  test: {
    environment: 'node',
    pool: 'threads',
    include: ['tests/**/*.test.ts'],
    // 管理端写入类用例会在临时目录建真实文件，并行 worker 抢占磁盘时单条可能超过默认 5s；
    // 15s 只用于兜住资源竞争，不放宽任何断言。
    testTimeout: 15000,
    hookTimeout: 15000
    // vitest 4 移除了 environmentMatchGlobs：需要 DOM 的用例在文件顶部写
    // `// @vitest-environment jsdom`。
  }
});
