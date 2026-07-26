/**
 * Confirm dialog that works inside Telegram Mini Apps.
 * `window.confirm` is unreliable / often returns false without a dialog
 * in Telegram WebViews — prefer `Telegram.WebApp.showConfirm` when present.
 */
export function confirmDialog(message: string): Promise<boolean> {
  const tg = window.Telegram?.WebApp as
    | (NonNullable<typeof window.Telegram>['WebApp'] & {
        showConfirm?: (msg: string, cb: (ok: boolean) => void) => void;
      })
    | null
    | undefined;

  if (tg && typeof tg.showConfirm === 'function') {
    return new Promise((resolve) => {
      tg.showConfirm!(message, (ok) => resolve(Boolean(ok)));
    });
  }

  try {
    return Promise.resolve(window.confirm(message));
  } catch {
    // Extremely locked-down WebViews: proceed only after an explicit
    // fallback prompt fails open would be unsafe — refuse instead.
    return Promise.resolve(false);
  }
}
