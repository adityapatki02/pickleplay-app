import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  YColors,
  YDisplay,
  YEyebrow,
  YUiText,
  YMono,
  YBadge,
  YButton,
} from '../../components/yoiden';
import { openRazorpay } from '../../utils/razorpay';
import { venuesApi } from '../../api/venues.api';
import { bookingsApi } from '../../api/bookings.api';
import { useAuthStore } from '../../store/authStore';
import type { Venue, CourtAvailability, BookingCell } from '../../types/booking.types';
import { DEMO_VENUE_ID } from '../../config/demo-venues';

/** Map the backend's { courtId, courtName, slots } shape → CourtAvailability */
const mapAvailability = (raw: any[]): CourtAvailability[] =>
  raw.map((c) => ({
    court: {
      id: c.courtId ?? c.court?.id,
      venueId: c.venueId ?? '',
      name: c.courtName ?? c.court?.name ?? 'Court',
      sport: c.sport ?? c.court?.sport ?? '',
      slotDurationMin: c.slotDurationMin ?? c.court?.slotDurationMin ?? 60,
      basePrice: c.basePrice ?? c.court?.basePrice ?? 0,
      peakPrice: c.peakPrice ?? c.court?.peakPrice ?? null,
      peakWindows: c.peakWindows ?? c.court?.peakWindows ?? [],
      isActive: true,
      displayOrder: c.displayOrder ?? c.court?.displayOrder ?? 0,
    },
    chunks: (c.slots ?? c.chunks ?? []).map((s: any) => ({
      startTime: s.startTime,
      endTime: s.endTime,
      isPeak: s.isPeak ?? false,
      price: s.price,
      available: s.available,
    })),
  }));
import type { BookStackParamList } from '../../navigation/YoidenTabNavigator';

type Nav = NativeStackNavigationProp<BookStackParamList, 'VenueDetail'>;
type Rt = RouteProp<BookStackParamList, 'VenueDetail'>;

const isoForOffset = (offset: number) => {
  const base = new Date();
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const prettyDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};
const to12h = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
};
const addMinutes = (hhmm: string, mins: number) => {
  const [h, m] = hhmm.split(':').map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
const isDay = (hhmm: string) => {
  const h = parseInt(hhmm.split(':')[0], 10);
  return h >= 6 && h < 18;
};
const cellKey = (courtId: string, start: string) => `${courtId}@${start}`;

const SunIcon = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={4} stroke="#F5A623" strokeWidth={2} fill="none" />
    <Path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" stroke="#F5A623" strokeWidth={2} strokeLinecap="round" />
  </Svg>
);
const MoonIcon = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24">
    <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" stroke="#7C6FE0" strokeWidth={2} fill="none" strokeLinejoin="round" />
  </Svg>
);
const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24">
    <Path d={dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} stroke={YColors.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);

const TIME_COL = 64;
const MAX_OFFSET = 13;

export default function VenueDetailScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { venueId } = route.params;
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const insets = useSafeAreaInsets();
  // Floating YTabBar height = 72 row + max(safe-area bottom, 12) padding.
  // Add a small gap so the lime total bar sits clearly above it.
  const tabBarSpace = 72 + Math.max(insets.bottom, 12) + 10;

  const [offset, setOffset] = useState(0);
  const date = useMemo(() => isoForOffset(offset), [offset]);

  const [venue, setVenue] = useState<Venue | null>(null);
  const [courts, setCourts] = useState<CourtAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [availLoading, setAvailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<string[]>([]);
  const [selNote, setSelNote] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadVenue = useCallback(async () => {
    try {
      const res = await venuesApi.getById(venueId);
      setVenue((res.data as any)?.data ?? null);
    } catch (e: any) {
      setError(e?.message || 'Could not load venue');
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  const loadAvailability = useCallback(async () => {
    setAvailLoading(true);
    try {
      const res = await venuesApi.getAvailability(venueId, date);
      const raw = (res.data as any)?.data?.courts ?? [];
      setCourts(mapAvailability(raw));
    } catch (e: any) {
      setError(e?.message || 'Could not load availability');
      setCourts([]);
    } finally {
      setAvailLoading(false);
    }
  }, [venueId, date]);

  useEffect(() => {
    loadVenue();
  }, [loadVenue]);
  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);
  useEffect(() => {
    setSelected([]);
    setSelNote(null);
  }, [date]);

  const timeline = courts[0]?.chunks ?? [];
  const courtById = useMemo(() => new Map(courts.map((c) => [c.court.id, c])), [courts]);
  const freeAt = (courtId: string, start: string) =>
    !!courtById.get(courtId)?.chunks.find((ch) => ch.startTime === start)?.available;
  const priceAt = (courtId: string, start: string) =>
    courtById.get(courtId)?.chunks.find((ch) => ch.startTime === start)?.price ?? 0;

  const cells: BookingCell[] = selected.map((k) => {
    const [courtId, startTime] = k.split('@');
    return { courtId, startTime };
  });
  const total = cells.reduce((s, c) => s + priceAt(c.courtId, c.startTime), 0);
  const distinctCourtIds = [...new Set(cells.map((c) => c.courtId))];
  const summaryCourts =
    distinctCourtIds.length === courts.length && courts.length > 1
      ? 'Both courts'
      : distinctCourtIds.map((id) => courtById.get(id)?.court.name ?? '').join(', ');

  const distinctTimes = (keys: string[]) => [...new Set(keys.map((k) => k.split('@')[1]))].sort();
  const isConsecutive = (times: string[]) =>
    times.every((t, i) => i === 0 || t === addMinutes(times[i - 1], 30));

  const tapCell = (courtId: string, start: string) => {
    if (!freeAt(courtId, start)) return;
    setSelNote(null);
    const k = cellKey(courtId, start);

    if (selected.includes(k)) {
      const next = selected.filter((x) => x !== k);
      if (next.length === 0 || isConsecutive(distinctTimes(next))) {
        setSelected(next);
      } else {
        setSelNote('Deselect from the start or end to keep times consecutive.');
      }
      return;
    }
    const candidate = [...selected, k];
    if (isConsecutive(distinctTimes(candidate))) {
      setSelected(candidate);
    } else {
      setSelected([k]);
      setSelNote('Times must be consecutive. Started a new selection here.');
    }
  };

  const submit = async (channel: 'online' | 'offline') => {
    if (cells.length === 0) return;
    setModalError(null);
    if (!isAuthed && (!guestName.trim() || !guestPhone.trim())) {
      setModalError('Enter your name and phone to book as a guest.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await bookingsApi.create({
        venueId,
        date,
        cells,
        channel,
        ...(isAuthed ? {} : { guestName: guestName.trim(), guestPhone: guestPhone.trim() }),
      });
      const result = res.data;
      const booking = result.booking;
      const payment = result.payment;

      // ── Online payment → open Razorpay checkout ──────────────────
      if (channel === 'online' && payment?.orderId) {
        setSheetOpen(false);
        try {
          const rzpRes = await openRazorpay({
            key: payment.key,
            amount: payment.amount,
            currency: payment.currency ?? 'INR',
            order_id: payment.orderId,
            name: venue?.name ?? 'Yoiden',
            description: `Court booking · ${date}`,
            prefill: {
              contact: guestPhone.trim() || '',
              name: guestName.trim() || '',
            },
            theme: { color: '#1B4FD8' },
          });
          // Verify signature on backend → marks booking confirmed
          await bookingsApi.confirmPayment(booking.id, {
            razorpayOrderId: rzpRes.razorpay_order_id,
            razorpayPaymentId: rzpRes.razorpay_payment_id,
            razorpaySignature: rzpRes.razorpay_signature,
          });
        } catch (rzpErr: any) {
          // User dismissed Razorpay or payment failed — booking stays 'pending'
          // Don't show as an error — they can retry from MyBookings
          console.warn('[Razorpay]', rzpErr?.description ?? rzpErr);
        }
      }

      // ── Cleanup + navigate ────────────────────────────────────────
      setSelected([]);
      setGuestName('');
      setGuestPhone('');
      await loadAvailability();
      nav.navigate('MyBookings', { justBooked: booking?.id });
    } catch (e: any) {
      const status = e?.response?.status;
      const msg =
        status === 409
          ? 'One of those slots was just taken. Pick another.'
          : e?.response?.data?.message || e?.message || 'Booking failed';
      setModalError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <ActivityIndicator color={YColors.ink2} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.headerBtn}>
          <Chevron dir="left" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <YUiText size={15} weight={800} color={YColors.accent} numberOfLines={1}>
            {venue?.name ?? 'Venue'}
          </YUiText>
          <YUiText size={12} color={YColors.ink2} style={{ marginTop: 2 }}>
            {prettyDate(date)}
          </YUiText>
        </View>
        <Pressable onPress={() => nav.navigate('MyBookings')} hitSlop={10} style={styles.headerBtn}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke={YColors.ink2} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      {/* Venue info strip — sports chips + open/close hours */}
      {venue && (
        <View style={styles.venueInfo}>
          <View style={styles.venueInfoLeft}>
            {(venue as any).sports?.length > 0 ? (
              <View style={styles.sportPills}>
                {((venue as any).sports as string[]).map((s: string) => (
                  <View key={s} style={styles.sportPill}>
                    <YMono size={9} bold color={YColors.accent} style={{ letterSpacing: 0.8 }}>
                      {s.toUpperCase()}
                    </YMono>
                  </View>
                ))}
              </View>
            ) : null}
            {venue.address ? (
              <YUiText size={11} color={YColors.ink3} numberOfLines={1} style={{ marginTop: 2 }}>
                {venue.address}
              </YUiText>
            ) : null}
          </View>
          <YMono size={10} color={YColors.ink2} style={{ letterSpacing: 0.5 }}>
            {to12h(venue.openTime)} – {to12h(venue.closeTime)}
          </YMono>
        </View>
      )}

      {/* Court column headers — blue bar with lime capsules */}
      <View style={styles.colHead}>
        <View style={{ width: TIME_COL }} />
        {courts.map((c) => (
          <View key={c.court.id} style={styles.colHeadCell}>
            <View style={styles.courtCapsule}>
              <YUiText size={13} weight={800} color="#14210A">
                {c.court.name}
              </YUiText>
            </View>
          </View>
        ))}
      </View>

      {/* Grid */}
      {availLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={YColors.ink2} />
        </View>
      ) : courts.length === 0 ? (
        <View style={styles.center}>
          <YUiText size={13} color={YColors.ink2}>
            {error ?? 'No courts open on this date.'}
          </YUiText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <YUiText
            size={11}
            color={selNote ? YColors.live : YColors.ink3}
            style={{ paddingHorizontal: 16, paddingVertical: 10, textAlign: 'center' }}
          >
            {selNote ?? 'Tap consecutive time slots. Either court, or both at once.'}
          </YUiText>

          {timeline.map((ch) => (
            <View key={ch.startTime} style={styles.row}>
              <View style={styles.timeCol}>
                {isDay(ch.startTime) ? <SunIcon /> : <MoonIcon />}
                <YMono size={10} color={YColors.ink2} style={{ marginTop: 3 }}>
                  {to12h(ch.startTime)}
                </YMono>
              </View>
              {courts.map((c) => {
                const free = freeAt(c.court.id, ch.startTime);
                const sel = selected.includes(cellKey(c.court.id, ch.startTime));
                const price = priceAt(c.court.id, ch.startTime);
                return (
                  <Pressable
                    key={c.court.id}
                    disabled={!free}
                    onPress={() => tapCell(c.court.id, ch.startTime)}
                    style={[styles.cell, !free && styles.cellBooked, sel && styles.cellSel]}
                  >
                    {free ? (
                      <YUiText size={13} weight={800} color={sel ? '#fff' : YColors.ink}>
                        ₹ {price}
                        {sel ? '  ✓' : ''}
                      </YUiText>
                    ) : (
                      <YUiText size={12} weight={700} color="#B6B6BC">
                        Booked
                      </YUiText>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Date nav */}
      <View style={styles.dateNav}>
        <Pressable disabled={offset <= 0} onPress={() => setOffset((o) => Math.max(0, o - 1))} hitSlop={8}>
          <YUiText size={14} weight={700} color={offset <= 0 ? YColors.ink4 : YColors.accent}>
            Previous
          </YUiText>
        </Pressable>
        <YUiText size={14} weight={800} color={YColors.ink}>
          {prettyDate(date)}
        </YUiText>
        <Pressable disabled={offset >= MAX_OFFSET} onPress={() => setOffset((o) => Math.min(MAX_OFFSET, o + 1))} hitSlop={8}>
          <YUiText size={14} weight={700} color={offset >= MAX_OFFSET ? YColors.ink4 : YColors.accent}>
            Next
          </YUiText>
        </Pressable>
      </View>

      {/* Total + proceed — lime pop, lifted above the floating tab bar */}
      <View style={styles.proceedBar}>
        {cells.length > 0 ? (
          <View style={{ flex: 1 }}>
            <YMono size={9} color="rgba(20,33,10,0.7)" style={{ letterSpacing: 1 }}>
              TOTAL PAYABLE · {cells.length} SLOT{cells.length === 1 ? '' : 'S'} · {(summaryCourts || '').toUpperCase()}
            </YMono>
            <YUiText size={22} weight={900} color="#14210A" style={{ marginTop: 1 }}>
              ₹{total}
            </YUiText>
          </View>
        ) : (
          <YUiText size={13} weight={700} color="rgba(20,33,10,0.7)" style={{ flex: 1 }}>
            Select slots to see your total
          </YUiText>
        )}
        <Pressable
          disabled={cells.length === 0}
          onPress={() => { setModalError(null); setSheetOpen(true); }}
          style={[styles.proceedBtn, cells.length === 0 && { opacity: 0.45 }]}
        >
          <YMono size={12} bold color="#fff" style={{ letterSpacing: 1.5 }}>
            PROCEED
          </YMono>
        </Pressable>
      </View>

      {/* Spacer to clear the floating bottom tab bar */}
      <View style={{ height: tabBarSpace, backgroundColor: '#FFFFFF' }} />

      {/* Confirm sheet */}
      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => !submitting && setSheetOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <YEyebrow color={YColors.ink3}>CONFIRM BOOKING</YEyebrow>
          <YDisplay size={26} color={YColors.ink} style={{ marginTop: 6 }}>
            {cells.length} SLOT{cells.length === 1 ? '' : 'S'} · ₹{total}
          </YDisplay>
          <YUiText size={13} color={YColors.ink2} style={{ marginTop: 8 }}>
            {prettyDate(date)} · {summaryCourts || 'Court'}
          </YUiText>

          <View style={styles.cartList}>
            {courts.map((c) => {
              const mine = cells.filter((x) => x.courtId === c.court.id).map((x) => x.startTime).sort();
              if (mine.length === 0) return null;
              return (
                <View key={c.court.id} style={styles.cartRow}>
                  <YMono size={10} bold color={YColors.ink2} style={{ letterSpacing: 0.8 }}>
                    {c.court.name.toUpperCase()}
                  </YMono>
                  <YUiText size={12} color={YColors.ink} style={{ flex: 1, textAlign: 'right' }}>
                    {mine.map((t) => `${t}-${addMinutes(t, 30)}`).join(', ')}
                  </YUiText>
                </View>
              );
            })}
          </View>

          {!isAuthed ? (
            <View style={{ marginTop: 16 }}>
              <TextInput placeholder="Your name" placeholderTextColor={YColors.ink3} value={guestName} onChangeText={setGuestName} style={styles.input} />
              <TextInput placeholder="Phone number" placeholderTextColor={YColors.ink3} keyboardType="phone-pad" value={guestPhone} onChangeText={setGuestPhone} style={[styles.input, { marginTop: 10 }]} />
            </View>
          ) : null}

          {modalError ? (
            <YUiText size={12} color={YColors.live} style={{ marginTop: 12 }}>
              {modalError}
            </YUiText>
          ) : null}

          <View style={styles.sheetActions}>
            <View style={{ flex: 1 }}>
              <YButton variant="primary" size="md" disabled={submitting} onPress={() => submit('offline')}>
                {submitting ? 'BOOKING…' : 'PAY AT VENUE'}
              </YButton>
            </View>
            <View style={{ flex: 1 }}>
              <YButton variant="lime" size="md" disabled={submitting} onPress={() => submit('online')}>
                PAY ONLINE
              </YButton>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, padding: 40, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 8, backgroundColor: '#FFFFFF' },
  headerBtn: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: YColors.line2 },
  venueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: YColors.bg2,
    borderBottomWidth: 1,
    borderBottomColor: YColors.line,
    gap: 10,
  },
  venueInfoLeft: { flex: 1, gap: 2 },
  sportPills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  sportPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#EEF3FF',
    borderWidth: 1,
    borderColor: '#D0DEFF',
  },
  colHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: YColors.line },
  colHeadCell: { flex: 1, alignItems: 'center' },
  courtCapsule: { backgroundColor: YColors.lime, paddingHorizontal: 22, paddingVertical: 7, borderRadius: 999 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 10 },
  timeCol: { width: TIME_COL, alignItems: 'center', justifyContent: 'center', paddingVertical: 3 },
  cell: { flex: 1, marginHorizontal: 5, marginVertical: 3, minHeight: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F8FF', borderWidth: 1, borderColor: '#DCE7FA' },
  cellSel: { backgroundColor: YColors.accent, borderColor: YColors.accent },
  cellBooked: { backgroundColor: '#EDEDF0', borderColor: 'transparent' },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: YColors.line },
  proceedBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: YColors.lime },
  proceedBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10, backgroundColor: YColors.accent },
  backdrop: { flex: 1, backgroundColor: 'rgba(10,10,11,0.45)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 28 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: YColors.line2, marginBottom: 16 },
  cartList: { marginTop: 14, gap: 8 },
  cartRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: YColors.line },
  input: { borderWidth: 1, borderColor: YColors.line2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: YColors.ink, backgroundColor: '#FFFFFF' },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
});
