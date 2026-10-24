import type { SidebarNavId } from '@/lib/theme-settings';
import {
  ADMIN_NAV_IDS,
  ADMIN_NAV_ORNAMENT_DEFAULT,
  isAdminNavId,
  normalizeAdminSocialIconKey,
  normalizeOptionalSingleLine,
  parseOrder
} from '@/lib/admin-console/theme-shared';
import type { EditableCustomSocialItem, EditableNavItem, FormCodecContext } from './context';

export type NavSocialCodec = {
  collectNavItems: () => EditableNavItem[];
  collectCustomItems: () => EditableCustomSocialItem[];
  applyNavRows: (nav: EditableNavItem[]) => void;
};

export const createNavSocialCodec = (context: FormCodecContext): NavSocialCodec => {
  const {
    defaultCustomSocialIconKey,
    getCustomRowLabelInput,
    getCustomRows,
    getNavRows,
    normalizeCustomSocialLabel,
    query
  } = context;

  const collectNavItems = (): EditableNavItem[] => {
    return getNavRows().map((row, index): EditableNavItem => {
      const idRaw = row.getAttribute('data-nav-id')?.trim() ?? '';
      const id = isAdminNavId(idRaw) ? idRaw : ADMIN_NAV_IDS[index] ?? 'blog';
      const labelInput = query<HTMLInputElement>(row, '[data-nav-field="label"]');
      const ornamentInput = query<HTMLInputElement>(row, '[data-nav-field="ornament"]');
      const orderInput = query<HTMLInputElement>(row, '[data-nav-field="order"]');
      const visibleInput = query<HTMLInputElement>(row, '[data-nav-field="visible"]');
      const fallbackOrder = index + 1;
      return {
        id,
        label: labelInput?.value.trim() || '',
        ornament: ornamentInput ? normalizeOptionalSingleLine(ornamentInput.value) : ADMIN_NAV_ORNAMENT_DEFAULT,
        order: parseOrder(orderInput?.value || '', fallbackOrder),
        visible: Boolean(visibleInput?.checked)
      };
    });
  };

  const collectCustomItems = (): EditableCustomSocialItem[] => {
    return getCustomRows().map((row, index): EditableCustomSocialItem => {
      const idInput = query<HTMLInputElement>(row, '[data-social-custom-field="id"]');
      const labelInput = getCustomRowLabelInput(row);
      const hrefInput = query<HTMLInputElement>(row, '[data-social-custom-field="href"]');
      const iconInput = query<HTMLSelectElement>(row, '[data-social-custom-field="iconKey"]');
      const orderInput = query<HTMLInputElement>(row, '[data-social-custom-field="order"]');
      const visibleInput = query<HTMLInputElement>(row, '[data-social-custom-field="visible"]');
      const iconKey = normalizeAdminSocialIconKey(iconInput?.value) ?? defaultCustomSocialIconKey;
      return {
        id: idInput?.value.trim() || '',
        label: normalizeCustomSocialLabel(labelInput?.value, iconKey),
        href: hrefInput?.value.trim() || '',
        iconKey,
        order: parseOrder(orderInput?.value || '', index + 1),
        visible: Boolean(visibleInput?.checked)
      };
    });
  };

  const applyNavRows = (nav: EditableNavItem[]): void => {
    const navMap = new Map<SidebarNavId, EditableNavItem>(nav.map((item) => [item.id, item]));
    getNavRows().forEach((row, index) => {
      const rawId = row.getAttribute('data-nav-id')?.trim() ?? '';
      const id = isAdminNavId(rawId) ? rawId : ADMIN_NAV_IDS[index] ?? 'blog';
      const current = navMap.get(id);
      const labelInput = query<HTMLInputElement>(row, '[data-nav-field="label"]');
      const ornamentInput = query<HTMLInputElement>(row, '[data-nav-field="ornament"]');
      const orderInput = query<HTMLInputElement>(row, '[data-nav-field="order"]');
      const visibleInput = query<HTMLInputElement>(row, '[data-nav-field="visible"]');
      if (labelInput) labelInput.value = current?.label?.trim() || '';
      if (ornamentInput) ornamentInput.value = current?.ornament ?? '';
      if (orderInput) orderInput.value = String(current?.order ?? (index + 1));
      if (visibleInput) visibleInput.checked = Boolean(current?.visible);
    });

    // 行序与编号保持一致：按排序值重排导航行（同值保持现有先后）
    const navRows = getNavRows();
    const navList = navRows[0]?.parentElement;
    if (navList) {
      navRows
        .map((row, index) => ({
          row,
          order: parseOrder(query<HTMLInputElement>(row, '[data-nav-field="order"]')?.value || '', index + 1)
        }))
        .sort((a, b) => a.order - b.order)
        .forEach((item) => navList.append(item.row));
    }
  };

  return {
    collectNavItems,
    collectCustomItems,
    applyNavRows
  };
};
