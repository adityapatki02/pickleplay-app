import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  YColors,
  YDisplay,
  YEyebrow,
  YMono,
  YUiText,
  YTopBar,
  YBadge,
} from '../../components/yoiden';

export default function FantasyScreen() {
  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <YTopBar eyebrow="DREAM TEAM" title="FANTASY" />

        <View style={styles.heroCard}>
          <View style={styles.heroInner}>
            <YBadge color={YColors.accentDeep} bg="rgba(24,88,214,0.12)">COMING SOON</YBadge>
            <YDisplay size={36} color="#fff" style={{ marginTop: 18, lineHeight: 34 }}>
              PICK·{'\n'}YOUR·{'\n'}SQUAD
            </YDisplay>
            <YUiText size={12} weight={700} color="rgba(255,255,255,0.85)" style={styles.subtitle}>
              Build a dream team. Trade weekly. Climb leaderboards. Win bragging rights.
            </YUiText>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 28 }}>
          <YEyebrow>WHAT'S COMING</YEyebrow>
          <View style={{ marginTop: 10, gap: 14 }}>
            <Bullet label="DRAFT PLAYERS WITHIN A BUDGET" />
            <Bullet label="WEEKLY TRADES + CAPTAIN BONUS" />
            <Bullet label="LIVE POINTS FROM REAL MATCHES" />
            <Bullet label="GLOBAL + FRIENDS LEADERBOARDS" />
          </View>

          <View style={styles.note}>
            <YEyebrow color={YColors.ink3}>NOT BUILT YET</YEyebrow>
            <YUiText size={12} color={YColors.ink2} style={{ marginTop: 6 }}>
              Fantasy needs a tournament with live match scoring to feed off. We'll wire it up once the core tournament flow is solid and live.
            </YUiText>
          </View>
        </View>

        <View style={styles.footer}>
          <YEyebrow color={YColors.ink3}>YOIDEN · FANTASY</YEyebrow>
          <YMono size={10} color={YColors.ink4} style={{ marginTop: 4 }}>
            COMING IN A FUTURE RELEASE
          </YMono>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const Bullet: React.FC<{ label: string }> = ({ label }) => (
  <View style={styles.bulletRow}>
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12l5 5 9-9" stroke={YColors.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
    <YUiText size={12} weight={800} color={YColors.ink} style={{ letterSpacing: 1.2, marginLeft: 10 }}>
      {label}
    </YUiText>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    backgroundColor: YColors.accentDeep,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 260,
  },
  heroInner: { padding: 22 },
  subtitle: { marginTop: 16, letterSpacing: 0.5 },
  bulletRow: { flexDirection: 'row', alignItems: 'center' },
  note: {
    marginTop: 24,
    padding: 14,
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line,
    borderRadius: 10,
  },
  footer: {
    marginTop: 28,
    paddingTop: 20,
    paddingBottom: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: YColors.line,
  },
});
