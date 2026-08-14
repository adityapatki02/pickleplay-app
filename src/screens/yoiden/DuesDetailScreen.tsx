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

type Props = NativeStackScreenProps<MeStackParamList, 'DuesDetail'>;

function money(n: number | string) {
  const v = Math.round(Number(n) || 0);
  const s = Math.abs(v).toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return '₹' + (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3);
}
const to12h = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`;
};
const dayLabel = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff > 0) return { text: `${diff} day${diff === 1 ? '' : 's'} ago`, overdue: true };
  if (diff === 0) return { text: 'today', overdue: false };
  return { text: `in ${-diff} day${diff === -1 ? '' : 's'}`, overdue: false };
};

export default function DuesDetailScreen({ route }: Props) {
  const nav = useNavigation();
  const { venueId } = route.params;
  const { show: showToast, node: toastNode } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await venuesApi.getVenueBookings(venueId, 300, 0) as any;
      const all: any[] = res?.data?.data ?? res?.data ?? [];
      const unpaid = all
        .filter(b => b.status !== 'cancelled' && b.paymentStatus === 'pending')
        .sort((a, b) => (a.bookingDate + a.startTime).localeCompare(b.bookingDate + b.startTime));
      setRows(unpaid);
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, [venueId]);

  useEffect(() => { load(); }, [load]);

  const markPaid = async (b: any) => {
    setBusy(b.id);
    try {
      await venuesApi.markBookingPaid(venueId, b.id, Number(b.amount));
      setRows(prev => prev.filter(x => x.id !== b.id));
    } catch { showToast('Could not mark as paid. Try again.'); }
    finally { setBusy(null); }
  };

  const total = rows.reduce((s, b) => s + Number(b.amount || 0), 0);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        <View style={styles.header}>
          <Pressable onPress={() => nav.goBack()} style={styles.backBtn} hitSlop={8}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M19 12H5M12 5l-7 7 7 7" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
          </Pressable>
          <YDisplay size={30} color={YColors.accent} style={{ marginTop: 8 }}>DUES</YDisplay>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <View style={styles.card}>
            <YUiText size={13.5} color={YColors.ink2} style={{ lineHeight: 20 }}>
              Bookings that were played (or booked) but <YUiText size={13.5} weight={800} color={YColors.ink}>not yet paid</YUiText>.
              This is money already earned — collect it. Mark a slot paid once the customer settles.
            </YUiText>
          </View>

          <View style={styles.totalBanner}>
            <View style={{ flex: 1 }}>
              <YUiText size={11} weight={800} color="rgba(255,255,255,0.7)" style={{ letterSpacing: 0.6 }}>OUTSTANDING</YUiText>
              <YUiText size={11} color="rgba(255,255,255,0.65)" style={{ marginTop: 2 }}>{rows.length} unpaid booking{rows.length === 1 ? '' : 's'}</YUiText>
            </View>
            <YDisplay size={30} color="#fff">{money(total)}</YDisplay>
          </View>

          {loading ? (
            <ActivityIndicator color={YColors.accent} style={{ marginTop: 30 }} />
          ) : rows.length === 0 ? (
            <View style={styles.emptyBox}>
              <YUiText size={30}>🎉</YUiText>
              <YUiText size={14} weight={700} color={YColors.ink} style={{ marginTop: 8 }}>All settled</YUiText>
              <YUiText size={12.5} color={YColors.ink3} style={{ marginTop: 2, textAlign: 'center' }}>No pending payments to chase.</YUiText>
            </View>
          ) : (
            <View style={{ marginTop: 16 }}>
              {rows.map(b => {
                const dl = dayLabel(b.bookingDate);
                const name = b.user?.displayName || b.user?.fullName || b.guestName || b.guestPhone || 'Guest';
                return (
                  <View key={b.id} style={styles.dueRow}>
                    <View style={{ flex: 1 }}>
                      <YUiText size={14} weight={800} color={YColors.ink}>{name}</YUiText>
                      <YUiText size={11.5} color={YColors.ink3} style={{ marginTop: 2 }}>
                        {b.court?.name ? `${b.court.name} · ` : ''}{to12h(b.startTime)} · <YUiText size={11.5} color={dl.overdue ? YColors.live : YColors.ink3} weight={dl.overdue ? 700 : 400}>{dl.text}</YUiText>
                      </YUiText>
                    </View>
                    <YUiText size={14} weight={900} color={WARN} style={{ marginRight: 10 }}>{money(b.amount)}</YUiText>
                    {busy === b.id ? (
                      <ActivityIndicator size="small" color={YColors.accent} />
                    ) : (
                      <Pressable style={styles.payBtn} onPress={() => markPaid(b)}>
                        <YUiText size={12} weight={800} color="#0b7a37">Mark paid</YUiText>
                      </Pressable>
                    )}
                  </View>
                );
              })}

              <Pressable
                style={styles.actionBtn}
                onPress={() => showToast('Coming soon — WhatsApp payment reminders arrive with the Grow tab.')}
              >
                <View style={styles.soonTag}><YUiText size={9} weight={800} color="#fff">SOON</YUiText></View>
                <YUiText size={14} weight={800} color="#fff">Send payment reminders</YUiText>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
      {toastNode}
    </SafeAreaView>
  );
}

const WARN = YColors.gold;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 999, backgroundColor: YColors.bg3, borderWidth: 1, borderColor: YColors.line2, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line2, borderRadius: 14, padding: 16, marginTop: 12 },
  totalBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: YColors.accent, borderRadius: 16, padding: 18, marginTop: 14 },
  emptyBox: { alignItems: 'center', paddingVertical: 44 },
  dueRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line2, borderRadius: 12, padding: 14, marginBottom: 10 },
  payBtn: { backgroundColor: '#dcfce7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: YColors.ink, borderRadius: 14, paddingVertical: 16, marginTop: 12 },
  soonTag: { position: 'absolute', top: 8, right: 10, backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
});
