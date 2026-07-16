import type { RazorpayOptions, RazorpayResult } from './razorpay';

/**
 * Bridge between the promise-based `openRazorpay()` helper and the single
 * <RazorpayCheckoutHost/> mounted at the app root. The host registers its
 * presenter on mount; `openRazorpay` (native path) calls `presentRazorpay`,
 * which shows the WebView checkout and resolves/rejects the returned promise
 * from the WebView's postMessage events.
 *
 * We use a WebView checkout (Razorpay's own checkout.js) instead of the native
 * react-native-razorpay SDK because that SDK's checkout does not present on
 * iOS under the New Architecture (Expo SDK 55 / RN 0.83).
 */
type Presenter = (opts: RazorpayOptions) => Promise<RazorpayResult>;

let presenter: Presenter | null = null;

export const registerRazorpayPresenter = (p: Presenter | null): void => {
  presenter = p;
};

export const presentRazorpay = (opts: RazorpayOptions): Promise<RazorpayResult> => {
  if (!presenter) {
    return Promise.reject({ description: 'Payment screen is not available. Please restart the app and try again.' });
  }
  return presenter(opts);
};
