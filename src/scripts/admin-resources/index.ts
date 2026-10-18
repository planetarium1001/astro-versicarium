import {
  MEDIA_FILE_ICON_PATHS,
  getMediaFileExtension,
  resolveMediaFileVisual,
  type MediaFileIcon
} from '../../lib/admin-console/media-file-visual';

type ResourceKind = 'image' | 'file';
type ReferenceStatus = 'referenced' | 'unreferenced' | 'orphan';
type ViewMode = 'grid' | 'list';

type FilterOption = {
  value: string;
  label: string;
  count: number;
  collection?: string;
  series?: string;
  entryId?: string;
};

type MediaItem = {
  path: string;
  origin: 'content' | 'public';
  kind: ResourceKind;
  fileName: string;
  mimeType: string | null;
  size: number;
  mtimeMs: number | null;
  collection: string;
  series: string;
  seriesLabel: string;
  version: string;
  versionLabel: string;
  entryId: string;
  entryLabel: string;
  hasSeries: boolean;
  entryExists: boolean;
  directory: string;
  referenceCount: number;
  referenced: boolean;
  referenceStatus: ReferenceStatus;
  previewSrc: string | null;
};

type TreeNode = {
  id: string;
  kind: 'collection' | 'series' | 'version' | 'directory';
  label: string;
  count: number;
  imageCount: number;
  fileCount: number;
  orphanCount: number;
  collection: string;
  series: string;
  version: string;
  entryId: string;
  directory: string;
  children: TreeNode[];
};

type Breadcrumb = {
  id: string;
  label: string;
  filters: {
    collection?: string;
    series?: string;
    entry?: string;
    directory?: string;
  };
};

type ListResult = {
  items: MediaItem[];
  page: number;
  totalPages: number;
  totalCount: number;
  tree: TreeNode[];
  breadcrumb: Breadcrumb[];
  options?: {
    series?: FilterOption[];
    versions?: FilterOption[];
    directories?: FilterOption[];
  };
};

type State = {
  collection: string;
  series: string;
  entry: string;
  dir: string;
  ref: '' | ReferenceStatus;
  type: '' | ResourceKind;
  from: string;
  to: string;
  q: string;
  page: number;
  view: ViewMode;
};

const REFERENCE_LABELS: Record<ReferenceStatus, string> = {
  referenced: '已引用',
  unreferenced: '未引用',
  orphan: '孤儿'
};

const COLLECTION_LABELS: Record<string, string> = {
  blog: '博客',
  projects: '项目',
  bits: '动态',
  devlog: '更新',
  about: '关于'
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getPayload = (value: unknown): Record<string, unknown> | null =>
  isRecord(value) ? value : null;

const normalize = (value: string): string => value.trim().toLowerCase();

const fuzzyScore = (label: string, query: string): number => {
  const haystack = normalize(label);
  const needle = normalize(query);
  if (!needle) return 0;
  const direct = haystack.indexOf(needle);
  if (direct >= 0) return 100 + Math.max(0, 40 - direct);
  let cursor = 0;
  let gaps = 0;
  for (const character of needle) {
    const found = haystack.indexOf(character, cursor);
    if (found < 0) return -1;
    gaps += found - cursor;
    cursor = found + 1;
  }
  return Math.max(1, 60 - gaps);
};

const formatSize = (size: number): string => {
  if (!size || size <= 0) return '大小未知';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatTime = (mtimeMs: number | null): string => {
  if (!mtimeMs) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(mtimeMs));
};

const getCollectionLabel = (collection: string): string =>
  COLLECTION_LABELS[collection] ?? collection;

const TEXT_PREVIEW_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'mdx', 'json', 'yml', 'yaml', 'csv', 'tsv',
  'log', 'toml', 'xml', 'html', 'css', 'js', 'ts', 'sh'
]);

const getItemValue = (item: MediaItem): string => {
  if (item.path.startsWith('content/')) {
    const prefix = `content/${item.collection}/${item.entryId}/`;
    const relative = item.path.startsWith(prefix) ? item.path.slice(prefix.length) : item.path;
    return relative.startsWith('./') ? relative : `./${relative}`;
  }
  if (item.path.startsWith('public/')) return `/${item.path.slice('public/'.length)}`;
  return item.path;
};

const getMarkdownReference = (item: MediaItem): string =>
  item.kind === 'image'
    ? `![${item.fileName}](${getItemValue(item)})`
    : `[${item.fileName}](${getItemValue(item)})`;

class ResourceCombobox {
  readonly root: HTMLElement;
  readonly input: HTMLInputElement;
  readonly hidden: HTMLInputElement;
  readonly menu: HTMLUListElement;
  readonly clear: HTMLButtonElement;
  readonly label: string;
  private options: FilterOption[] = [];
  private selected = '';
  private onSelect: (option: FilterOption | null) => void;
  private activeIndex = 0;

  constructor(root: HTMLElement, label: string, onSelect: (option: FilterOption | null) => void) {
    this.root = root;
    this.label = label;
    this.onSelect = onSelect;
    this.input = root.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    this.hidden = root.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    this.menu = root.querySelector<HTMLUListElement>('.resources-combobox__menu')!;
    this.clear = root.querySelector<HTMLButtonElement>('.resources-combobox__clear')!;

    this.input.addEventListener('focus', () => this.open());
    this.input.addEventListener('input', () => {
      this.hidden.value = '';
      this.selected = '';
      this.clear.hidden = true;
      this.open();
    });
    this.input.addEventListener('keydown', (event) => this.onKeyDown(event));
    this.input.addEventListener('change', () => this.commitRaw());
    this.clear.addEventListener('click', () => {
      this.input.value = '';
      this.hidden.value = '';
      this.selected = '';
      this.clear.hidden = true;
      this.close();
      this.onSelect(null);
    });
    document.addEventListener('click', (event) => {
      if (this.root.contains(event.target as Node)) return;
      this.close();
    });
  }

  setOptions(options: readonly FilterOption[], value: string): void {
    this.options = [...options];
    this.selected = value;
    const current = this.options.find((option) => option.value === value);
    this.input.value = current?.label ?? value;
    this.hidden.value = value;
    this.clear.hidden = !value;
  }

  private getFiltered(): FilterOption[] {
    const query = this.input.value.trim();
    if (this.hidden.value && query === (this.options.find((option) => option.value === this.selected)?.label ?? this.selected)) {
      return this.options;
    }
    return this.options
      .map((option) => ({
        option,
        score: fuzzyScore(`${option.label} ${option.series ?? ''} ${option.entryId ?? ''}`, query)
      }))
      .filter((entry) => entry.score >= 0)
      .sort((left, right) => right.score - left.score || left.option.label.localeCompare(right.option.label, 'zh-CN'))
      .slice(0, 10)
      .map((entry) => entry.option);
  }

  private open(): void {
    const filtered = this.getFiltered();
    this.menu.replaceChildren();
    if (filtered.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'resources-combobox__empty';
      empty.textContent = '没有匹配项，可直接输入后回车';
      this.menu.append(empty);
    } else {
      filtered.forEach((option, index) => {
        const item = document.createElement('li');
        item.className = 'resources-combobox__option';
        item.role = 'option';
        item.dataset.value = option.value;
        item.setAttribute('aria-selected', index === this.activeIndex ? 'true' : 'false');
        const label = document.createElement('span');
        label.className = 'resources-combobox__option-label';
        label.textContent = option.label;
        const meta = document.createElement('span');
        meta.className = 'resources-combobox__option-meta';
        meta.textContent = [option.series, option.entryId, `${option.count} 个文件`].filter(Boolean).join(' · ');
        item.append(label, meta);
        item.addEventListener('mousedown', (event) => {
          event.preventDefault();
          this.choose(option);
        });
        this.menu.append(item);
      });
    }
    this.menu.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
    this.activeIndex = 0;
  }

  private close(): void {
    this.menu.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
  }

  private choose(option: FilterOption): void {
    this.selected = option.value;
    this.input.value = option.label;
    this.hidden.value = option.value;
    this.clear.hidden = false;
    this.close();
    this.onSelect(option);
  }

  private commitRaw(): void {
    const value = this.input.value.trim();
    if (!value) {
      this.onSelect(null);
      return;
    }
    const exact = this.options.find((option) => option.label === value || option.value === value);
    if (exact) {
      this.choose(exact);
      return;
    }
    this.hidden.value = value;
    this.selected = value;
    this.clear.hidden = false;
    this.onSelect({ value, label: value, count: 0 });
  }

  private onKeyDown(event: KeyboardEvent): void {
    const options = this.getFiltered();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex = Math.min(options.length - 1, this.activeIndex + 1);
      this.open();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex = Math.max(0, this.activeIndex - 1);
      this.open();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = options[this.activeIndex];
      if (option) this.choose(option);
      else this.commitRaw();
    } else if (event.key === 'Escape') {
      this.close();
    }
  }
}

const init = () => {
  const root = document.querySelector<HTMLElement>('[data-admin-resources-root]');
  if (!root) return;

  const listEndpoint = root.dataset.listEndpoint ?? '';
  const batchEndpoint = root.dataset.batchEndpoint ?? '';
  const imageUploadEndpoint = root.dataset.imageUploadEndpoint ?? '';
  const fileUploadEndpoint = root.dataset.fileUploadEndpoint ?? '';
  const exportEndpoint = root.dataset.exportEndpoint ?? '';
  const importEndpoint = root.dataset.importEndpoint ?? '';
  const textEndpoint = root.dataset.textEndpoint ?? '';
  const status = root.querySelector<HTMLElement>('[data-admin-resources-status]');
  const treeEl = root.querySelector<HTMLElement>('[data-resources-tree]')!;
  const breadcrumbEl = root.querySelector<HTMLElement>('[data-resources-breadcrumb]')!;
  const searchEl = root.querySelector<HTMLInputElement>('[data-resources-search]')!;
  const filterToggle = root.querySelector<HTMLButtonElement>('[data-resources-filter-toggle]')!;
  const filtersEl = root.querySelector<HTMLFormElement>('[data-resources-filters]')!;
  const collectionEl = filtersEl.querySelector<HTMLSelectElement>('[name="collection"]')!;
  const referenceEl = filtersEl.querySelector<HTMLSelectElement>('[name="ref"]')!;
  const fromEl = filtersEl.querySelector<HTMLInputElement>('[name="from"]')!;
  const toEl = filtersEl.querySelector<HTMLInputElement>('[name="to"]')!;
  const selectionEl = root.querySelector<HTMLElement>('[data-resources-selection]')!;
  const selectedCountEl = root.querySelector<HTMLElement>('[data-resources-selected-count]')!;
  const resultsEl = root.querySelector<HTMLElement>('[data-resources-results]')!;
  const emptyEl = root.querySelector<HTMLElement>('[data-resources-empty]')!;
  const summaryEl = root.querySelector<HTMLElement>('[data-resources-summary]')!;
  const pageEl = root.querySelector<HTMLElement>('[data-resources-page]')!;
  const prevEl = root.querySelector<HTMLButtonElement>('[data-resources-prev]')!;
  const nextEl = root.querySelector<HTMLButtonElement>('[data-resources-next]')!;
  const uploadDialog = root.querySelector<HTMLDialogElement>('[data-resources-upload-dialog]')!;
  const uploadForm = root.querySelector<HTMLFormElement>('[data-resources-upload-form]')!;
  const uploadTarget = root.querySelector<HTMLElement>('[data-resources-upload-target]')!;
  const importDialog = root.querySelector<HTMLDialogElement>('[data-resources-import-dialog]')!;
  const importForm = root.querySelector<HTMLFormElement>('[data-resources-import-form]')!;
  const detailDialog = root.querySelector<HTMLDialogElement>('[data-resources-detail]')!;
  const layoutEl = root.querySelector<HTMLElement>('[data-resources-layout]')!;
  const treeToggleEl = root.querySelector<HTMLButtonElement>('[data-resources-tree-toggle]')!;
  const treeToggleLabelEl = root.querySelector<HTMLElement>('[data-resources-tree-toggle-label]')!;
  const resizerEl = root.querySelector<HTMLElement>('[data-resources-resizer]')!;
  const mainEl = root.querySelector<HTMLElement>('.resources-main')!;

  // 让预览区自己滚动、分页条固定在工作区底部；高度按工作区顶部到视口底计算。
  const syncMainHeight = () => {
    if (window.innerWidth <= 980) {
      mainEl.style.height = '';
      return;
    }
    const top = mainEl.getBoundingClientRect().top + window.scrollY;
    mainEl.style.height = `${Math.max(420, window.innerHeight - top - 20)}px`;
  };
  syncMainHeight();
  window.addEventListener('resize', syncMainHeight);

  // 目录面板：宽度可拖拽、可整体收起；两者都记住用户上次选择。
  const TREE_WIDTH_KEY = 'astro-whono:resources-tree-width';
  const TREE_COLLAPSED_KEY = 'astro-whono:resources-tree-collapsed';
  const MIN_TREE_WIDTH = 180;
  const MAX_TREE_WIDTH = 560;
  const DEFAULT_TREE_WIDTH = 248;

  const clampTreeWidth = (value: number): number =>
    Math.min(MAX_TREE_WIDTH, Math.max(MIN_TREE_WIDTH, Math.round(value)));

  const applyTreeWidth = (value: number) => {
    layoutEl.style.setProperty('--resources-tree-width', `${clampTreeWidth(value)}px`);
  };

  const readStoredTreeWidth = (): number => {
    const stored = Number.parseInt(localStorage.getItem(TREE_WIDTH_KEY) ?? '', 10);
    return Number.isFinite(stored) ? clampTreeWidth(stored) : DEFAULT_TREE_WIDTH;
  };

  const syncTreeCollapsed = (collapsed: boolean) => {
    layoutEl.dataset.treeCollapsed = String(collapsed);
    treeToggleEl.setAttribute('aria-expanded', String(!collapsed));
    treeToggleLabelEl.textContent = collapsed ? '展开目录' : '收起目录';
    localStorage.setItem(TREE_COLLAPSED_KEY, collapsed ? '1' : '0');
  };

  const setStatus = (message: string, state: 'idle' | 'ok' | 'error' | 'loading' = 'idle') => {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  };

  const readState = (): State => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    return {
      collection: params.get('collection') ?? '',
      series: params.get('series') ?? '',
      entry: params.get('entry') ?? params.get('version') ?? '',
      dir: params.get('dir') ?? '',
      ref: (params.get('ref') ?? '') as State['ref'],
      type: type === 'image' || type === 'file' ? type : '',
      from: params.get('from') ?? '',
      to: params.get('to') ?? '',
      q: params.get('q') ?? '',
      page: Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1),
      view: localStorage.getItem('astro-whono:resources-view') === 'list' ? 'list' : 'grid'
    };
  };

  let state = readState();
  let lastResult: ListResult | null = null;
  let selectedPaths = new Set<string>();
  let requestToken = 0;
  let searchTimer: number | null = null;

  const syncUrl = () => {
    const url = new URL(window.location.href);
    const keys: Array<[string, string]> = [
      ['collection', state.collection],
      ['series', state.series],
      ['entry', state.entry],
      ['dir', state.dir],
      ['ref', state.ref],
      ['type', state.type],
      ['from', state.from],
      ['to', state.to],
      ['q', state.q],
      ['page', state.page > 1 ? String(state.page) : '']
    ];
    for (const [key, value] of keys) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    url.searchParams.delete('version');
    history.replaceState(null, '', `${url.pathname}${url.search}`);
  };

  const syncControls = () => {
    collectionEl.value = state.collection;
    referenceEl.value = state.ref;
    fromEl.value = state.from;
    toEl.value = state.to;
    searchEl.value = state.q;
    root.querySelectorAll<HTMLElement>('[data-resources-type]').forEach((button) => {
      const active = (button.dataset.resourcesType ?? '') === state.type;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    root.querySelectorAll<HTMLElement>('[data-resources-view]').forEach((button) => {
      const active = (button.dataset.resourcesView ?? 'grid') === state.view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    resultsEl.dataset.view = state.view;
  };

  const seriesCombo = new ResourceCombobox(
    root.querySelector<HTMLElement>('[data-resources-combobox="series"]')!,
    '系列',
    (option) => {
      state = {
        ...state,
        collection: option?.collection ?? state.collection,
        series: option?.value ?? '',
        entry: '',
        dir: '',
        page: 1
      };
      void load();
    }
  );
  const entryCombo = new ResourceCombobox(
    root.querySelector<HTMLElement>('[data-resources-combobox="entry"]')!,
    '版本',
    (option) => {
      state = {
        ...state,
        collection: option?.collection ?? state.collection,
        series: option?.series ?? state.series,
        entry: option?.value ?? '',
        dir: '',
        page: 1
      };
      void load();
    }
  );
  const directoryCombo = new ResourceCombobox(
    root.querySelector<HTMLElement>('[data-resources-combobox="dir"]')!,
    '目录',
    (option) => {
      state = {
        ...state,
        collection: option?.collection ?? state.collection,
        series: option?.series ?? state.series,
        entry: option?.entryId ?? state.entry,
        dir: option?.value ?? '',
        page: 1
      };
      void load();
    }
  );

  const syncComboboxes = () => {
    const options = lastResult?.options;
    const seriesOptions = (options?.series ?? []).filter((option) =>
      !state.collection || option.collection === state.collection
    );
    const entryOptions = (options?.versions ?? []).filter((option) =>
      (!state.collection || option.collection === state.collection)
      && (!state.series || option.series === state.series)
    );
    const directoryOptions = (options?.directories ?? []).filter((option) =>
      (!state.entry || option.entryId === state.entry)
    );
    seriesCombo.setOptions(seriesOptions, state.series);
    entryCombo.setOptions(entryOptions, state.entry);
    directoryCombo.setOptions(directoryOptions, state.dir);
  };

  const selectNode = (node: TreeNode) => {
    state = {
      ...state,
      collection: node.collection,
      series: node.kind === 'collection' ? '' : node.series,
      entry: node.kind === 'series' || node.kind === 'collection' ? '' : node.entryId,
      dir: node.kind === 'directory' ? node.directory : '',
      page: 1
    };
    void load();
  };

  const isNodeActive = (node: TreeNode): boolean => {
    if (node.kind === 'collection') return state.collection === node.collection && !state.series && !state.entry && !state.dir;
    if (node.kind === 'series') return state.collection === node.collection && state.series === node.series && !state.entry && !state.dir;
    if (node.kind === 'version') return state.entry === node.entryId && state.dir === '';
    return state.entry === node.entryId && state.dir === node.directory;
  };

  const hasActiveDescendant = (node: TreeNode): boolean =>
    node.children.some((child) => isNodeActive(child) || hasActiveDescendant(child));

  const createToggle = (node: TreeNode, group: HTMLElement, expanded: boolean): HTMLElement => {
    if (node.children.length === 0) {
      const placeholder = document.createElement('span');
      placeholder.className = 'resources-tree__toggle resources-tree__toggle--placeholder';
      return placeholder;
    }

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'resources-tree__toggle';
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', `${expanded ? '收起' : '展开'}${node.label}`);
    const chevron = document.createElement('span');
    chevron.className = 'resources-tree__chevron';
    toggle.append(chevron);
    toggle.addEventListener('click', () => {
      const next = group.dataset.collapsed !== 'true';
      group.dataset.collapsed = String(next);
      toggle.setAttribute('aria-expanded', String(!next));
      toggle.setAttribute('aria-label', `${next ? '展开' : '收起'}${node.label}`);
    });
    return toggle;
  };

  const renderTree = (nodes: readonly TreeNode[]) => {
    treeEl.replaceChildren();
    const allRow = document.createElement('div');
    allRow.className = 'resources-tree__row';
    const allPlaceholder = document.createElement('span');
    allPlaceholder.className = 'resources-tree__toggle resources-tree__toggle--placeholder';
    const allButton = document.createElement('button');
    allButton.type = 'button';
    allButton.className = 'resources-tree__node';
    allButton.dataset.kind = 'all';
    allButton.dataset.active = String(!state.collection);
    allButton.innerHTML = '<span class="resources-tree__swatch"></span><span class="resources-tree__label">全部资源</span>';
    allButton.addEventListener('click', () => {
      state = { ...state, collection: '', series: '', entry: '', dir: '', page: 1 };
      void load();
    });
    allRow.append(allPlaceholder, allButton);
    treeEl.append(allRow);

    if (nodes.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'resources-tree__empty';
      empty.textContent = '还没有资源目录';
      treeEl.append(empty);
      return;
    }

    const renderList = (items: readonly TreeNode[], depth: number): HTMLUListElement => {
      const list = document.createElement('ul');
      list.className = 'resources-tree__list';
      if (depth > 0) list.classList.add('resources-tree__children');
      for (const node of items) {
        const item = document.createElement('li');
        item.className = 'resources-tree__group';
        // 默认只展开第一级；当前筛选路径上的祖先自动展开，避免选中项被折叠隐藏。
        const expanded = depth === 0 || hasActiveDescendant(node);
        item.dataset.collapsed = String(node.children.length > 0 && !expanded);
        const row = document.createElement('div');
        row.className = 'resources-tree__row';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'resources-tree__node';
        button.dataset.kind = node.kind;
        button.dataset.active = String(isNodeActive(node));
        button.setAttribute('aria-pressed', isNodeActive(node) ? 'true' : 'false');
        const swatch = document.createElement('span');
        swatch.className = 'resources-tree__swatch';
        const label = document.createElement('span');
        label.className = 'resources-tree__label';
        label.textContent = node.label;
        const count = document.createElement('span');
        count.className = 'resources-tree__count';
        count.textContent = String(node.count);
        button.append(swatch, label, count);
        button.addEventListener('click', () => selectNode(node));
        row.append(createToggle(node, item, expanded), button);
        item.append(row);
        if (node.children.length > 0) item.append(renderList(node.children, depth + 1));
        list.append(item);
      }
      return list;
    };

    treeEl.append(renderList(nodes, 0));
  };

  const renderBreadcrumb = (items: readonly Breadcrumb[]) => {
    breadcrumbEl.replaceChildren();
    items.forEach((item, index) => {
      if (index > 0) {
        const sep = document.createElement('span');
        sep.className = 'resources-breadcrumb__sep';
        sep.textContent = '/';
        breadcrumbEl.append(sep);
      }
      if (index === items.length - 1) {
        const current = document.createElement('span');
        current.className = 'resources-breadcrumb__current';
        current.textContent = item.label;
        breadcrumbEl.append(current);
        return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'resources-breadcrumb__link';
      button.textContent = item.label;
      button.addEventListener('click', () => {
        state = {
          ...state,
          collection: item.filters.collection ?? '',
          series: item.filters.series ?? '',
          entry: item.filters.entry ?? '',
          dir: item.filters.directory ?? '',
          page: 1
        };
        void load();
      });
      breadcrumbEl.append(button);
    });
  };

  const getStatusBadge = (item: MediaItem): HTMLElement => {
    const badge = document.createElement('span');
    badge.className = `resources-badge${item.referenceStatus === 'referenced' ? ' resources-badge--ok' : item.referenceStatus === 'orphan' ? ' resources-badge--warn' : ''}`;
    badge.textContent = item.referenceStatus === 'referenced'
      ? `引用 ${item.referenceCount}`
      : REFERENCE_LABELS[item.referenceStatus];
    return badge;
  };

  const SVG_NS = 'http://www.w3.org/2000/svg';

  const createFileIcon = (icon: MediaFileIcon): SVGSVGElement => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('resources-file-visual__icon');
    for (const pathData of MEDIA_FILE_ICON_PATHS[icon]) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', pathData);
      svg.append(path);
    }
    return svg;
  };

  const createFileVisual = (fileName: string): HTMLElement => {
    const visual = resolveMediaFileVisual(fileName);
    const root = document.createElement('div');
    root.className = 'resources-file-visual';
    root.dataset.tone = visual.tone;
    root.setAttribute('aria-hidden', 'true');
    const page = document.createElement('span');
    page.className = 'resources-file-visual__page';
    page.append(createFileIcon(visual.icon));
    const label = document.createElement('span');
    label.className = 'resources-file-visual__label';
    label.textContent = visual.label;
    root.append(page, label);
    return root;
  };

  const createThumb = (item: MediaItem, className: string): HTMLElement => {
    const wrapper = document.createElement('div');
    wrapper.className = className;
    wrapper.dataset.kind = item.kind;
    if (item.previewSrc) {
      const image = document.createElement('img');
      image.src = item.previewSrc;
      image.alt = '';
      image.loading = 'lazy';
      image.addEventListener('error', () => image.remove());
      wrapper.append(image);
    } else {
      wrapper.append(createFileVisual(item.fileName));
    }
    return wrapper;
  };

  const openDetail = (item: MediaItem) => {
    detailDialog.dataset.path = item.path;
    detailDialog.querySelector<HTMLElement>('[data-resources-detail-kind]')!.textContent = item.kind === 'image' ? '图片' : '附件';
    detailDialog.querySelector<HTMLElement>('[data-resources-detail-title]')!.textContent = item.fileName;
    const preview = detailDialog.querySelector<HTMLElement>('[data-resources-detail-preview]')!;
    const textPreview = item.kind === 'file' && TEXT_PREVIEW_EXTENSIONS.has(getMediaFileExtension(item.fileName));
    if (textPreview) {
      const box = document.createElement('pre');
      box.className = 'resources-drawer__text';
      box.textContent = '正在读取文本…';
      box.setAttribute('aria-label', `${item.fileName} 文本预览`);
      preview.replaceChildren(box);
      const loadPreview = async () => {
        try {
          const response = await fetch(`${textEndpoint}?path=${encodeURIComponent(item.path)}`);
          const payload = await response.json();
          if (!response.ok || payload?.ok !== true) {
            throw new Error(payload?.errors?.[0] ?? '文本读取失败');
          }
          const text = String(payload.result?.text ?? '');
          box.textContent = text.length ? text : '（空文件）';
          if (payload.result?.truncated) {
            const note = document.createElement('span');
            note.className = 'resources-drawer__text-note';
            note.textContent = '文件较大，仅显示前 256 KB。';
            preview.append(note);
          }
        } catch (error) {
          box.textContent = error instanceof Error ? error.message : '文本读取失败';
        }
      };
      void loadPreview();
    } else {
      preview.replaceChildren(createThumb(item, 'resources-drawer__preview-inner'));
    }
    const meta = detailDialog.querySelector<HTMLElement>('[data-resources-detail-meta]')!;
    meta.replaceChildren();
    const scopeLabel = item.hasSeries
      ? `${getCollectionLabel(item.collection)} / ${item.seriesLabel} / ${item.versionLabel}`
      : `${getCollectionLabel(item.collection)} / ${item.entryLabel}`;
    const rows: Array<[string, string]> = [
      ['所属', scopeLabel],
      ['路径', item.path],
      ['类型', item.mimeType ?? '未知类型'],
      ['大小', formatSize(item.size)],
      ['修改时间', formatTime(item.mtimeMs)],
      ['引用', item.referenceStatus === 'referenced' ? `${item.referenceCount} 处` : REFERENCE_LABELS[item.referenceStatus]]
    ];
    for (const [label, value] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      meta.append(dt, dd);
    }
    if (!detailDialog.open) detailDialog.showModal();
  };

  const renderItems = (result: ListResult) => {
    resultsEl.replaceChildren();
    resultsEl.dataset.view = state.view;
    if (result.items.length === 0) {
      resultsEl.hidden = true;
      emptyEl.hidden = false;
      return;
    }
    resultsEl.hidden = false;
    emptyEl.hidden = true;

    for (const item of result.items) {
      if (state.view === 'grid') {
        const card = document.createElement('article');
        card.className = 'resources-card';
        card.dataset.path = item.path;
        card.dataset.selected = String(selectedPaths.has(item.path));
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'resources-card__select';
        checkbox.checked = selectedPaths.has(item.path);
        checkbox.setAttribute('aria-label', `选择 ${item.fileName}`);
        checkbox.addEventListener('click', (event) => event.stopPropagation());
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) selectedPaths.add(item.path);
          else selectedPaths.delete(item.path);
          updateSelection();
        });
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'resources-card__open';
        open.addEventListener('click', () => openDetail(item));
        open.append(createThumb(item, 'resources-card__preview'));
        const body = document.createElement('div');
        body.className = 'resources-card__body';
        const title = document.createElement('span');
        title.className = 'resources-card__title';
        title.textContent = item.fileName;
        const meta = document.createElement('span');
        meta.className = 'resources-card__meta';
        meta.append(getStatusBadge(item));
        const version = document.createElement('span');
        version.textContent = item.versionLabel;
        meta.append(version);
        body.append(title, meta);
        open.append(body);
        card.append(checkbox, open);
        resultsEl.append(card);
      } else {
        const row = document.createElement('article');
        row.className = 'resources-row';
        row.dataset.path = item.path;
        row.dataset.selected = String(selectedPaths.has(item.path));
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'resources-row__select';
        checkbox.checked = selectedPaths.has(item.path);
        checkbox.setAttribute('aria-label', `选择 ${item.fileName}`);
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) selectedPaths.add(item.path);
          else selectedPaths.delete(item.path);
          updateSelection();
        });
        const thumb = createThumb(item, 'resources-row__thumb');
        const main = document.createElement('div');
        main.className = 'resources-row__main';
        const title = document.createElement('div');
        title.className = 'resources-row__title';
        title.textContent = item.fileName;
        const owner = document.createElement('div');
        owner.className = 'resources-row__owner';
        owner.textContent = `${getCollectionLabel(item.collection)} / ${item.seriesLabel} / ${item.versionLabel} / ${item.directory || '根目录'}`;
        main.append(title, owner);
        const meta = document.createElement('div');
        meta.className = 'resources-row__meta';
        meta.append(getStatusBadge(item));
        const size = document.createElement('span');
        size.textContent = formatSize(item.size);
        meta.append(size);
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'admin-btn admin-btn--tool admin-btn--compact';
        open.textContent = '详情';
        open.addEventListener('click', () => openDetail(item));
        row.append(checkbox, thumb, main, meta, open);
        row.addEventListener('click', (event) => {
          if ((event.target as HTMLElement).closest('input,button')) return;
          openDetail(item);
        });
        resultsEl.append(row);
      }
    }
  };

  const updateSelection = () => {
    selectionEl.hidden = selectedPaths.size === 0;
    selectedCountEl.textContent = `已选 ${selectedPaths.size} 项`;
    resultsEl.querySelectorAll<HTMLElement>('[data-path]').forEach((element) => {
      element.dataset.selected = String(selectedPaths.has(element.dataset.path ?? ''));
      const checkbox = element.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (checkbox) checkbox.checked = selectedPaths.has(element.dataset.path ?? '');
    });
  };

  const load = async () => {
    const token = ++requestToken;
    setStatus('正在载入资源…', 'loading');
    syncControls();
    syncUrl();
    const params = new URLSearchParams();
    if (state.collection) params.set('collection', state.collection);
    if (state.series) params.set('series', state.series);
    if (state.entry) params.set('entry', state.entry);
    if (state.dir) params.set('dir', state.dir);
    if (state.ref) params.set('ref', state.ref);
    if (state.type) params.set('type', state.type);
    if (state.from) params.set('from', state.from);
    if (state.to) params.set('to', state.to);
    if (state.q) params.set('q', state.q);
    params.set('page', String(state.page));
    try {
      const response = await fetch(`${listEndpoint}?${params.toString()}`, { headers: { accept: 'application/json' } });
      const payload = getPayload(await response.json());
      if (!response.ok || !payload || payload.ok !== true || !isRecord(payload.result)) {
        throw new Error(payload && Array.isArray(payload.errors) ? String(payload.errors[0]) : '资源列表加载失败');
      }
      if (token !== requestToken) return;
      lastResult = payload.result as ListResult;
      selectedPaths = new Set([...selectedPaths].filter((path) => lastResult!.items.some((item) => item.path === path)));
      renderTree(lastResult.tree);
      renderBreadcrumb(lastResult.breadcrumb);
      renderItems(lastResult);
      syncComboboxes();
      summaryEl.textContent = `共 ${lastResult.totalCount} 个文件 · 本页 ${lastResult.items.length} 个 · 已选 ${selectedPaths.size} 个`;
      pageEl.textContent = `${lastResult.page} / ${lastResult.totalPages}`;
      prevEl.disabled = lastResult.page <= 1;
      nextEl.disabled = lastResult.page >= lastResult.totalPages;
      updateSelection();
      setStatus(lastResult.totalCount > 0 ? `已载入 ${lastResult.totalCount} 个资源` : '当前筛选下没有资源', 'ok');
    } catch (error) {
      if (token !== requestToken) return;
      treeEl.replaceChildren();
      breadcrumbEl.replaceChildren();
      resultsEl.replaceChildren();
      resultsEl.hidden = true;
      emptyEl.hidden = false;
      setStatus(error instanceof Error ? error.message : '资源列表加载失败', 'error');
    }
  };

  // 目录宽度：拖拽分割条调整，键盘左右键微调，双击恢复默认。
  applyTreeWidth(readStoredTreeWidth());
  syncTreeCollapsed(localStorage.getItem(TREE_COLLAPSED_KEY) === '1');

  treeToggleEl.addEventListener('click', () => {
    syncTreeCollapsed(layoutEl.dataset.treeCollapsed !== 'true');
  });

  resizerEl.addEventListener('dblclick', () => {
    applyTreeWidth(DEFAULT_TREE_WIDTH);
    localStorage.setItem(TREE_WIDTH_KEY, String(DEFAULT_TREE_WIDTH));
  });
  resizerEl.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = clampTreeWidth(
      Number.parseFloat(getComputedStyle(layoutEl).getPropertyValue('--resources-tree-width'))
        + (event.key === 'ArrowRight' ? 16 : -16)
    );
    applyTreeWidth(next);
    localStorage.setItem(TREE_WIDTH_KEY, String(next));
  });
  resizerEl.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    resizerEl.setPointerCapture(event.pointerId);
    resizerEl.dataset.dragging = 'true';
    const startX = event.clientX;
    const startWidth = Number.parseFloat(
      getComputedStyle(layoutEl).getPropertyValue('--resources-tree-width')
    ) || DEFAULT_TREE_WIDTH;
    const handleMove = (moveEvent: PointerEvent) => {
      applyTreeWidth(startWidth + moveEvent.clientX - startX);
    };
    const handleUp = () => {
      resizerEl.dataset.dragging = 'false';
      const width = Number.parseFloat(getComputedStyle(layoutEl).getPropertyValue('--resources-tree-width'));
      localStorage.setItem(TREE_WIDTH_KEY, String(Math.round(width)));
      resizerEl.removeEventListener('pointermove', handleMove);
      resizerEl.removeEventListener('pointerup', handleUp);
      resizerEl.removeEventListener('pointercancel', handleUp);
    };
    resizerEl.addEventListener('pointermove', handleMove);
    resizerEl.addEventListener('pointerup', handleUp);
    resizerEl.addEventListener('pointercancel', handleUp);
  });

  filterToggle.addEventListener('click', () => {
    const expanded = filterToggle.getAttribute('aria-expanded') === 'true';
    filterToggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    filtersEl.hidden = expanded;
  });

  collectionEl.addEventListener('change', () => {
    state = { ...state, collection: collectionEl.value, series: '', entry: '', dir: '', page: 1 };
    void load();
  });
  referenceEl.addEventListener('change', () => {
    state = { ...state, ref: referenceEl.value as State['ref'], page: 1 };
    void load();
  });
  filtersEl.addEventListener('submit', (event) => {
    event.preventDefault();
    state = { ...state, from: fromEl.value, to: toEl.value, page: 1 };
    void load();
  });
  root.querySelectorAll<HTMLElement>('[data-resources-reset]').forEach((button) => {
    button.addEventListener('click', () => {
      state = { collection: '', series: '', entry: '', dir: '', ref: '', type: '', from: '', to: '', q: '', page: 1, view: state.view };
      void load();
    });
  });
  root.querySelectorAll<HTMLElement>('[data-resources-type]').forEach((button) => {
    button.addEventListener('click', () => {
      state = { ...state, type: (button.dataset.resourcesType ?? '') as State['type'], page: 1 };
      void load();
    });
  });
  root.querySelectorAll<HTMLElement>('[data-resources-view]').forEach((button) => {
    button.addEventListener('click', () => {
      state = { ...state, view: (button.dataset.resourcesView ?? 'grid') === 'list' ? 'list' : 'grid' };
      localStorage.setItem('astro-whono:resources-view', state.view);
      syncControls();
      if (lastResult) renderItems(lastResult);
    });
  });
  searchEl.addEventListener('input', () => {
    if (searchTimer !== null) window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state = { ...state, q: searchEl.value.trim(), page: 1 };
      void load();
    }, 240);
  });
  prevEl.addEventListener('click', () => {
    if (!lastResult || lastResult.page <= 1) return;
    state = { ...state, page: lastResult.page - 1 };
    void load();
  });
  nextEl.addEventListener('click', () => {
    if (!lastResult || lastResult.page >= lastResult.totalPages) return;
    state = { ...state, page: lastResult.page + 1 };
    void load();
  });

  const runBatch = async (action: 'rename' | 'move' | 'delete') => {
    const paths = [...selectedPaths];
    if (paths.length === 0) return;
    let payloadItems = paths.map((path) => ({ path }));
    if (action === 'rename') {
      const prefix = window.prompt('输入新文件名前缀（结果：前缀-原文件名，扩展名不变）');
      const normalized = (prefix ?? '').trim();
      if (!normalized) return;
      if (!window.confirm(`确定重命名 ${paths.length} 个文件？`)) return;
      payloadItems = paths.map((path) => ({
        path,
        name: `${normalized}-${path.split('/').pop() ?? ''}`
      }));
    } else if (action === 'move') {
      const target = window.prompt('输入目标目录（必须位于 content/ 或 public/images/）', `content/${state.collection}/`);
      const normalized = (target ?? '').trim().replace(/\/+$/, '');
      if (!normalized) return;
      if (!/^(?:content|public\/images)(?:\/|$)/.test(normalized)) {
        setStatus('目标目录必须位于 content/ 或 public/images/ 下', 'error');
        return;
      }
      if (!window.confirm(`确定移动 ${paths.length} 个文件到 ${normalized}？`)) return;
      payloadItems = paths.map((path) => ({ path, to: normalized }));
    } else if (!window.confirm(`确定删除 ${paths.length} 个文件？此操作不可撤销。`)) {
      return;
    }

    setStatus('正在处理批量操作…', 'loading');
    try {
      const response = await fetch(batchEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, items: payloadItems })
      });
      const payload = getPayload(await response.json());
      const result = payload && isRecord(payload.result) ? payload.result : null;
      if (!response.ok || !payload || payload.ok !== true || !result) {
        throw new Error(payload && Array.isArray(payload.errors) ? String(payload.errors[0]) : '批量操作失败');
      }
      const failed = Array.isArray(result.results) ? result.results.filter((item) => isRecord(item) && item.ok === false) : [];
      selectedPaths.clear();
      await load();
      if (failed.length > 0) {
        setStatus(`${failed.length} 个文件失败：${String((failed[0] as Record<string, unknown>).error ?? '未知错误')}`, 'error');
      } else {
        setStatus(`已完成 ${paths.length} 个文件的批量操作`, 'ok');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '批量操作失败', 'error');
    }
  };

  root.querySelectorAll<HTMLElement>('[data-resources-batch]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.resourcesBatch;
      if (action === 'rename' || action === 'move' || action === 'delete') void runBatch(action);
    });
  });

  root.querySelectorAll<HTMLElement>('[data-resources-upload-open]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!state.collection || !state.entry) {
        setStatus('请先从左侧选择一个版本或条目，再上传资源', 'error');
        return;
      }
      uploadTarget.textContent = `上传到 ${getCollectionLabel(state.collection)} / ${state.entry}`;
      uploadDialog.showModal();
    });
  });
  root.querySelectorAll<HTMLElement>('[data-resources-import-open]').forEach((button) => {
    button.addEventListener('click', () => importDialog.showModal());
  });
  root.querySelectorAll<HTMLElement>('[data-resources-close]').forEach((button) => {
    button.addEventListener('click', () => button.closest('dialog')?.close());
  });
  root.querySelectorAll<HTMLDialogElement>('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  uploadForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(uploadForm);
    const kind = data.get('kind') === 'file' ? 'file' : 'image';
    const file = data.get('file');
    if (!state.collection || !state.entry) {
      setStatus('请先选择版本或条目', 'error');
      return;
    }
    if (!(file instanceof File) || file.size === 0) {
      setStatus('请选择文件', 'error');
      return;
    }
    const formData = new FormData();
    formData.set('collection', state.collection);
    formData.set('entryId', state.entry);
    formData.set(kind === 'image' ? 'image' : 'file', file);
    setStatus('正在上传…', 'loading');
    void (async () => {
      try {
        const endpoint = kind === 'image' ? imageUploadEndpoint : fileUploadEndpoint;
        const response = await fetch(endpoint, { method: 'POST', body: formData });
        const payload = getPayload(await response.json());
        if (!response.ok || !payload || payload.ok !== true) {
          throw new Error(payload && Array.isArray(payload.errors) ? String(payload.errors[0]) : '上传失败');
        }
        uploadDialog.close();
        uploadForm.reset();
        await load();
        setStatus('上传完成', 'ok');
      } catch (error) {
        setStatus(error instanceof Error ? error.message : '上传失败', 'error');
      }
    })();
  });

  importForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = new FormData(importForm).get('file');
    if (!(file instanceof File) || file.size === 0) {
      setStatus('请选择 ZIP 文件', 'error');
      return;
    }
    const formData = new FormData();
    formData.set('file', file);
    setStatus('正在导入…', 'loading');
    void (async () => {
      try {
        const response = await fetch(importEndpoint, { method: 'POST', body: formData });
        const payload = getPayload(await response.json());
        if (!response.ok || !payload || payload.ok !== true) {
          throw new Error(payload && Array.isArray(payload.errors) ? String(payload.errors[0]) : '导入失败');
        }
        importDialog.close();
        importForm.reset();
        await load();
        setStatus('导入完成', 'ok');
      } catch (error) {
        setStatus(error instanceof Error ? error.message : '导入失败', 'error');
      }
    })();
  });

  const detailClose = root.querySelector<HTMLElement>('[data-resources-detail-close]');
  detailClose?.addEventListener('click', () => detailDialog.close());
  detailDialog.addEventListener('click', (event) => {
    if (event.target === detailDialog) detailDialog.close();
  });

  const getDetailItem = (): MediaItem | null => {
    const path = detailDialog.dataset.path;
    return lastResult?.items.find((item) => item.path === path) ?? null;
  };

  const copyText = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(message, 'ok');
    } catch {
      setStatus('复制失败，请手动选择路径', 'error');
    }
  };

  root.querySelectorAll<HTMLElement>('[data-resources-detail-copy-path]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = getDetailItem();
      if (item) void copyText(item.path, '路径已复制');
    });
  });
  root.querySelectorAll<HTMLElement>('[data-resources-detail-copy-md]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = getDetailItem();
      if (item) void copyText(getMarkdownReference(item), '引用已复制');
    });
  });
  root.querySelectorAll<HTMLElement>('[data-resources-detail-export]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = getDetailItem();
      if (!item) return;
      const params = new URLSearchParams({ collection: item.collection, entryId: item.entryId, format: 'archive' });
      window.location.href = `${exportEndpoint}?${params.toString()}`;
    });
  });
  root.querySelectorAll<HTMLElement>('[data-resources-detail-rename]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = getDetailItem();
      if (!item) return;
      const current = item.fileName;
      const next = window.prompt('输入新的文件名（扩展名保持不变）', current);
      if (!next || next === current) return;
      void (async () => {
        const response = await fetch(batchEndpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'rename', items: [{ path: item.path, name: next }] })
        });
        const payload = getPayload(await response.json());
        if (!response.ok || !payload || payload.ok !== true) {
          setStatus(payload && Array.isArray(payload.errors) ? String(payload.errors[0]) : '重命名失败', 'error');
          return;
        }
        detailDialog.close();
        await load();
        setStatus('重命名完成', 'ok');
      })();
    });
  });
  root.querySelectorAll<HTMLElement>('[data-resources-detail-move]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = getDetailItem();
      if (!item) return;
      const target = window.prompt('目标目录（必须位于 content/ 或 public/images/）', `content/${item.collection}/${item.entryId}/${item.kind === 'image' ? 'images' : 'files'}`);
      if (!target) return;
      void (async () => {
        const response = await fetch(batchEndpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'move', items: [{ path: item.path, to: target.trim() }] })
        });
        const payload = getPayload(await response.json());
        if (!response.ok || !payload || payload.ok !== true) {
          setStatus(payload && Array.isArray(payload.errors) ? String(payload.errors[0]) : '移动失败', 'error');
          return;
        }
        detailDialog.close();
        await load();
        setStatus('移动完成', 'ok');
      })();
    });
  });
  root.querySelectorAll<HTMLElement>('[data-resources-detail-delete]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = getDetailItem();
      if (!item || !window.confirm(`确定删除 ${item.fileName}？此操作不可撤销。`)) return;
      void (async () => {
        const response = await fetch(batchEndpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'delete', items: [{ path: item.path }] })
        });
        const payload = getPayload(await response.json());
        if (!response.ok || !payload || payload.ok !== true) {
          setStatus(payload && Array.isArray(payload.errors) ? String(payload.errors[0]) : '删除失败', 'error');
          return;
        }
        detailDialog.close();
        await load();
        setStatus('删除完成', 'ok');
      })();
    });
  });

  const refreshButton = root.querySelector<HTMLElement>('[data-resources-refresh]');
  refreshButton?.addEventListener('click', () => void load());

  void load();
};

export {};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
