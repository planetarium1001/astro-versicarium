import {
  ADMIN_CONTENT_COLLECTION_KEYS,
  getAdminContentCollectionCapability
} from '../content-collections';
import { addToCounts, createEmptyCounts } from './filter';
import {
  SHARED_ENTRY_ID,
  SHARED_LABEL,
  UNASSIGNED_VERSION_GROUP,
  UNASSIGNED_VERSION,
  type AdminMediaBreadcrumb,
  type AdminMediaFilterOption,
  type AdminMediaItem,
  type AdminMediaListRequest,
  type AdminMediaListResult,
  type AdminMediaTreeNode
} from './types';

const createTreeNode = (
  kind: AdminMediaTreeNode['kind'],
  label: string,
  filters: Pick<
    AdminMediaTreeNode,
    'collection' | 'versionGroup' | 'version' | 'entryId' | 'directory'
  >
): AdminMediaTreeNode => ({
  id: `${filters.collection}:${filters.versionGroup}:${filters.version}:${kind}:${filters.directory}`,
  kind,
  label,
  ...createEmptyCounts(),
  ...filters,
  children: []
});

/**
 * 树按 collection → versionGroup（仅版本线）→ version/entry → 目录 逐层建立；
 * 不在版本线里的条目跳过 versionGroup 层，避免出现同名两级目录。count 只统计当前筛选池。
 */
export const buildMediaTree = (items: readonly AdminMediaItem[]): AdminMediaTreeNode[] => {
  const collectionNodes = new Map<string, AdminMediaTreeNode>();

  for (const item of items) {
    const collectionLabel = getAdminContentCollectionCapability(item.collection).label;
    let collectionNode = collectionNodes.get(item.collection);
    if (!collectionNode) {
      collectionNode = createTreeNode('collection', collectionLabel, {
        collection: item.collection,
        versionGroup: '',
        version: '',
        entryId: '',
        directory: ''
      });
      collectionNodes.set(item.collection, collectionNode);
    }
    addToCounts(collectionNode, item);

    // 共享资源是 collection 级节点，与未归属资源同级，目录直接挂在它下面。
    if (item.entryId === SHARED_ENTRY_ID) {
      let sharedNode = collectionNode.children.find((child) => child.kind === 'shared');
      if (!sharedNode) {
        sharedNode = createTreeNode('shared', SHARED_LABEL, {
          collection: item.collection,
          versionGroup: '',
          version: '',
          entryId: SHARED_ENTRY_ID,
          directory: ''
        });
        collectionNode.children.push(sharedNode);
      }
      addToCounts(sharedNode, item);

      const sharedDirectoryKey = item.directory;
      let sharedDirectoryNode = sharedNode.children.find(
        (child) => child.directory === sharedDirectoryKey
      );
      if (!sharedDirectoryNode) {
        sharedDirectoryNode = createTreeNode(
          'directory',
          sharedDirectoryKey || '条目根目录',
          {
            collection: item.collection,
            versionGroup: '',
            version: '',
            entryId: SHARED_ENTRY_ID,
            directory: sharedDirectoryKey
          }
        );
        sharedNode.children.push(sharedDirectoryNode);
      }
      addToCounts(sharedDirectoryNode, item);
      continue;
    }

    const versionGroupKey = item.hasVersionGroup
      ? (item.versionGroup || UNASSIGNED_VERSION_GROUP)
      : '';
    let parentNode = collectionNode;

    if (item.hasVersionGroup) {
      let versionGroupNode = collectionNode.children.find(
        (child) => child.kind === 'versionGroup' && child.versionGroup === versionGroupKey
      );
      if (!versionGroupNode) {
        versionGroupNode = createTreeNode(
          'versionGroup',
          item.versionGroupLabel || versionGroupKey,
          {
            collection: item.collection,
            versionGroup: versionGroupKey,
            version: '',
            entryId: '',
            directory: ''
          }
        );
        collectionNode.children.push(versionGroupNode);
      }
      addToCounts(versionGroupNode, item);
      parentNode = versionGroupNode;
    }

    const versionKey = item.hasVersionGroup
      ? (item.version || item.entryId || UNASSIGNED_VERSION)
      : (item.entryId || UNASSIGNED_VERSION);
    const nodeVersion = item.hasVersionGroup ? versionKey : '';
    let versionNode = parentNode.children.find(
      (child) => child.kind === 'version' && child.version === nodeVersion && child.entryId === item.entryId
    );
    if (!versionNode) {
      versionNode = createTreeNode(
        'version',
        item.hasVersionGroup
          ? (item.versionLabel || versionKey)
          : (item.entryId ? (item.entryLabel || versionKey) : '未归属资源'),
        {
          collection: item.collection,
          versionGroup: versionGroupKey,
          version: nodeVersion,
          entryId: item.entryId,
          directory: ''
        }
      );
      parentNode.children.push(versionNode);
    }
    addToCounts(versionNode, item);

    const directoryKey = item.directory;
    let directoryNode = versionNode.children.find((child) => child.directory === directoryKey);
    if (!directoryNode) {
      directoryNode = createTreeNode('directory', directoryKey || '条目根目录', {
        collection: item.collection,
        versionGroup: versionGroupKey,
        version: item.hasVersionGroup ? versionKey : '',
        entryId: item.entryId,
        directory: directoryKey
      });
      versionNode.children.push(directoryNode);
    }
    addToCounts(directoryNode, item);
  }

  const sortNodes = (nodes: AdminMediaTreeNode[]): void => {
    nodes.sort((left, right) => {
      if (left.kind === 'shared' && right.kind !== 'shared') return -1;
      if (right.kind === 'shared' && left.kind !== 'shared') return 1;
      if (left.kind === 'collection' && right.kind === 'collection') {
        return ADMIN_CONTENT_COLLECTION_KEYS.indexOf(left.collection)
          - ADMIN_CONTENT_COLLECTION_KEYS.indexOf(right.collection);
      }
      if (left.kind === 'directory') {
        return (left.directory || '').localeCompare(right.directory || '', 'zh-CN');
      }
      return left.label.localeCompare(right.label, 'zh-CN');
    });
    for (const node of nodes) sortNodes(node.children);
  };
  const roots = Array.from(collectionNodes.values());
  sortNodes(roots);
  return roots;
};

export const buildBreadcrumb = (
  tree: readonly AdminMediaTreeNode[],
  filters: AdminMediaListRequest
): AdminMediaBreadcrumb[] => {
  const breadcrumb: AdminMediaBreadcrumb[] = [
    { id: 'all', label: '全部媒体', filters: {} }
  ];
  if (!filters.collection) return breadcrumb;

  const collectionNode = tree.find((node) => node.collection === filters.collection);
  if (!collectionNode) return breadcrumb;
  breadcrumb.push({
    id: collectionNode.id,
    label: collectionNode.label,
    filters: { collection: filters.collection }
  });
  let parentNode = collectionNode;
  if (filters.versionGroup) {
    const versionGroupNode = collectionNode.children.find(
      (node) => node.kind === 'versionGroup' && node.versionGroup === filters.versionGroup
    );
    if (!versionGroupNode) return breadcrumb;
    breadcrumb.push({
      id: versionGroupNode.id,
      label: versionGroupNode.label,
      filters: { collection: filters.collection, versionGroup: filters.versionGroup }
    });
    parentNode = versionGroupNode;
  }

  const entryId = filters.entry || filters.version;
  if (!entryId) return breadcrumb;

  if (entryId === SHARED_ENTRY_ID) {
    const sharedNode = collectionNode.children.find((node) => node.kind === 'shared');
    if (!sharedNode) return breadcrumb;
    breadcrumb.push({
      id: sharedNode.id,
      label: sharedNode.label,
      filters: {
        collection: filters.collection,
        entry: SHARED_ENTRY_ID
      }
    });
    if (!filters.directory) return breadcrumb;

    const sharedDirectoryNode = sharedNode.children.find(
      (node) => node.directory === filters.directory
    );
    if (sharedDirectoryNode) {
      breadcrumb.push({
        id: sharedDirectoryNode.id,
        label: sharedDirectoryNode.label,
        filters: {
          collection: filters.collection,
          entry: SHARED_ENTRY_ID,
          directory: filters.directory
        }
      });
    }
    return breadcrumb;
  }

  const versionNode = parentNode.children.find(
    (node) => node.kind === 'version' && node.entryId === entryId
  );
  if (!versionNode) return breadcrumb;
  breadcrumb.push({
    id: versionNode.id,
    label: versionNode.label,
    filters: {
      collection: filters.collection,
      ...(filters.versionGroup ? { versionGroup: filters.versionGroup } : {}),
      entry: entryId
    }
  });
  if (!filters.directory) return breadcrumb;

  const directoryNode = versionNode.children.find((node) => node.directory === filters.directory);
  if (directoryNode) {
    breadcrumb.push({
      id: directoryNode.id,
      label: directoryNode.label,
      filters: {
        collection: filters.collection,
        ...(filters.versionGroup ? { versionGroup: filters.versionGroup } : {}),
        entry: entryId,
        directory: filters.directory
      }
    });
  }
  return breadcrumb;
};

export const buildFilterOptions = (
  items: readonly AdminMediaItem[],
  key: 'reference' | 'type'
): AdminMediaFilterOption[] => {
  if (key === 'type') {
    return [
      { value: 'all', label: '全部类型', count: items.length },
      { value: 'image', label: '图片', count: items.filter((item) => item.kind === 'image').length },
      { value: 'file', label: '附件', count: items.filter((item) => item.kind === 'file').length }
    ];
  }
  return [
    { value: 'all', label: '全部引用状态', count: items.length },
    { value: 'referenced', label: '已引用', count: items.filter((item) => item.referenceStatus === 'referenced').length },
    { value: 'unreferenced', label: '未引用', count: items.filter((item) => item.referenceStatus === 'unreferenced').length },
    { value: 'orphan', label: '孤儿', count: items.filter((item) => item.referenceStatus === 'orphan').length }
  ];
};

export const buildMediaFilterOptions = (
  items: readonly AdminMediaItem[]
): AdminMediaListResult['options'] => {
  const versionGroups = new Map<string, AdminMediaFilterOption>();
  const versions = new Map<string, AdminMediaFilterOption>();
  const directories = new Map<string, AdminMediaFilterOption>();

  for (const item of items) {
    if (item.entryExists) {
      if (item.hasVersionGroup) {
        const versionGroupKey = `${item.collection}:${item.versionGroup}`;
        const versionGroupOption = versionGroups.get(versionGroupKey) ?? {
          value: item.versionGroup,
          label: item.versionGroupLabel || item.versionGroup,
          count: 0,
          collection: item.collection
        };
        versionGroupOption.count += 1;
        versionGroups.set(versionGroupKey, versionGroupOption);
      }

      const versionOption = versions.get(item.entryId) ?? {
        value: item.entryId,
        label: item.hasVersionGroup ? (item.versionLabel || item.entryId) : item.entryLabel,
        count: 0,
        collection: item.collection,
        versionGroup: item.versionGroup,
        entryId: item.entryId
      };
      versionOption.count += 1;
      versions.set(item.entryId, versionOption);

      const directoryKey = `${item.entryId}\u0000${item.directory}`;
      const directoryOption = directories.get(directoryKey) ?? {
        value: item.directory,
        label: item.directory || '条目根目录',
        count: 0,
        collection: item.collection,
        versionGroup: item.versionGroup,
        entryId: item.entryId
      };
      directoryOption.count += 1;
      directories.set(directoryKey, directoryOption);
    }
  }

  const sortOptions = (values: AdminMediaFilterOption[]): AdminMediaFilterOption[] =>
    values.sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));

  return {
    versionGroups: sortOptions(Array.from(versionGroups.values())),
    versions: sortOptions(Array.from(versions.values())),
    directories: sortOptions(Array.from(directories.values()))
  };
};
