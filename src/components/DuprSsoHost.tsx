import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  BackHandler,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { registerDuprSsoPresenter, DuprSsoResult } from '../utils/dupr-host-bridge';
import { DUPR_SSO_BASE_URL, DUPR_CLIENT_KEY } from '../config/constants';

/**
 * A single, app-root-mounted host that renders DUPR's SSO login page inside a
 * WebView overlay. Driven imperatively via the dupr-host-bridge so callers
 * keep using the promise-based `presentDuprSso()` helper. Clones the
 * structure of <RazorpayCheckoutHost/> (absolute-fill overlay, Cancel bar,
 * Android back handling, postMessage bridge) rather than reusing it directly
 * since this host navigates to a remote URL instead of injecting local HTML.
 */

// Minimal, dependency-free base64 encoder for the ASCII client key — RN's JS
// engine (Hermes) does not reliably provide a global `btoa` across the RN/SDK
// versions this app targets, so we avoid relying on one.
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(input: string): string {
  let output = '';
  let i = 0;
  while (i < input.length) {
    const c1 = input.charCodeAt(i++);
    const c2 = input.charCodeAt(i++);
    const c3 = input.charCodeAt(i++);
    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4);
    const e3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6);
    const e4 = isNaN(c3) ? 64 : c3 & 63;
    output += BASE64_CHARS[e1] + BASE64_CHARS[e2] + BASE64_CHARS[e3] + BASE64_CHARS[e4];
  }
  return output;
}

const ssoUrl = (): string => `${DUPR_SSO_BASE_URL}/login-external-app/${toBase64(DUPR_CLIENT_KEY)}`;

// Forwards DUPR's window.postMessage payload (posted by the SSO page after
// login + consent) to React Native via the WebView bridge.
//
// TODO(dupr): confirm exact postMessage field names during Phase 6/8 UAT.
// DUPR's GitBook SSO doc wasn't reachable headlessly, so this defensively
// reads several likely field-name variants (userToken||accessToken,
// duprId||id, expiry||expiresAt) — a real-world field-name mismatch should
// be a one-line change to the `d.<field>` lookups below.
const INJECTED_JS = `
(function () {
  function send(m) { try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {} }
  window.addEventListener('message', function (ev) {
    try {
      var d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
      if (d && (d.userToken || d.accessToken)) {
        send({
          type: 'dupr-token',
          userToken: d.userToken || d.accessToken,
          refreshToken: d.refreshToken || d.refresh_token,
          duprId: d.duprId || d.id || '',
          expiresAt: d.expiry || d.expiresAt || d.expires_at
        });
      }
    } catch (e) {}
  }, false);
  true;
})();
true;
`;

type Pending = { resolve: (r: DuprSsoResult) => void; reject: (e: any) => void };

export const DuprSsoHost: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const pending = useRef<Pending | null>(null);

  const settle = useCallback((result: DuprSsoResult | null, err?: any) => {
    const p = pending.current;
    pending.current = null;
    setVisible(false);
    setLoading(true);
    if (!p) return;
    if (err || !result) p.reject(err ?? { message: 'DUPR login cancelled' });
    else p.resolve(result);
  }, []);

  useEffect(() => {
    registerDuprSsoPresenter(
      () =>
        new Promise<DuprSsoResult>((resolve, reject) => {
          if (pending.current) {
            reject({ message: 'DUPR login is already in progress.' });
            return;
          }
          pending.current = { resolve, reject };
          setLoading(true);
          setVisible(true);
        }),
    );
    return () => registerDuprSsoPresenter(null);
  }, []);

  // Android hardware-back cancels the SSO flow.
  useEffect(() => {
    if (Platform.OS !== 'android' || !visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      settle(null);
      return true;
    });
    return () => sub.remove();
  }, [visible, settle]);

  const onMessage = useCallback(
    (e: { nativeEvent: { data: string } }) => {
      let msg: any;
      try {
        msg = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      if (msg?.type === 'dupr-token' && msg.userToken) {
        settle({
          userToken: msg.userToken,
          refreshToken: msg.refreshToken,
          duprId: msg.duprId || '',
          expiresAt: msg.expiresAt,
        });
      }
    },
    [settle],
  );

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.bar}>
        <Text style={styles.title}>Connect DUPR</Text>
        <Pressable hitSlop={12} onPress={() => settle(null)}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1 }}>
        <WebView
          source={{ uri: ssoUrl() }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          injectedJavaScript={INJECTED_JS}
          onMessage={onMessage}
          onLoadEnd={() => setLoading(false)}
          style={{ flex: 1, backgroundColor: '#ffffff' }}
        />
        {loading ? (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator color="#1B4FD8" />
            <Text style={styles.loadingText}>Loading DUPR login…</Text>
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
