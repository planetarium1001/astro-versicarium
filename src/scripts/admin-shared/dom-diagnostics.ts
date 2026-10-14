export const ADMIN_DOM_SETUP_ERROR_STATUS = '初始化失败，请查看控制台';

type AdminDomControlMap<TControls> = {
  [Key in keyof TControls]: Element | null;
};

type RequiredAdminDomControls<TControls extends AdminDomControlMap<TControls>> = {
  [Key in keyof TControls]: NonNullable<TControls[Key]>;
};

type AdminDomControlQueryResult<TControls extends AdminDomControlMap<TControls>> =
  | {
      ok: true;
      controls: RequiredAdminDomControls<TControls>;
    }
  | {
      ok: false;
      controls: TControls;
      missing: string[];
    };

export const queryAdminDomControls = <TControls extends AdminDomControlMap<TControls>>(
  controls: TControls,
  selectors: Record<keyof TControls, string>
): AdminDomControlQueryResult<TControls> => {
  const missing = (Object.keys(selectors) as Array<keyof TControls>).flatMap((key) =>
    controls[key] ? [] : [selectors[key]]
  );

  if (missing.length > 0) {
    return {
      ok: false,
      controls,
      missing
    };
  }

  return {
    ok: true,
    controls: controls as RequiredAdminDomControls<TControls>
  };
};

export const reportAdminDomSetupError = ({
  prefix,
  message = '页面缺少必要控件，客户端脚本已停止初始化。',
  missing,
  statusEl,
  statusLiveEl,
  statusText = ADMIN_DOM_SETUP_ERROR_STATUS
}: {
  prefix: string;
  message?: string;
  missing: readonly string[];
  statusEl?: HTMLElement | null;
  statusLiveEl?: HTMLElement | null;
  statusText?: string;
}) => {
  console.error(`${prefix} 初始化失败: ${message}`, { missing });

  if (statusEl) {
    statusEl.dataset.state = 'error';
    statusEl.textContent = statusText;
  }

  if (statusLiveEl) {
    statusLiveEl.textContent = statusText;
  }
};
