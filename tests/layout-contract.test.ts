import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 只能在单位层守住的布局与交互不变量：这些值改一个数字或改一处结构就会悄悄回退，
 * 而类型检查、构建与 DOM 断言都看不出来。jsdom 不做布局，端到端用例断言不了几何，
 * 因此按 article-toc-client.test.ts 的既有做法直接读样式与组件源码做契约断言。
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

  // /blog/ /bits/ /archive/ 的页头带 `--with-search`，lists.css 里 0,3,0 的规则会覆盖
  // display / align-items / gap（align-items: baseline + gap: 12px），使这几页的
  // tag 行与描述行之间比 /devlog/ 多出 12px。必须用 0,4,0 把这三个属性一起抢回来。
  it('带搜索框的页头用 0,4,0 抢回 display / align-items / gap', async () => {
    const layout = await read(LAYOUT_CSS);
    const override =
      /\.page-header\.page-header--with-search \.page-heading\.page-heading--tag-bar\s*\{([^}]*)\}/.exec(layout)?.[1] ?? '';

    expect(override).toContain('display: grid');
    expect(override).toMatch(/align-items:\s*center/);
    expect(override).toMatch(/row-gap:\s*0/);
    expect(override).toMatch(/column-gap:\s*10px/);
    // G5 守卫按「特异度 + 顺序」判定，这条 0,4,0 必须排在文件里最后
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

describe('/devlog/：摘要全局一刀切', () => {
  it('回退态隐藏全部摘要、正常态不重复显示正文里的摘要', async () => {
    const css = await read(DEVLOG_CSS);

    expect(css).toMatch(
      /\.devlog-list\[data-devlog-excerpts='fallback'\] \.devlog-row__description\s*\{[^}]*display:\s*none/
    );
    expect(css).toMatch(
      /\.devlog-list\[data-devlog-excerpts='inline'\] \.devlog-panel__summary\s*\{[^}]*display:\s*none/
    );
    // 上一轮的「容器查询逐条藏摘要」已经删掉（它会让标题也被压缩）
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

describe('/devlog/：摘要一刀切的过渡', () => {
  it('先淡出 → 再过渡行高（正文范围）+ 并行淡入正文摘要，时间比原来长', async () => {
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
    // 过渡整体比原来更长（原来 180ms）
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

    // 行的线与面板的线都不再被关掉（上一轮的「整块盖住」方案已推翻）
    expect(narrow).not.toMatch(/\.devlog-row__toggle::before,[\s\S]{0,80}?display:\s*none/);
    expect(narrow).not.toContain('.devlog-list::before');

    // 标题缩进 = 线位置 + 线到内容的间隙 − 行自身左内边距
    expect(narrow).toMatch(
      /\.devlog-row__headline\s*\{[^}]*padding-left:\s*calc\(var\(--devlog-line-x\) \+ var\(--devlog-line-gutter\) - var\(--devlog-row-pad-x\)\)/
    );
    // 日期底色让线在日期处断开（节点观感）
    expect(css).toMatch(/\.devlog-row__date\s*\{[^}]*background:\s*var\(--bg\)/);
  });

  it('窄屏条目是两行：meta + 箭头一行、标题一行', async () => {
    const css = await read(DEVLOG_CSS);
    const narrow = css.slice(css.indexOf('@media (max-width: 900px)'));

    expect(narrow).toMatch(/\.devlog-row__action\s*\{[^}]*order:\s*0[^}]*margin-left:\s*auto/);
    expect(narrow).toMatch(/\.devlog-row__headline\s*\{[^}]*order:\s*1[^}]*flex:\s*1 0 100%/);
  });
});

describe('tag dialog：搜索框已删、逻辑预览长胶囊', () => {
  it('活动 dialog 里不再渲染筛选输入框', async () => {
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

describe('主题涟漪：按目标主题分类方向', () => {
  it('亮色从点击处扩散、暗色从四周向点击处收敛', async () => {
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

describe('后台页脚那一行的排版', () => {
  it('页脚年份 / 窄屏站点标题宽度 / 页脚版权文案同一行，空隙均分', async () => {
    const [section, form] = await Promise.all([
      read('src/components/admin/AdminSiteSection.astro'),
      read('src/styles/components/admin/theme/form.css')
    ]);

    // 三个格子在同一个 flex 行里，顺序 = 年份 → 宽度 → 版权
    const row = /<div class="admin-field admin-field--full admin-footer-row">([\s\S]*?)<\/div>\n/.exec(section)?.[1] ?? '';
    expect(row, '需要 admin-footer-row').not.toBe('');
    const order = ['--year', '--percent', '--copyright'].map((suffix) => row.indexOf(suffix));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order[0]).toBeLessThan(order[1]!);
    expect(order[1]).toBeLessThan(order[2]!);

    const rowCss = /\.admin-footer-row\s*\{([^}]*)\}/.exec(form)?.[1] ?? '';
    expect(rowCss).toMatch(/justify-content:\s*space-between/);
    expect(rowCss).toMatch(/flex-wrap:\s*wrap/);
    // 版权先换行；宽度格子被顶到行右端（`margin-left: auto`）
    expect(form).toMatch(/\.admin-footer-row__cell--copyright\s*\{[^}]*flex:\s*0 1 260px/);
    expect(form).toMatch(/\.admin-footer-row__cell--percent\s*\{[^}]*margin-left:\s*auto/);
    // 百分比输入框很短
    expect(form).toMatch(/\.admin-field__control--percent\s*\{[^}]*width:\s*84px/);
  });
});

describe('RSS 点击区域与 RSS 开关', () => {
  it('可点元素右侧的「·」不吃点击（原来点 RSS 右边那个点也会触发 RSS）', async () => {
    const css = await read(ENTRY_TAGS_CSS);

    // 分隔符绝对定位 + pointer-events: none，链接的点击盒子只剩文字
    const sep =
      /\.page-subtitle__item:not\(\[hidden\]\):has\(~ \.page-subtitle__item:not\(\[hidden\]\)\)::after\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(sep).toMatch(/position:\s*absolute/);
    expect(sep).toMatch(/pointer-events:\s*none/);
    // 间距改由元素自身的 margin 提供（否则两段会贴在一起）
    expect(css).toMatch(/\.page-subtitle__item:not\(:last-child\)\s*\{[^}]*margin-right:\s*1\.1em/);
    // 纯文本那段（不可点）保持行内分隔符，但只在后面还有可见项时才画：
    // hidden 的兄弟不算，否则末尾会多出一个孤零零的「·」
    expect(css).toMatch(
      /\.page-subtitle__text:has\(~ \.page-subtitle__item:not\(\[hidden\]\)\)::after\s*\{[^}]*content:\s*"·"/
    );
    expect(css).toMatch(
      /\.page-subtitle__item:not\(\[hidden\]\):has\(~ \.page-subtitle__item:not\(\[hidden\]\)\)::after/
    );
    expect(css).not.toMatch(/\.page-subtitle__text:not\(:last-child\)::after/);
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

describe('#标签 与「切换标签」不再同时出现', () => {
  it('hidden 属性真的隐藏（display:inline-flex 会压过 UA 的 [hidden]）', async () => {
    const css = await read(ENTRY_TAGS_CSS);
    expect(css).toMatch(
      /\.page-subtitle__item\[hidden\],[\s\S]{0,120}?\.page-subtitle__text\[hidden\],[\s\S]{0,120}?\.page-subtitle__actions\[hidden\]\s*\{[^}]*display:\s*none/
    );
  });
});

describe('项目弹窗的主次层级', () => {
  it('关闭按钮更小、标题与副标题放大、正文不得大于标题', async () => {
    const css = await read('src/styles/projects-page.css');

    // 关闭按钮缩小（44px 热区保留）
    const close = /\.project-dialog__close\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(close).toMatch(/font-size:\s*15px/);
    expect(close).toMatch(/width:\s*var\(--tap-min-h\)/);
    expect(close).toMatch(/border:\s*0/);
    expect(close).toMatch(/background:\s*transparent/);

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

describe('/devlog/ 增加搜索', () => {
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
  it('项目档不再暴露标签入口，更新档只取项目名称，全部档不带项目集合的 tags', async () => {
    const [page, scopeScript, indexJson, entryScript] = await Promise.all([
      read('src/pages/archive/index.astro'),
      read('src/scripts/archive-scope.ts'),
      read('src/pages/archive/index.json.ts'),
      read('src/scripts/entry-search.ts')
    ]);

    // 取值域
    expect(page).toMatch(/const projectTags: TagSummary\[\] = \[\];/);
    expect(page).toMatch(/collectTagScopedSummary\('devlog', devlogs, \(entry\) => \[\s*entry\.data\.project\s*\]/);
    expect(page).toMatch(/collectTagScopedSummary\(\s*'all',\s*\[\s*\.\.\.blogs,\s*\.\.\.devlogs\s*\]/);
    // index.json 的 devlog tags 也不再含 kind
    expect(indexJson).toMatch(/tags: \[entry\.data\.project\]/);
    expect(indexJson).not.toMatch(/tags: \[entry\.data\.project, entry\.data\.kind\]/);

    // 项目档隐藏 tag 入口；更新档把入口与标题改成「项目」
    expect(scopeScript).toMatch(/TAG_TRIGGER\.hidden = isProjects/);
    expect(scopeScript).toMatch(/const noun = scope === 'devlog' \? '项目' : '标签'/);
    expect(scopeScript).toContain("ENTRY_ROOT.dataset.entryTagNoun = noun");
    // entry-search 读这个称谓来生成「切换项目 / 清除筛选」
    expect(entryScript).toMatch(/root\.dataset\.entryTagNoun/);
    expect(entryScript).toContain('createSelectedChipActions(tagNoun())');
  });
});

describe('归档的更新行补「项目名：」', () => {
  it('devlog 行在标题前渲染项目名，样式用 muted 不抢标题', async () => {
    const [page, css] = await Promise.all([
      read('src/pages/archive/index.astro'),
      read('src/styles/archive-page.css')
    ]);

    expect(page).toMatch(/row\.kind === 'devlog' && row\.project/);
    expect(page).toContain('archive-timeline__project');
    expect(page).toMatch(/project: entry\.data\.project/);
    // 半角冒号，冒号后一个空格
    expect(page).toMatch(/\$\{row\.project\}: `/);
    // 项目名不再单独着色 → 与标题一起继承链接色，悬停时整体变成同一个高亮色
    expect(css).toMatch(/\.archive-timeline__project\s*\{[^}]*color:\s*inherit/);
  });
});

describe('首页导语链接选项', () => {
  it('标签选项改名为 #归档标签，且选择框加宽', async () => {
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

describe('胶囊条严格照搬原「絮语」设计', () => {
  it('不额外指定字体族、悬停不加底色', async () => {
    const css = await read('src/styles/components/scope-pills.css');
    const item = /\.scope-pills__item\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

    // 原实现没有 font-family（跟随页面正文字体）
    expect(item).not.toContain('font-family');
    expect(item).toMatch(/font-size:\s*13px/);
    // 悬停只变色，不加底色
    const hover = /\.scope-pills__item:hover,[\s\S]{0,80}?\{([^}]*)\}/.exec(css)?.[1] ?? '';
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

    // 1024–1280 阅读模式（目录进了第 4 列）：间隙 = --pad-x（与左侧一致）
    expect(layout).toMatch(
      /@media \(min-width: 1024px\) and \(max-width: 1279\.98px\)\s*\{[\s\S]{0,300}?body\.immersive-page\[data-reading='immersive'\] \.shell\[data-toc='true'\] \.content\s*\{[^}]*padding-right:\s*var\(--pad-x\)/
    );

    // ≥1280 展开态不再有「归零 / 车道」覆写 → 走基础规则的 --pad-x
    const wideBlock = /@media \(min-width: 1280px\)\s*\{([\s\S]*?)\n\}/.exec(
      layout.slice(layout.indexOf('内容区域'))
    )?.[1] ?? '';
    expect(wideBlock).not.toContain('padding-right');
  });
});

describe('最后两条微调：目录标题字号 + 时间/kind 可读性', () => {
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

    // 日期：不再用 --faint
    const devlogDate = /\.devlog-row__date\s*\{([^}]*)\}/.exec(devlog)?.[1] ?? '';
    expect(devlogDate).toMatch(/color:\s*var\(--muted\)/);
    expect(devlogDate).not.toContain('var(--faint)');

    const archiveDate = /\.archive-timeline__date\s*\{([^}]*)\}/.exec(archive)?.[1] ?? '';
    expect(archiveDate).toMatch(/color:\s*var\(--muted\)/);
    expect(archiveDate).not.toContain('var(--faint)');

    // kind 胶囊：照搬 .badge 的浅色/暗色配色
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
