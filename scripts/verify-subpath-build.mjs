#!/usr/bin/env node
/**
 * verify-subpath-build：以 GitHub Pages 项目页的子路径参数真实构建一次 dist，再运行
 * check-deployment-base 扫描。用于抓 `createWithBase()` 一类「部署 base 被拼两次」
 * 的回归——这类问题只在 base 非 '/' 时出现，CI 的根路径构建抓不到。
 *
 * 用法：npm run check:subpath
 */

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { checkDeploymentBase } from './check-deployment-base.mjs';

// 部署地址以 package.json 的 homepage 为准，避免仓库改名或换 owner 后守卫继续测旧路径而假通过；
// 需要临时验证别的子路径时用 ASTRO_VERSICARIUM_BASE_PATH / SITE_URL 覆盖。
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const homepage = new URL(pkg.homepage);
const SUBPATH_BASE = process.env.ASTRO_VERSICARIUM_BASE_PATH
  ?? (homepage.pathname.endsWith('/') ? homepage.pathname : `${homepage.pathname}/`);
const SITE_URL = process.env.SITE_URL ?? homepage.origin;

const runBuild = () =>
  new Promise((resolve, reject) => {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npmCommand, ['run', 'build'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        ASTRO_VERSICARIUM_BASE_PATH: SUBPATH_BASE,
        SITE_URL
      }
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`构建被信号 ${signal} 终止`));
      } else if (code !== 0) {
        reject(new Error(`构建失败，退出码 ${code}`));
      } else {
        resolve();
      }
    });
  });

const main = async () => {
  console.log(`[check:subpath] 以 ASTRO_VERSICARIUM_BASE_PATH=${SUBPATH_BASE} SITE_URL=${SITE_URL} 构建 dist`);
  await runBuild();

  const result = await checkDeploymentBase({ base: SUBPATH_BASE });
  if (!result.ok) {
    console.error('[check:subpath] 子路径构建产物校验失败');
    process.exit(1);
  }
};

try {
  await main();
} catch (error) {
  console.error(`[check:subpath] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
