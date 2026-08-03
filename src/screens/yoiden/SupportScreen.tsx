import React from 'react';
import { View, ScrollView, StyleSheet, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';

import { YColors, YTopBar, YSectionHead, YUiText, YEyebrow } from '../../components/yoiden';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from '../../config/constants';

const openURL = (url: string) => Linking.openURL(url).catch(() => {});

const EmailIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" stroke={YColors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M3.5 6.5l8.5 6 8.5-6" stroke={YColors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const WhatsAppIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.36A10 10 0 1 0 12 2z"
      stroke="#25D366"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M8.4 8.2c.2-.5.4-.5.6-.5h.5c.16 0 .38 0 .55.42.2.5.66 1.7.72 1.83.06.13.1.28.02.45-.08.17-.13.28-.25.42-.13.15-.27.34-.38.46-.13.13-.26.27-.11.53.14.26.63 1.03 1.35 1.67.93.83 1.7 1.09 1.97 1.21.26.13.42.1.57-.06.16-.16.65-.76.82-1.02.17-.26.34-.22.57-.13.24.08 1.5.71 1.76.84.26.13.43.2.5.31.06.11.06.63-.15 1.24-.2.6-1.2 1.18-1.65 1.24-.42.06-.83.24-2.8-.6-2.38-1.02-3.87-3.5-3.98-3.66-.11-.15-.94-1.25-.94-2.38 0-1.14.6-1.7.8-1.93z"
      fill="#25D366"
    />
  </Svg>
);

export default function SupportScreen() {
  const nav = useNavigation();

  const handleEmail = () =>
    openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Yoiden support')}`);

  const handleWhatsApp = () => {
    const digits = SUPPORT_WHATSAPP.replace(/[^0-9]/g, '');
    openURL(`https://wa.me/${digits}`);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <YTopBar eyebrow="WE'RE HERE TO HELP" title="SUPPORT" onBack={() => (nav as any).goBack()} />

        <View style={styles.introCard}>
          <YUiText size={13} color={YColors.ink2} style={{ lineHeight: 20 }}>
            Reach the Yoiden support team for anything — account issues, tournament or booking
            questions, or a{' '}
            <YUiText size={13} weight={800} color={YColors.ink}>
              DUPR match dispute
            </YUiText>
            . If you think a match result or rating submitted to DUPR is wrong, contact us with
            the tournament name, match, and what looks incorrect and we'll help sort it out.
          </YUiText>
        </View>

        <YSectionHead eyebrow="CONTACT" title="GET IN TOUCH" />
        <View style={styles.actionsWrap}>
          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: YColors.bg3 }]}
            onPress={handleEmail}
          >
            <View style={styles.actionIcon}>
              <EmailIcon />
            </View>
            <View style={{ flex: 1 }}>
              <YUiText size={13} weight={800} color={YColors.ink} style={{ letterSpacing: 0.3 }}>
                EMAIL SUPPORT
              </YUiText>
              <YUiText size={12} color={YColors.ink3} style={{ marginTop: 2 }}>
                {SUPPORT_EMAIL}
              </YUiText>
            </View>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M9 6l6 6-6 6" stroke={YColors.ink3} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: YColors.bg3 }]}
            onPress={handleWhatsApp}
          >
            <View style={styles.actionIcon}>
              <WhatsAppIcon />
            </View>
            <View style={{ flex: 1 }}>
              <YUiText size={13} weight={800} color={YColors.ink} style={{ letterSpacing: 0.3 }}>
                WHATSAPP
              </YUiText>
              <YUiText size={12} color={YColors.ink3} style={{ marginTop: 2 }}>
                Chat with our support team
              </YUiText>
            </View>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M9 6l6 6-6 6" stroke={YColors.ink3} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <YEyebrow color={YColors.ink3}>MATCH DISPUTES</YEyebrow>
          <YUiText size={12} color={YColors.ink2} style={{ marginTop: 8, lineHeight: 18, textAlign: 'center' }}>
            Include the tournament/league name, category, and match details so we can look into
            it — and check the DUPR rating on your profile within a few days of the match.
          </YUiText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },
  introCard: {
    marginHorizontal: 16,
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line2,
    borderRadius: 14,
    padding: 18,
  },
  actionsWrap: {
    marginHorizontal: 16,
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line,
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionRow: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: YColors.line,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(24,88,214,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginTop: 28,
    marginHorizontal: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: YColors.line,
  },
});
