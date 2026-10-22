import { spawnSync } from 'node:child_process';

/* font:build：字体资产重建编排。
   顺序：font:fetch（缓存命中不联网）→ font:charset → build（取得 dist）→ font:roles → font:subset → 最终 build。
   说明：
   - dist 是角色字符集的唯一来源，roles 之前必须有一次完整构建；
   - subset 会改写生成 CSS，最终再构建一次让页面产物引用最新 CSS；
   - 维护者提交字体资产，CI 不运行 font:build。 */

const args = new Set(process.argv.slice(2));
const SKIP_FETCH = args.has('--skip-fetch');
const SKIP_BUILD = args.has('--skip-build');
const SKIP_FINAL_BUILD = args.has('--skip-final-build');

const run = (label, command, commandArgs) => {
  console.log(`\n[font:build] ===> ${label}: ${command} ${commandArgs.join(' ')}`);
  const result = spawnSync(command, commandArgs, { stdio: 'inherit' });
  if (result.error) {
    console.error(`[font:build] ${label} 启动失败: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[font:build] ${label} 失败（退出码 ${result.status}）`);
    process.exit(result.status ?? 1);
  }
};

const npm = (script, extraArgs = []) => {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  run(script, command, ['run', script, ...(extraArgs.length ? ['--', ...extraArgs] : [])]);
};

if (!SKIP_FETCH) npm('font:fetch');
else console.log('[font:build] 跳过 font:fetch（--skip-fetch）');

npm('font:charset');

if (!SKIP_BUILD) npm('build');
else console.log('[font:build] 跳过首次 build（--skip-build）：dist 必须已存在且最新');

npm('font:roles');
npm('font:subset');

if (!SKIP_FINAL_BUILD) npm('build');
else console.log('[font:build] 跳过最终 build（--skip-final-build）');

console.log('\n[font:build] 完成：提交 public/fonts/base|dlc、src/styles/fonts*.generated.css、tools/font-manifest.json、tools/charset-*.json/txt');
