export type BitPublicOrderItem = {
  id: string;
  date: Date;
  draft: boolean;
};

type BitRoutingOrderItem = Pick<BitPublicOrderItem, 'id' | 'date'>;

export const getBitAnchorId = (key: string) => `bit-${key}`;

/** `/bits/` 是唯一列表页，锚点直接落在该页。 */
export const getBitsPagePath = (_page: number = 1) => '/bits/';

export const compareBitsForRouting = <T extends BitRoutingOrderItem>(left: T, right: T): number => {
  const dateOrder = right.date.valueOf() - left.date.valueOf();
  if (dateOrder !== 0) return dateOrder;
  return left.id.localeCompare(right.id, 'en');
};

const orderBitsForRouting = <T extends BitRoutingOrderItem>(items: readonly T[]): T[] =>
  items.slice().sort(compareBitsForRouting);

export const orderPublishedBitsForRouting = <T extends BitPublicOrderItem>(items: readonly T[]): T[] =>
  orderBitsForRouting(items.filter((item) => item.draft !== true));

export const buildPublishedBitsHrefMap = (
  items: readonly BitPublicOrderItem[]
): Map<string, string> => {
  const hrefById = new Map<string, string>();
  orderPublishedBitsForRouting(items).forEach((item) => {
    hrefById.set(item.id, `${getBitsPagePath()}#${getBitAnchorId(item.id)}`);
  });
  return hrefById;
};
