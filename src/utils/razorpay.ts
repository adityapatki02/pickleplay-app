import { Platform } from 'react-native';

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency?: string;
  order_id?: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; contact?: string; email?: string };
  theme?: { color?: string };
}

export interface RazorpayResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/** Loads the Razorpay web checkout script once. */
const loadWebScript = (): Promise<void> =>
  new Promise((resolve) => {
    if ((window as any).Razorpay) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    document.head.appendChild(s);
  });

/** Opens Razorpay checkout on web (browser). */
const openWeb = (opts: RazorpayOptions): Promise<RazorpayResult> =>
  new Promise(async (resolve, reject) => {
    await loadWebScript();
    const rzp = new (window as any).Razorpay({
      key: opts.key,
      amount: opts.amount,
      currency: opts.currency ?? 'INR',
      order_id: opts.order_id,
      name: opts.name ?? 'Yoiden',
      description: opts.description ?? '',
      prefill: opts.prefill ?? {},
      theme: opts.theme ?? { color: '#1B4FD8' },
      handler: (response: RazorpayResult) => resolve(response),
      modal: { ondismiss: () => reject({ description: 'Payment cancelled' }) },
    });
    rzp.open();
  });

/** Opens Razorpay checkout on Android/iOS (native SDK). */
const openNative = async (opts: RazorpayOptions): Promise<RazorpayResult> => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RazorpayCheckout = require('react-native-razorpay').default;
  const res = await RazorpayCheckout.open({
    key: opts.key,
    amount: opts.amount,
    currency: opts.currency ?? 'INR',
    order_id: opts.order_id,
    name: opts.name,
    description: opts.description,
    prefill: opts.prefill,
    theme: opts.theme,
  });
  return {
    razorpay_payment_id: res.razorpay_payment_id,
    razorpay_order_id: res.razorpay_order_id,
    razorpay_signature: res.razorpay_signature,
  };
};

/**
 * Cross-platform Razorpay checkout.
 * - Web  → loads checkout.razorpay.com/v1/checkout.js in the browser
 * - Native → uses react-native-razorpay (Android/iOS only)
 *
 * Throws if the user cancels or payment fails.
 */
export const openRazorpay = (opts: RazorpayOptions): Promise<RazorpayResult> =>
  Platform.OS === 'web' ? openWeb(opts) : openNative(opts);
