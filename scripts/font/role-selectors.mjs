/* 角色字符集选择器：唯一来源。
   dist HTML 的角色提取（scripts/font-roles.mjs）与测试共用本模块；新增 600/copy 场景时只改这里。
   选择器对应 CSS 中实际使用 --font-readable（400/600）与 --font-copy 的文本容器：
   - display：600 字重场景（标题、加粗、表头、列表标题等）
   - meta：--font-copy 场景（meta 行、引用、导语、注释、标签、目录等）
   - brand：品牌名/侧栏标题/引言，字符并入 text 集合（默认 brand 是系统字体，不单独生成 face）
   - text：其余可见文本（正文） */

export const ROLE_SELECTORS = {
  display: {
    description: '600 字重场景：标题、加粗、表头、列表标题、徽章、末尾链接',
    selectors: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'strong',
      'b',
      'th',
      '.callout-title',
      '.list-item__title',
      '.entry-title__project',
      '.entry-title__version-name',
      '.entry-title__badge',
      '.badge',
      '.trailing-links a',
      '.project-card__title',
      '.section-title',
      '.archive-group__label',
      '.version-drawer__title',
      '.friend-card__name',
      '.scope-pills__item.is-active',
      '.page-subtitle__action',
      '.admin-label__main',
      '.admin-subtitle__main',
      '.admin-banner__title',
      '.admin-content-module__head h3'
    ]
  },
  meta: {
    description: '--font-copy 场景：meta 行、引用、导语、注释、标签、目录、图注',
    selectors: [
      'time',
      '.bit-meta',
      '.meta-line',
      '.page-subtitle',
      '.intro',
      '.note',
      '.prose blockquote',
      'blockquote',
      'cite',
      'q',
      '.prose figure > figcaption',
      '.about-body',
      '.qa-question',
      '.qa-answer',
      '.friend-card__description',
      '.view-stats',
      '.article-toc',
      '.prose .callout',
      '.list-item__excerpt',
      '.entry-tags',
      '.entry-tag-option',
      '.pagination__status',
      '.entry-search-feedback',
      '.lightbox-meta',
      '.nav .nav-ornament',
      '.bit-body-hint',
      '.bit-media-more',
      '.bits-search input',
      '.entry-tags-dialog__hint'
    ]
  },
  brand: {
    description: '品牌名/侧栏标题/引言：字符并入 text 集合',
    selectors: ['.sidebar__title-text', '.sidebar__title', '.site-title', '.brand', '.intro--serif']
  }
};

/** 提取时排除的容器：不参与任何角色的可见文本。 */
export const TEXT_EXCLUDE_SELECTORS = ['script', 'style', 'noscript', 'template', 'svg', 'head', 'title'];

/** 合并选择器为单个 matches() 字符串。 */
export const selectorGroup = (role) => ROLE_SELECTORS[role].selectors.join(',');

/** 角色优先级：文本节点归属最内层匹配的角色；display > meta > brand > text。 */
export const ROLE_PRIORITY = ['display', 'meta', 'brand'];
