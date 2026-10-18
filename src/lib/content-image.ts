import { createWithBase } from '../utils/format';

export type ContentImageValue =
  | string
  | {
      src: string;
      width?: number;
      height?: number;
    }
  | null
  | undefined;

export const getContentImageSrc = (value: ContentImageValue): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  return value.src.trim() || null;
};

export const getContentImageDimensions = (
  value: ContentImageValue
): { width?: number; height?: number } => {
  if (!value || typeof value === 'string') return {};
  return {
    ...(value.width ? { width: value.width } : {}),
    ...(value.height ? { height: value.height } : {})
  };
};

/** 站内图片补部署 base；远程 URL 原样返回。 */
export const resolveContentImageSrc = (
  value: ContentImageValue,
  base = '/'
): string | null => {
  const src = getContentImageSrc(value);
  if (!src) return null;
  return createWithBase(base)(src);
};
