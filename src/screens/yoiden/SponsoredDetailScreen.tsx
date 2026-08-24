import React, { useCallback, useEffect, useState } from 'react';
import {
  View, StyleSheet, Pressable, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';
import type { MeStackParamList } from '../../navigation/nav-types';
import { YColors, YDisplay, YUiText } from '../../components/yoiden';
import { venuesApi } from '../../api/venues.api';
import { useRangeFilter } from '../../components/RangeFilter';

type Props = NativeStackScreenProps<MeStackParamList, 'SponsoredDetail'>;

function money(n: number | string) {
  const v = Math.round(Number(n) || 0);
  const s = Math.abs(v).toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return '₹' + (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3);
}

export default function SponsoredDetailScreen({ route }: Props) {
  const nav = useNavigation();
  const { venueId, month, days, daypart } = route.params;
  const { params, depKey, node: filterNode } = useRangeFilter({ month, days, daypart });
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await venuesApi.getAnalytics(venueId, params) as any;
      setData(res?.data?.data ?? res?.data ?? null);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [venueId, depKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const sp = data?.sponsored;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        <View style={styles.header}>
          <Pressable onPress={() => nav.goBack()} style={styles.backBtn} hitSlop={8}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M19 12H5M12 5l-7 7 7 7" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
          </Pressable>
          <YDisplay size={30} color={YColors.accent} style={{ marginTop: 8 }}>SPONSORED</YDisplay>
          <YUiText size={13} color={YColors.ink3} style={{ marginTop: 2 }}>Brand-funded play at your venue</YUiText>
        </View>

        <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>{filterNode}</View>

        {loading ? (
          <ActivityIndicator color={YColors.accent} style={{ marginTop: 40 }} />
        ) : !sp ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Svg width={26} height={26} viewBox="0 0 24 24" fill="none"><Path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21l2.3-7.1-6-4.5h7.6z" stroke={YColors.ink3} strokeWidth={1.6} strokeLinejoin="round" /></Svg>
            </View>
            <YUiText size={15} weight={800} color={YColors.ink} style={{ marginTop: 12, textAlign: 'center' }}>No sponsored play yet</YUiText>
            <YUiText size={12.5} color={YColors.ink3} style={{ marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
              When a brand funds play at your venue, this is where you’ll see how many funded hours were booked, how many were actually played, and how many new customers it brought you.
            </YUiText>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {/* Hero — sponsor money into your courts */}
            <View style={styles.hero}>
              <YUiText size={10.5} weight={800} color="rgba(255,255,255,0.7)" style={{ letterSpacing: 1 }}>
                SPONSOR REVENUE INTO YOUR COURTS
              </YUiText>
              <YDisplay size={34} color="#fff" style={{ marginTop: 4 }}>{money(sp.fundedRevenue)}</YDisplay>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <View style={styles.pill}><YUiText size={11} weight={700} color="rgba(255,255,255,0.9)">{sp.campaigns} campaign{sp.campaigns === 1 ? '' : 's'}</YUiText></View>
                <View style={styles.pill}><YUiText size={11} weight={700} color="rgba(255,255,255,0.9)">{sp.playedCourtHours || sp.fundedCourtHours} funded court-hrs</YUiText></View>
              </View>
            </View>

            {/* Funnel — booked with credit → actually played */}
            <YUiText size={12} weight={800} color={YColors.ink2} style={styles.sectionTitle}>REDEEMED → UTILISED</YUiText>
            <View style={styles.card}>
              <View style={styles.funnelRow}>
                <View style={styles.funnelStep}>
                  <YDisplay size={28} color={YColors.ink}>{sp.creditsRedeemed}</YDisplay>
                  <YUiText size={11.5} weight={700} color={YColors.ink2}>Booked</YUiText>
                  <YUiText size={10.5} color={YColors.ink3}>with sponsor credit</YUiText>
                </View>
                <YUiText size={20} color={YColors.ink3} style={{ marginHorizontal: 6 }}>→</YUiText>
                <View style={styles.funnelStep}>
                  <YDisplay size={28} color={YColors.accent}>{sp.played}</YDisplay>
                  <YUiText size={11.5} weight={700} color={YColors.ink2}>Played</YUiText>
                  <YUiText size={10.5} weight={700} color={YColors.accent}>{sp.utilisationPct}% utilised</YUiText>
                </View>
              </View>
              <View style={styles.utilTrack}>
                <View style={[styles.utilFill, { width: `${Math.min(100, sp.utilisationPct)}%` }]} />
              </View>
              <YUiText size={11} color={YColors.ink3} style={{ marginTop: 8 }}>
                {sp.creditsRedeemed - sp.played > 0
                  ? `${sp.creditsRedeemed - sp.played} funded booking${sp.creditsRedeemed - sp.played === 1 ? '' : 's'} were not checked in.`
                  : 'Every funded booking was checked in.'}
              </YUiText>
            </View>

            {/* Value to the venue */}
            <YUiText size={12} weight={800} color={YColors.ink2} style={styles.sectionTitle}>WHAT IT BROUGHT YOU</YUiText>
            <View style={styles.statGrid}>
              <View style={styles.statTile}>
                <YDisplay size={24} color={YColors.ink}>{sp.newToVenue}</YDisplay>
                <YUiText size={11} color={YColors.ink3}>new to your venue</YUiText>
              </View>
              <View style={styles.statTile}>
                <YDisplay size={24} color={YColors.ink}>{sp.postSubsidyReturns}</YDisplay>
                <YUiText size={11} color={YColors.ink3}>came back & paid full</YUiText>
              </View>
            </View>

            {/* Per-campaign breakdown */}
            {(sp.byCampaign ?? []).length > 0 && (
              <>
                <YUiText size={12} weight={800} color={YColors.ink2} style={styles.sectionTitle}>BY CAMPAIGN</YUiText>
                <View style={styles.card}>
                  {sp.byCampaign.map((c: any, i: number) => (
                    <View key={c.campaignId ?? i} style={[styles.campRow, i > 0 && { borderTopWidth: 1, borderTopColor: YColors.line, paddingTop: 12, marginTop: 12 }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <YUiText size={13} weight={800} color={YColors.ink} numberOfLines={1} style={{ flex: 1, paddingRight: 8 }}>{c.campaignId}</YUiText>
                        <YUiText size={13} weight={900} color={YColors.accent}>{money(c.fundedRevenue)}</YUiText>
                      </View>
                      <YUiText size={11} color={YColors.ink3}>
                        {c.booked} booked · {c.played} played ({c.utilisationPct}%) · {c.courtHours} court-hrs
                      </YUiText>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Honesty note — funded vs incremental (per the measurement spec) */}
            <View style={styles.note}>
              <YUiText size={11.5} color={YColors.ink3} style={{ lineHeight: 18 }}>
                These are <YUiText size={11.5} weight={700} color={YColors.ink2}>funded and utilised</YUiText> hours — play that a sponsor paid for and that was checked in. Whether the funding created <YUiText size={11.5} weight={700} color={YColors.ink2}>incremental</YUiText> play (above what would have happened anyway) is measured separately against a baseline.
              </YUiText>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 999, backgroundColor: YColors.bg3, borderWidth: 1, borderColor: YColors.line2, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: YColors.accent, borderRadius: 16, padding: 18, marginTop: 12 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)' },
  sectionTitle: { letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 10 },
  card: { backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line2, borderRadius: 14, padding: 16 },
  funnelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  funnelStep: { alignItems: 'center', flex: 1 },
  utilTrack: { height: 8, borderRadius: 999, backgroundColor: YColors.bg3, overflow: 'hidden', marginTop: 14 },
  utilFill: { height: 8, borderRadius: 999, backgroundColor: YColors.accent },
  statGrid: { flexDirection: 'row', gap: 10 },
  statTile: { flex: 1, backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line2, borderRadius: 14, padding: 16 },
  campRow: {},
  note: { marginTop: 18, backgroundColor: YColors.bg3, borderRadius: 12, padding: 14 },
  emptyWrap: { paddingHorizontal: 32, marginTop: 48, alignItems: 'center' },
  emptyIcon: { width: 56, height: 56, borderRadius: 999, backgroundColor: YColors.bg3, alignItems: 'center', justifyContent: 'center' },
});
