import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 涟漪圆心与半径只能在源码层守住：jsdom 没有 View Transition 伪元素，
 * 真机 DPR、浏览器 UI 造成的快照原点偏移也无法在单测里复现，
 * 因此直接对脚本源码做契约断言，防止退回 px 圆心、按视口对角线算半径，
 * 或让浏览器 UI 偏移补偿失去钳制。
 */

const SOURCE = 'src/scripts/sidebar-theme.ts';
const read = () => readFile(path.join(process.cwd(), SOURCE), 'utf8');

describe('主题涟漪：圆心换算到快照坐标系', () => {
  it('圆心按伪元素参考盒的百分比写在 at 位置，不再出现 px 长度的 at 写法', async () => {
    const script = await read();

    // clip-path 的百分比由浏览器在 snapshot containing block 上解析，
    // 绕开部分内核在伪元素里解析 px 长度时的偏移。
    expect(script).toMatch(/const x = origin\.x \+ offset\.x;/);
    expect(script).toMatch(/const y = origin\.y \+ offset\.y;/);
    expect(script).toMatch(/x: \(x \/ box\.width\) \* 100/);
    expect(script).toMatch(/y: \(y \/ box\.height\) \* 100/);
    expect(script).toMatch(/circle\(\$\{percent\}% at \$\{center\.x\}% \$\{center\.y\}%\)/);
    expect(script).not.toContain('px at');
    expect(script).not.toContain('Math.ceil');
  });

  it('参考盒尺寸取自被动画的伪元素，读不到时回退到视口尺寸', async () => {
    const script = await read();

    expect(script).toMatch(
      /const pseudo = expanding \? '::view-transition-new\(root\)' : '::view-transition-old\(root\)';/
    );
    expect(script).toMatch(/readRippleReferenceBox\(pseudo\)/);
    expect(script).toContain('return { width: window.innerWidth, height: window.innerHeight };');
  });

  it('矩形量不到时仍回退到视口顶部中点', async () => {
    const script = await read();

    expect(script).toContain('const rect = themeBtn?.getBoundingClientRect();');
    expect(script).toMatch(/x: rect\.left \+ rect\.width \/ 2, y: rect\.top \+ rect\.height \/ 2/);
    expect(script).toContain('return { x: window.innerWidth / 2, y: 0 };');
  });
});

describe('主题涟漪：浏览器 UI 偏移补偿', () => {
  it('快照原点偏移从命名快照 group 的位移读出', async () => {
    const script = await read();

    // 伪元素的参考盒是 snapshot containing block；命名快照 group 的位移按规范
    // 以同一坐标系为基准，减去元素视口坐标即为原点偏移。
    expect(script).toMatch(/::view-transition-group\(\$\{RIPPLE_PROBE_NAME\}\)/);
    expect(script).toMatch(/translateX - origin\.x/);
    expect(script).toMatch(/translateY - origin\.y/);
    expect(script).toMatch(/session\.probe = createRippleProbe\(origin\);/);
  });

  it('连续切换时只有最新一次涟漪能恢复共享状态', async () => {
    const script = await read();

    expect(script).toMatch(/if \(activeRipple !== session\) return;/);
    expect(script).toMatch(/if \(activeRipple\) endRippleSession\(activeRipple\);/);
    expect(script).toMatch(/activeRipple = session;/);
  });

  it('探针在新旧快照拍摄前插入，过渡结束后移除', async () => {
    const script = await read();

    // 探针若在 startViewTransition 之后才插入，group 不存在，偏移会退化为 0。
    const probeIndex = script.indexOf('createRippleProbe(origin)');
    const transitionIndex = script.indexOf('startViewTransition(apply)');
    expect(probeIndex).toBeGreaterThan(-1);
    expect(transitionIndex).toBeGreaterThan(probeIndex);
    expect(script).toMatch(/session\.probe\?\.remove\(\)/);
  });

  it('补偿量钳制在 0–160 CSS px，不做设备像素比修正', async () => {
    const script = await read();

    expect(script).toMatch(/RIPPLE_ORIGIN_OFFSET_LIMIT_PX = 160/);
    expect(script).toMatch(
      /Math\.min\(Math\.max\(value, 0\), RIPPLE_ORIGIN_OFFSET_LIMIT_PX\)/
    );
    expect(script).not.toMatch(/devicePixelRatio/);
    expect(script).not.toContain('Math.hypot');
  });

  it('读数异常或 group 缺失时按 0 处理，不移动圆心', async () => {
    const script = await read();

    expect(script).toMatch(/if \(!match\) return \{ x: 0, y: 0 \};/);
    expect(script).toMatch(/if \(values\.length !== 6\) return \{ x: 0, y: 0 \};/);
    expect(script).toMatch(/translateX === undefined \|\| translateY === undefined/);
    expect(script).toMatch(/Number\.isFinite\(translateX\) \|\| !Number\.isFinite\(translateY\)/);
  });
});

describe('主题涟漪：半径覆盖全视口', () => {
  it('半径是 150% 百分比，扩散与收缩互为反向', async () => {
    const script = await read();

    // circle() 的百分比半径按参考盒 sqrt(w²+h²)/√2 解析，150% 可从任意圆心覆盖视口。
    expect(script).toMatch(/const radius = 150;/);
    expect(script).toMatch(
      /expanding\s*\?\s*\[circle\(0\), circle\(radius\)\]\s*:\s*\[circle\(radius\), circle\(0\)\]/
    );
  });

  it('不再按视口对角线计算 px 半径，也不留死代码', async () => {
    const script = await read();

    expect(script).not.toMatch(/window\.innerWidth - x/);
    expect(script).not.toMatch(/const radius = Math\./);
  });
});

describe('主题涟漪：方向与回退路径', () => {
  it('expand 只动画新快照、converge 只动画旧快照', async () => {
    const script = await read();

    expect(script).toMatch(/const expanding = targetTheme === 'light'/);
    expect(script).toMatch(
      /pseudoElement: expanding\s*\?\s*'::view-transition-new\(root\)'\s*:\s*'::view-transition-old\(root\)'/
    );
    expect(script).toContain("root.dataset[RIPPLE_ATTR] = expanding ? 'expand' : 'converge'");
  });

  it('偏好减少动效时直接切换；结束后清理标记并交还 color-scheme', async () => {
    const script = await read();

    expect(script).toMatch(
      /if \(!startViewTransition \|\| prefersReducedMotion\(\)\) \{\s*apply\(\);/
    );
    expect(script).toContain('root.style.colorScheme = previousScheme');
    expect(script).toMatch(/if \(session\.previousDirection === undefined\) delete root\.dataset\[RIPPLE_ATTR\]/);
    expect(script).toMatch(/animation\.finished\.then\(clearRippleFlag, clearRippleFlag\)/);
    expect(script).toMatch(/\.catch\(clearRippleFlag\)/);
  });
});
