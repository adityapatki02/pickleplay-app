/**
 * Bridge between the promise-based `presentDuprSso()` helper and the single
 * <DuprSsoHost/> mounted at the app root. Mirrors razorpay-host-bridge.ts:
 * the host registers its presenter on mount; callers await `presentDuprSso()`,
 * which shows the DUPR SSO WebView and resolves/rejects from the WebView's
 * postMessage events.
 */
export type DuprSsoResult = {
  userToken: string;
  refreshToken: string;
  duprId: string;
  expiresAt?: string;
};

type Presenter = () => Promise<DuprSsoResult>;

let presenter: Presenter | null = null;

export const registerDuprSsoPresenter = (p: Presenter | null): void => {
  presenter = p;
};

export const presentDuprSso = (): Promise<DuprSsoResult> => {
  if (!presenter) {
    return Promise.reject({ message: 'DUPR login is not available. Restart the app and try again.' });
  }
  return presenter();
};
