/**
 * 媒体管理器索引：把 content/ 条目目录与 public/images/ 条目图片统一成
 * collection → series → version → 目录。图片和附件都来自磁盘扫描，引用状态来自
 * content/ 里的 Markdown 引用解析。
 */

export type {
  AdminMediaBreadcrumb,
  AdminMediaFilterOption,
  AdminMediaItem,
  AdminMediaKind,
  AdminMediaListRequest,
  AdminMediaListResult,
  AdminMediaOrigin,
  AdminMediaReferenceFilter,
  AdminMediaReferenceStatus,
  AdminMediaTreeNode,
  AdminMediaTypeFilter
} from './media-index/types';
export { getAdminMediaListRequest, listAdminMediaItems } from './media-index/query';
