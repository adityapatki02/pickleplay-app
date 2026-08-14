import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, StyleSheet, Pressable, ScrollView, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';
import type { MeStackParamList } from '../../navigation/nav-types';
import { YColors, YDisplay, YUiText } from '../../components/yoiden';
import { venuesApi } from '../../api/venues.api';
import type { Venue } from '../../types/booking.types';

type Props = NativeStackScreenProps<MeStackParamList, 'OwnerDashboard'>;

const GOOD = '#16A34A';
const WARN = YColors.gold;
const DANGER = YColors.live;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function money(n: number | string) {
  const v = Math.round(Number(n) || 0);
  const s = Math.abs(v).toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return (v < 0 ? '-₹' : '₹') + grouped;
}
const heatColor = (a: number) => `rgba(24,88,214,${a})`;

export default function OwnerDashboardScreen({ route }: Props) {
  const nav = useNavigation();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueId, setVenueId] = useState<string | undefined>(route.params?.venueId);
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [rangeKey, setRangeKey] = useState<'7d' | '30d' | '60d' | '90d' | 'month'>('30d');
  const [selMonth, setSelMonth] = useState(thisMonth);
  const [daypart, setDaypart] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('all');
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(Number(thisMonth.split('-')[0]));

  // Params passed to drill-downs so they inherit the same range + daypart.
  const drillParams = (extra: any = {}) => ({
    venueId,
    ...(rangeKey === 'month' ? { month: selMonth } : { days: Number(rangeKey.replace('d', '')) }),
    ...(daypart !== 'all' ? { daypart } : {}),
    ...extra,
  });

  useEffect(() => {
    venuesApi.getMyVenues().then((res: any) => {
      const list: Venue[] = res?.data?.data ?? res?.data ?? [];
      const owned = Array.isArray(list) ? list : [];
      setVenues(owned);
      if (!venueId && owned.length) setVenueId(owned[0].id);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async (vId: string) => {
    setLoading(true);
    try {
      const p: any = {};
      if (rangeKey === 'month') p.month = selMonth; else p.days = Number(rangeKey.replace('d', ''));
      if (daypart !== 'all') p.daypart = daypart;
      const res = await venuesApi.getAnalytics(vId, p) as any;
      setData(res?.data?.data ?? res?.data ?? null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [rangeKey, selMonth, daypart]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (venueId) load(venueId);
  }, [venueId, load]);

  const venue = venues.find(v => v.id === venueId);
  const s = data?.summary;
  const insights = data?.insights ?? [];
  const warnCount = insights.filter((i: any) => i.severity === 'warn').length;
  const trendMax = useMemo(() => Math.max(1, ...(data?.trend ?? []).map((t: any) => t.revenue)), [data]);
  const heatMax = useMemo(() => {
    const m = data?.heatmap?.matrix ?? [];
    return Math.max(1, ...m.flat());
  }, [data]);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => nav.goBack()} style={styles.backBtn} hitSlop={8}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M12 5l-7 7 7 7" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          {insights.length > 0 && (
            <Pressable onPress={() => setInsightsOpen(true)} style={styles.insightsBtn} hitSlop={6}>
              <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                <Path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <View style={[styles.badge, { backgroundColor: warnCount > 0 ? YColors.live : YColors.accent }]}>
                <YUiText size={10} weight={800} color="#fff">{insights.length}</YUiText>
              </View>
            </Pressable>
          )}
        </View>
        <YDisplay size={30} color={YColors.accent} style={{ marginTop: 8 }}>DASHBOARD</YDisplay>
        {venue && <YUiText size={13} color={YColors.ink3} style={{ marginTop: 2 }}>{venue.name}</YUiText>}

        {/* Range presets (full width) */}
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 6, alignItems: 'center', paddingRight: 16 }}>
            {(['7d', '30d', '60d', '90d', 'month'] as const).map(k => {
              const active = rangeKey === k;
              const isMonth = k === 'month';
              const label = isMonth
                ? (active ? `${MONTHS[Number(selMonth.split('-')[1]) - 1]} ${selMonth.split('-')[0]}` : 'Month')
                : k.toUpperCase();
              return (
                <Pressable
                  key={k}
                  onPress={() => {
                    setRangeKey(k);
                    if (isMonth) { setPickerYear(Number(selMonth.split('-')[0])); setMonthPickerOpen(true); }
                  }}
                  style={[styles.rChip, active && styles.rChipOn, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}
                >
                  <YUiText size={12} weight={active ? 800 : 600} color={active ? '#fff' : YColors.ink2}>{label}</YUiText>
                  {isMonth && active && (
                    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none"><Path d="M6 9l6 6 6-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" /></Svg>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Time-of-day slice */}
        <View style={styles.dpRow}>
          {(['all', 'morning', 'afternoon', 'evening'] as const).map(d => (
            <Pressable key={d} onPress={() => setDaypart(d)} style={[styles.dpChip, daypart === d && styles.dpChipOn]}>
              <YUiText size={11.5} weight={daypart === d ? 800 : 600} color={daypart === d ? YColors.accent : YColors.ink3}>{d === 'all' ? 'All day' : d.charAt(0).toUpperCase() + d.slice(1)}</YUiText>
            </Pressable>
          ))}
        </View>
      </View>

      {loading && !data ? (
        <ActivityIndicator color={YColors.accent} style={{ marginTop: 60 }} />
      ) : !data ? (
        <View style={styles.emptyBox}><YUiText size={14} color={YColors.ink3}>No data for this venue.</YUiText></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>

          {/* ── Hero KPIs ────────────────────────────── */}
          <View style={styles.kpiGrid}>
            <Pressable style={[styles.kpiTile, styles.kpiHero]} onPress={() => venueId && (nav as any).navigate('RevenueDetail', drillParams())}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <YUiText size={10.5} weight={800} color="rgba(255,255,255,0.7)" style={{ letterSpacing: 1 }}>REVENUE COLLECTED</YUiText>
                <View style={styles.heroTag}><YUiText size={9.5} weight={800} color="#fff">VIEW →</YUiText></View>
              </View>
              <YDisplay size={30} color="#fff" style={{ marginTop: 4 }}>{money(s.collected)}</YDisplay>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                {s.momPct != null && (
                  <View style={[styles.momPill, { backgroundColor: s.momPct >= 0 ? 'rgba(22,163,74,0.25)' : 'rgba(255,61,92,0.25)' }]}>
                    <YUiText size={11} weight={800} color={s.momPct >= 0 ? '#86efac' : '#fca5a5'}>
                      {s.momPct >= 0 ? '▲' : '▼'} {Math.abs(s.momPct)}% vs prev
                    </YUiText>
                  </View>
                )}
                {s.projectedMonthEnd != null && <YUiText size={11} color="rgba(255,255,255,0.7)">proj. {money(s.projectedMonthEnd)}</YUiText>}
              </View>
            </Pressable>

            <StatTile label="OCCUPANCY" value={`${s.occupancyPct}%`} sub="of court-hours" onPress={() => venueId && (nav as any).navigate('HeatmapDetail', { venueId })} />
            <StatTile label="REVENUE / SLOT-HR" value={money(s.revpash)} sub="RevPASH" />
            <StatTile
              label="PENDING DUES"
              value={money(s.pending)}
              sub={`${s.pendingCount} to collect`}
              valueColor={s.pending > 0 ? WARN : YColors.ink}
              onPress={s.pending > 0 ? () => venueId && (nav as any).navigate('DuesDetail', { venueId }) : undefined}
            />
          </View>

          {/* ── Revenue trend ────────────────────────── */}
          <SectionTitle>Revenue trend</SectionTitle>
          <View style={styles.card}>
            <View style={styles.barRow}>
              {(data.trend ?? []).map((t: any, i: number) => {
                const h = Math.max(3, Math.round((t.revenue / trendMax) * 90));
                const current = t.month === data.month;
                return (
                  <View key={t.month} style={styles.barCol}>
                    <YUiText size={9.5} color={YColors.ink3} style={{ marginBottom: 4 }}>{t.revenue >= 1000 ? Math.round(t.revenue / 1000) + 'k' : t.revenue}</YUiText>
                    <View style={[styles.bar, { height: h, backgroundColor: current ? YColors.accent : YColors.line2 }]} />
                    <YUiText size={10} color={current ? YColors.ink : YColors.ink3} weight={current ? 800 : 400} style={{ marginTop: 6 }}>
                      {MONTHS[(Number(t.month.split('-')[1]) - 1)]}
                    </YUiText>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ── Channel mix ──────────────────────────── */}
          <SectionTitle>Where revenue comes from</SectionTitle>
          <View style={styles.card}>
            <ChannelMix mix={data.channelMix} />
          </View>

          {/* ── Demand heatmap ───────────────────────── */}
          <SectionTitle>Demand heatmap {data.peak?.hour != null ? `· peak ${data.peak.day} ${data.peak.hour}:00` : ''}</SectionTitle>
          <Pressable style={styles.card} onPress={() => venueId && (nav as any).navigate('HeatmapDetail', { venueId })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <YUiText size={11} color={YColors.ink3} style={{ flex: 1 }}>Bookings by day &amp; hour (last 8 weeks). Darker = busier.</YUiText>
              <YUiText size={11} weight={800} color={YColors.accent}>Explore →</YUiText>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                {/* hour axis */}
                <View style={{ flexDirection: 'row', marginLeft: 34, marginBottom: 4 }}>
                  {(data.heatmap?.hours ?? []).map((h: number, i: number) => (
                    <View key={h} style={styles.heatCellWrap}>
                      {i % 2 === 0 ? <YUiText size={8.5} color={YColors.ink3}>{h}</YUiText> : <YUiText size={8.5} color="transparent">.</YUiText>}
                    </View>
                  ))}
                </View>
                {(data.heatmap?.days ?? []).map((day: string, di: number) => (
                  <View key={day} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                    <YUiText size={10} color={YColors.ink3} style={{ width: 30 }}>{day}</YUiText>
                    {(data.heatmap.matrix[di] ?? []).map((v: number, hi: number) => (
                      <View key={hi} style={[styles.heatCell, { backgroundColor: v === 0 ? YColors.bg3 : heatColor(0.12 + 0.88 * (v / heatMax)) }]} />
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </Pressable>

          {/* ── Per court ────────────────────────────── */}
          <SectionTitle>By court</SectionTitle>
          <View style={styles.card}>
            {(data.perCourt ?? []).map((c: any, i: number) => (
              <Pressable key={c.courtId} style={[styles.courtRow, i > 0 && { borderTopWidth: 1, borderTopColor: YColors.line, paddingTop: 12, marginTop: 12 }]} onPress={() => venueId && (nav as any).navigate('HeatmapDetail', { venueId, courtId: c.courtId })}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <YUiText size={13} weight={800} color={YColors.ink}>{c.name}</YUiText>
                  <YUiText size={13} weight={900} color={YColors.accent}>{money(c.revenue)}</YUiText>
                </View>
                <View style={styles.trackBg}>
                  <View style={[styles.trackFill, { width: `${Math.min(100, c.occupancyPct)}%` }]} />
                </View>
                <YUiText size={11} color={YColors.ink3} style={{ marginTop: 5 }}>{c.occupancyPct}% occupancy · {c.bookings} bookings · <YUiText size={11} weight={800} color={YColors.accent}>demand →</YUiText></YUiText>
              </Pressable>
            ))}
          </View>

          {/* ── Customers ────────────────────────────── */}
          <SectionTitle>Customers</SectionTitle>
          <Pressable style={styles.card} onPress={() => venueId && (nav as any).navigate('CustomersDetail', drillParams())}>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 6 }}>
              <YUiText size={11} weight={800} color={YColors.accent}>See all →</YUiText>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <View style={[styles.miniStat, { backgroundColor: 'rgba(24,88,214,0.08)' }]}>
                <YDisplay size={22} color={YColors.accent}>{s.returningCustomers}</YDisplay>
                <YUiText size={11} color={YColors.ink2}>returning</YUiText>
              </View>
              <View style={[styles.miniStat, { backgroundColor: 'rgba(200,242,50,0.22)' }]}>
                <YDisplay size={22} color={YColors.ink}>{s.newCustomers}</YDisplay>
                <YUiText size={11} color={YColors.ink2}>new this month</YUiText>
              </View>
            </View>

            <YUiText size={11} weight={800} color={YColors.ink2} style={styles.subhead}>TOP CUSTOMERS</YUiText>
            {(data.customers?.top ?? []).slice(0, 5).map((c: any, i: number) => (
              <View key={i} style={styles.custRow}>
                <View style={styles.rankDot}><YUiText size={10} weight={800} color="#fff">{i + 1}</YUiText></View>
                <View style={{ flex: 1 }}>
                  <YUiText size={13} weight={700} color={YColors.ink} numberOfLines={1}>{c.name}</YUiText>
                  <YUiText size={11} color={YColors.ink3}>{c.bookings} bookings · last {c.lastVisit}</YUiText>
                </View>
                <YUiText size={13} weight={900} color={YColors.ink}>{money(c.spend)}</YUiText>
              </View>
            ))}
          </Pressable>

          {/* ── At-risk regulars ─────────────────────── */}
          {(data.customers?.atRisk ?? []).length > 0 && (
            <>
              <SectionTitle>Regulars who’ve gone quiet</SectionTitle>
              <View style={styles.card}>
                {(data.customers.atRisk).map((c: any, i: number) => (
                  <View key={i} style={[styles.custRow, i > 0 && { borderTopWidth: 1, borderTopColor: YColors.line }]}>
                    <View style={{ flex: 1 }}>
                      <YUiText size={13} weight={700} color={YColors.ink}>{c.name}</YUiText>
                      <YUiText size={11} color={YColors.ink3}>{c.bookings} past bookings · last seen {c.daysSince} days ago</YUiText>
                    </View>
                    <View style={styles.riskBadge}><YUiText size={10.5} weight={800} color={DANGER}>AT RISK</YUiText></View>
                  </View>
                ))}
              </View>
            </>
          )}


          {/* ── Reliability (cancellations / no-shows) ── */}
          <SectionTitle>Reliability</SectionTitle>
          <View style={styles.card}>
            <YUiText size={11.5} color={YColors.ink3} style={{ marginBottom: 14 }}>Are booked slots actually honoured?</YUiText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
              <FooterStat label="Cancel rate" value={`${data.cancellations?.ratePct ?? 0}%`} />
              <FooterStat label="No-shows" value={String(data.cancellations?.noShow ?? 0)} />
              <FooterStat label="Total bookings" value={String(s.totalBookings)} />
            </View>
          </View>
        </ScrollView>
      )}

      {/* Insights tray — opens like a notification panel from the header */}
      <Modal visible={insightsOpen} transparent animationType="fade" onRequestClose={() => setInsightsOpen(false)}>
        <Pressable style={styles.insightsOverlay} onPress={() => setInsightsOpen(false)}>
          <Pressable style={styles.insightsPanel} onPress={() => {}}>
            <View style={styles.insightsHead}>
              <YUiText size={13} weight={900} color={YColors.ink} style={{ letterSpacing: 0.5 }}>INSIGHTS</YUiText>
              <Pressable onPress={() => setInsightsOpen(false)} hitSlop={8}>
                <YUiText size={16} color={YColors.ink3}>✕</YUiText>
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ padding: 12, gap: 10 }} showsVerticalScrollIndicator={false}>
              {insights.map((ins: any, i: number) => {
                const c = ins.severity === 'warn' ? WARN : ins.severity === 'good' ? GOOD : YColors.accent;
                return (
                  <View key={i} style={[styles.insight, { borderLeftColor: c, marginBottom: 0 }]}>
                    <YUiText size={13.5} weight={800} color={YColors.ink}>{ins.title}</YUiText>
                    <YUiText size={12.5} color={YColors.ink2} style={{ marginTop: 3, lineHeight: 18 }}>{ins.body}</YUiText>
                  </View>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Month picker popup — year stepper + month grid */}
      <Modal visible={monthPickerOpen} transparent animationType="fade" onRequestClose={() => setMonthPickerOpen(false)}>
        <Pressable style={styles.mpOverlay} onPress={() => setMonthPickerOpen(false)}>
          <Pressable style={styles.mpPanel} onPress={() => {}}>
            <View style={styles.mpYearRow}>
              <Pressable onPress={() => setPickerYear(y => y - 1)} hitSlop={10} style={styles.monthArrow}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M15 6l-6 6 6 6" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" /></Svg>
              </Pressable>
              <YUiText size={17} weight={900} color={YColors.ink}>{pickerYear}</YUiText>
              <Pressable onPress={() => setPickerYear(y => Math.min(y + 1, now.getFullYear()))} hitSlop={10} disabled={pickerYear >= now.getFullYear()} style={[styles.monthArrow, pickerYear >= now.getFullYear() && { opacity: 0.3 }]}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M9 6l6 6 6-6" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" /></Svg>
              </Pressable>
            </View>
            <View style={styles.mpGrid}>
              {MONTHS.map((mn, i) => {
                const mm = `${pickerYear}-${String(i + 1).padStart(2, '0')}`;
                const disabled = mm > thisMonth;
                const active = mm === selMonth;
                return (
                  <Pressable key={mn} disabled={disabled} onPress={() => { setSelMonth(mm); setMonthPickerOpen(false); }} style={[styles.mpCell, active && styles.mpCellActive, disabled && { opacity: 0.3 }]}>
                    <YUiText size={13} weight={active ? 800 : 600} color={active ? '#fff' : YColors.ink}>{mn}</YUiText>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <YUiText size={12} weight={800} color={YColors.ink2} style={styles.sectionTitle}>{children}</YUiText>
);

const StatTile = ({ label, value, sub, valueColor, onPress }: { label: string; value: string; sub?: string; valueColor?: string; onPress?: () => void }) => {
  const Cmp: any = onPress ? Pressable : View;
  return (
    <Cmp style={styles.kpiTile} onPress={onPress}>
      <YUiText size={10.5} weight={800} color={YColors.ink3} style={{ letterSpacing: 0.8 }}>{label}</YUiText>
      <YDisplay size={26} color={valueColor ?? YColors.ink} style={{ marginTop: 4 }}>{value}</YDisplay>
      {sub ? <YUiText size={11} color={YColors.ink3} style={{ marginTop: 2 }}>{sub}</YUiText> : null}
      {onPress ? <YUiText size={10} weight={800} color={YColors.accent} style={{ marginTop: 6 }}>View →</YUiText> : null}
    </Cmp>
  );
};

const FooterStat = ({ label, value }: { label: string; value: string }) => (
  <View style={{ minWidth: 90 }}>
    <YDisplay size={22} color={YColors.ink}>{value}</YDisplay>
    <YUiText size={11} color={YColors.ink3}>{label}</YUiText>
  </View>
);

const ChannelMix = ({ mix }: { mix: any[] }) => {
  const total = (mix ?? []).reduce((s, m) => s + m.revenue, 0) || 1;
  const colors: Record<string, string> = { online: YColors.accent, venue: YColors.gold, complimentary: YColors.ink3 };
  const label: Record<string, string> = { online: 'Online (app)', venue: 'Walk-in', complimentary: 'Complimentary' };
  return (
    <View>
      <View style={styles.stackBar}>
        {(mix ?? []).map((m, i) => (
          <View key={i} style={{ width: `${(m.revenue / total) * 100}%`, backgroundColor: colors[m.channel] ?? YColors.ink4 }} />
        ))}
      </View>
      <View style={{ marginTop: 12, gap: 8 }}>
        {(mix ?? []).map((m, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.legendDot, { backgroundColor: colors[m.channel] ?? YColors.ink4 }]} />
            <YUiText size={12.5} color={YColors.ink2} style={{ flex: 1 }}>{label[m.channel] ?? m.channel}</YUiText>
            <YUiText size={12.5} weight={700} color={YColors.ink}>{money(m.revenue)}</YUiText>
            <YUiText size={11} color={YColors.ink3} style={{ width: 44, textAlign: 'right' }}>{Math.round((m.revenue / total) * 100)}%</YUiText>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 999, backgroundColor: YColors.bg3,
    borderWidth: 1, borderColor: YColors.line2, alignItems: 'center', justifyContent: 'center',
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', marginTop: 12 },
  rChip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5, borderColor: YColors.line2, backgroundColor: YColors.bg },
  rChipOn: { backgroundColor: YColors.accent, borderColor: YColors.accent },
  monthPicker: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start', marginTop: 10,
    backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line2, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  monthArrow: { padding: 2 },
  mpOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 30 },
  mpPanel: { backgroundColor: YColors.bg2, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: YColors.line2 },
  mpYearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingHorizontal: 10 },
  mpGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  mpCell: { width: '31%', paddingVertical: 13, borderRadius: 10, backgroundColor: YColors.bg3, alignItems: 'center' },
  mpCellActive: { backgroundColor: YColors.accent },
  dpRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  dpChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: YColors.bg3 },
  dpChipOn: { backgroundColor: 'rgba(24,88,214,0.13)' },
  insightsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line2,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
  },
  badge: { minWidth: 18, height: 18, borderRadius: 999, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  insightsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', paddingTop: 148, paddingHorizontal: 16 },
  insightsPanel: { backgroundColor: YColors.bg2, borderRadius: 16, borderWidth: 1, borderColor: YColors.line2, overflow: 'hidden' },
  insightsHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: YColors.line,
  },
  emptyBox: { alignItems: 'center', marginTop: 60 },

  insight: {
    backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line,
    borderLeftWidth: 3, borderRadius: 12, padding: 14, marginBottom: 10,
  },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6, marginBottom: 6 },
  kpiTile: {
    width: '47.7%', flexGrow: 1, backgroundColor: YColors.bg2,
    borderWidth: 1, borderColor: YColors.line, borderRadius: 14, padding: 14,
  },
  kpiHero: { width: '100%', backgroundColor: YColors.accent, borderColor: YColors.accent },
  heroTag: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  momPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },

  sectionTitle: { letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 10 },
  card: { backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line, borderRadius: 14, padding: 16 },

  barRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 130 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 26, borderRadius: 5 },

  stackBar: { flexDirection: 'row', height: 18, borderRadius: 6, overflow: 'hidden', backgroundColor: YColors.bg3 },
  legendDot: { width: 11, height: 11, borderRadius: 3, marginRight: 9 },

  heatCellWrap: { width: 18, alignItems: 'center' },
  heatCell: { width: 16, height: 16, borderRadius: 3, marginRight: 2 },

  courtRow: {},
  trackBg: { height: 8, borderRadius: 999, backgroundColor: YColors.bg3, overflow: 'hidden' },
  trackFill: { height: 8, borderRadius: 999, backgroundColor: YColors.accent },

  miniStat: { flex: 1, borderRadius: 12, padding: 14 },
  subhead: { letterSpacing: 0.8, marginBottom: 8 },
  custRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  rankDot: { width: 20, height: 20, borderRadius: 999, backgroundColor: YColors.accent, alignItems: 'center', justifyContent: 'center' },
  riskBadge: { backgroundColor: 'rgba(255,61,92,0.12)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
});
