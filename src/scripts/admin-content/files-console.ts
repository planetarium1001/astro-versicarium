type FileItem = {
  path: string;
  value: string;
  owner: string;
  fileName: string;
  size: number;
  mimeType: string | null;
  referenceCount?: number;
  referenced?: boolean;
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const init = () => {
  const root = document.querySelector<HTMLElement>('[data-admin-files-root]');
  if (!root) return;
  const listEndpoint = root.dataset.listEndpoint ?? '';
  const uploadEndpoint = root.dataset.uploadEndpoint ?? '';
  const output = root.querySelector<HTMLElement>('[data-admin-files-list]');
  const form = root.querySelector<HTMLFormElement>('[data-admin-files-upload]');
  const status = root.querySelector<HTMLElement>('[data-admin-files-status]');
  if (!output || !form) return;

  const setStatus = (text: string, state: 'idle' | 'ok' | 'error' = 'idle') => {
    if (!status) return;
    status.textContent = text;
    status.dataset.state = state;
  };

  const render = (items: FileItem[]) => {
    output.replaceChildren();
    if (items.length === 0) {
      output.textContent = '还没有附件。';
      return;
    }
    const groups = new Map<string, FileItem[]>();
    for (const item of items) {
      const list = groups.get(item.owner) ?? [];
      list.push(item);
      groups.set(item.owner, list);
    }
    for (const [owner, files] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const section = document.createElement('section');
      section.className = 'admin-files-group';
      const heading = document.createElement('h3');
      heading.textContent = owner;
      section.append(heading);
      const list = document.createElement('ul');
      for (const file of files) {
        const item = document.createElement('li');
        const name = document.createElement('span');
        name.textContent = file.fileName;
        const meta = document.createElement('span');
        meta.className = 'admin-files-meta';
        meta.textContent = `${formatSize(file.size)} · ${file.mimeType ?? '未知类型'} · ${file.referenced ? `被引用 ${file.referenceCount ?? 0} 处` : '未引用'}`;
        if (!file.referenced) meta.classList.add('is-unreferenced');
        item.append(name, meta);
        list.append(item);
      }
      section.append(list);
      output.append(section);
    }
  };

  const load = async () => {
    try {
      const response = await fetch(listEndpoint, { headers: { accept: 'application/json' } });
      const payload = await response.json() as { ok?: boolean; result?: { items?: FileItem[] }; errors?: string[] };
      if (!response.ok || !payload.ok) throw new Error(payload.errors?.[0] ?? '附件列表加载失败');
      render(payload.result?.items ?? []);
    } catch (error) {
      output.textContent = error instanceof Error ? error.message : '附件列表加载失败';
      setStatus('附件列表加载失败', 'error');
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const owner = String(data.get('owner') ?? '').trim().replace(/\/+$/, '');
    const segments = owner.split('/');
    const collection = segments[1] ?? '';
    const entryId = segments.slice(2).join('/');
    const file = data.get('file');
    if (!owner.startsWith('content/') || !collection || !entryId) {
      setStatus('owner 需写成 content/<collection>/<entryId>', 'error');
      return;
    }
    if (!(file instanceof File) || file.size === 0) {
      setStatus('请选择附件文件', 'error');
      return;
    }
    void (async () => {
      const body = new FormData();
      body.set('collection', collection);
      body.set('entryId', entryId);
      body.set('file', file);
      setStatus('正在上传附件…');
      try {
        const response = await fetch(uploadEndpoint, { method: 'POST', body });
        const payload = await response.json() as { ok?: boolean; errors?: string[]; result?: { src?: string } };
        if (!response.ok || !payload.ok) throw new Error(payload.errors?.[0] ?? '附件上传失败');
        setStatus(`已上传 ${payload.result?.src ?? file.name}`, 'ok');
        form.reset();
        await load();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : '附件上传失败', 'error');
      }
    })();
  });

  void load();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

export {};
