import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Linking,
  BackHandler,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { registerRazorpayPresenter } from '../utils/razorpay-host-bridge';
import type { RazorpayOptions, RazorpayResult } from '../utils/razorpay';

/**
 * A single, app-root-mounted host that renders Razorpay's checkout.js inside a
 * WebView overlay. Driven imperatively via the razorpay-host-bridge so callers
 * keep using the promise-based `openRazorpay()` helper unchanged.
 *
 * Rendered as an absolute-fill View (not a RN <Modal>) so it never collides
 * with another native modal/view-controller presentation — the exact failure
 * mode the native react-native-razorpay SDK hit on iOS New Architecture.
 */

const buildHtml = (o: RazorpayOptions): string => {
  const opts = {
    key: o.key,
    amount: o.amount,
    currency: o.currency ?? 'INR',
    order_id: o.order_id,
    name: o.name ?? 'Yoiden',
    description: o.description ?? '',
    prefill: o.prefill ?? {},
    theme: o.theme ?? { color: '#1B4FD8' },
  };
  // Escape < so the JSON can't break out of the <script> element.
  const json = JSON.stringify(opts).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"></head>
<body style="margin:0;padding:0;background:#ffffff;">
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  function send(m){ try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch(e){} }
  try {
    if (typeof Razorpay === 'undefined') { send({ type: 'error', message: 'checkout_not_loaded' }); }
    else {
      var options = ${json};
      options.handler = function(resp){ send({ type: 'success', data: resp }); };
      options.modal = {
        escape: true,
        backdropclose: false,
        ondismiss: function(){ send({ type: 'dismiss' }); }
      };
      var rzp = new Razorpay(options);
      rzp.on('payment.failed', function(resp){ send({ type: 'failed', data: (resp && resp.error) || {} }); });
      rzp.open();
      send({ type: 'ready' });
    }
  } catch (e) {
    send({ type: 'error', message: String((e && e.message) || e) });
  }
</script>
</body>
</html>`;
};

type Pending = { resolve: (r: RazorpayResult) => void; reject: (e: any) => void };

export const RazorpayCheckoutHost: React.FC = () => {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pending = useRef<Pending | null>(null);

  const settle = useCallback((result: RazorpayResult | null, err?: any) => {
    const p = pending.current;
    pending.current = null;
    setHtml(null);
    setLoading(true);
    if (!p) return;
    if (err || !result) p.reject(err ?? { description: 'Payment cancelled' });
    else p.resolve(result);
  }, []);

  useEffect(() => {
    registerRazorpayPresenter(
      (opts) =>
        new Promise<RazorpayResult>((resolve, reject) => {
          if (pending.current) {
            reject({ description: 'Another payment is already in progress.' });
            return;
          }
          pending.current = { resolve, reject };
          setLoading(true);
          setHtml(buildHtml(opts));
        }),
    );
    return () => registerRazorpayPresenter(null);
  }, []);

  // Android hardware-back cancels the checkout.
  useEffect(() => {
    if (Platform.OS !== 'android' || !html) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      settle(null);
      return true;
    });
    return () => sub.remove();
  }, [html, settle]);

  const onMessage = useCallback(
    (e: { nativeEvent: { data: string } }) => {
      let msg: any;
      try {
        msg = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      switch (msg?.type) {
        case 'ready':
          setLoading(false);
          break;
        case 'success':
          settle(msg.data as RazorpayResult);
          break;
        case 'dismiss':
          settle(null, { description: 'Payment cancelled' });
          break;
        case 'failed':
          settle(null, { description: msg.data?.description || 'Payment failed', ...(msg.data || {}) });
          break;
        case 'error':
          settle(null, { description: msg.message || 'Could not open checkout' });
          break;
      }
    },
    [settle],
  );

  if (!html) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.bar}>
        <Text style={styles.title}>Secure payment</Text>
        <Pressable hitSlop={12} onPress={() => settle(null)}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1 }}>
        <WebView
          source={{ html, baseUrl: 'https://checkout.razorpay.com' }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          onMessage={onMessage}
          onShouldStartLoadWithRequest={(req) => {
            // Bank 3-D Secure / OTP pages are https and load in the WebView.
            // UPI-intent and app deep links (upi://, tez://, phonepe://, …) must
            // be handed to the OS so the payment app can open.
            if (/^(https?|about|data|blob):/i.test(req.url)) return true;
            Linking.openURL(req.url).catch(() => {});
            return false;
          }}
          style={{ flex: 1, backgroundColor: '#ffffff' }}
        />
        {loading ? (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator color="#1B4FD8" />
            <Text style={styles.loadingText}>Loading secure checkout…</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    zIndex: 9999,
    elevation: 9999,
  },
  bar: {
    paddingTop: Platform.OS === 'ios' ? 54 : 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#ECECEC',
    backgroundColor: '#ffffff',
  },
  title: { fontSize: 15, fontWeight: '700', color: '#0A0A0B' },
  cancel: { fontSize: 15, fontWeight: '700', color: '#1B4FD8' },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: { marginTop: 10, color: '#6B6B70', fontSize: 13 },
});
