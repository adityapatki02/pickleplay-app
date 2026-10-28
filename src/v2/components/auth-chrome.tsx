// Sign-in screens in the v2 look. The log-in / sign-up, forgot-PIN and profile screens keep
// their logic and read their colours and fonts from AY / AF (the same names they used from
// config/yoiden), mapped here onto the v2 broadcast theme. AuthHeader is the navy band with
// the wordmark and the blue + lime stripes that replaces their old logo header.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Mark, Wordmark } from './wordmark';
import { CloseIcon } from './icons';
import { C, F } from '../theme';

export const AY = {
  bg: C.page,
  bg2: C.white,
  bg3: C.page,
  ink: C.ink,
  ink2: C.soft,
  ink3: C.mute,
  line: C.line,
  line2: C.lineStrong,
  accent: C.accent,
  lime: C.hl,
  live: C.live,
} as const;

export const AF = {
  display: F.cond,
  ui: F.text,
  uiSemibold: F.semi,
  uiBold: F.bold,
  uiExtrabold: F.heavy,
  uiBlack: F.heavy,
} as const;

/** The primary button: lime with navy condensed text, like the rest of the app. */
export const authButton = StyleSheet.create({
  btn: { backgroundColor: C.hl, borderRadius: 10, minHeight: 52, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  text: { fontFamily: F.cond, fontSize: 18, letterSpacing: 1, color: C.bar, textTransform: 'uppercase' },
});

/** Condensed uppercase heading, no slant. */
export const authTitle = StyleSheet.create({
  main: { fontFamily: F.cond, fontSize: 44, lineHeight: 46, color: C.bar, textTransform: 'uppercase', letterSpacing: 0.4 },
  accent: { fontFamily: F.cond, fontSize: 44, lineHeight: 46, color: C.accent, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 14 },
  eyebrow: { fontFamily: F.condBold, fontSize: 13, color: C.accent, letterSpacing: 1.6, marginBottom: 10, textTransform: 'uppercase' },
});

export function AuthHeader({ closable = true }: { closable?: boolean }) {
  const nav = useNavigation<any>();
  // Inside the app the sign-in screens open as a sheet; the close button leaves it.
  const parent = nav.getParent?.();
  const canClose = closable && !!parent?.canGoBack?.();
  return (
    <View style={s.band}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[s.stripe, { right: 62, width: 12, backgroundColor: C.accent }]} />
        <View style={[s.stripe, { right: 18, width: 32, backgroundColor: C.hl }]} />
      </View>
      <View style={s.row}>
        <Mark height={26} />
        <Wordmark height={24} />
      </View>
      {canClose ? (
        <Pressable onPress={() => parent.goBack()} hitSlop={12} style={s.close} accessibilityRole="button" accessibilityLabel="Close">
          <CloseIcon size={18} color={C.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  band: { backgroundColor: C.bar, paddingVertical: 26, paddingHorizontal: 24, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stripe: { position: 'absolute', top: -40, bottom: -40, transform: [{ skewX: '-20deg' }] },
  close: { position: 'absolute', right: 112, top: 0, bottom: 0, justifyContent: 'center' },
});
