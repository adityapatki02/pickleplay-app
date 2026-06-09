/**
 * MSG91 widget configuration. These values are public — the widget ID and
 * frontend auth token are intentionally shipped to every browser. Security
 * comes from MSG91's origin allowlist on this widget (configured in the
 * MSG91 dashboard) plus backend verification of the access token MSG91
 * returns.
 *
 * To rotate keys: update MSG91 dashboard + values here, rebuild the web
 * bundle, redeploy. There's no separate env-baking step in Expo web — the
 * bundle inlines whatever's referenced at build time.
 */
export const MSG91_WIDGET_ID = '36647a666e76303436353733';
export const MSG91_FRONTEND_AUTH_TOKEN = '490820TQQzDyoB1w5f69edad97P1';

/**
 * Shape of the data MSG91 hands back via the widget's `success` callback.
 * The actual token typically lives at `data.message` for OTP widgets but
 * we lookup defensively in case MSG91's payload shape varies.
 */
export interface Msg91WidgetSuccess {
  message?: string;
  type?: string;
  data?: { message?: string; accessToken?: string };
  accessToken?: string;
}

declare global {
  interface Window {
    initSendOTP?: (config: Msg91InitConfig) => void;
  }
}

export interface Msg91InitConfig {
  widgetId: string;
  tokenAuth: string;
  /** Optional pre-fill (phone or email). */
  identifier?: string;
  /** When true MSG91 exposes sendOTP/verifyOTP methods rather than auto-running its modal. */
  exposeMethods?: boolean;
  success: (data: Msg91WidgetSuccess) => void;
  failure: (error: unknown) => void;
}

let scriptLoadPromise: Promise<void> | null = null;

/**
 * Lazily injects MSG91's `otp-provider.js` into the page. We don't add it
 * to index.html so it doesn't load on every page (it's only needed if a
 * user actually clicks "Forgot PIN?"). We try the primary URL first and
 * fall back to the secondary if it errors — same fallback list MSG91's own
 * snippet uses.
 *
 * Native (iOS/Android): no-op. The widget is web-only; native builds would
 * need a separate WebView-based flow, which we don't need for the
 * tournament's PWA-first deployment.
 */
export function loadMsg91Widget(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('MSG91 widget is only available on web.'));
  }

  if (window.initSendOTP) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const urls = [
      'https://verify.msg91.com/otp-provider.js',
      'https://verify.phone91.com/otp-provider.js',
    ];
    let i = 0;

    const attempt = () => {
      const s = document.createElement('script');
      s.src = urls[i];
      s.async = true;
      s.onload = () => {
        if (typeof window.initSendOTP === 'function') {
          resolve();
        } else {
          // Loaded but didn't expose initSendOTP — try the next URL.
          i++;
          if (i < urls.length) attempt();
          else reject(new Error('MSG91 script loaded but initSendOTP is missing.'));
        }
      };
      s.onerror = () => {
        i++;
        if (i < urls.length) attempt();
        else reject(new Error('MSG91 script failed to load.'));
      };
      document.head.appendChild(s);
    };

    attempt();
  });

  return scriptLoadPromise;
}

/**
 * Open the MSG91 OTP widget. Resolves with the access token MSG91 issues
 * after the user completes the OTP flow; rejects on cancel or error.
 *
 * MSG91 returns the token in different fields depending on widget config;
 * we check the common spots in order.
 */
export async function openMsg91Widget(prefill?: string): Promise<string> {
  await loadMsg91Widget();

  return new Promise<string>((resolve, reject) => {
    if (!window.initSendOTP) {
      reject(new Error('MSG91 widget is not available.'));
      return;
    }

    window.initSendOTP({
      widgetId: MSG91_WIDGET_ID,
      tokenAuth: MSG91_FRONTEND_AUTH_TOKEN,
      identifier: prefill,
      success: (data) => {
        const token =
          data?.message ??
          data?.data?.message ??
          data?.data?.accessToken ??
          data?.accessToken;
        if (typeof token === 'string' && token.length > 0) {
          resolve(token);
        } else {
          reject(new Error('MSG91 returned no access token.'));
        }
      },
      failure: (error: any) => {
        // MSG91's failure callback hands us a plain object like
        // { type: 'error', message: 'Network error' }. Extract a usable
        // message rather than letting it stringify to "[object Object]".
        if (error instanceof Error) {
          reject(error);
          return;
        }
        const msg =
          (error && typeof error === 'object' && (error.message || error.error || error.msg)) ||
          'Verification failed. Please try again.';
        reject(new Error(typeof msg === 'string' ? msg : 'Verification failed.'));
      },
    });
  });
}
