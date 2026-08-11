// Toast host for the cross-platform `notify` service. Mount ONCE near the app
// root (see RootNavigator). Renders stacked toasts at the top that auto-dismiss.
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { YColors } from '../../config/yoiden';
import { YUiText } from './YText';
import {
  _registerNotifyHost,
  _registerChoiceHost,
  type ToastPayload,
  type ToastType,
  type ChoicePayload,
} from '../../utils/notify';

const DURATION = 3400;

const accentFor = (t: ToastType) =>
  t === 'success' ? '#1D9E75' : t === 'error' ? YColors.live : YColors.accent;

const iconFor = (t: ToastType, c: string) => {
  if (t === 'success') {
    return <Path d="M5 13l4 4L19 7" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (t === 'error') {
    return <Path d="M12 8v5M12 16.5v.5M12 3l9 16H3l9-16Z" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />;
  }
  return <Path d="M12 8v.5M12 11v5M12 3a9 9 0 100 18 9 9 0 000-18Z" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />;
};

export const NotifyHost: React.FC = () => {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);
  const [choice, setChoice] = useState<ChoicePayload | null>(null);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    _registerNotifyHost((t) => {
      setToasts((cur) => [...cur, t]);
      timers.current[t.id] = setTimeout(() => {
        setToasts((cur) => cur.filter((x) => x.id !== t.id));
        delete timers.current[t.id];
      }, DURATION);
    });
    _registerChoiceHost((c) => setChoice(c));
    return () => {
      _registerNotifyHost(null);
      _registerChoiceHost(null);
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, []);

  const pick = (v: string | null) => {
    choice?.resolve(v);
    setChoice(null);
  };

  const dismiss = (id: number) => {
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
    setToasts((cur) => cur.filter((x) => x.id !== id));
  };

  if (toasts.length === 0 && !choice) return null;

  return (
    <>
      {toasts.length > 0 && (
        <View style={styles.host} pointerEvents="box-none">
          {toasts.map((t) => {
            const accent = accentFor(t.type);
            return (
              <Pressable key={t.id} onPress={() => dismiss(t.id)} style={styles.toast}>
                <View style={[styles.stripe, { backgroundColor: accent }]} />
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={{ marginRight: 10 }}>
                  {iconFor(t.type, accent)}
                </Svg>
                <View style={{ flex: 1 }}>
                  {t.title ? (
                    <YUiText size={13} weight={800} color={YColors.ink} numberOfLines={1}>{t.title}</YUiText>
                  ) : null}
                  <YUiText size={12.5} weight={500} color={YColors.ink2} numberOfLines={4}>{t.message}</YUiText>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {choice && (
        <View style={styles.overlay}>
          <View style={styles.card}>
            {choice.title ? (
              <YUiText size={16} weight={800} color={YColors.ink} style={{ marginBottom: 6 }}>{choice.title}</YUiText>
            ) : null}
            {choice.message ? (
              <YUiText size={13.5} weight={500} color={YColors.ink2} style={{ marginBottom: 14 }}>{choice.message}</YUiText>
            ) : null}
            {choice.options.map((o) => (
              <Pressable
                key={o.value}
                onPress={() => pick(o.value)}
                style={[styles.optBtn, o.destructive && styles.optBtnDanger]}
              >
                <YUiText size={14} weight={700} color="#fff">{o.label}</YUiText>
              </Pressable>
            ))}
            <Pressable onPress={() => pick(null)} style={styles.cancelBtn}>
              <YUiText size={14} weight={700} color={YColors.ink2}>{choice.cancelLabel ?? 'Cancel'}</YUiText>
            </Pressable>
          </View>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 52,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '92%',
    maxWidth: 460,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: YColors.line2,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 14,
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: '#0A0A0B',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,10,11,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 10000,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
  },
  optBtn: {
    backgroundColor: YColors.accentDeep,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  optBtnDanger: {
    backgroundColor: YColors.live,
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
});
