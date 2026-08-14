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
import { useRangeFilter } from '../../components/RangeFilter';

type Props = NativeStackScreenProps<MeStackParamList, 'CustomersDetail'>;

function money(n: number | string) {
  const v = Math.round(Number(n) || 0);
  const s = Math.abs(v).toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return '₹' + (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3);
}

export default function CustomersDetailScreen({ route }: Props) {
  const nav = useNavigation();
  const { venueId, month, days, daypart } = route.params;
  const { show: showToast, node: toastNode } = useToast();
  const { params, depKey, node: filterNode } = useRangeFilter({ month, days, daypart });
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'top' | 'risk'>('top');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await venuesApi.getAnalytics(venueId, params) as any;
      setData(res?.data?.data ?? res?.data ?? null);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [venueId, depKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const cust = data?.customers ?? {};
  const top: any[] = cust.top ?? [];
  const atRisk: any[] = cust.atRisk ?? [];
  const list = tab === 'top' ? top : atRisk;

  const nudge = (name: string) =>
    showToast(`Coming soon — a "we miss you" WhatsApp to ${name} arrives with the Grow tab.`);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        <View style={styles.header}>
          <Pressable onPress={() => nav.goBack()} style={styles.backBtn} hitSlop={8}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M19 12H5M12 5l-7 7 7 7" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
          </Pressable>
          <YDisplay size={30} color={YColors.accent} style={{ marginTop: 8 }}>CUSTOMERS</YDisplay>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <View style={{ marginBottom: 12 }}>{filterNode}</View>
          <View style={styles.card}>
            <YUiText size={13.5} color={YColors.ink2} style={{ lineHeight: 20 }}>
              Your players. <YUiText size={13.5} weight={800} color={YColors.ink}>Reward the regulars</YUiText> who keep you busy, and
              <YUiText size={13.5} weight={800} color={YColors.ink}> win back the ones slipping away</YUiText> before they're gone for good.
            </YUiText>
          </View>

          {loading ? (
            <ActivityIndicator color={YColors.accent} style={{ marginTop: 30 }} />
          ) : !data ? (
            <YUiText size={13} color={YColors.ink3} style={{ marginTop: 20 }}>Couldn’t load customers.</YUiText>
          ) : (
            <>
              <View style={styles.miniRow}>
                <View style={[styles.mini, { backgroundColor: 'rgba(24,88,214,0.08)' }]}>
                  <YDisplay size={24} color={YColors.accent}>{cust.returningCustomers ?? 0}</YDisplay>
                  <YUiText size={11} color={YColors.ink2}>returning</YUiText>
                </View>
                <View style={[styles.mini, { backgroundColor: 'rgba(200,242,50,0.22)' }]}>
                  <YDisplay size={24} color={YColors.ink}>{cust.newCustomers ?? 0}</YDisplay>
                  <YUiText size={11} color={YColors.ink2}>new this month</YUiText>
                </View>
              </View>

              <View style={styles.tabs}>
                <Pressable style={[styles.tab, tab === 'top' && styles.tabActive]} onPress={() => setTab('top')}>
                  <YUiText size={13} weight={800} color={tab === 'top' ? '#fff' : YColors.ink2}>Top ({top.length})</YUiText>
                </Pressable>
                <Pressable style={[styles.tab, tab === 'risk' && styles.tabActive]} onPress={() => setTab('risk')}>
                  <YUiText size={13} weight={800} color={tab === 'risk' ? '#fff' : YColors.ink2}>At-risk ({atRisk.length})</YUiText>
                </Pressable>
              </View>

              {list.length === 0 ? (
                <View style={styles.emptyBox}>
                  <YUiText size={13} color={YColors.ink3}>{tab === 'risk' ? 'No regulars slipping — nice.' : 'No customers yet.'}</YUiText>
                </View>
              ) : list.map((c: any, i: number) => (
                <View key={i} style={styles.row}>
                  <View style={styles.rank}><YUiText size={12} weight={800} color={YColors.accent}>{i + 1}</YUiText></View>
                  <View style={{ flex: 1 }}>
                    <YUiText size={14} weight={800} color={YColors.ink}>{c.name}</YUiText>
                    <YUiText size={11.5} color={YColors.ink3} style={{ marginTop: 2 }}>
                      {tab === 'top'
                        ? `${c.bookings} bookings · ${money(c.spend)}`
                        : `${c.bookings} past bookings · last seen ${c.daysSince} days ago`}
                    </YUiText>
                  </View>
                  {tab === 'risk' && (
                    <Pressable style={styles.msgBtn} onPress={() => nudge(c.name)}>
                      <View style={styles.soonDot}><YUiText size={8} weight={800} color="#fff">SOON</YUiText></View>
                      <YUiText size={12} weight={800} color={YColors.accent}>Message</YUiText>
                    </Pressable>
                  )}
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
      {toastNode}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 999, backgroundColor: YColors.bg3, borderWidth: 1, borderColor: YColors.line2, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line2, borderRadius: 14, padding: 16, marginTop: 12 },
  miniRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  mini: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'flex-start' },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 18, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, borderWidth: 1.5, borderColor: YColors.line2, alignItems: 'center' },
  tabActive: { backgroundColor: YColors.accent, borderColor: YColors.accent },
  emptyBox: { alignItems: 'center', paddingVertical: 30 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line2, borderRadius: 12, padding: 14, marginBottom: 10 },
  rank: { width: 26, height: 26, borderRadius: 999, backgroundColor: 'rgba(24,88,214,0.1)', alignItems: 'center', justifyContent: 'center' },
  msgBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(24,88,214,0.08)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  soonDot: { backgroundColor: YColors.accent, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999 },
});
