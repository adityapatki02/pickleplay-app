import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { registerDuprSsoPresenter, DuprSsoResult } from '../utils/dupr-host-bridge';
import { DUPR_SSO_BASE_URL, DUPR_CLIENT_KEY } from '../config/constants';

/**
 * Web counterpart to <DuprSsoHost/> (native, WebView-based). Same public
 * contract — mounted once at the app root, registers the presenter via
 * `registerDuprSsoPresenter`, and resolves/rejects the `presentDuprSso()`
 * promise — but renders DUPR's SSO login page inside a real <iframe> instead
 * of a react-native-webview, since react-native-webview has no web target.
 *
 * Metro/Expo picks this file automatically for `--platform web` builds via
 * the `.web.tsx` extension; App.tsx's `import { DuprSsoHost } from
 * './src/components/DuprSsoHost'` needs no change.
 */

// `window.btoa` is a real global on web (unlike RN/Hermes), so we can use it
// directly here rather than the hand-rolled base64 encoder the native host
// carries for Hermes compatibility. Client KEY only — never a secret.
const ssoUrl = (): string => `${DUPR_SSO_BASE_URL}/login-external-app/${window.btoa(DUPR_CLIENT_KEY)}`;

// Derive the DUPR SSO origin from the configured base URL for strict
// postMessage origin verification below (e.g. 'https://uat.dupr.gg').
const ssoOrigin = (): string => {
  try {
    return new URL(DUPR_SSO_BASE_URL).origin;
  } catch {
    return DUPR_SSO_BASE_URL;
  }
};

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

  // Listens for DUPR's postMessage payload (posted by the SSO page, running
  // in the iframe, after login + consent).
  //
  // CRITICAL SECURITY: only accept messages whose event.origin matches
  // DUPR's SSO origin — otherwise any other page/tab could forge a
  // 'dupr-token' message and inject arbitrary tokens.
  //
  // TODO(dupr): confirm exact postMessage field names + origin during UAT.
  // DUPR's GitBook SSO doc wasn't reachable headlessly, so this defensively
  // reads several likely field-name variants (userToken||accessToken,
  // duprId||id, expiry||expiresAt||expires_at) — a real-world field-name
  // mismatch should be a one-line change to the lookups below.
  useEffect(() => {
    if (!visible) return undefined;

    const expectedOrigin = ssoOrigin();

    const handler = (event: MessageEvent) => {
      if (event.origin !== expectedOrigin) return;

      let d: any = event.data;
      if (typeof d === 'string') {
        try {
          d = JSON.parse(d);
        } catch {
          return;
        }
      }
      if (!d || typeof d !== 'object') return;

      const userToken = d.userToken || d.accessToken;
      if (!userToken) return;

      settle({
        userToken,
        refreshToken: d.refreshToken || d.refresh_token,
        duprId: d.duprId || d.id || '',
        expiresAt: d.expiry || d.expiresAt || d.expires_at,
      });
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [visible, settle]);

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
        {/* RN Web escape hatch: a raw DOM element inside the RN component
            tree. react-native-web renders <View>/<Text> as DOM nodes under
            the hood, so a plain <iframe> nests cleanly here and typechecks
            without extra shims. */}
        <iframe
          title="DUPR SSO"
          src={ssoUrl()}
          onLoad={() => setLoading(false)}
          style={{ flex: 1, width: '100%', height: '100%', border: 'none', backgroundColor: '#ffffff' }}
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
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    zIndex: 9999,
  },
  bar: {
    paddingTop: 16,
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
