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
import { useToast } from '../../components/Toast';

type Props = NativeStackScreenProps<MeStackParamList, 'HeatmapDetail'>;

const heatColor = (a: number) => `rgba(24,88,214,${a})`;
const GOOD = '#16A34A';
const to12 = (h: number) => `${h % 12 || 12}${h >= 12 ? 'pm' : 'am'}`;
const WEEK_OPTS = [4, 8, 12];

export default function HeatmapDetailScreen({ route }: Props) {
  const nav = useNavigation();
  const { venueId } = route.params;
  const { show: showToast, node: toastNode } = useToast();

  const [courtId, setCourtId] = useState<string | undefined>(route.params.courtId);
  const [weeks, setWeeks] = useState(8);
  const [dayType, setDayType] = useState<'all' | 'weekday' | 'weekend'>('all');
  const [daypart, setDaypart] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('all');
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<{ di: number; hi: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await venuesApi.getHeatmap(venueId, { courtId, weeks, dayType, daypart }) as any;
      setData(res?.data?.data ?? res?.data ?? null);
      setSel(null);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [venueId, courtId, weeks, dayType, daypart]);

  useEffect(() => { load(); }, [load]);

  const matrix: number[][] = data?.matrix ?? [];
  const hours: number[] = data?.hours ?? [];
  const days: string[] = data?.days ?? [];
  const heatMax = Math.max(1, ...matrix.flat());
  const courts: { id: string; name: string }[] = data?.courts ?? [];
  const selCount = sel ? matrix[sel.di]?.[sel.hi] ?? 0 : null;
  const opps: any[] = data?.opportunities ?? [];
  const primeFill = data?.primeFillPct ?? 0;
  const primeSet = new Set<number>(data?.primeHours ?? []);
  const oppSet = new Set(opps.map((o: any) => `${days.indexOf(o.day)}|${o.hour}`));

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => nav.goBack()} style={styles.backBtn} hitSlop={8}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M12 5l-7 7 7 7" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <YDisplay size={30} color={YColors.accent} style={{ marginTop: 8 }}>DEMAND</YDisplay>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {/* 1 — What this means */}
          <View style={styles.card}>
            <YUiText size={13.5} color={YColors.ink2} style={{ lineHeight: 20 }}>
              This is your <YUiText size={13.5} weight={800} color={YColors.ink}>historical pattern</YUiText> — not a forecast.
              We flag prime slots (proven demand) that have sat <YUiText size={13.5} weight={800} color={YColors.ink}>empty week after week</YUiText> (outlined).
              Those recurring gaps are what a standing weekday/weekend offer can fill — like a happy hour. Filter by day-type
              and time of day to zoom in.
            </YUiText>
          </View>

          {/* 2 — Filters (the magnifier) */}
          <YUiText size={11} weight={800} color={YColors.ink3} style={styles.filterLabel}>COURT</YUiText>
          <View style={styles.chipRow}>
            <Chip label="All courts" active={!courtId} onPress={() => setCourtId(undefined)} />
            {courts.map(c => <Chip key={c.id} label={c.name} active={courtId === c.id} onPress={() => setCourtId(c.id)} />)}
          </View>
          <YUiText size={11} weight={800} color={YColors.ink3} style={styles.filterLabel}>WINDOW</YUiText>
          <View style={styles.chipRow}>
            {WEEK_OPTS.map(w => <Chip key={w} label={`${w} weeks`} active={weeks === w} onPress={() => setWeeks(w)} />)}
          </View>
          <YUiText size={11} weight={800} color={YColors.ink3} style={styles.filterLabel}>DAY TYPE</YUiText>
          <View style={styles.chipRow}>
            <Chip label="All days" active={dayType === 'all'} onPress={() => setDayType('all')} />
            <Chip label="Weekdays" active={dayType === 'weekday'} onPress={() => setDayType('weekday')} />
            <Chip label="Weekends" active={dayType === 'weekend'} onPress={() => setDayType('weekend')} />
          </View>
          <YUiText size={11} weight={800} color={YColors.ink3} style={styles.filterLabel}>TIME OF DAY</YUiText>
          <View style={styles.chipRow}>
            <Chip label="All" active={daypart === 'all'} onPress={() => setDaypart('all')} />
            <Chip label="Morning" active={daypart === 'morning'} onPress={() => setDaypart('morning')} />
            <Chip label="Afternoon" active={daypart === 'afternoon'} onPress={() => setDaypart('afternoon')} />
            <Chip label="Evening" active={daypart === 'evening'} onPress={() => setDaypart('evening')} />
          </View>

          {loading ? (
            <ActivityIndicator color={YColors.accent} style={{ marginTop: 30 }} />
          ) : !data ? (
            <YUiText size={13} color={YColors.ink3} style={{ marginTop: 20 }}>Couldn’t load demand data.</YUiText>
          ) : (
            <>
              {/* Prime-time fill */}
              <View style={styles.primeBanner}>
                <View style={{ flex: 1 }}>
                  <YUiText size={11} weight={800} color={YColors.ink3} style={{ letterSpacing: 0.6 }}>PRIME-TIME FILL</YUiText>
                  <YUiText size={11.5} color={YColors.ink3} style={{ marginTop: 2 }}>How full your in-demand hours are.</YUiText>
                </View>
                <YDisplay size={30} color={primeFill >= 70 ? GOOD : primeFill >= 45 ? YColors.accent : YColors.gold}>{primeFill}%</YDisplay>
              </View>

              {/* Selected-cell readout */}
              <View style={styles.readout}>
                {sel ? (
                  <YUiText size={14} weight={800} color={YColors.ink}>
                    {days[sel.di]} {to12(hours[sel.hi])} · <YUiText size={14} weight={900} color={YColors.accent}>{selCount} booking{selCount === 1 ? '' : 's'}</YUiText>
                    <YUiText size={12} color={YColors.ink3}>  (last {data.weeks} wks)</YUiText>
                  </YUiText>
                ) : (
                  <YUiText size={12.5} color={YColors.ink3}>Tap any square to see that slot’s bookings.</YUiText>
                )}
              </View>

              {/* 3 — The heatmap */}
              <View style={styles.card}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    <View style={{ flexDirection: 'row', marginLeft: 34, marginBottom: 4 }}>
                      {hours.map((h, i) => (
                        <View key={h} style={styles.cellWrap}>
                          {i % 2 === 0 ? <YUiText size={9} weight={primeSet.has(h) ? 800 : 400} color={primeSet.has(h) ? YColors.accent : YColors.ink3}>{h}</YUiText> : <YUiText size={9} color="transparent">.</YUiText>}
                        </View>
                      ))}
                    </View>
                    {days.map((day, di) => (
                      <View key={day} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                        <YUiText size={10} color={YColors.ink3} style={{ width: 30 }}>{day}</YUiText>
                        {(matrix[di] ?? []).map((v: number, hi: number) => {
                          const isSel = sel?.di === di && sel?.hi === hi;
                          const isOpp = oppSet.has(`${di}|${hours[hi]}`);
                          return (
                            <Pressable key={hi} onPress={() => setSel({ di, hi })}>
                              <View style={[
                                styles.cell,
                                { backgroundColor: v === 0 ? YColors.bg3 : heatColor(0.14 + 0.86 * (v / heatMax)) },
                                isOpp && styles.cellOpp,
                                isSel && styles.cellSel,
                              ]} />
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                    {/* legend */}
                    <View style={styles.legendRow}>
                      <YUiText size={9.5} color={YColors.ink3}>Less</YUiText>
                      {[0.14, 0.4, 0.65, 1].map(a => <View key={a} style={[styles.legendCell, { backgroundColor: heatColor(a) }]} />)}
                      <YUiText size={9.5} color={YColors.ink3}>More</YUiText>
                    </View>
                  </View>
                </ScrollView>
              </View>

              {/* 4 — Headline findings */}
              <View style={styles.findRow}>
                <View style={[styles.findCard, { borderLeftColor: YColors.accent }]}>
                  <YUiText size={11} weight={800} color={YColors.ink3} style={{ letterSpacing: 0.6 }}>GOLD HOUR</YUiText>
                  {data.busiest ? (
                    <>
                      <YUiText size={17} weight={900} color={YColors.ink} style={{ marginTop: 4 }}>{data.busiest.day} {to12(data.busiest.hour)}</YUiText>
                      <YUiText size={12} color={YColors.ink3}>{data.busiest.count} bookings — protect this slot</YUiText>
                    </>
                  ) : <YUiText size={13} color={YColors.ink3} style={{ marginTop: 6 }}>No bookings yet</YUiText>}
                </View>
                <View style={[styles.findCard, { borderLeftColor: YColors.gold }]}>
                  <YUiText size={11} weight={800} color={YColors.ink3} style={{ letterSpacing: 0.6 }}>BIGGEST OPPORTUNITY</YUiText>
                  {opps[0] ? (
                    <>
                      <YUiText size={17} weight={900} color={YColors.ink} style={{ marginTop: 4 }}>{opps[0].day} {to12(opps[0].hour)}</YUiText>
                      <YUiText size={12} color={YColors.ink3}>empty {opps[0].emptyWeeks} of {opps[0].totalWeeks} weeks</YUiText>
                    </>
                  ) : <YUiText size={13} color={YColors.ink3} style={{ marginTop: 6 }}>No recurring gaps here 🎉</YUiText>}
                </View>
              </View>

              {/* Fill these first — ranked prime-time gaps */}
              {opps.length > 0 && (
                <>
                  <YUiText size={11} weight={800} color={YColors.ink3} style={styles.filterLabel}>FILL THESE FIRST</YUiText>
                  <View style={styles.card}>
                    {opps.slice(0, 3).map((o: any, i: number) => (
                      <View key={i} style={[styles.oppRow, i > 0 && { borderTopWidth: 1, borderTopColor: YColors.line }]}>
                        <View style={{ flex: 1 }}>
                          <YUiText size={14} weight={800} color={YColors.ink}>{o.day} {to12(o.hour)}</YUiText>
                          <YUiText size={11.5} color={YColors.ink3} style={{ marginTop: 1 }}>empty {o.emptyWeeks} of {o.totalWeeks} weeks · {o.daypart} slot</YUiText>
                        </View>
                        {o.recoverablePerWeek > 0 && <YUiText size={13} weight={800} color={YColors.accent}>≈ ₹{o.recoverablePerWeek}/wk</YUiText>}
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* 5 — Action (wired to Grow layer later) */}
              <Pressable
                style={styles.actionBtn}
                onPress={() => showToast(`Coming soon — off-peak offers for ${opps[0] ? `${opps[0].day} ${to12(opps[0].hour)}` : 'your quiet slots'} arrive with the Grow tab.`)}
              >
                <View style={styles.soonTag}><YUiText size={9} weight={800} color="#fff">SOON</YUiText></View>
                <YUiText size={14} weight={800} color="#fff">Create an offer to fill these slots</YUiText>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
      {toastNode}
    </SafeAreaView>
  );
}

const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
    <YUiText size={12.5} weight={active ? 800 : 600} color={active ? '#fff' : YColors.ink2}>{label}</YUiText>
  </Pressable>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 999,
    backgroundColor: YColors.bg3, borderWidth: 1, borderColor: YColors.line2,
    alignItems: 'center', justifyContent: 'center',
  },
  card: { backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line2, borderRadius: 14, padding: 16, marginTop: 12 },
  filterLabel: { marginTop: 18, marginBottom: 8, letterSpacing: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: YColors.line2, backgroundColor: YColors.bg },
  chipActive: { backgroundColor: YColors.accent, borderColor: YColors.accent },
  readout: { marginTop: 18, minHeight: 20 },
  cellWrap: { width: 24, alignItems: 'center' },
  cell: { width: 22, height: 22, borderRadius: 4, margin: 1 },
  cellSel: { borderWidth: 2, borderColor: YColors.ink },
  cellOpp: { borderWidth: 1.5, borderColor: YColors.gold },
  primeBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line2, borderRadius: 14, padding: 16, marginTop: 18 },
  oppRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, marginLeft: 34 },
  legendCell: { width: 16, height: 12, borderRadius: 3 },
  findRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  findCard: { flex: 1, backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line2, borderLeftWidth: 3, borderRadius: 12, padding: 14 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: YColors.accent, borderRadius: 14, paddingVertical: 16, marginTop: 22,
  },
  soonTag: { position: 'absolute', top: 8, right: 10, backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
});
