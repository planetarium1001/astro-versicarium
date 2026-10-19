/**
 * 条目标题行的固定排版。
 *
 * 列表与归档统一为 `(分类胶囊) 标题 (版本号淡色胶囊)`，唯一的配置是版本名称出现的位置。
 * 版本号与版本名称只来自显式 frontmatter，不使用日期兜底。
 */

export type EntryVersionNameMode = 'hidden' | 'before-label' | 'after-label';

export type EntryTitleSurface = 'list' | 'archive' | 'project';

export type EntryTitleKind = 'blog' | 'projects' | 'devlog';

export const ENTRY_VERSION_NAME_MODES = ['hidden', 'before-label', 'after-label'] as const satisfies readonly EntryVersionNameMode[];

export const DEFAULT_ENTRY_VERSION_NAME_MODE: EntryVersionNameMode = 'hidden';

/**
 * 后台下拉框用「结构组合」而不是自然语言描述：每个选项直接画出字段顺序，
 * 下方的实时预览再给出真实条目外观。
 */
export const ENTRY_VERSION_NAME_MODE_OPTIONS = [
  { id: 'hidden', label: '分类 · 标题 · 版本号' },
  { id: 'before-label', label: '分类 · 标题 : 版本名称 · 版本号' },
  { id: 'after-label', label: '分类 · 标题 · 版本号 · 版本名称' }
] as const satisfies ReadonlyArray<{ id: EntryVersionNameMode; label: string }>;

export const ENTRY_TITLE_COLON = ': ';

export const isEntryVersionNameMode = (value: unknown): value is EntryVersionNameMode =>
  typeof value === 'string' && (ENTRY_VERSION_NAME_MODES as readonly string[]).includes(value);

export const normalizeEntryVersionNameMode = (value: unknown): EntryVersionNameMode =>
  isEntryVersionNameMode(value) ? value : DEFAULT_ENTRY_VERSION_NAME_MODE;

export type EntryTitleSegment =
  | { kind: 'badge'; text: string }
  | { kind: 'project'; text: string }
  | { kind: 'title'; text: string }
  | { kind: 'gap' }
  | { kind: 'colon' }
  | { kind: 'version-name'; text: string }
  | { kind: 'version-label'; text: string };

export type EntryTitleData = {
  /** 归档行类型：只有 devlog 使用「项目名: 标题」前缀。 */
  kind?: EntryTitleKind | null;
  badge?: string | null;
  project?: string | null;
  title: string;
  versionLabel?: string | null;
  versionName?: string | null;
};

const trimmed = (value: string | null | undefined): string => (value ?? '').trim();

const buildVersionSegments = (
  versionLabel: string,
  versionName: string,
  mode: EntryVersionNameMode
): EntryTitleSegment[] => {
  if (mode === 'before-label') {
    if (!versionName) return [{ kind: 'gap' }, { kind: 'version-label', text: versionLabel }];
    return [
      { kind: 'colon' },
      { kind: 'version-name', text: versionName },
      { kind: 'gap' },
      { kind: 'version-label', text: versionLabel }
    ];
  }

  if (mode === 'after-label') {
    const segments: EntryTitleSegment[] = [
      { kind: 'gap' },
      { kind: 'version-label', text: versionLabel }
    ];
    if (versionName) {
      segments.push({ kind: 'gap' }, { kind: 'version-name', text: versionName });
    }
    return segments;
  }

  return [{ kind: 'gap' }, { kind: 'version-label', text: versionLabel }];
};

/**
 * 生成固定顺序的标题行片段。
 *
 * - `list` / `project`：badge → 间隙 → 标题 → 版本段。
 * - `archive` + `devlog`：项目名 → `": "` → 标题，不显示版本段。
 * - 其余归档行：标题 → 版本段。
 * - `versionLabel` 为空时完全跳过版本段；`versionName` 为空时退化为仅版本号。
 */
export const buildEntryTitleSegments = (
  data: EntryTitleData,
  surface: EntryTitleSurface,
  mode: EntryVersionNameMode = DEFAULT_ENTRY_VERSION_NAME_MODE
): EntryTitleSegment[] => {
  const title = data.title ?? '';
  const versionLabel = trimmed(data.versionLabel);
  const versionName = trimmed(data.versionName);
  const project = trimmed(data.project);

  if (surface === 'archive' && data.kind === 'devlog') {
    const segments: EntryTitleSegment[] = [];
    if (project) {
      segments.push({ kind: 'project', text: project }, { kind: 'colon' });
    }
    segments.push({ kind: 'title', text: title });
    return segments;
  }

  const segments: EntryTitleSegment[] = [];

  if (surface !== 'archive') {
    const badge = trimmed(data.badge) || (surface === 'list' ? '随笔' : '');
    if (badge) segments.push({ kind: 'badge', text: badge }, { kind: 'gap' });
  }

  segments.push({ kind: 'title', text: title });

  if (versionLabel) {
    segments.push(...buildVersionSegments(versionLabel, versionName, mode));
  }

  return segments;
};
