type MediaKind = 'image' | 'file';
type MediaReferenceStatus = 'referenced' | 'unreferenced' | 'orphan';

type MediaItem = {
  path: string;
  origin: 'content' | 'public';
  kind: MediaKind;
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
  entryExists: boolean;
  directory: string;
  referenceCount: number;
  referenced: boolean;
  referenceStatus: MediaReferenceStatus;
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

type MediaState = {
  collection: string;
  series: string;
  entry: string;
  dir: string;
  ref: '' | MediaReferenceStatus;
  type: '' | MediaKind;
  from: string;
  to: string;
  q: string;
  page: number;
};

type ListResult = {
  items: MediaItem[];
  page: number;
  totalPages: number;
  totalCount: number;
  tree: TreeNode[];
  breadcrumb: Breadcrumb[];
};

const REFERENCE_LABELS: Record<MediaReferenceStatus, string> = {
  referenced: '已引用',
  unreferenced: '未引用',
  orphan: '孤儿'
};

const KIND_LABELS: Record<MediaKind, string> = {
  image: '图片',
  file: '附件'
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getResult = (payload: unknown): ListResult => {
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.result)) {
    const errors = isRecord(payload) && Array.isArray(payload.errors)
      ? payload.errors.filter((item): item is string => typeof item === 'string')
      : [];
    throw new Error(errors[0] ?? '媒体列表响应格式无效');
  }
  return payload.result as ListResult;
};

const formatSize = (size: number): string => {
  if (!size || size <= 0) return '大小未知';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatTime = (mtimeMs: number | null): string => {
  if (!mtimeMs) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(mtimeMs));
};

const init = () => {
  const root = document.querySelector<HTMLElement>('[data-admin-media-root]');
  if (!root) return;

  const listEndpoint = root.dataset.listEndpoint ?? '';
  const batchEndpoint = root.dataset.batchEndpoint ?? '';
  const imageUploadEndpoint = root.dataset.imageUploadEndpoint ?? '';
  const fileUploadEndpoint = root.dataset.fileUploadEndpoint ?? '';
  const exportEndpoint = root.dataset.exportEndpoint ?? '';
  const importEndpoint = root.dataset.importEndpoint ?? '';

  const treeEl = root.querySelector<HTMLElement>('[data-admin-media-tree]');
  const breadcrumbEl = root.querySelector<HTMLElement>('[data-admin-media-breadcrumb]');
  const filterForm = root.querySelector<HTMLFormElement>('[data-admin-media-filters]');
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-admin-media-reset]');
  const listEl = root.querySelector<HTMLUListElement>('[data-admin-media-list]');
  const emptyEl = root.querySelector<HTMLElement>('[data-admin-media-empty]');
  const summaryEl = root.querySelector<HTMLElement>('[data-admin-media-summary]');
  const statusEl = root.querySelector<HTMLElement>('[data-admin-media-status]');
  const selectAllEl = root.querySelector<HTMLInputElement>('[data-admin-media-select-all]');
  const prevBtn = root.querySelector<HTMLButtonElement>('[data-admin-media-prev]');
  const nextBtn = root.querySelector<HTMLButtonElement>('[data-admin-media-next]');
  const pageMetaEl = root.querySelector<HTMLElement>('[data-admin-media-page-meta]');
  const exportArchiveEl = root.querySelector<HTMLAnchorElement>('[data-admin-media-export-archive]');
  const exportMarkdownEl = root.querySelector<HTMLAnchorElement>('[data-admin-media-export-markdown]');
  const uploadForm = root.querySelector<HTMLFormElement>('[data-admin-media-upload]');
  const uploadTargetEl = root.querySelector<HTMLElement>('[data-admin-media-upload-target]');
  const importForm = root.querySelector<HTMLFormElement>('[data-admin-media-import]');

  if (
    !treeEl || !breadcrumbEl || !filterForm || !listEl || !emptyEl || !summaryEl || !statusEl
    || !selectAllEl || !prevBtn || !nextBtn || !pageMetaEl || !exportArchiveEl || !exportMarkdownEl
    || !uploadForm || !uploadTargetEl || !importForm
  ) {
    return;
  }

  const getField = <T extends HTMLInputElement | HTMLSelectElement>(
    form: HTMLFormElement,
    name: string
  ): T | null => form.elements.namedItem(name) as T | null;

  const readStateFromUrl = (): MediaState => {
    const params = new URL(window.location.href).searchParams;
    const ref = params.get('ref') ?? '';
    const type = params.get('type') ?? '';
    return {
      collection: params.get('collection') ?? '',
      series: params.get('series') ?? '',
      entry: params.get('entry') ?? params.get('version') ?? '',
      dir: params.get('dir') ?? '',
      ref: ref === 'referenced' || ref === 'unreferenced' || ref === 'orphan' ? ref : '',
      type: type === 'image' || type === 'file' ? type : '',
      from: params.get('from') ?? '',
      to: params.get('to') ?? '',
      q: params.get('q') ?? '',
      page: Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
    };
  };

  let state = readStateFromUrl();
  let selectedPaths = new Set<string>();
  let busy = false;
  let currentResult: ListResult | null = null;
  let uploadKind: 'image' | 'file' = 'image';
  let requestToken = 0;

  const setStatus = (nextState: 'idle' | 'ok' | 'error' | 'loading', message: string) => {
    statusEl.dataset.state = nextState;
    statusEl.textContent = message;
  };

  const updateUrl = () => {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    const setParam = (key: string, value: string) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };
    setParam('collection', state.collection);
    setParam('series', state.series);
    setParam('entry', state.entry);
    setParam('version', state.entry);
    setParam('dir', state.dir);
    setParam('ref', state.ref);
    setParam('type', state.type);
    setParam('from', state.from);
    setParam('to', state.to);
    setParam('q', state.q);
    setParam('page', state.page > 1 ? String(state.page) : '');
    history.replaceState(null, '', `${url.pathname}${url.search}`);
  };

  const syncForm = () => {
    const fields: Array<[string, string]> = [
      ['collection', state.collection],
      ['series', state.series],
      ['entry', state.entry],
      ['dir', state.dir],
      ['ref', state.ref || 'all'],
      ['type', state.type || 'all'],
      ['from', state.from],
      ['to', state.to],
      ['q', state.q]
    ];
    for (const [name, value] of fields) {
      const field = getField<HTMLInputElement | HTMLSelectElement>(filterForm, name);
      if (field) field.value = value;
    }
  };

  const syncExportLinks = () => {
    const hasEntry = Boolean(state.collection && state.entry);
    const buildHref = (format: 'archive' | '') => {
      const params = new URLSearchParams({ collection: state.collection, entryId: state.entry });
      if (format) params.set('format', format);
      return `${exportEndpoint}?${params.toString()}`;
    };
    exportArchiveEl.href = hasEntry ? buildHref('archive') : '#';
    exportMarkdownEl.href = hasEntry ? buildHref('') : '#';
    exportArchiveEl.setAttribute('aria-disabled', hasEntry ? 'false' : 'true');
    exportMarkdownEl.setAttribute('aria-disabled', hasEntry ? 'false' : 'true');
    uploadTargetEl.textContent = hasEntry
      ? `当前条目：${state.collection}/${state.entry}`
      : '未选择条目（请先在树中选择 version / 条目）';
  };

  const isNodeActive = (node: TreeNode): boolean => {
    if (node.kind === 'collection') {
      return state.collection === node.collection && !state.series && !state.entry && !state.dir;
    }
    if (node.kind === 'series') {
      return state.collection === node.collection
        && state.series === node.series && !state.entry && !state.dir;
    }
    if (node.kind === 'version') {
      return state.collection === node.collection
        && state.series === node.series && state.entry === node.entryId && !state.dir;
    }
    return state.collection === node.collection
      && state.series === node.series && state.entry === node.entryId && state.dir === node.directory;
  };

  const selectNode = (node: TreeNode) => {
    const next: MediaState = {
      ...state,
      collection: node.collection,
      series: node.kind === 'collection' ? '' : node.series,
      entry: node.kind === 'series' || node.kind === 'collection' ? '' : node.entryId,
      dir: node.kind === 'directory' ? node.directory : '',
      page: 1
    };
    state = next;
    void load();
  };

  const renderTree = (nodes: readonly TreeNode[]) => {
    treeEl.replaceChildren();
    const renderNodes = (items: readonly TreeNode[], depth: number): HTMLUListElement => {
      const list = document.createElement('ul');
      list.className = 'admin-media-console__tree-list';
      list.dataset.depth = String(depth);
      for (const node of items) {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'admin-media-console__tree-node';
        button.dataset.nodeKind = node.kind;
        button.dataset.active = isNodeActive(node) ? 'true' : 'false';
        button.setAttribute('aria-pressed', isNodeActive(node) ? 'true' : 'false');
        const label = document.createElement('span');
        label.className = 'admin-media-console__tree-label';
        label.textContent = node.label;
        const count = document.createElement('span');
        count.className = 'admin-media-console__tree-count';
        count.textContent = String(node.count);
        button.append(label, count);
        button.addEventListener('click', () => selectNode(node));
        item.append(button);
        if (node.children.length > 0) {
          item.append(renderNodes(node.children, depth + 1));
        }
        list.append(item);
      }
      return list;
    };
    treeEl.append(renderNodes(nodes, 0));
  };

  const renderBreadcrumb = (breadcrumb: readonly Breadcrumb[]) => {
    breadcrumbEl.replaceChildren();
    for (const crumb of breadcrumb) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-media-console__crumb';
      button.textContent = crumb.label;
      button.addEventListener('click', () => {
        const filters = crumb.filters;
        state = {
          ...state,
          collection: filters.collection ?? '',
          series: filters.series ?? '',
          entry: filters.entry ?? '',
          dir: filters.directory ?? '',
          page: 1
        };
        void load();
      });
      breadcrumbEl.append(button);
      breadcrumbEl.append(document.createTextNode(' / '));
    }
  };

  const createItemElement = (item: MediaItem): HTMLLIElement => {
    const listItem = document.createElement('li');
    listItem.className = 'admin-media-console__item';
    listItem.dataset.kind = item.kind;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'admin-media-console__item-check';
    checkbox.value = item.path;
    checkbox.checked = selectedPaths.has(item.path);
    checkbox.setAttribute('aria-label', `选择 ${item.fileName}`);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedPaths.add(item.path);
      else selectedPaths.delete(item.path);
      syncSelectAll();
    });

    const thumb = document.createElement('span');
    thumb.className = 'admin-media-console__thumb';
    if (item.previewSrc && item.kind === 'image') {
      const image = document.createElement('img');
      image.src = item.previewSrc;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      thumb.append(image);
    } else {
      thumb.textContent = item.kind === 'image' ? '图' : '附件';
    }

    const body = document.createElement('div');
    body.className = 'admin-media-console__item-body';
    const title = document.createElement('p');
    title.className = 'admin-media-console__item-title';
    title.textContent = item.fileName;
    const filePath = document.createElement('p');
    filePath.className = 'admin-media-console__item-path';
    filePath.textContent = item.path;
    const meta = document.createElement('p');
    meta.className = 'admin-media-console__item-meta';
    meta.textContent = [
      item.entryLabel,
      item.series !== item.entryId ? `series: ${item.series}` : '',
      item.directory ? `目录: ${item.directory}` : '条目根目录',
      KIND_LABELS[item.kind],
      formatSize(item.size),
      formatTime(item.mtimeMs)
    ].filter(Boolean).join(' · ');
    const badge = document.createElement('span');
    badge.className = 'admin-media-console__badge';
    badge.dataset.status = item.referenceStatus;
    badge.textContent = item.referenceStatus === 'referenced'
      ? `${REFERENCE_LABELS[item.referenceStatus]} ${item.referenceCount}`
      : REFERENCE_LABELS[item.referenceStatus];
    body.append(title, filePath, meta, badge);

    listItem.append(checkbox, thumb, body);
    return listItem;
  };

  const renderList = (result: ListResult) => {
    listEl.replaceChildren();
    emptyEl.hidden = result.items.length > 0;
    summaryEl.textContent = `共 ${result.totalCount} 个文件 · 本页 ${result.items.length} 个 · 已选 ${selectedPaths.size} 个`;
    for (const item of result.items) {
      listEl.append(createItemElement(item));
    }
    syncSelectAll();
  };

  const syncSelectAll = () => {
    const pageItems = currentResult?.items ?? [];
    selectAllEl.checked = pageItems.length > 0 && pageItems.every((item) => selectedPaths.has(item.path));
    selectAllEl.indeterminate = pageItems.some((item) => selectedPaths.has(item.path)) && !selectAllEl.checked;
  };

  const applyResult = (result: ListResult) => {
    currentResult = result;
    state = { ...state, page: result.page };
    renderTree(result.tree);
    renderBreadcrumb(result.breadcrumb);
    renderList(result);
    pageMetaEl.textContent = `${result.page} / ${result.totalPages}`;
    prevBtn.disabled = busy || result.page <= 1;
    nextBtn.disabled = busy || result.page >= result.totalPages;
    syncForm();
    syncExportLinks();
    updateUrl();
  };

  const load = async () => {
    const token = ++requestToken;
    busy = true;
    selectedPaths = new Set();
    setStatus('loading', '正在加载媒体…');
    try {
      const params = new URLSearchParams({
        page: String(state.page),
        limit: '40'
      });
      if (state.collection) params.set('collection', state.collection);
      if (state.series) params.set('series', state.series);
      if (state.entry) params.set('entry', state.entry);
      if (state.dir) params.set('dir', state.dir);
      if (state.ref) params.set('ref', state.ref);
      if (state.type) params.set('type', state.type);
      if (state.from) params.set('from', state.from);
      if (state.to) params.set('to', state.to);
      if (state.q) params.set('q', state.q);

      const response = await fetch(`${listEndpoint}?${params.toString()}`, {
        headers: { accept: 'application/json' }
      });
      const payload = await response.json().catch(() => null) as unknown;
      if (token !== requestToken) return;
      if (!response.ok) {
        throw new Error(isRecord(payload) && Array.isArray(payload.errors)
          ? String(payload.errors[0] ?? '媒体列表加载失败')
          : '媒体列表加载失败');
      }
      const result = getResult(payload);
      applyResult(result);
      setStatus('ok', result.totalCount > 0 ? `已加载 ${result.totalCount} 个媒体文件` : '没有找到符合条件的媒体文件');
    } catch (error) {
      if (token !== requestToken) return;
      listEl.replaceChildren();
      emptyEl.hidden = false;
      summaryEl.textContent = '';
      setStatus('error', error instanceof Error ? error.message : '媒体列表加载失败');
    } finally {
      if (token === requestToken) {
        busy = false;
        prevBtn.disabled = state.page <= 1;
        nextBtn.disabled = state.page >= (currentResult?.totalPages ?? 1);
      }
    }
  };

  const readFilterForm = () => {
    const data = new FormData(filterForm);
    const rawRef = String(data.get('ref') ?? '');
    const rawType = String(data.get('type') ?? '');
    state = {
      ...state,
      collection: String(data.get('collection') ?? '').trim(),
      series: String(data.get('series') ?? '').trim(),
      entry: String(data.get('entry') ?? '').trim(),
      dir: String(data.get('dir') ?? '').trim(),
      ref: rawRef === 'referenced' || rawRef === 'unreferenced' || rawRef === 'orphan' ? rawRef : '',
      type: rawType === 'image' || rawType === 'file' ? rawType : '',
      from: String(data.get('from') ?? '').trim(),
      to: String(data.get('to') ?? '').trim(),
      q: String(data.get('q') ?? '').trim(),
      page: 1
    };
  };

  filterForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (busy) return;
    readFilterForm();
    void load();
  });

  resetBtn?.addEventListener('click', () => {
    if (busy) return;
    state = {
      collection: '',
      series: '',
      entry: '',
      dir: '',
      ref: '',
      type: '',
      from: '',
      to: '',
      q: '',
      page: 1
    };
    syncForm();
    void load();
  });

  selectAllEl.addEventListener('change', () => {
    const pageItems = currentResult?.items ?? [];
    if (selectAllEl.checked) pageItems.forEach((item) => selectedPaths.add(item.path));
    else pageItems.forEach((item) => selectedPaths.delete(item.path));
    renderList(currentResult ?? { items: [], page: 1, totalPages: 1, totalCount: 0, tree: [], breadcrumb: [] });
  });

  prevBtn.addEventListener('click', () => {
    if (busy || state.page <= 1) return;
    state = { ...state, page: state.page - 1 };
    void load();
  });

  nextBtn.addEventListener('click', () => {
    if (busy || !currentResult || state.page >= currentResult.totalPages) return;
    state = { ...state, page: state.page + 1 };
    void load();
  });

  const getSelectedItems = (): Array<{ path: string }> =>
    Array.from(selectedPaths).map((filePath) => ({ path: filePath }));

  const runBatch = async (action: 'rename' | 'move' | 'delete') => {
    if (busy) return;
    const items = getSelectedItems();
    if (items.length === 0) {
      setStatus('error', '请先勾选要操作的文件');
      return;
    }

    if (action === 'delete') {
      const confirmed = window.confirm(`确定删除选中的 ${items.length} 个文件？此操作不可撤销。`);
      if (!confirmed) return;
    }

    let payloadItems = items;
    if (action === 'rename') {
      const prefix = window.prompt('批量重命名：输入新文件名前缀（结果：<前缀>-原文件名，扩展名不变）');
      const normalizedPrefix = (prefix ?? '').trim();
      if (!normalizedPrefix) return;
      if (!window.confirm(`确定重命名选中的 ${items.length} 个文件？`)) return;
      payloadItems = items.map((item) => ({
        ...item,
        name: `${normalizedPrefix}-${item.path.split('/').pop() ?? ''}`
      }));
    }
    if (action === 'move') {
      const target = window.prompt(
        '批量移动：输入目标目录（必须位于 content/ 或 public/images/）',
        `content/${state.collection}/`
      );
      const normalizedTarget = (target ?? '').trim();
      if (!normalizedTarget) return;
      if (!/^(?:content|public\/images)(?:\/|$)/.test(normalizedTarget)) {
        setStatus('error', '移动目标必须是 content/ 或 public/images/ 下的目录');
        return;
      }
      if (!window.confirm(`确定把选中的 ${items.length} 个文件移动到 ${normalizedTarget}？`)) return;
      payloadItems = items.map((item) => ({ ...item, to: normalizedTarget.replace(/\/+$/, '') }));
    }

    busy = true;
    setStatus('loading', action === 'delete' ? '正在删除…' : action === 'move' ? '正在移动…' : '正在重命名…');
    try {
      const response = await fetch(batchEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, items: payloadItems })
      });
      const payload = await response.json().catch(() => null) as unknown;
      if (!response.ok) {
        const message = isRecord(payload) && Array.isArray(payload.errors)
          ? String(payload.errors[0] ?? '批量操作失败')
          : `批量操作失败（HTTP ${response.status}）`;
        throw new Error(message);
      }
      const result = isRecord(payload) && isRecord(payload.result) ? payload.result : null;
      const failed = result && Array.isArray(result.results)
        ? result.results.filter((item): item is Record<string, unknown> => isRecord(item) && item.ok === false)
        : [];
      if (failed.length > 0) {
        const messages = failed
          .slice(0, 3)
          .map((item) => `${String(item.path ?? '')}：${String(item.error ?? '操作失败')}`);
        setStatus('error', `${failed.length} 个文件操作失败；${messages.join('；')}`);
      } else {
        setStatus('ok', `已完成 ${items.length} 个文件的批量${action === 'delete' ? '删除' : action === 'move' ? '移动' : '重命名'}`);
      }
      selectedPaths = new Set();
      await load();
    } catch (error) {
      setStatus('error', error instanceof Error ? error.message : '批量操作失败');
    } finally {
      busy = false;
    }
  };

  root.querySelectorAll<HTMLButtonElement>('[data-admin-media-batch]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.adminMediaBatch;
      if (action === 'rename' || action === 'move' || action === 'delete') {
        void runBatch(action);
      }
    });
  });

  uploadForm.querySelectorAll<HTMLButtonElement>('[data-admin-media-upload-kind]').forEach((button) => {
    button.addEventListener('click', () => {
      uploadKind = button.dataset.adminMediaUploadKind === 'file' ? 'file' : 'image';
    });
  });

  uploadForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (busy) return;
    if (!state.collection || !state.entry) {
      setStatus('error', '请先在树中选择一个 version / 条目，再上传文件');
      return;
    }
    const input = getField<HTMLInputElement>(uploadForm, uploadKind === 'image' ? 'image' : 'file');
    const file = input?.files?.[0];
    if (!(file instanceof File) || file.size === 0) {
      setStatus('error', uploadKind === 'image' ? '请选择图片文件' : '请选择附件文件');
      return;
    }

    busy = true;
    setStatus('loading', uploadKind === 'image' ? '正在上传图片…' : '正在上传附件…');
    void (async () => {
      try {
        const formData = new FormData();
        formData.set('collection', state.collection);
        formData.set('entryId', state.entry);
        formData.set(uploadKind === 'image' ? 'image' : 'file', file);
        const response = await fetch(
          uploadKind === 'image' ? imageUploadEndpoint : fileUploadEndpoint,
          { method: 'POST', body: formData }
        );
        const payload = await response.json().catch(() => null) as unknown;
        if (!response.ok || !isRecord(payload) || payload.ok !== true) {
          const message = isRecord(payload) && Array.isArray(payload.errors)
            ? String(payload.errors[0] ?? '上传失败')
            : `上传失败（HTTP ${response.status}）`;
          throw new Error(message);
        }
        const result = isRecord(payload.result) ? payload.result : {};
        setStatus('ok', `已上传到 ${String(result.path ?? state.entry)}`);
        uploadForm.reset();
        await load();
      } catch (error) {
        setStatus('error', error instanceof Error ? error.message : '上传失败');
      } finally {
        busy = false;
      }
    })();
  });

  importForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (busy) return;
    const input = getField<HTMLInputElement>(importForm, 'file');
    const file = input?.files?.[0];
    if (!(file instanceof File) || file.size === 0) {
      setStatus('error', '请选择要导入的 zip 文件');
      return;
    }

    busy = true;
    setStatus('loading', '正在导入条目 zip…');
    void (async () => {
      try {
        const formData = new FormData();
        formData.set('file', file);
        const response = await fetch(importEndpoint, { method: 'POST', body: formData });
        const payload = await response.json().catch(() => null) as unknown;
        if (!response.ok || !isRecord(payload) || payload.ok !== true) {
          const message = isRecord(payload) && Array.isArray(payload.errors)
            ? String(payload.errors[0] ?? '导入失败')
            : `导入失败（HTTP ${response.status}）`;
          throw new Error(message);
        }
        const result = isRecord(payload.result) ? payload.result : {};
        setStatus('ok', `已导入 ${String(result.relativePath ?? '')}，编辑入口：${String(result.editHref ?? '')}`);
        importForm.reset();
        await load();
      } catch (error) {
        setStatus('error', error instanceof Error ? error.message : '导入失败');
      } finally {
        busy = false;
      }
    })();
  });

  syncForm();
  syncExportLinks();
  void load();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

export {};
