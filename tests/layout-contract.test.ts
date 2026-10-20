import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 只能在单位层守住的布局与交互不变量：类型检查、构建与 DOM 断言都覆盖不到。
 * jsdom 不做布局，端到端用例断言不了几何，因此直接读样式与组件源码做契约断言。
 */

const SRC = process.cwd();
const read = (relative: string) => readFile(path.join(SRC, relative), 'utf8');

const DEVLOG_CSS = 'src/styles/devlog-page.css';
const LAYOUT_CSS = 'src/styles/components/layout.css';
const ENTRY_TAGS_CSS = 'src/styles/components/entry-tags.css';
const TAG_HEADER_ASTRO = 'src/components/TagFilterHeader.astro';
const BASE_LAYOUT_ASTRO = 'src/layouts/BaseLayout.astro';

describe('页头：标题 + 两行块（tag 行 / 描述行）', () => {
  const ROW_SELECTOR = String.raw`\.page-header :is\(\.page-heading--tag-slot, \.page-heading--tag-bar\)`;

  it('tag 行与描述行都在第 2 列、行距 0，标题跨两行', async () => {
    const layout = await read(LAYOUT_CSS);
    const grid = /\.page-header \.page-heading--tag-bar\s*\{([^}]*)\}/.exec(layout)?.[1] ?? '';

    expect(grid).toContain('display: grid');
    // tag 行与描述行之间的观感要等于正文行距 → 不留额外行距
    expect(grid).toMatch(/row-gap:\s*0/);

    // 标题跨两行 → 「tag 行 + 描述行」作为一个整体与标题同行
    expect(layout).toMatch(
      new RegExp(`${ROW_SELECTOR} \\.page-title-row > \\.page-title\\s*\\{[^}]*grid-row:\\s*1 \\/ span 2`)
    );
    // 两行都落在第 2 列 → 左缘完全一致
    expect(layout).toMatch(
      new RegExp(`${ROW_SELECTOR} \\.page-title-row > \\.entry-tag-apply\\s*\\{[^}]*grid-column:\\s*2`)
    );
    expect(layout).toMatch(
      new RegExp(`${ROW_SELECTOR} \\.page-subtitle\\s*\\{[^}]*grid-column:\\s*2`)
    );
  });

  it('已选胶囊压到 20px 高（配合行距 0 才像相邻两行正文）', async () => {
    const entryTags = await read(ENTRY_TAGS_CSS);
    const chip = /\.entry-tag-chip\s*\{([^}]*)\}/.exec(entryTags)?.[1] ?? '';
    expect(chip).toMatch(/min-height:\s*20px/);
  });

  // 必须预留 tag 行的位置，否则选择 / 取消标签时描述行会跳动。页头只要有 tag 入口
  // 就锁成两行结构（服务端类 `page-heading--tag-slot`），未选中时第 1 行也占住胶囊高度。
  it('没选标签时也预留 tag 行高度（描述行不跳）', async () => {
    const [layout, header] = await Promise.all([read(LAYOUT_CSS), read(TAG_HEADER_ASTRO)]);

    // 服务端渲染的 slot 类
    expect(header).toMatch(/hasTagEntry && 'page-heading--tag-slot'/);
    // 预留行高
    expect(layout).toMatch(
      /\.page-header \.page-heading--tag-slot:not\(\.page-heading--tag-bar\)\s*\{[^}]*grid-template-rows:\s*var\(--page-tag-slot-height, 20px\) auto/
    );
  });

  // /blog/ /bits/ /archive/ 的页头带 `--with-search`，lists.css 的 0,3,0 规则会覆盖
  // display / align-items / gap，多出 12px 行距；必须用 0,4,0 把这三个属性抢回来。
  it('带搜索框的页头用 0,4,0 抢回 display / align-items / gap', async () => {
    const layout = await read(LAYOUT_CSS);
    const override =
      /\.page-header\.page-header--with-search \.page-heading\.page-heading--tag-bar\s*\{([^}]*)\}/.exec(layout)?.[1] ?? '';

    expect(override).toContain('display: grid');
    expect(override).toMatch(/align-items:\s*center/);
    expect(override).toMatch(/row-gap:\s*0/);
    expect(override).toMatch(/column-gap:\s*10px/);
    // 该 0,4,0 规则按「特异度 + 顺序」生效，必须排在文件里最后
    expect(layout.lastIndexOf('.page-heading.page-heading--tag-bar')).toBeGreaterThan(
      layout.lastIndexOf('.page-heading--tag-slot:not(')
    );
  });

  // 窄屏下 tag 块在标题行里底部对齐，与描述行之间保持宽屏那种行距；
  // 在剩余宽度内换行，标签多时回退成两行。
  it('窄屏：tag 块底部对齐并占满标题右侧的剩余宽度', async () => {
    const entryTags = await read(ENTRY_TAGS_CSS);
    const narrow = entryTags.slice(entryTags.indexOf('@media (max-width: 900px)'));

    expect(narrow).toMatch(/\.page-title-row\s*\{[^}]*width:\s*100%[^}]*align-items:\s*flex-end/);
    expect(narrow).toMatch(
      /\.entry-tag-apply\s*\{[^}]*flex:\s*1 1 0[^}]*min-width:\s*0[^}]*align-self:\s*flex-end/
    );
  });

  // 单行 tag 时胶囊底部要与标题底部齐平：标题的行盒先收紧（否则 body 的 1.75 行高
  // 会把胶囊顶得很低），胶囊再上抬一点。
  it('窄屏：标题行盒收紧 + 胶囊上抬，使胶囊底部与标题底部齐平', async () => {
    const entryTags = await read(ENTRY_TAGS_CSS);
    const narrow = entryTags.slice(entryTags.indexOf('@media (max-width: 900px)'));

    expect(narrow).toMatch(
      /\.page-header \.page-heading--tag-slot \.page-title\s*\{[^}]*line-height:\s*1\.15/
    );
    expect(narrow).toMatch(/\.entry-tag-apply\s*\{[^}]*margin-bottom:\s*0\.25rem/);
  });
});

describe('/devlog/：间距不变量', () => {
  it('正文上下边距 = 收缩状态条目行距的 1/2（同一 token 的 1× vs 2×）', async () => {
    const css = await read(DEVLOG_CSS);

    const padY = Number(/--devlog-row-pad-y:\s*([\d.]+)px/.exec(css)?.[1] ?? Number.NaN);
    expect(Number.isFinite(padY), '需要 --devlog-row-pad-y 这个 token').toBe(true);
    expect(padY).toBeGreaterThan(0);

    // 条目之间没有任何 margin/gap → 行距 = 上下 padding 之和 = 2 × padY
    expect(css).toMatch(/\.devlog-list\s*\{[^}]*gap:\s*0/);

    // 正文的上下边距 = 1/4 × 行距（= padY / 2）
    expect(css).toMatch(
      /\.devlog-panel__inner\s*\{[^}]*padding:\s*calc\(var\(--devlog-row-pad-y\) \/ 2\)[^;]*calc\(var\(--devlog-row-pad-y\) \/ 2\)/
    );
    // 摘要与正文之间不留额外间隙（靠行高形成正常行距）
    expect(css).toMatch(/\.devlog-panel__inner\s*\{[^}]*gap:\s*0/);

    // `.prose p` 自带 `margin: 12px 0`，首尾子元素必须归零，否则 5px 会被撑成 17px
    expect(css).toMatch(
      /\.devlog-panel__inner \.devlog-panel__prose > :first-child[\s\S]{0,180}?margin-block:\s*0/
    );
  });

  it('日期与项目名的间距收紧：日期列改 max-content + 列间距 ≤ 8px', async () => {
    const css = await read(DEVLOG_CSS);

    expect(css, '固定日期列宽已经删掉').not.toContain('--devlog-date-column');
    expect(css).toMatch(/grid-template-columns:\s*max-content auto auto minmax\(0,\s*1fr\) auto/);

    const gap = Number(/--devlog-gap:\s*([\d.]+)px/.exec(css)?.[1] ?? Number.NaN);
    expect(Number.isFinite(gap), '需要 --devlog-gap').toBe(true);
    expect(gap).toBeLessThanOrEqual(8);
  });
});

describe('/devlog/：摘要回退策略', () => {
  it('回退态隐藏全部摘要、正常态不重复显示正文里的摘要', async () => {
    const css = await read(DEVLOG_CSS);

    expect(css).toMatch(
      /\.devlog-list\[data-devlog-excerpts='fallback'\] \.devlog-row__description\s*\{[^}]*display:\s*none/
    );
    expect(css).toMatch(
      /\.devlog-list\[data-devlog-excerpts='inline'\] \.devlog-panel__summary\s*\{[^}]*display:\s*none/
    );
    // 不得使用容器查询逐条隐藏摘要：会让标题一起被压缩
    expect(css).not.toContain('@container');
  });

  it('判定脚本把「任何一条被压缩 → 整体回退」写在列表属性上（窄屏直接回退）', async () => {
    const script = await read('src/scripts/devlog-excerpts.ts');

    expect(script).toContain("list.dataset.devlogExcerpts");
    expect(script).toContain('scrollWidth > description.clientWidth + 1');
    expect(script).toMatch(/descriptions\.some\(/);
    expect(script).toContain('(max-width: 900px)');
    // 摘要在列表里放不下时，正文顶部的完整摘要要放开
    expect(script).toContain('summary.hidden = !fallback');
  });
});

describe('/devlog/：时间线收尾', () => {
  it('最后一条收起时线止于日期，展开后补上这一段并淡入淡出', async () => {
    const css = await read(DEVLOG_CSS);

    // 补丁挂在日期元素上：`top: 100%` 就是日期下沿，不用算行内 baseline 偏移
    expect(css).toMatch(
      /\.devlog-row:is\(:last-child, \.is-last-visible\) \.devlog-row__date::after\s*\{[^}]*top:\s*100%[^}]*width:\s*4px[^}]*background:\s*var\(--bg\)/
    );
    // 补丁裁在行内（不会溢到页脚）
    expect(css).toMatch(
      /\.devlog-row:is\(:last-child, \.is-last-visible\) \.devlog-row__toggle\s*\{[^}]*overflow:\s*hidden/
    );
    // 展开 → 补丁淡出（这一段线露出来）；收起 → 淡入（重新盖住）
    expect(css).toMatch(
      /\.devlog-row:is\(:last-child, \.is-last-visible\)\.is-open \.devlog-row__date::after\s*\{[^}]*opacity:\s*0/
    );
    expect(css).toMatch(/transition:\s*opacity 220ms ease/);
    // 减少动效时不播过渡
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.devlog-row:is\(:last-child, \.is-last-visible\) \.devlog-row__date::after/
    );

    // 按项目筛选后，新的「最后一条」也要收尾（脚本按计划结果同步打标记）
    const filterScript = await read('src/scripts/devlog-filter.ts');
    expect(filterScript).toContain("classList.toggle('is-last-visible'");
    expect(filterScript).toContain('reverse().find((row) => matches(row))');
  });
});

describe('/devlog/：摘要回退的过渡', () => {
  it('先淡出，再过渡正文行高并并行淡入摘要，两段时长都不低于下限', async () => {
    const script = await read('src/scripts/devlog-excerpts.ts');

    expect(script).toContain('FADE_MS');
    expect(script).toMatch(/\[\{ opacity: 1 \}, \{ opacity: 0 \}\]/);
    expect(script).toMatch(/\[\{ opacity: 0 \}, \{ opacity: 1 \}\]/);
    expect(script).toContain('prefers-reduced-motion');
    // 摘要淡出走完之后才落 hidden、才跑行高过渡
    expect(script).toContain('Promise.all(fadeOuts.map(');
    // 行高过渡要覆盖正文那一部分
    expect(script).toMatch(/const animateRowHeights = /);
    expect(script).toMatch(/\[\{ height: `\$\{from\}px` \}, \{ height: `\$\{to\}px` \}\]/);
    // 摘要文本并行淡入
    expect(script).toMatch(/const fadeSummariesIn = /);
    // 过渡整体时长下限
    const fade = Number(/const FADE_MS = (\d+)/.exec(script)?.[1] ?? 0);
    const reflow = Number(/const REFLOW_MS = (\d+)/.exec(script)?.[1] ?? 0);
    expect(fade).toBeGreaterThanOrEqual(260);
    expect(reflow).toBeGreaterThanOrEqual(300);
  });
});

describe('/devlog/：窄屏时间线与两行条目', () => {
  it('时间线保持逐行 + 逐面板可见，标题以时间线为左边距', async () => {
    const css = await read(DEVLOG_CSS);
    const narrow = css.slice(css.indexOf('@media (max-width: 900px)'));

    // 窄屏下行的线与面板的线都保持可见
    expect(narrow).not.toMatch(/\.devlog-row__toggle::before,[\s\S]{0,80}?display:\s*none/);
    expect(narrow).not.toContain('.devlog-list::before');

    // 标题缩进 = 线位置 + 线到内容的间隙 − 行自身左内边距
    expect(narrow).toMatch(
      /\.devlog-row__headline\s*\{[^}]*padding-left:\s*calc\(var\(--devlog-line-x\) \+ var\(--devlog-line-gutter\) - var\(--devlog-row-pad-x\)\)/
    );
    // 日期底色让线在日期处断开
    expect(css).toMatch(/\.devlog-row__date\s*\{[^}]*background:\s*var\(--bg\)/);
  });

  it('窄屏条目是两行：meta + 箭头一行、标题一行', async () => {
    const css = await read(DEVLOG_CSS);
    const narrow = css.slice(css.indexOf('@media (max-width: 900px)'));

    expect(narrow).toMatch(/\.devlog-row__action\s*\{[^}]*order:\s*0[^}]*margin-left:\s*auto/);
    expect(narrow).toMatch(/\.devlog-row__headline\s*\{[^}]*order:\s*1[^}]*flex:\s*1 0 100%/);
  });
});

describe('tag dialog：逻辑预览长胶囊（无搜索框）', () => {
  it('活动 dialog 不渲染筛选输入框', async () => {
    const [header, entryTags] = await Promise.all([read(TAG_HEADER_ASTRO), read(ENTRY_TAGS_CSS)]);

    expect(header).not.toContain('data-entry-tag-filter');
    expect(entryTags).not.toContain('.entry-tags-dialog__filter');
  });

  it('标题与标签列表之间有一行「长胶囊 + +//」，`+` `/` 在胶囊右边', async () => {
    const header = await read(TAG_HEADER_ASTRO);
    const row = /<div class="entry-tags-dialog__expression-row">([\s\S]*?)\n        <\/div>/.exec(header)?.[1] ?? '';

    expect(row, '需要新增的逻辑预览行').not.toBe('');
    const expressionAt = row.indexOf('data-entry-tag-expression');
    const modeAt = row.indexOf('entry-tags-dialog__mode');
    expect(expressionAt, '预览行里要有长胶囊').toBeGreaterThanOrEqual(0);
    expect(modeAt, '`+` `/` 开关要在这一行里').toBeGreaterThan(expressionAt);

    // 标题行的动作区只剩「清除筛选 + 关闭」
    const actions = /<div class="entry-tags-dialog__actions">([\s\S]*?)\n          <\/div>/.exec(header)?.[1] ?? '';
    expect(actions).not.toContain('entry-tags-dialog__mode');
    expect(actions).toContain('data-entry-tag-clear');
  });

  it('表达式渲染走纯函数模块（括号 + 淡入淡出）', async () => {
    const [script, entryTags] = await Promise.all([read('src/scripts/entry-search.ts'), read(ENTRY_TAGS_CSS)]);

    expect(script).toContain('buildExpressionTokens');
    expect(script).toContain('switchPendingOp');
    expect(entryTags).toMatch(/\.entry-tags-dialog__expression\s*\{[^}]*border-radius:\s*999px/);
    expect(entryTags).toMatch(/\.entry-tags-dialog__expression-chip\s*\{/);
  });
});

describe('窄屏站点标题宽度：后台百分比设置', () => {
  it('样式消费 CSS 变量，默认 35%', async () => {
    const layout = await read(LAYOUT_CSS);
    const narrowTitle =
      /:where\(body:not\(\.admin-page\)\) \.sidebar__title\s*\{([^}]*)\}/.exec(layout)?.[1] ?? '';

    expect(narrowTitle, '需要窄屏的 .sidebar__title 规则').not.toBe('');
    expect(narrowTitle).toMatch(/max-width:\s*var\(--site-title-max-inline,\s*35%\)/);
    // 动作按钮仍然贴右端（否则标题封顶后按钮会跑到中间）
    expect(layout).toMatch(
      /:where\(body:not\(\.admin-page\)\) \.sidebar-actions\s*\{[^}]*margin-left:\s*auto/
    );
  });

  it('BaseLayout 把设置写成 <html> 内联变量', async () => {
    const layout = await read(BASE_LAYOUT_ASTRO);
    expect(layout).toContain('--site-title-max-inline: ${siteTitleMaxPercent}%');
    expect(layout).toContain('settings.site.titleMaxPercent');
    expect(layout).toContain('style={htmlStyleOverride}');
  });
});

describe('窄屏覆盖规则的源码顺序', () => {
  it('窄屏顶栏覆盖排在基础规则之后，否则同特异性下会被覆盖', async () => {
    const layout = await read(LAYOUT_CSS);
    const baseTitle = layout.indexOf('\n.sidebar__title {');
    const baseActions = layout.indexOf('\n.sidebar-actions {');
    const override = layout.indexOf('窄屏顶栏的最终覆盖');

    expect(baseTitle, '需要基础 .sidebar__title 规则').toBeGreaterThan(-1);
    expect(baseActions, '需要基础 .sidebar-actions 规则').toBeGreaterThan(-1);
    expect(override, '需要文件末尾的窄屏顶栏最终覆盖').toBeGreaterThan(-1);
    expect(override).toBeGreaterThan(baseTitle);
    expect(override).toBeGreaterThan(baseActions);

    const block = layout.slice(override);
    expect(block).toMatch(/\.sidebar__title\s*\{[^}]*text-align:\s*left/);
    expect(block).toMatch(/\.sidebar-actions\s*\{[^}]*align-self:\s*start/);
  });

  it('窄屏表格覆盖排在基础表格规则之后', async () => {
    const prose = await read('src/styles/components/prose.css');
    const base = prose.indexOf('\n.prose table {');
    const override = prose.indexOf('.prose table {\n    display: block;');

    expect(base, '需要基础 .prose table 规则').toBeGreaterThan(-1);
    expect(override, '需要窄屏表格覆盖').toBeGreaterThan(-1);
    expect(override).toBeGreaterThan(base);
  });
});

describe('触屏设备：滚动条不占宽度，正文左右必须对称', () => {
  const TOUCH_QUERY = '@media (hover: none) and (pointer: coarse)';

  const touchBlock = (layout: string) => {
    const start = layout.indexOf(TOUCH_QUERY);
    return start === -1 ? '' : layout.slice(start, layout.indexOf('\n}\n', start));
  };

  it('触屏块取消滚动条槽补偿，两侧视觉间隙相等', async () => {
    const block = touchBlock(await read(LAYOUT_CSS));

    expect(block).toContain('--scrollbar-gutter-inline: 0px');
    expect(block).toMatch(/--page-inline:\s*var\(--page-gap-inline\)/);
  });

  it('触屏不为右下角浮动列预留整列右内边距', async () => {
    const layout = await read(LAYOUT_CSS);

    // 中屏的预留规则仍在，只由触屏块覆盖为对称值
    expect(layout).toContain('padding-right: max(calc(var(--pad-x) / 2)');
    expect(touchBlock(layout)).toContain('padding-right: var(--pad-x)');
  });

  it('窄屏内容区底部不留额外内边距，页脚贴底', async () => {
    const layout = await read(LAYOUT_CSS);

    expect(layout).not.toContain('calc(48px + env(safe-area-inset-bottom))');
    expect(layout).not.toContain('calc(56px + env(safe-area-inset-bottom))');
  });
});

describe('窄屏横向溢出：真实宽度约束与 clip 回退', () => {
  it('html 的滚动条槽位只对桌面生效，窄屏不得预留', async () => {
    const [globalCss, indexPage] = await Promise.all([
      read('src/styles/global.css'),
      read('src/pages/index.astro')
    ]);

    // 顶层 html 规则只管横向兜底，不能直接固定槽位
    const htmlBlock = /\nhtml\s*\{([^}]*)\}/.exec(globalCss)?.[1] ?? '';
    expect(htmlBlock).toContain('overflow-x: clip');
    expect(htmlBlock).not.toContain('scrollbar-gutter');

    // 槽位声明必须落在桌面断点内：窄屏单列铺满没有居中位移，槽位只会变成右侧空白
    expect(globalCss).toMatch(
      /@media \(min-width: 901px\)\s*\{\s*html\s*\{[^}]*scrollbar-gutter:\s*stable/
    );
    // 老内核的 overflow-y: scroll 退化同样只在桌面生效
    expect(globalCss).toMatch(
      /@supports not \(scrollbar-gutter: stable\)\s*\{\s*@media \(min-width: 901px\)\s*\{\s*html\s*\{[^}]*overflow-y:\s*scroll/
    );

    // 首页首屏快照必须同形，否则首屏会先闪一下右侧空白
    const snapshot = /String\.raw`([\s\S]*?)`\s*\]\s*\.join/.exec(indexPage)?.[1] ?? '';
    expect(snapshot).toMatch(
      /@media \(min-width: 901px\)\s*\{\s*html\s*\{[^}]*scrollbar-gutter:\s*stable/
    );
    expect(/\nhtml\s*\{([^}]*)\}/.exec(snapshot)?.[1] ?? '').not.toContain('scrollbar-gutter');
  });

  it('不支持 overflow: clip 的内核有 overflow-x: hidden 等效兜底', async () => {
    const [globalCss, indexPage] = await Promise.all([
      read('src/styles/global.css'),
      read('src/pages/index.astro')
    ]);

    const fallback = /@supports not \(overflow: clip\)\s*\{\s*html\s*\{[^}]*overflow-x:\s*hidden/;
    expect(globalCss).toMatch(fallback);
    // 首屏也要有：否则首屏在旧内核上仍可被横向拖动
    expect(/String\.raw`([\s\S]*?)`\s*\]\s*\.join/.exec(indexPage)?.[1] ?? '').toMatch(fallback);
  });

  // 根元素上的 overflow 不约束初始包含块：只写 html 时布局视口照样被真实溢出撑宽。
  // 窄屏没有 sticky 侧栏（.sidebar 是 static），兜底因此可以安全落在 body 上；
  // 桌面若给 body 加 overflow 会破坏 sticky 侧栏，所以必须限定在窄屏断点内。
  it('窄屏横向兜底落在 body，而不是只靠 html', async () => {
    const [globalCss, indexPage] = await Promise.all([
      read('src/styles/global.css'),
      read('src/pages/index.astro')
    ]);

    // global.css 要避开后台页，选择器带 body:not(.admin-page)
    const bodyClip = /@media \(max-width: 900px\)\s*\{\s*body:not\(\.admin-page\)\s*\{\s*overflow-x:\s*clip/;
    const bodyHidden = /@supports not \(overflow: clip\)\s*\{[\s\S]*?@media \(max-width: 900px\)\s*\{\s*body:not\(\.admin-page\)\s*\{\s*overflow-x:\s*hidden/;

    expect(globalCss, 'global.css 需要在窄屏给 body 加 clip 兜底').toMatch(bodyClip);
    expect(globalCss, 'global.css 需要窄屏 body 的 hidden 回退').toMatch(bodyHidden);

    // 首屏快照是首页专用、永远不是后台页：用裸 body（带 .admin- 会命中首屏产物守卫）
    const snapshot = /String\.raw`([\s\S]*?)`\s*\]\s*\.join/.exec(indexPage)?.[1] ?? '';
    const snapshotClip = /@media \(max-width: 900px\)\s*\{\s*body\s*\{\s*overflow-x:\s*clip/;
    const snapshotHidden = /@supports not \(overflow: clip\)\s*\{[\s\S]*?@media \(max-width: 900px\)\s*\{\s*body\s*\{\s*overflow-x:\s*hidden/;
    expect(snapshot, '首屏快照需要窄屏 body 的 clip 兜底').toMatch(snapshotClip);
    expect(snapshot, '首屏快照需要窄屏 body 的 hidden 回退').toMatch(snapshotHidden);
    // 与 check-production-artifacts 同义：首屏出现 .admin- 规则即说明快照混入了后台样式
    expect(snapshot, '首屏快照不得包含 .admin- 规则').not.toMatch(/\.admin-/);

    // 桌面不能给 body 加横向 overflow：会让 .sidebar 的 sticky 失效
    expect(globalCss).not.toMatch(
      /@media \(min-width: 901px\)\s*\{[^}]*body:not\(\.admin-page\)\s*\{[^}]*overflow-x/
    );
  });

  it('窄屏壳层有 max-width 上限，且用 100% 而不是 100vw', async () => {
    const [layoutCss, indexPage] = await Promise.all([
      read(LAYOUT_CSS),
      read('src/pages/index.astro')
    ]);

    // 单列壳层的上限取初始包含块：100vw 在移动端不含滚动条占位，会把壳层推出视口
    const shellRules = Array.from(
      layoutCss.matchAll(/:where\(body:not\(\.admin-page\)\) \.shell \{([^}]*)\}/g),
      (match) => match[1] ?? ''
    );
    const narrowShell = shellRules.find((body) => body.includes('grid-template-columns: 1fr')) ?? '';
    expect(narrowShell, '需要窄屏单列壳层规则').not.toBe('');
    // 注释里会提到 100vw 作为反例，断言只看声明
    const declarations = narrowShell.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(declarations).toMatch(/max-width:\s*100%;/);
    expect(declarations).not.toMatch(/100vw/);
    // 首屏快照同形
    const snapshot = /String\.raw`([\s\S]*?)`\s*\]\s*\.join/.exec(indexPage)?.[1] ?? '';
    expect(snapshot).toMatch(/\.shell \{[^}]*max-width:\s*100%;/);
  });
});

describe('后台概览：结构行窄屏不撑宽', () => {
  const OVERVIEW_CSS = 'src/styles/components/admin/overview.css';

  it('窄屏把结构行改成两行网格，桌面三列保持不变', async () => {
    const overview = await read(OVERVIEW_CSS);

    // 桌面三列（标签 104px + 条形 + 计数 max-content）的最小宽度超出窄屏可用宽度
    expect(overview).toMatch(
      /\.admin-site-overview__structure-row \{[^}]*grid-template-columns: 104px minmax\(96px, 1fr\) max-content/
    );

    // 窄屏必须存在覆盖，且不得沿用同一套三列
    const narrow = /@media \(max-width: 900px\) \{([\s\S]*?)\n\}/.exec(
      overview.slice(overview.indexOf('窄屏结构行'))
    )?.[1] ?? '';
    expect(narrow, '需要窄屏结构行覆盖').not.toBe('');
    expect(narrow).toMatch(
      /\.admin-site-overview__structure-row \{[^}]*grid-template-columns: minmax\(0, 1fr\) max-content/
    );
    expect(narrow).not.toContain('104px');
    // 条形独占第二行，计数列不再与它同排参与最小宽度计算
    expect(narrow).toMatch(
      /\.admin-site-overview__structure-bar \{[^}]*grid-column: 1 \/ -1/
    );
    // 覆盖必须排在基础三列规则之后，否则同特异性下会被覆盖
    expect(overview.indexOf('窄屏结构行')).toBeGreaterThan(
      overview.indexOf('grid-template-columns: 104px minmax(96px, 1fr) max-content')
    );
  });
});

describe('页面外缘间隙：后台 px 设置', () => {
  it('BaseLayout 把间隙与换算后的 --page-inline 写成 <html> 内联属性', async () => {
    const [layout, globalCss, themeSettings] = await Promise.all([
      read(BASE_LAYOUT_ASTRO),
      read('src/styles/global.css'),
      read('src/lib/theme-settings.ts')
    ]);

    // 内联的是解析后的数值（不在 CSS 里写 calc）：内联优先级高于 :root 与首屏 critical 快照
    expect(layout).toContain('settings.site.pageGapPx');
    expect(layout).toContain('--page-gap-inline: ${sitePageGapPx}px');
    expect(layout).toContain('--page-inline: ${pageInlinePx}px');
    expect(layout).toContain('const pageInlinePx = sitePageGapPx - SCROLLBAR_GUTTER_INLINE_PX');
    // 槽宽常量在共享的设置模块里只定义一次，注释指向 CSS token；公开布局不依赖后台模块
    expect(themeSettings).toContain('SCROLLBAR_GUTTER_INLINE_PX = 15');
    expect(themeSettings).toContain('--scrollbar-gutter-inline');
    expect(layout).not.toContain('admin-console/theme-shared');
    expect(globalCss).toMatch(/--scrollbar-gutter-inline:\s*15px/);
    // 窄屏把两侧内边距都覆写到 body，后代以 body 为准（内联的 html 值不参与）
    expect(globalCss).toMatch(
      /@media \(max-width: 900px\)[\s\S]*?body:not\(\.admin-page\)[\s\S]*?--page-gap-inline:\s*0px[\s\S]*?--page-inline:\s*0px/
    );
  });

  it('几何守卫从构建页面的 <html> 内联属性读生效值，并断言结束内边距 == 间隙 − 槽宽', async () => {
    const guard = await read('scripts/check-layout-geometry.mjs');

    // 生效值在 <html style> 上：:root 与 critical 快照里的 --page-inline 只是默认值
    expect(guard).toContain('readHtmlInlineVariables');
    expect(guard).toContain("path.join(root, 'dist', 'index.html')");
    expect(guard).toContain("'--page-gap-inline'");
    expect(guard).toMatch(/near\(O,\s*pageGap - gutter\)/);
    // 把手内边距随结构移到目录表头
    expect(guard).toContain("bySelector.get('.article-toc__rail-head')");
    // 比的是内容盒两侧的视觉间隙（起始内边距 == 结束内边距 + 槽宽）
    expect(guard).toMatch(/const rightInset = shellPadEnd \+ gutter;/);
  });

  it('壳层起始内边距取视觉间隙、结束内边距扣掉滚动条槽', async () => {
    const [layoutCss, critical] = await Promise.all([
      read('src/styles/components/layout.css'),
      read('src/pages/index.astro')
    ]);

    // 两侧都用 --page-inline 会让内容盒右缘比左缘多出一个槽的距离
    const shell = /padding-inline:\s*var\(--page-gap-inline\)\s*var\(--page-inline\);/g;
    expect(layoutCss.match(shell), '公开壳层与后台壳层都要按起始/结束分别取值').toHaveLength(2);
    // 首屏快照必须同形，否则首屏会跳一下
    expect(critical).toContain('padding-inline: var(--page-gap-inline) var(--page-inline);');
  });
});

describe('浮动列：后台可配的窄屏右缘距离与热区几何守卫', () => {
  it('守卫保留桌面断言，并校验窄屏只引用构建期内联变量', async () => {
    const guard = await read('scripts/check-layout-geometry.mjs');

    // 桌面既有断言不因窄屏改动而削弱
    expect(guard).toContain('const MIN_RAIL_INSET = 4;');
    expect(guard).toMatch(/near\(floatRight, railOffset\)/);
    expect(guard).toContain("bySelector.get('.float-stack')");
    expect(guard).toContain("bySelector.get('.article-toc__rail-head')");

    // 窄屏偏移必须来自后台设置：守卫检查 var() 形式与内联值范围
    expect(guard).toContain('NARROW_RAIL_OFFSET_DEFAULT = 6');
    expect(guard).toContain('NARROW_RAIL_OFFSET_MIN = 0');
    expect(guard).toContain('NARROW_RAIL_OFFSET_MAX = 32');
    expect(guard).toContain('NARROW_RAIL_VAR_RE');
    expect(guard).toMatch(/--rail-action-offset-narrow/);
    expect(guard).toMatch(/窄屏 --rail-action-offset 必须写成 var\(--rail-action-offset-narrow/);
    expect(guard).toContain('${NARROW_RAIL_OFFSET_MIN}–${NARROW_RAIL_OFFSET_MAX}');
    expect(guard).toContain('的整数 px');

    // 相邻 44px 热区的净空断言保留（交互改善的关键）
    expect(guard).toContain('const MIN_HIT_CLEARANCE = 2;');
    expect(guard).toContain('collectMediaBlocks');
    expect(guard).toMatch(/窄屏相邻热区中心距/);
  });

  it('窄屏覆盖写成 var(--rail-action-offset-narrow, 6px)，桌面仍是 6px', async () => {
    const [layoutCss, guard] = await Promise.all([
      read(LAYOUT_CSS),
      read('scripts/check-layout-geometry.mjs')
    ]);

    expect(layoutCss).toMatch(
      /\.float-stack\s*\{[^}]*right:\s*calc\(var\(--rail-action-offset\)/s
    );
    // 两处声明：:root 的桌面 6px + 窄屏对后台变量的引用
    expect(layoutCss.match(/--rail-action-offset:\s*[^;]+;/g), '桌面值 + 窄屏引用各一次').toHaveLength(2);
    expect(layoutCss).toMatch(/--rail-action-offset:\s*6px/);
    expect(layoutCss).toMatch(
      /@media \(max-width: 900px\) \{[\s\S]*?--rail-action-offset:\s*var\(--rail-action-offset-narrow,\s*6px\)/
    );

    // 窄屏断点仍有间距覆盖（12px）与热区内收
    const narrowFloatBlock =
      /@media \(max-width: 900px\) \{[\s\S]*?body:not\(\.admin-page\) \.float-stack \{([^}]*)\}/.exec(
        layoutCss
      )?.[1] ?? '';
    expect(narrowFloatBlock, '窄屏需要有 .float-stack 间距覆盖').not.toBe('');
    expect(narrowFloatBlock).toMatch(/gap:\s*12px/);

    // 守卫同时读 44px 热区下限，窄屏中心距要按它比较
    expect(guard).toContain("readPx('--tap-min-h')");
  });
});

describe('项目卡片与末尾链接行', () => {
  it('整卡可点、链接固定在右下角并抬到覆盖层之上，悬停下划线贴文字', async () => {
    const [card, links] = await Promise.all([
      read('src/styles/projects-page.css'),
      read('src/styles/components/trailing-links.css')
    ]);

    // 按钮的覆盖层铺满卡片（卡片是定位祖先），整卡可点
    expect(card).toMatch(/\.project-card\s*\{[^}]*position:\s*relative/);
    expect(card).toMatch(/\.project-card__main::after\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/);
    // 链接行固定在卡片右下角，并抬到覆盖层之上保持可点
    expect(card).toMatch(/\.project-card \.trailing-links\s*\{[^}]*margin-top:\s*auto/);
    expect(card).toMatch(/\.project-card \.trailing-links\s*\{[^}]*z-index:\s*1/);
    // 触控热区用覆盖层实现，视觉高度就是文字一行
    expect(links).toMatch(/\.trailing-links a::after\s*\{[^}]*height:\s*var\(--tap-min-h\)/);
    expect(links).not.toMatch(/\.trailing-links a\s*\{[^}]*min-height/);
    // 悬停下划线用 text-decoration 贴文字，不画在盒子底边
    expect(links).toMatch(/\.trailing-links a:hover[\s\S]{0,200}?text-decoration:\s*underline/);
    expect(links).toMatch(/\.prose \.trailing-links a\s*\{[^}]*border-bottom:\s*0/);
  });

  it('列数三档特调，多列时所有行等高且卡片撑满行高', async () => {
    const css = await read('src/styles/projects-page.css');

    // 窄屏一列、常规两列、极宽三列；不再用 auto-fit 无限增加列数
    expect(css).toMatch(/\.projects-page \.project-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(css).toMatch(
      /@media \(min-width: 760px\)\s*\{[^@]*?\.project-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
    );
    expect(css).toMatch(
      /@media \(min-width: 1500px\)\s*\{[^@]*?\.project-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/
    );
    expect(css).not.toContain('auto-fit');
    // grid-auto-rows: 1fr 让每一行都取最高卡片的高度；卡片 height: 100% 撑满行高
    expect(css).toMatch(
      /@media \(min-width: 760px\)\s*\{[^@]*?\.project-grid\s*\{[^}]*grid-auto-rows:\s*1fr/
    );
    expect(css).toMatch(/\.projects-page \.project-grid\s*\{[^}]*align-items:\s*stretch/);
    expect(css).toMatch(/\.project-card\s*\{[^}]*height:\s*100%/);
    expect(css).not.toMatch(/\.project-card\s*\{[^}]*max-height:\s*320px/);
  });

  it('展示图：可选字段渲染成与文字左对齐的缩略图', async () => {
    const [schema, page, css] = await Promise.all([
      read('src/content.config.ts'),
      read('src/pages/projects/index.astro'),
      read('src/styles/projects-page.css')
    ]);

    // 可选前置字段：icon 与 image 都走同一套内容图片 schema
    expect(schema).toMatch(
      /icon: createOptionalEntryImage\(image\),[\s\S]{0,200}?image: createOptionalEntryImage\(image\)/
    );
    expect(page).toContain('image: getContentImageSrc(entry.data.image),');
    // 卡片里与文字同列渲染，路径经 withBase 解析
    expect(page).toMatch(
      /card\.image \? \(\s*<span class="project-card__image">\s*<img src=\{withBase\(card\.image\)\}/
    );
    // 头部两列顶部对齐：图标在左，胶囊标题与小号副标题在右
    expect(css).toMatch(/\.project-card__head\s*\{[^}]*display:\s*flex[^}]*align-items:\s*flex-start/);
    expect(css).toMatch(/\.project-card__headings\s*\{[^}]*flex-direction:\s*column/);
    expect(css).toMatch(/\.project-card__title\s*\{[^}]*font-size:\s*16px/);
    expect(css).toMatch(/\.project-card__subtitle\s*\{[^}]*font-size:\s*12px/);
    // 正文容器用 flow-root 包住浮动，展示图左浮动、正文整体不被推右
    expect(css).toMatch(/\.project-card__main\s*\{[^}]*display:\s*block/);
    expect(css).toMatch(/\.project-card__body\s*\{[^}]*display:\s*flow-root/);
    expect(css).toMatch(/\.project-card__image\s*\{[^}]*float:\s*left/);
    // 固定框裁切，高度可预期
    expect(css).toMatch(/\.project-card__image img\s*\{[^}]*height:\s*96px[^}]*object-fit:\s*cover/);
    // 弹窗复用同一套图标样式与头部
    expect(css).toMatch(/\.project-card__icon,\s*\n\.project-dialog__icon\s*\{/);
    expect(page).toContain('<span class="project-dialog__icon">');
    expect(css).toMatch(/\.project-dialog__icon\s*\{[^}]*width:\s*44px/);

    // 头部在图标之后，展示图排在头部之后、文段之前，文段才会绕开它
    const iconIndex = page.indexOf('class="project-card__icon"');
    const titleIndex = page.indexOf('class="project-card__title-row"');
    const headEndIndex = page.indexOf('class="project-card__image"');
    const descIndex = page.indexOf('class="project-card__description"');
    expect(iconIndex).toBeGreaterThan(-1);
    expect(iconIndex).toBeLessThan(titleIndex);
    expect(titleIndex).toBeLessThan(headEndIndex);
    expect(headEndIndex).toBeLessThan(descIndex);
  });
});

describe('卡片弹窗：统一宽度与滚动区', () => {
  it('项目与动态的卡片弹窗共用同一份宽度 token', async () => {
    const [global, projects, bits] = await Promise.all([
      read('src/styles/global.css'),
      read('src/styles/projects-page.css'),
      read('src/styles/components/bit-card.css')
    ]);

    expect(global).toMatch(/--card-dialog-inline-size:\s*min\(920px, calc\(100vw - 64px\)\)/);
    expect(projects).toMatch(/\.project-dialog\s*\{[^}]*width:\s*var\(--card-dialog-inline-size\)/);
    expect(bits).toMatch(/\.bit-dialog\s*\{[^}]*width:\s*var\(--card-dialog-inline-size\)/);
    // 写死宽度会让两个页面的弹窗在同一视口下不等宽（宽屏上尤其明显）
    expect(projects).not.toMatch(/\.project-dialog\s*\{[^}]*width:\s*min\(/);
    expect(bits).not.toMatch(/\.bit-dialog\s*\{[^}]*width:\s*min\(/);
  });

  it('滚动区按需出现：末尾外边距归零，overflow 不用 scroll', async () => {
    const [projects, bits] = await Promise.all([
      read('src/styles/projects-page.css'),
      read('src/styles/components/bit-card.css')
    ]);

    // 内容放得下时不该出现滚动条：末尾元素折叠出来的外边距会算进滚动区
    expect(projects).toMatch(/\.project-dialog__content > :last-child[\s\S]{0,140}?\{[^}]*margin-bottom:\s*0/);
    expect(bits).toMatch(/\.bit-dialog__content > :last-child[\s\S]{0,140}?\{[^}]*margin-bottom:\s*0/);
    expect(projects).toMatch(/\.project-dialog__content\s*\{[^}]*overflow-y:\s*auto/);
    expect(bits).toMatch(/\.bit-dialog__content\s*\{[^}]*overflow-y:\s*auto/);
    expect(projects).not.toMatch(/overflow-y:\s*scroll/);
    expect(bits).not.toMatch(/overflow-y:\s*scroll/);
  });
});

describe('阅读模式与页脚位置', () => {
  it('阅读模式把左栏两列 token 收为 0，正文内边距沿用 --pad-x', async () => {
    const [layout, toc] = await Promise.all([
      read('src/styles/components/layout.css'),
      read('src/styles/components/article-toc.css')
    ]);

    // 收起左栏靠 token 归零：目录的栅格规则引用同一对 token，因此无需逐条覆写
    expect(layout).toMatch(
      /body\.immersive-page\[data-reading="immersive"\]\s*\{[^}]*--sidebar:\s*0px[^}]*--layout-divider-inline-size:\s*0px/
    );
    expect(toc).toMatch(
      /grid-template-columns:[\s\S]{0,140}?var\(--sidebar\)[\s\S]{0,100}?var\(--layout-divider-inline-size\)/
    );
    // 阅读模式的正文左右内边距跟随普通设计
    expect(layout).toMatch(
      /body\.immersive-page\[data-reading="immersive"\] \.content\s*\{[^}]*padding:\s*64px var\(--pad-x\)/
    );
  });

  it('页脚贴页面底部：内容区底部不留内边距（含后台），页脚自身顶到底部', async () => {
    const layout = await read('src/styles/components/layout.css');
    expect(layout).toMatch(/\.content\s*\{[^}]*padding-bottom:\s*0/);
    expect(layout).toMatch(/\.site-footer\s*\{[^}]*margin-top:\s*auto/);
  });
});

describe('文章目录列：右边界跟随页面外缘间隙', () => {
  it('列宽 = 文字区宽度 - --page-inline，补偿移到表头且收起态抵消', async () => {
    const css = await read('src/styles/components/article-toc.css');

    // 「文字区宽度」与「列宽」是两个变量：列右边界落在壳层内容盒右缘，左边界不随间隙变化
    expect(css).toMatch(/--article-toc-inline-size:\s*260px/);
    expect(css).toMatch(
      /--article-toc-column:\s*calc\(var\(--article-toc-inline-size\) - var\(--page-inline\)\)/
    );

    // 补偿放在表头：列不用负右外边距，右内边距归 0
    const rail = /^\.article-toc--rail\s*\{([^}]*)\}/m.exec(css)?.[1] ?? '';
    expect(rail, '需要 .article-toc--rail 规则').not.toBe('');
    expect(rail).toMatch(/margin-right:\s*0/);
    expect(rail).toMatch(/padding:\s*var\(--sidebar-padding-block\) 0 40px 0/);

    const head = /^\.article-toc__rail-head\s*\{([^}]*)\}/m.exec(css)?.[1] ?? '';
    expect(head, '需要 .article-toc__rail-head 规则').not.toBe('');
    expect(head).toMatch(/margin-right:\s*calc\(var\(--page-inline\) \* -1\)/);
    expect(head).toMatch(/padding-right:\s*var\(--rail-action-offset\)/);

    // 收起 / 入场态抵消表头补偿，把手位置与今天一致
    expect(css).toMatch(
      /:root\[data-toc-collapsed='true'\] \.article-toc__rail-head,[\s\S]*?:root\[data-toc-intro='true'\] \.article-toc__rail-head\s*\{[^}]*margin-right:\s*0[^}]*padding-right:\s*0/
    );
    // 收起态列宽仍压到把手宽；1024–1279 普通模式也常驻目录列，不再占位 0px
    expect(css).toMatch(/--article-toc-column:\s*var\(--article-toc-handle-column\)/);
    expect(css).toMatch(
      /@media \(min-width: 1024px\) and \(max-width: 1279\.98px\)[\s\S]*?clamp\(184px, 17vw, 220px\)/
    );
    expect(css).toMatch(
      /@media \(min-width: 1024px\) and \(max-width: 1279\.98px\)[\s\S]*?body\.immersive-page \.article-toc--rail\s*\{\s*display:\s*block/
    );
    expect(css).toMatch(
      /@media \(min-width: 1024px\) and \(max-width: 1279\.98px\)[\s\S]*?body\.immersive-page \.article-toc--inline\s*\{\s*display:\s*none/
    );
  });
});

describe('主题涟漪：按目标主题分类方向', () => {
  it('亮色从按钮中心扩散、暗色从四周向按钮中心收敛', async () => {
    const [script, globalCss] = await Promise.all([
      read('src/scripts/sidebar-theme.ts'),
      read('src/styles/global.css')
    ]);

    expect(script).toMatch(/const expanding = targetTheme === 'light'/);
    // 扩散：新快照 clip 从 0 到整圆；收敛：旧快照 clip 从整圆到 0
    expect(script).toMatch(/expanding\s*\?\s*\[circle\(0\), circle\(radius\)\]\s*:\s*\[circle\(radius\), circle\(0\)\]/);
    expect(script).toContain("'::view-transition-new(root)'");
    expect(script).toContain("'::view-transition-old(root)'");
    // 方向标记 + 过渡结束后清理
    expect(script).toContain("root.dataset[RIPPLE_ATTR] = expanding ? 'expand' : 'converge'");
    expect(script).toContain('clearRippleFlag');

    // 收敛方向必须把旧快照抬到新快照之上，否则裁掉旧快照的过程看不见
    expect(globalCss).toMatch(
      /:root\[data-theme-ripple='converge'\]::view-transition-old\(root\)\s*\{[^}]*z-index:\s*1/
    );
    expect(globalCss).toMatch(
      /:root\[data-theme-ripple='expand'\]::view-transition-new\(root\)\s*\{[^}]*z-index:\s*1/
    );
  });

  it('圆心取主题切换按钮中心，不跟随指针坐标', async () => {
    const script = await read('src/scripts/sidebar-theme.ts');

    expect(script).toMatch(/const rect = themeBtn\?\.getBoundingClientRect\(\)/);
    expect(script).toMatch(/x: rect\.left \+ rect\.width \/ 2, y: rect\.top \+ rect\.height \/ 2/);
    expect(script).not.toContain('event.clientX');
    expect(script).not.toContain('resolveRippleOrigin(event)');
  });

  it('有效主题未变时不跑涟漪，变化时按新有效主题定方向', async () => {
    const script = await read('src/scripts/sidebar-theme.ts');

    // 两边都取解析后的有效主题：跟随系统参与时同样只在有效主题变化时过渡
    expect(script).toMatch(/const currentTheme = resolveTheme\(activeThemeMode\)/);
    expect(script).toMatch(/const nextTheme = resolveTheme\(nextMode\)/);
    expect(script).toMatch(/if \(nextTheme === currentTheme\) \{\s*apply\(\);\s*return;\s*\}/);
    // 切到亮色 = 发散（expanding 为真），切到暗色 = 收缩（反向）
    expect(script).toMatch(/const expanding = targetTheme === 'light'/);
  });
});

describe('blog 列表卡：tag 可悬停点击', () => {
  it('卡片是 div + 拉伸链接，tag 是真链接（不能嵌套 <a>）', async () => {
    const [card, lists] = await Promise.all([
      read('src/components/BlogCard.astro'),
      read('src/styles/components/lists.css')
    ]);

    expect(card).toMatch(/<div\s+class="list-item list-item--link"/);
    expect(card).toContain('list-item__stretch');
    expect(card).toContain('tag tag--link');
    // 卡片内不能再有「外层 a 包住 tag a」这种非法嵌套
    expect(card).not.toMatch(/<a\s+class="list-item list-item--link"/);
    expect(lists).toMatch(/\.list-item__stretch::after\s*\{[^}]*position:\s*absolute/);
    expect(lists).toMatch(/\.list-item--link \.meta-line \.tag--link\s*\{[^}]*z-index:\s*1/);
  });
});

describe('后台设置行的排版', () => {
  it('页脚四项与站点标题、站点语言共用同一套两列网格，顺序为页脚信息在上', async () => {
    const [section, form] = await Promise.all([
      read('src/components/admin/AdminSiteSection.astro'),
      read('src/styles/components/admin/theme/form.css')
    ]);

    // 四项与「站点标题 / 站点语言」写法逐字一致：都是 .admin-grid 的直接子项，因此列与列对齐
    const gridField = (main: string) =>
      new RegExp(
        `\\n {4}<label class="admin-field">\\n {6}<span class="admin-label">\\n {8}<span class="admin-label__main">${main}</span>`
      ).test(section);
    for (const main of [
      '站点标题',
      '站点语言',
      '页脚年份',
      '页脚版权文案',
      '窄屏站点标题宽度',
      '页面外缘间隙'
    ]) {
      expect(gridField(main), `${main} 应是 .admin-grid 的直接子项`).toBe(true);
    }
    expect(section).not.toContain('admin-footer-row');
    // 页脚预览跨两列
    expect(section).toMatch(/\n {4}<div class="admin-field admin-field--full">\n {6}<p id="site-footer-preview"/);

    // 顺序：页脚年份 → 页脚版权文案 → 页脚预览 → 窄屏站点标题宽度 → 页面外缘间隙
    const order = [
      'id="site-footer-start-year"',
      'id="site-footer-copyright"',
      'id="site-footer-preview"',
      'id="site-title-max-percent"',
      'id="site-page-gap-px"'
    ].map((token) => section.indexOf(token));
    expect(order.every((index) => index >= 0), '四项与页脚预览都要在标记里').toBe(true);
    for (let index = 1; index < order.length; index += 1) {
      expect(order[index - 1], `${order[index - 1]} 应排在 ${order[index]} 之前`).toBeLessThan(order[index]!);
    }

    // 新字段的标签与提示：提示走 TS 常量，避免把非子集字符写进模板
    expect(section).toContain('页面外缘间隙');
    expect(section).toContain('{ADMIN_SITE_PAGE_GAP_HINT}');
    const themeShared = await read('src/lib/admin-console/theme-shared.ts');
    expect(themeShared).toContain('（px，最小 ${ADMIN_SITE_PAGE_GAP_MIN}；仅 901px 以上生效）');

    // 两列均分来自 .admin-grid
    expect(form).not.toContain('admin-footer-row');
    expect(form).toMatch(/\.admin-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    // 百分比与间隙输入框都很短
    expect(form).toMatch(/\.admin-field__control--percent\s*\{[^}]*width:\s*84px/);
    expect(form).toMatch(/\.admin-field__control--page-gap\s*\{[^}]*width:\s*84px/);
  });
});

describe('RSS 点击区域与 RSS 开关', () => {
  it('描述行放不下时整组回退两行，组内分隔符不参与命中', async () => {
    const css = await read(ENTRY_TAGS_CSS);

    // 描述与「计数 · RSS · 标签入口」是两个 flex 项：放得下并排，放不下整组换行。
    const container = /\.page-subtitle--entry-filters\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(container).toMatch(/display:\s*flex/);
    expect(container).toMatch(/flex-wrap:\s*wrap/);
    // 两组之间只留白；间距抽成变量，描述分隔点也按同一间距居中。
    expect(container).toMatch(/column-gap:\s*var\(--page-subtitle-gap\)/);

    // 描述可收缩并在自己的行内换行；计数组不收缩、不内部换行，从而整体回退到第二行。
    expect(css).toMatch(/\.page-subtitle__text\s*\{[^}]*flex:\s*0 1 auto/);
    expect(css).toMatch(/\.page-subtitle__meta\s*\{[^}]*flex:\s*0 0 auto/);
    expect(css).toMatch(/\.page-subtitle__meta\s*\{[^}]*white-space:\s*nowrap/);

    // 组内分隔符是生成内容且 pointer-events: none：伪元素不成为独立命中目标，
    // 但它仍属于所属链接的盒子，点击区比纯文字略宽，这是可接受的取舍。
    const sep = /\.page-subtitle__meta > \* \+ \*::before\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(sep).toMatch(/content:\s*"·"/);
    expect(sep).toMatch(/pointer-events:\s*none/);

    // 一行显示时描述点与 RSS / #标签 之间的点距必须一致：
    // 组间距 = 2 × 内部点单侧间距 + 「·」自身字宽（绝对定位不占布局宽度）。
    const dotWidthEm = Number(/--page-subtitle-dot-width:\s*([\d.]+)em/.exec(container)?.[1] ?? NaN);
    const gapBaseEm = Number(/--page-subtitle-gap:\s*calc\(([\d.]+)em/.exec(container)?.[1] ?? NaN);
    const sepMarginEm = Number(/margin:\s*0\s*([\d.]+)em/.exec(sep)?.[1] ?? NaN);
    expect(Number.isFinite(dotWidthEm), '需要声明「·」字宽变量').toBe(true);
    expect(Number.isFinite(gapBaseEm), '组间距需要写成 calc(<x>em + 点宽)').toBe(true);
    expect(Number.isFinite(sepMarginEm), '需要能解析内部点单侧间距').toBe(true);
    expect(gapBaseEm, '组间距两侧留白应与内部点间距一致').toBeCloseTo(sepMarginEm * 2, 3);

    // 窄屏 640 档同样要满足推导关系，防止只改桌面档造成两档漂移。
    const mobileStart = css.indexOf('@media (max-width: 640px)');
    const mobileBlock = mobileStart >= 0 ? css.slice(mobileStart) : '';
    const narrowGapBaseEm = Number(/--page-subtitle-gap:\s*calc\(([\d.]+)em/.exec(mobileBlock)?.[1] ?? NaN);
    const narrowSepMarginEm = Number(/margin:\s*0\s*([\d.]+)em/.exec(mobileBlock)?.[1] ?? NaN);
    expect(Number.isFinite(narrowGapBaseEm), '窄屏需要重新声明组间距').toBe(true);
    expect(Number.isFinite(narrowSepMarginEm), '窄屏需要重新声明内部点间距').toBe(true);
    expect(narrowGapBaseEm, '窄屏组间距两侧留白应与内部点间距一致').toBeCloseTo(narrowSepMarginEm * 2, 3);

    // 描述与计数组之间的「·」只在同一行显示，且必须是绝对定位：
    // 否则它的宽度会参与换行判定，出现“去掉点就放得下、放得下又加点”的抖动。
    // 点挂在计数组左侧、按组间间距的中点居中，不依赖「·」的字宽。
    const inlineDot =
      /\.page-subtitle--entry-filters\[data-meta-inline\]\s+\.page-subtitle__meta::before\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(inlineDot).toMatch(/content:\s*"·"/);
    expect(inlineDot).toMatch(/position:\s*absolute/);
    expect(inlineDot).toMatch(/pointer-events:\s*none/);
    expect(inlineDot).toMatch(/left:\s*calc\(var\(--page-subtitle-gap\)\s*\/\s*-2\)/);
    // 计数组内部不再用绝对定位的 ::after 画分隔符：换行时不会残留。
    expect(css).not.toMatch(/\.page-subtitle__item[^{]*::after/);
  });

  it('内页设置里 RSS 订阅 = 总开关 + 三页各自勾选（样式参考首页导语）', async () => {
    const [pageSection, blog, archive, bits, themeSettings, themeShared, codec] = await Promise.all([
      read('src/components/admin/AdminPageSection.astro'),
      read('src/components/BlogPageView.astro'),
      read('src/pages/archive/index.astro'),
      read('src/components/BitsPageView.astro'),
      read('src/lib/theme-settings.ts'),
      read('src/lib/admin-console/theme-shared.ts'),
      read('src/scripts/admin-console/form-codec.ts')
    ]);

    // 后台：单独一个 topic，总开关在标题行最右（`admin-label__toggle` = 首页导语那款「展示」）
    expect(pageSection).toMatch(/admin-subgroup--list-rss/);
    expect(pageSection).toMatch(
      /admin-label--split[\s\S]{0,600}?page-list-rss-enabled/
    );
    expect(pageSection).toMatch(/id="page-list-rss-enabled" type="checkbox"/);
    for (const page of ['blog', 'bits', 'archive']) {
      expect(pageSection).toContain(`id="page-list-rss-${page}"`);
    }
    expect(pageSection).toContain('id="page-list-rss-group"');

    // 数据层：总开关 + 三个页面各自一项，可规范化、可逐个校验
    expect(themeSettings).toMatch(/interface ListRssSettings[\s\S]{0,200}?enabled: boolean/);
    expect(themeShared).toMatch(/listRss: \{[\s\S]{0,200}?enabled:/);
    expect(themeShared).toContain('pushIssue(`page.listRss.${key}`');
    // 总开关关掉时三个勾选框置灰
    expect(codec).toContain('const syncListRssControls = (): void => {');
    expect(codec).toMatch(/input\.disabled = !enabled/);

    // 三页互不干扰：各自「总开关 ∧ 本页开关」
    expect(blog).toContain('page.listRss.enabled !== false && page.listRss.blog !== false');
    expect(bits).toContain('page.listRss.enabled !== false && page.listRss.bits !== false');
    expect(archive).toContain('page.listRss.enabled !== false && page.listRss.archive !== false');
  });
});

describe('#标签 与「切换标签」互斥', () => {
  it('hidden 属性真的隐藏（display:inline-flex 会压过 UA 的 [hidden]）', async () => {
    const css = await read(ENTRY_TAGS_CSS);
    expect(css).toMatch(
      /\.page-subtitle__item\[hidden\],[\s\S]{0,120}?\.page-subtitle__text\[hidden\],[\s\S]{0,120}?\.page-subtitle__actions\[hidden\]\s*\{[^}]*display:\s*none/
    );
  });
});

describe('项目弹窗的主次层级', () => {
  it('关闭按钮统一走 shared 样式、标题与副标题放大、正文不得大于标题', async () => {
    const [css, global] = await Promise.all([
      read('src/styles/projects-page.css'),
      read('src/styles/global.css')
    ]);

    // 视觉 32px、44px 热区由全局 [data-dialog-close] 提供；项目页只保留边距
    const close = /\.project-dialog__close\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(close).not.toMatch(/width:/);
    expect(close).not.toMatch(/font-size:/);
    expect(global).toMatch(/\[data-dialog-close\]\s*\{[^}]*width:\s*32px[^}]*height:\s*32px/);
    expect(global).toMatch(/\[data-dialog-close\]::before\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/);
    expect(global).toMatch(/\[data-dialog-close\]\[data-pointer-focus\]:focus\s*\{[^}]*outline:\s*none/);

    // 标题 / 副标题 / 类型胶囊放大
    const title = /\.project-dialog__title\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    const titleSize = Number(/font-size:\s*([\d.]+)px/.exec(title)?.[1] ?? 0);
    expect(titleSize).toBeGreaterThanOrEqual(21);
    expect(css).toMatch(/\.project-dialog__subtitle\s*\{[^}]*font-size:\s*14\.5px/);
    expect(css).toMatch(/\.project-dialog \.badge\s*\{[^}]*font-size:\s*13px/);

    // 正文 < 标题
    const prose = /\.project-dialog__prose\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    const proseSize = Number(/font-size:\s*([\d.]+)px/.exec(prose)?.[1] ?? 0);
    expect(proseSize).toBeGreaterThan(0);
    expect(proseSize).toBeLessThan(titleSize);
  });
});

describe('/devlog/ 条目的字号层级', () => {
  it('项目名最大最重、更新标题次之（不加粗）、摘要最小，且都用正文色', async () => {
    const css = await read(DEVLOG_CSS);

    const project = /\.devlog-row__project\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    const title = /\.devlog-row__title\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    const description = /\.devlog-row__description\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

    const projectSize = Number(/font-size:\s*([\d.]+)px/.exec(project)?.[1] ?? 0);
    const titleSize = Number(/font-size:\s*([\d.]+)px/.exec(title)?.[1] ?? 0);
    const descSize = Number(/font-size:\s*([\d.]+)px/.exec(description)?.[1] ?? 0);

    expect(projectSize).toBeGreaterThan(titleSize);
    expect(titleSize).toBeGreaterThan(descSize);
    // 项目名加粗、标题不加粗；两者都是纯文本色
    expect(project).toMatch(/font-weight:\s*600/);
    expect(project).toMatch(/color:\s*var\(--text\)/);
    expect(title).toMatch(/font-weight:\s*400/);
    expect(title).toMatch(/color:\s*var\(--text\)/);
  });
});

describe('涟漪过渡期间冻结滚动条配色', () => {
  it('过渡期间把 color-scheme 钉在旧主题，结束后交还 CSS', async () => {
    const script = await read('src/scripts/sidebar-theme.ts');

    expect(script).toMatch(/root\.style\.colorScheme = previousScheme/);
    expect(script).toMatch(/removeProperty\('color-scheme'\)/);
    // 清理函数在动画结束/失败两条路径都要跑到
    expect(script).toMatch(/animation\.finished\.then\(clearRippleFlag, clearRippleFlag\)/);
    expect(script).toMatch(/\.catch\(clearRippleFlag\)/);
  });
});

describe('/devlog/ 页头搜索', () => {
  it('页头打开搜索，过滤由 devlog-filter 一并负责（项目 ∧ 关键词）', async () => {
    const [page, script] = await Promise.all([
      read('src/pages/devlog/index.astro'),
      read('src/scripts/devlog-filter.ts')
    ]);

    expect(page).toContain('showSearch={true}');
    expect(page).toContain('searchPlaceholder="搜索：标题 / 摘要 / 项目"');
    // 搜索与项目筛选同时成立
    expect(script).toContain('matchesProject(row, activeValue) && matchesQuery(row, activeQuery)');
    expect(script).toContain('tokenizeSearchQuery');
    expect(script).toContain('runPlan');
  });
});

describe('归档 tag 的作用域与语义', () => {
  it('项目档不暴露标签入口，更新档只取项目名称，全部档不带项目集合的 tags', async () => {
    const [page, scopeScript, indexJson, entryScript, archiveLib] = await Promise.all([
      read('src/pages/archive/index.astro'),
      read('src/scripts/archive-scope.ts'),
      read('src/pages/archive/index.json.ts'),
      read('src/scripts/entry-search.ts'),
      read('src/lib/archive.ts')
    ]);

    // 取值域：项目版本行按项目显示名打标签，all 作用域由行数据推导
    expect(page).toMatch(/collectTagScopedSummary\('projects', projectRows, \(row\) => row\.tags\)/);
    expect(page).toMatch(/collectTagScopedSummary\('devlog', devlogs, \(entry\) => \[\s*entry\.data\.project\s*\]/);
    expect(page).toMatch(/collectTagScopedSummary\('all', rows, \(row\) => row\.tags\)/);
    // archive row 的 devlog tags 只取项目名称，不含 kind；index.json 直接复用 row.tags
    expect(archiveLib).toMatch(/tags: \[entry\.data\.project\]/);
    expect(archiveLib).not.toMatch(/tags: \[entry\.data\.project, entry\.data\.kind\]/);
    expect(indexJson).toMatch(/tags: row\.tags/);

    // 项目档与更新档都显示 tag 入口并称「项目」；不再隐藏
    expect(scopeScript).toContain('TAG_TRIGGER.hidden = false');
    expect(scopeScript).toMatch(/const noun = scope === 'projects' \|\| scope === 'devlog' \? '项目' : '标签'/);
    expect(scopeScript).toContain("ENTRY_ROOT.dataset.entryTagNoun = noun");
    // entry-search 读这个称谓来生成「切换项目 / 清除筛选」
    expect(entryScript).toMatch(/root\.dataset\.entryTagNoun/);
    expect(entryScript).toContain('createSelectedChipActions(tagNoun())');
  });
});

describe('归档条目固定排版「项目名: 标题 v2.0」', () => {
  it('归档行统一走 EntryTitleLine，冒号为半角冒号+空格，版本胶囊为淡色', async () => {
    const [page, css, display] = await Promise.all([
      read('src/pages/archive/index.astro'),
      read('src/styles/components/lists.css'),
      read('src/lib/entry-display.ts')
    ]);

    expect(page).toContain('<EntryTitleLine');
    expect(page).toContain('surface="archive"');
    expect(page).toContain('titleTag="span"');
    expect(page).toContain('kind={row.kind}');
    // 固定排版：devlog 项目名前缀 + ': ' + 标题；版本段只由显式 versionLabel 触发。
    expect(display).toContain("ENTRY_TITLE_COLON = ': '");
    expect(display).toMatch(/kind === 'devlog'/);
    expect(display).toMatch(/kind: 'version-label'/);
    // 项目名分隔符继承标题色，不额外抢层级
    expect(css).toMatch(/\.entry-title--archive \.entry-title__colon\s*\{[^}]*color:\s*inherit/);
    expect(css).toMatch(/\.entry-title .entry-title__version-label[\s\S]*?height:\s*var\(--entry-pill-height\)/);
  });
});

describe('首页导语链接选项', () => {
  it('标签选项使用 #归档标签，且选择框加宽', async () => {
    const [shared, form] = await Promise.all([
      read('src/lib/admin-console/theme-shared.ts'),
      read('src/styles/components/admin/theme/form.css')
    ]);

    expect(shared).toContain("label: '#归档标签'");
    expect(shared).not.toContain("label: '#标签'");
    const select = /\.admin-inline-builder__select\s*\{([^}]*)\}/.exec(form)?.[1] ?? '';
    const width = Number(/width:\s*(\d+)px/.exec(select)?.[1] ?? 0);
    expect(width).toBeGreaterThanOrEqual(110);
  });
});

describe('弹窗正文层级与宽屏面板间距', () => {
  it('项目弹窗正文（含各级标题）都小于弹窗标题，正文对齐描述字号', async () => {
    const css = await read('src/styles/projects-page.css');
    const titleSize = Number(
      /font-size:\s*([\d.]+)px/.exec(/\.project-dialog__title\s*\{([^}]*)\}/.exec(css)?.[1] ?? '')?.[1] ?? 0
    );
    const proseSize = Number(
      /font-size:\s*([\d.]+)px/.exec(/\.project-dialog__prose\s*\{([^}]*)\}/.exec(css)?.[1] ?? '')?.[1] ?? 0
    );
    const subtitleSize = Number(
      /font-size:\s*([\d.]+)px/.exec(/\.project-dialog__subtitle\s*\{([^}]*)\}/.exec(css)?.[1] ?? '')?.[1] ?? 0
    );
    expect(proseSize).toBe(subtitleSize);
    expect(proseSize).toBeLessThan(titleSize);

    for (const level of ['h1', 'h2', 'h3']) {
      // h3/h4 是合并选择器（`h3,\n h4 {`），中间要允许逗号与空白
      const block = new RegExp(`\\.project-dialog__prose ${level}[^{]*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
      const size = Number(/font-size:\s*([\d.]+)px/.exec(block)?.[1] ?? 0);
      expect(size, `${level} 必须小于弹窗标题`).toBeGreaterThan(proseSize);
      expect(size, `${level} 必须小于弹窗标题`).toBeLessThan(titleSize);
    }
  });

  it('宽屏行把 min-height 多出来的高度放到内容上方，使正文到标题的间距与窄屏一致', async () => {
    const css = await read(DEVLOG_CSS);
    const toggle = /\.devlog-row__toggle\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(toggle).toMatch(/align-content:\s*end/);
    // 首行上方多出的那一截用列表上边距补回来
    expect(css).toMatch(/\.devlog-list\s*\{[^}]*margin-top:\s*8px/);
  });
});

describe('胶囊条视觉规格', () => {
  it('不额外指定字体族、悬停不加底色', async () => {
    const css = await read('src/styles/components/scope-pills.css');
    const item = /\.scope-pills__item\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

    // 不指定 font-family，字体跟随正文
    expect(item).not.toContain('font-family');
    expect(item).toMatch(/font-size:\s*13px/);
    // 悬停只变色，不加底色；触屏点按后 :hover 会粘住，故规则必须再按输入模态门禁。
    const hoverMedia = /@media \(hover: hover\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    const hover =
      /:root:not\(\[data-input="touch"\]\) \.scope-pills__item:hover\s*\{([^}]*)\}/.exec(hoverMedia)?.[1] ?? '';
    expect(hover, '悬停规则需要在 (hover: hover) 内并按 data-input 门禁').not.toBe('');
    expect(hover).toMatch(/color:\s*var\(--text\)/);
    expect(hover).not.toContain('background');
  });

  it('暗色模式下滑块是深色浮起面（否则白底白字不可视）', async () => {
    const css = await read('src/styles/components/scope-pills.css');
    const dark = /:root\[data-theme='dark'\] \.scope-pills__cursor\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

    expect(dark, '需要暗色模式的滑块覆盖').not.toBe('');
    // 不能是「92% 白」那种几乎纯白的底
    expect(dark).not.toContain('#fff 92%');
    expect(dark).toMatch(/background:\s*color-mix\(in srgb, #fff 1[0-9]%, var\(--panel\)\)/);
  });
});

describe('目录展开/收起的正文右内边距', () => {
  it('展开时与左侧分割线留同样的间隙（--pad-x），收起时保持对称', async () => {
    const layout = await read(LAYOUT_CSS);

    // 收起态：不进入任何「展开」规则 → 基础 .content 的 `padding: 56px var(--pad-x)` 生效
    expect(layout).toMatch(/\.content\s*\{[^}]*padding:\s*56px var\(--pad-x\)/);

    // 中屏「正文内嵌目录」：仍然给浮动列留车道（不能被一起去掉）
    expect(layout).toMatch(
      /@media \(max-width: 1279\.98px\)\s*\{[\s\S]{0,300}?:root:not\(\[data-toc-collapsed='true'\]\) body\.immersive-page \.shell\[data-toc='true'\] \.content\s*\{[^}]*padding-right:\s*max\(/
    );

    // 1024–1280 目录常驻第 4 列（普通模式也生效）：间隙 = --pad-x（与左侧一致）
    expect(layout).toMatch(
      /@media \(min-width: 1024px\) and \(max-width: 1279\.98px\)\s*\{[\s\S]{0,300}?body\.immersive-page \.shell\[data-toc='true'\] \.content\s*\{[^}]*padding-right:\s*var\(--pad-x\)/
    );

    // ≥1280 展开态走基础规则的 --pad-x
    const wideBlock = /@media \(min-width: 1280px\)\s*\{([\s\S]*?)\n\}/.exec(
      layout.slice(layout.indexOf('内容区域'))
    )?.[1] ?? '';
    expect(wideBlock).not.toContain('padding-right');
  });
});

describe('目录标题字号与时间/kind 配色', () => {
  it('「本文目录」不小于目录条目字号（两种形态一致）', async () => {
    const css = await read('src/styles/components/article-toc.css');
    const base = Number(/\.article-toc\s*\{[^}]*font-size:\s*([\d.]+)px/.exec(css)?.[1] ?? 0);
    const title = Number(/\.article-toc__title\s*\{[^}]*font-size:\s*([\d.]+)px/.exec(css)?.[1] ?? 0);
    const inlineLabel = Number(
      /\.article-toc__summary-label\s*\{[^}]*font-size:\s*([\d.]+)px/.exec(css)?.[1] ?? 0
    );

    expect(base).toBeGreaterThan(0);
    expect(title, '目录标题不能比条目还小').toBeGreaterThanOrEqual(base);
    expect(inlineLabel).toBe(title);
  });

  it('/devlog/ 的日期与 kind 胶囊、/archive/ 的日期都用项目卡胶囊的可读配色', async () => {
    const [devlog, archive, lists] = await Promise.all([
      read(DEVLOG_CSS),
      read('src/styles/archive-page.css'),
      read('src/styles/components/lists.css')
    ]);

    // 项目卡胶囊的配色基准（.badge）
    // 行首锚定：`.list-item__row .badge { height: 24px }` 会先匹配到
    const badge = /^\.badge\s*\{([^}]*)\}/m.exec(lists)?.[1] ?? '';
    expect(badge).toMatch(/color:\s*var\(--muted\)/);

    // 日期使用 --muted
    const devlogDate = /\.devlog-row__date\s*\{([^}]*)\}/.exec(devlog)?.[1] ?? '';
    expect(devlogDate).toMatch(/color:\s*var\(--muted\)/);
    expect(devlogDate).not.toContain('var(--faint)');

    const archiveDate = /\.archive-timeline__date\s*\{([^}]*)\}/.exec(archive)?.[1] ?? '';
    expect(archiveDate).toMatch(/color:\s*var\(--muted\)/);
    expect(archiveDate).not.toContain('var(--faint)');

    // kind 胶囊与 .badge 的浅色/暗色配色一致
    const kind = /\.devlog-row__kind\s*\{([^}]*)\}/.exec(devlog)?.[1] ?? '';
    expect(kind).toMatch(/background:\s*#fafafa/);
    expect(kind).toMatch(/color:\s*var\(--muted\)/);
    expect(kind).toMatch(/border:\s*1px solid var\(--border\)/);
    expect(devlog).toMatch(
      /:root\[data-theme='dark'\] \.devlog-row__kind\s*\{[^}]*background:\s*#1f1f1f[^}]*border-color:\s*#3f3f3f/
    );
    // 与 .badge 的暗色覆盖一致
    expect(lists).toMatch(/:root\[data-theme="dark"\] \.badge\s*\{[^}]*background:\s*#1f1f1f[^}]*border-color:\s*#3f3f3f/);
  });
});

describe('主题台：文章元信息按语义分组', () => {
  it('日期 / 附加信息 / 列表卡片分成三组，组内换行且无横向滚动', async () => {
    const [section, form] = await Promise.all([
      read('src/components/admin/AdminPageSection.astro'),
      read('src/styles/components/admin/theme/form.css')
    ]);

    const group = /\.admin-meta-group\s*\{([^}]*)\}/.exec(form)?.[1] ?? '';
    expect(group).toContain('display: grid');
    expect(group).toMatch(/grid-template-columns:\s*84px minmax\(0,\s*1fr\)/);
    expect(group).not.toMatch(/overflow-x\s*:/);
    expect(group).not.toMatch(/nowrap/);

    const line = /\.admin-toggle-row-group__line\s*\{([^}]*)\}/.exec(form)?.[1] ?? '';
    expect(line).toContain('display: flex');
    expect(line).toMatch(/flex-wrap:\s*wrap/);
    expect(line).toMatch(/min-width:\s*0/);

    // 语义分组：日期（显示/前缀/模式/粒度）、附加信息（标签/字数/时长）、列表卡片（日期显示）
    expect(section.match(/class="admin-meta-group"/g) ?? []).toHaveLength(3);
    expect(section.match(/class="admin-toggle-row-group__line"/g) ?? []).toHaveLength(3);
    const labels = [...section.matchAll(/class="admin-meta-group__label">([^<]+)</g)].map((match) => match[1]);
    expect(labels).toEqual(['日期', '附加信息', '列表卡片']);
    // 日期组不再把「列表卡片日期」和详情附加信息混在一起
    expect(section).not.toContain('列表卡片日期');
  });
});
