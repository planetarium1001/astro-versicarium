import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

/* fontTools Python 环境：
   - 默认 /tmp/dsh-fontenv/bin/python（本任务约定的 fontTools/brotli 环境）
   - 可用 FONT_PYTHON 环境变量覆盖（CI/其他机器）
   - 也接受 PATH 里的 pyftsubset 所在环境的 python3 作为回退 */
export const DEFAULT_FONT_PYTHON = '/tmp/dsh-fontenv/bin/python';

export const resolveFontPython = () => {
  const candidates = [
    process.env.FONT_PYTHON,
    DEFAULT_FONT_PYTHON,
    'python3'
  ].filter(Boolean);
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['-c', 'import fontTools, brotli'], { stdio: 'pipe' });
    if (!probe.error && probe.status === 0) return candidate;
  }
  return null;
};

const failMissingPython = () => {
  console.error('[font] 缺少可用的 fontTools Python 环境');
  console.error('- 期望: FONT_PYTHON 或 /tmp/dsh-fontenv/bin/python，且已安装 fonttools + brotli');
  console.error('- 安装: python -m pip install "fonttools[woff]" brotli');
  console.error('- 验证: /tmp/dsh-fontenv/bin/python -c "import fontTools, brotli"');
  process.exit(1);
};

/**
 * 运行 scripts/font/font_ops.py。
 * @param {{ fontOpsPath: string, planPath: string, resultPath: string, cwd: string }} options
 */
export const runFontOps = ({ fontOpsPath, planPath, resultPath, cwd }) => {
  const python = resolveFontPython();
  if (!python) failMissingPython();
  if (!existsSync(fontOpsPath)) {
    console.error(`[font] 缺少 Python 助手: ${fontOpsPath}`);
    process.exit(1);
  }
  const startedAt = Date.now();
  const result = spawnSync(
    python,
    [fontOpsPath, '--plan', planPath, '--out', resultPath],
    { stdio: 'inherit', cwd, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }
  );
  if (result.error) {
    console.error(`[font] 运行 font_ops.py 失败: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[font] font_ops.py 退出码 ${result.status}`);
    process.exit(result.status ?? 1);
  }
  return { elapsedMs: Date.now() - startedAt, python };
};

/** 输出 npm scripts 可读的 Python 环境名（报告用）。 */
export const describeFontPython = () => {
  const python = resolveFontPython();
  return python ? path.basename(path.dirname(path.dirname(python))) + `/${path.basename(python)}` : '(missing)';
};
