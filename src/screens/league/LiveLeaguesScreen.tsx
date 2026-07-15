import React from 'react';
import { View, ScrollView, StyleSheet, Pressable, Image, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { YColors, YDisplay, YEyebrow, YUiText } from '../../components/yoiden';
import { FEATURED_LEAGUES, liveLeagues, type FeaturedLeague } from '../../config/leagues';

const STATUS_META: Record<
  FeaturedLeague['status'],
  { label: string; bg: string; fg: string; dot: string }
> = {
  live:      { label: 'LIVE',      bg: '#FDE7EA', fg: '#C1203A', dot: YColors.live },
  in_season: { label: 'IN SEASON', bg: '#E7F0FB', fg: '#185FA5', dot: YColors.accent },
  completed: { label: 'COMPLETED', bg: YColors.bg3, fg: YColors.ink3, dot: YColors.ink4 },
};

export default function LiveLeaguesScreen() {
  const nav = useNavigation<any>();

  // Ongoing leagues lead; completed ones (kept as featured) fall to the bottom.
  const ongoing = liveLeagues();
  const rest = FEATURED_LEAGUES.filter((l) => !ongoing.includes(l));
  const ordered = [...ongoing, ...rest];

  const openLeague = (l: FeaturedLeague) =>
    nav.navigate('LeagueDashboard', { leagueId: l.leagueId, seasonId: l.seasonId });

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backTxt}>{'‹'}</Text>
        </Pressable>
        <View>
          <YEyebrow size={10} color={YColors.ink3}>WHAT'S ON</YEyebrow>
          <YDisplay size={26} color={YColors.ink} style={{ marginTop: 2 }}>LIVE LEAGUES</YDisplay>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <YUiText size={12} weight={600} color={YColors.ink2} style={{ marginBottom: 14 }}>
          {ongoing.length > 0
            ? `${ongoing.length} league${ongoing.length > 1 ? 's' : ''} going on right now.`
            : 'No leagues live at the moment.'}
        </YUiText>

        {ordered.map((l) => {
          const s = STATUS_META[l.status];
          return (
            <Pressable
              key={l.key}
              onPress={() => openLeague(l)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}
            >
              <View style={styles.logoWrap}>
                <Image source={l.logo} style={styles.logo} resizeMode="cover" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={styles.titleRow}>
                  <YUiText size={17} weight={900} color={YColors.ink}>{l.name}</YUiText>
                  <View style={[styles.pill, { backgroundColor: s.bg }]}>
                    <View style={[styles.pillDot, { backgroundColor: s.dot }]} />
                    <YUiText size={9} weight={900} color={s.fg} style={{ letterSpacing: 0.8 }}>
                      {s.label}
                    </YUiText>
                  </View>
                </View>
                <YUiText size={12} weight={700} color={YColors.ink3} style={{ marginTop: 3, letterSpacing: 0.4 }}>
                  {l.season.toUpperCase()} · {l.sport.toUpperCase()}
                </YUiText>
                <YUiText size={12} weight={500} color={YColors.ink2} style={{ marginTop: 6 }}>
                  {l.blurb}
                </YUiText>
              </View>
              <Text style={styles.chev}>{'›'}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: YColors.line2,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTxt: { fontSize: 24, lineHeight: 26, color: YColors.ink, marginTop: -2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: YColors.bg2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: YColors.line2,
    padding: 14,
    marginBottom: 12,
  },
  logoWrap: {
    width: 54,
    height: 54,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: YColors.line2,
  },
  logo: { width: '100%', height: '100%' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  pillDot: { width: 5, height: 5, borderRadius: 3 },
  chev: { fontSize: 26, color: YColors.ink3, marginLeft: 6 },
});
