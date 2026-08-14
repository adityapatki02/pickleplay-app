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

type Props = NativeStackScreenProps<MeStackParamList, 'RevenueDetail'>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CH_LABEL: Record<string, string> = { online: 'Online (app)', venue: 'Walk-in / phone', complimentary: 'Complimentary' };
function money(n: number | string) {
  const v = Math.round(Number(n) || 0);
  const s = Math.abs(v).toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return '₹' + (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3);
}

export default function RevenueDetailScreen({ route }: Props) {
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

  const s = data?.summary;
  const trend: any[] = data?.trend ?? [];
  const trendMax = Math.max(1, ...trend.map(t => t.revenue));
  const channel: any[] = data?.channelMix ?? [];
  const chTotal = Math.max(1, channel.reduce((a, c) => a + c.revenue, 0));
  const perCourt: any[] = data?.perCourt ?? [];

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        <View style={styles.header}>
          <Pressable onPress={() => nav.goBack()} style={styles.backBtn} hitSlop={8}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M19 12H5M12 5l-7 7 7 7" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
          </Pressable>
          <YDisplay size={30} color={YColors.accent} style={{ marginTop: 8 }}>REVENUE</YDisplay>
        </View>

        <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>{filterNode}</View>

        {loading ? (
          <ActivityIndicator color={YColors.accent} style={{ marginTop: 40 }} />
        ) : !s ? (
          <YUiText size={13} color={YColors.ink3} style={{ marginLeft: 16, marginTop: 20 }}>Couldn’t load revenue.</YUiText>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {/* Money in / owed */}
            <View style={styles.hero}>
              <YUiText size={10.5} weight={800} color="rgba(255,255,255,0.7)" style={{ letterSpacing: 1 }}>
                COLLECTED{data.range ? ` · ${data.range.days ? `LAST ${data.range.days}D` : String(data.range.label).toUpperCase()}${data.range.daypart && data.range.daypart !== 'all' ? ` · ${String(data.range.daypart).toUpperCase()}` : ''}` : ''}
              </YUiText>
              <YDisplay size={34} color="#fff" style={{ marginTop: 4 }}>{money(s.collected)}</YDisplay>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {s.momPct != null && (
                  <View style={[styles.pill, { backgroundColor: s.momPct >= 0 ? 'rgba(22,163,74,0.25)' : 'rgba(255,61,92,0.25)' }]}>
                    <YUiText size={11} weight={800} color={s.momPct >= 0 ? '#86efac' : '#fca5a5'}>{s.momPct >= 0 ? '▲' : '▼'} {Math.abs(s.momPct)}% MoM</YUiText>
                  </View>
                )}
                <View style={styles.pill}><YUiText size={11} weight={700} color="rgba(255,255,255,0.85)">booked {money(s.gross)}</YUiText></View>
              </View>
            </View>

            {s.pending > 0 && (
              <Pressable style={styles.duesLink} onPress={() => (nav as any).navigate('DuesDetail', { venueId })}>
                <YUiText size={13} weight={700} color={YColors.ink}>{money(s.pending)} still uncollected · {s.pendingCount} booking{s.pendingCount === 1 ? '' : 's'}</YUiText>
                <YUiText size={12} weight={800} color={YColors.accent}>Chase →</YUiText>
              </Pressable>
            )}

            {/* 6-month trend */}
            <SectionTitle>Last 6 months</SectionTitle>
            <View style={styles.card}>
              <View style={styles.barRow}>
                {trend.map((t: any) => {
                  const h = Math.max(3, Math.round((t.revenue / trendMax) * 100));
                  const current = t.month === data.month;
                  return (
                    <View key={t.month} style={styles.barCol}>
                      <YUiText size={9.5} color={YColors.ink3} style={{ marginBottom: 4 }}>{t.revenue >= 1000 ? Math.round(t.revenue / 1000) + 'k' : t.revenue}</YUiText>
                      <View style={[styles.bar, { height: h, backgroundColor: current ? YColors.accent : YColors.line2 }]} />
                      <YUiText size={10} color={current ? YColors.ink : YColors.ink3} weight={current ? 800 : 400} style={{ marginTop: 6 }}>{MONTHS[Number(t.month.split('-')[1]) - 1]}</YUiText>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Channel mix */}
            <SectionTitle>Where it comes from</SectionTitle>
            <View style={styles.card}>
              {channel.map((c: any, i: number) => (
                <View key={c.channel} style={{ marginTop: i ? 14 : 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                    <YUiText size={13} color={YColors.ink}>{CH_LABEL[c.channel] ?? c.channel}</YUiText>
                    <YUiText size={13} weight={800} color={YColors.ink}>{money(c.revenue)} · {Math.round((c.revenue / chTotal) * 100)}%</YUiText>
                  </View>
                  <View style={styles.trackBg}><View style={[styles.trackFill, { width: `${Math.round((c.revenue / chTotal) * 100)}%` }]} /></View>
                </View>
              ))}
            </View>

            {/* Per court */}
            <SectionTitle>By court</SectionTitle>
            <View style={styles.card}>
              {perCourt.map((c: any, i: number) => (
                <View key={c.courtId} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: i ? 12 : 0 }}>
                  <YUiText size={13} color={YColors.ink}>{c.name} <YUiText size={11} color={YColors.ink3}>· {c.bookings} bookings</YUiText></YUiText>
                  <YUiText size={13} weight={800} color={YColors.accent}>{money(c.revenue)}</YUiText>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <YUiText size={12} weight={800} color={YColors.ink2} style={{ marginTop: 22, marginBottom: 8, letterSpacing: 0.6 }}>{children}</YUiText>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 999, backgroundColor: YColors.bg3, borderWidth: 1, borderColor: YColors.line2, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: YColors.accent, borderRadius: 16, padding: 18, marginTop: 12 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)' },
  duesLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(200,242,50,0.18)', borderWidth: 1, borderColor: YColors.line2, borderRadius: 12, padding: 14, marginTop: 12 },
  card: { backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line2, borderRadius: 14, padding: 16 },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 130 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 22, borderRadius: 5 },
  trackBg: { height: 8, borderRadius: 999, backgroundColor: YColors.bg3, overflow: 'hidden' },
  trackFill: { height: 8, borderRadius: 999, backgroundColor: YColors.accent },
});
