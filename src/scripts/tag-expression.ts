/**
 * 标签筛选的复合逻辑表达式。状态是分段数组 [{ op, keys }]：
 * 每段的 op 同时约束段内标签之间，以及该段与左侧累计结果之间。
 * `and` 段要求全部命中，`or` 段要求任一命中。
 * 本模块是纯函数、无 DOM；渲染与事件在 `entry-search.ts`。
 */

export type TagOp = 'and' | 'or';

export type TagSegment = {
  op: TagOp;
  keys: string[];
};

/** 预览条渲染用的记号：标签 / 运算符 / 括号。 */
export type ExpressionToken =
  | { type: 'tag'; key: string; segmentIndex: number }
  /** `segmentIndex` = 该运算符右侧那一段的下标（点击它就改这一段的 op） */
  | { type: 'op'; op: TagOp; segmentIndex: number }
  | { type: 'paren'; side: '(' | ')' };

export const OP_CHAR: Record<TagOp, string> = { and: '+', or: '/' };

export const isTagOp = (value: unknown): value is TagOp => value === 'and' || value === 'or';

/** 空表达式 = 一个空的待选段。 */
export const createEmptyExpression = (): TagSegment[] => [{ op: 'and', keys: [] }];

const cloneSegments = (segments: readonly TagSegment[]): TagSegment[] =>
  segments.map((segment) => ({ op: segment.op, keys: [...segment.keys] }));

/**
 * 丢弃空段、合并相邻同 op 的段，并在末尾保留一个段。
 *
 * 仅当输入末段本来就为空时才保留空段：它代表用户刚切过运算符，预览需显示成 `( 已选 ) /`。
 * 无条件补空段会把 `tags=a` 渲染成 `( a ) +`，产生多余括号与悬空运算符。
 */
const normalizeExpression = (segments: readonly TagSegment[]): TagSegment[] => {
  const merged: TagSegment[] = [];
  for (const segment of segments) {
    if (segment.keys.length === 0) continue;
    const previous = merged.at(-1);
    if (previous && previous.op === segment.op) {
      previous.keys.push(...segment.keys);
      continue;
    }
    merged.push({ op: segment.op, keys: [...segment.keys] });
  }

  const last = segments.at(-1);
  if (last && last.keys.length === 0) merged.push({ op: last.op, keys: [] });
  return merged;
};

/** 表达式里选中的全部标签（按出现顺序，去重）。 */
export const listTagKeys = (segments: readonly TagSegment[]): string[] => {
  const keys: string[] = [];
  for (const segment of segments) {
    for (const key of segment.keys) {
      if (!keys.includes(key)) keys.push(key);
    }
  }
  return keys;
};

export const hasAnyTag = (segments: readonly TagSegment[]): boolean =>
  listTagKeys(segments).length > 0;

const hasTag = (segments: readonly TagSegment[], key: string): boolean =>
  listTagKeys(segments).includes(key);

/** 当前待选段的运算符 = 预览条上 `+` `/` 的激活态。 */
export const getPendingOp = (segments: readonly TagSegment[]): TagOp =>
  segments.at(-1)?.op ?? 'and';

/** 点一个标签：已选则移除，未选则追加到最后一个段（也就是当前待选段）。 */
export const toggleTag = (segments: readonly TagSegment[], key: string): TagSegment[] => {
  const next = cloneSegments(segments);
  if (hasTag(next, key)) {
    return normalizeExpression(
      next.map((segment) => ({ ...segment, keys: segment.keys.filter((item) => item !== key) }))
    );
  }
  const last = next.at(-1);
  if (last) last.keys.push(key);
  else next.push({ op: 'and', keys: [key] });
  return normalizeExpression(next);
};

export const removeTag = (segments: readonly TagSegment[], key: string): TagSegment[] =>
  normalizeExpression(
    cloneSegments(segments).map((segment) => ({
      ...segment,
      keys: segment.keys.filter((item) => item !== key)
    }))
  );

/**
 * 切换 `+` / `/`。
 *
 * 待选段非空：左侧整体加括号并追加一个 op 为 `next` 的空段。
 * 待选段为空：只改末段 op，反复切换不产生多余括号。
 */
export const switchPendingOp = (segments: readonly TagSegment[], next: TagOp): TagSegment[] => {
  const list = cloneSegments(segments);
  const last = list.at(-1);
  if (!last) return [{ op: next, keys: [] }];
  if (last.keys.length === 0) {
    last.op = next;
    return normalizeExpression(list);
  }
  return normalizeExpression([...list, { op: next, keys: [] }]);
};

/** 改某一段的运算符（页头控件条上的连接符按钮走这条路）。 */
export const setSegmentOp = (
  segments: readonly TagSegment[],
  segmentIndex: number,
  next: TagOp
): TagSegment[] => {
  const list = cloneSegments(segments);
  if (segmentIndex < 0 || segmentIndex >= list.length) {
    return normalizeExpression(list);
  }
  list[segmentIndex] = { ...list[segmentIndex]!, op: next };
  return normalizeExpression(list);
};

/** 「0 命中」提示用：把最后一个非空段的 op 改成 or（等价于点「切换到 /」）。 */
export const switchLastNonEmptySegmentToOr = (segments: readonly TagSegment[]): TagSegment[] => {
  const list = cloneSegments(segments);
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (list[index]!.keys.length === 0) continue;
    list[index] = { ...list[index]!, op: 'or' };
    break;
  }
  return normalizeExpression(list);
};

/** 表达式是否只有一段（此时 URL 仍写成旧的 `tags=&mode=`，保持深链接兼容）。 */
export const isSingleSegment = (segments: readonly TagSegment[]): boolean =>
  normalizeExpression(segments).length === 1;

/**
 * 复合判断：段内先算，再自左向右与左边整体结合。
 * 空表达式（没选任何标签）返回 `true`，不参与筛选。
 */
export const evaluateExpression = (
  segments: readonly TagSegment[],
  tagKeys: readonly string[]
): boolean => {
  const list = normalizeExpression(segments).filter((segment) => segment.keys.length > 0);
  let accumulated: boolean | null = null;

  for (const segment of list) {
    const hits = segment.keys.filter((key) => tagKeys.includes(key)).length;
    const matched = segment.op === 'and' ? hits === segment.keys.length : hits > 0;
    if (accumulated === null) {
      accumulated = matched;
      continue;
    }
    accumulated = segment.op === 'and' ? accumulated && matched : accumulated || matched;
  }

  return accumulated ?? true;
};

/**
 * 预览记号流。左边整块在每次追加新段时被 `(` `)` 包起来，与求值顺序一致。
 */
export const buildExpressionTokens = (segments: readonly TagSegment[]): ExpressionToken[] => {
  const list = normalizeExpression(segments);
  const nonEmpty = list.filter((segment) => segment.keys.length > 0);
  if (nonEmpty.length === 0) return [];

  const tokens: ExpressionToken[] = [];
  /**
   * 左侧累计结果是否出现过运算符。出现过才加括号：
   * 单标签的 `a /` 不需要写成 `( a ) /`；`( a + b ) / c` 必须保留括号才读得出求值顺序。
   */
  let leftHasOp = false;

  nonEmpty.forEach((segment, index) => {
    if (index > 0) {
      if (leftHasOp) {
        tokens.unshift({ type: 'paren', side: '(' });
        tokens.push({ type: 'paren', side: ')' });
      }
      tokens.push({ type: 'op', op: segment.op, segmentIndex: index });
    }
    segment.keys.forEach((key, keyIndex) => {
      if (keyIndex > 0) tokens.push({ type: 'op', op: segment.op, segmentIndex: index });
      tokens.push({ type: 'tag', key, segmentIndex: index });
    });
    if (index > 0 || segment.keys.length > 1) leftHasOp = true;
  });

  // 末尾的空「待选段」：把刚切过的运算符也显示出来，预览才完整（`(a + b) /`）
  const pending = list.at(-1);
  if (pending && pending.keys.length === 0) {
    if (leftHasOp) {
      tokens.unshift({ type: 'paren', side: '(' });
      tokens.push({ type: 'paren', side: ')' });
    }
    tokens.push({ type: 'op', op: pending.op, segmentIndex: list.length - 1 });
  }

  return tokens;
};

/** 预览/控件条的纯文本形式（用于 aria-label、无障碍播报、断言）。 */
export const formatExpression = (segments: readonly TagSegment[], labelOf?: (key: string) => string): string =>
  buildExpressionTokens(segments)
    .map((token) => {
      if (token.type === 'op') return OP_CHAR[token.op];
      if (token.type === 'paren') return token.side;
      return labelOf ? labelOf(token.key) : token.key;
    })
    .join(' ');

/**
 * 从 URL 读表达式，兼容三种写法：
 * - `?tags=a,b&ops=and,or` —— 复合表达式（`ops` 与 `tags` 一一对应）；
 * - `?tags=a,b&mode=or`    —— 旧版扁平写法（所有标签同一 op）；
 * - `?tags=a`              —— 默认 AND。
 * 非法 key 由调用方通过 `isUsableKey` 过滤。
 */
export const parseExpression = (params: URLSearchParams, isUsableKey: (key: string) => boolean): TagSegment[] => {
  const rawTags = (params.get('tags') ?? '').trim();
  if (!rawTags) return createEmptyExpression();

  const keys = rawTags
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value && isUsableKey(value));
  if (keys.length === 0) return createEmptyExpression();

  const rawOps = (params.get('ops') ?? '').trim();
  const mode = (params.get('mode') ?? '').trim().toLowerCase();
  const ops = rawOps ? rawOps.split(',').map((value) => value.trim().toLowerCase()) : [];

  const segments: TagSegment[] = [];
  keys.forEach((key, index) => {
    const raw = ops[index] ?? mode;
    const op: TagOp = isTagOp(raw) ? raw : 'and';
    const previous = segments.at(-1);
    if (previous && previous.op === op) previous.keys.push(key);
    else segments.push({ op, keys: [key] });
  });

  return normalizeExpression(segments);
};

/**
 * 把表达式写进 URL：
 * - 单段写成旧的 `tags=&mode=`（保持既有深链接与测试口径）；
 * - 复合表达式追加与 `tags=` 一一对应的 `ops=`。
 */
export const applyExpressionToParams = (params: URLSearchParams, segments: readonly TagSegment[]): void => {
  const list = normalizeExpression(segments).filter((segment) => segment.keys.length > 0);
  if (list.length === 0) {
    params.delete('tags');
    params.delete('mode');
    params.delete('ops');
    return;
  }

  params.set('tags', list.flatMap((segment) => segment.keys).join(','));
  if (list.length > 1) {
    params.delete('mode');
    params.set('ops', list.flatMap((segment) => segment.keys.map(() => segment.op)).join(','));
    return;
  }
  params.delete('ops');
  params.set('mode', list[0]!.op);
};
