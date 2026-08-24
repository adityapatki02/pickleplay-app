import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  YColors,
  YDisplay,
  YEyebrow,
  YUiText,
  YMono,
  YTopBar,
  YBadge,
  YButton,
  YSectionHead,
} from '../../components/yoiden';
import { bookingsApi } from '../../api/bookings.api';
import { useAuthStore } from '../../store/authStore';
import type { Booking } from '../../types/booking.types';
import type { BookStackParamList } from '../../navigation/YoidenTabNavigator';

type Nav = NativeStackNavigationProp<BookStackParamList, 'MyBookings'>;
type Rt = RouteProp<BookStackParamList, 'MyBookings'>;

const statusColor = (s: string): { bg: string; fg: string } => {
  switch (s) {
    case 'confirmed':
      return { bg: YColors.accent, fg: '#fff' };
    case 'pending':
      return { bg: YColors.bg4, fg: '#000' };
    case 'cancelled':
      return { bg: 'rgba(255,61,92,0.14)', fg: YColors.live };
    case 'completed':
      return { bg: YColors.bg3, fg: YColors.ink2 };
    default:
      return { bg: YColors.bg3, fg: YColors.ink2 };
  }
};

// The payment chip. Design principle: a SOLID, channel-tagged "PAID" chip only
// when money actually changed hands. Everything else — abandoned online
// checkouts, awaited payments, failures — gets a distinct MUTED chip that states
// the fact, never phrased as an action (there's no pay button on this list).
const paymentBadge = (
  b: { paymentStatus: string; channel?: string; status?: string; razorpayPaymentId?: string | null },
): { label: string; bg: string; fg: string } => {
  // A cancelled booking that never paid: neutral, no "pending"/"due" wording.
  if (b.status === 'cancelled' && b.paymentStatus !== 'paid') {
    return { label: 'NOT PAID', bg: YColors.bg3, fg: YColors.ink3 };
  }
  const online = b.channel === 'online';
  switch (b.paymentStatus) {
    case 'paid':
      // APP vs AT VENUE keys off an ACTUAL Razorpay payment — not the booking's
      // channel. An owner marking a booking paid (cash) has no razorpay id, so it
      // correctly reads "AT VENUE" even if it was created via the online flow.
      return b.razorpayPaymentId
        ? { label: 'PAID · APP', bg: '#0b7a37', fg: '#fff' }
        : { label: 'PAID · AT VENUE', bg: YColors.accent, fg: '#fff' };
    case 'refunded':
      return { label: 'REFUNDED', bg: YColors.bg3, fg: YColors.ink2 };
    case 'failed':
      return { label: 'PAYMENT FAILED', bg: '#fee2e2', fg: '#dc2626' };
    case 'pending':
      // Online: checkout started but never completed. Venue: due when you arrive.
      return online
        ? { label: 'PAYMENT INCOMPLETE', bg: 'rgba(180,83,9,0.12)', fg: '#b45309' }
        : { label: 'DUE AT VENUE', bg: 'rgba(180,83,9,0.12)', fg: '#b45309' };
    default: // unpaid
      return online
        ? { label: 'NOT PAID', bg: YColors.bg3, fg: YColors.ink3 }
        : { label: 'DUE AT VENUE', bg: 'rgba(180,83,9,0.12)', fg: '#b45309' };
  }
};


export default function MyBookingsScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const justBooked = route.params?.justBooked;
  const isAuthed = useAuthStore((s) => s.isAuthenticated);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const fetch = useCallback(async () => {
    if (!isAuthed) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const res = await bookingsApi.myBookings();
      setBookings((res.data as any)?.data ?? []);
    } catch (e: any) {
      setError(e?.message || 'Could not load bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthed]);

  useFocusEffect(
    useCallback(() => {
      fetch();
    }, [fetch]),
  );


  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetch();
            }}
            tintColor={YColors.ink2}
          />
        }
      >
        <YTopBar eyebrow="YOUR COURT TIME" title="MY BOOKINGS" onBack={() => nav.goBack()} />

        {!isAuthed ? (
          <View style={styles.empty}>
            <YEyebrow color={YColors.ink3}>SIGN IN</YEyebrow>
            <YUiText size={13} color={YColors.ink2} style={{ marginTop: 8 }}>
              Log in to see and manage your court bookings.
            </YUiText>
          </View>
        ) : loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={YColors.ink2} />
          </View>
        ) : error ? (
          <View style={styles.empty}>
            <YEyebrow color={YColors.live}>COULDN'T LOAD</YEyebrow>
            <YUiText size={13} color={YColors.ink2} style={{ marginTop: 8 }}>
              {error}
            </YUiText>
          </View>
        ) : bookings.length === 0 ? (
          <View style={styles.empty}>
            <YEyebrow color={YColors.ink3}>NOTHING YET</YEyebrow>
            <YUiText size={13} color={YColors.ink2} style={{ marginTop: 8, marginBottom: 16 }}>
              You haven't booked a court yet.
            </YUiText>
            <YButton variant="primary" size="md" onPress={() => nav.navigate('Book')}>
              FIND A COURT
            </YButton>
          </View>
        ) : (
          <View style={styles.list}>
            <YSectionHead eyebrow={`${bookings.length} BOOKING${bookings.length === 1 ? '' : 'S'}`} title="ALL" />
            {bookings.map((b) => {
              const sc = statusColor(b.status);
              return (
                <Pressable
                  key={b.id}
                  style={[styles.card, b.id === justBooked && { borderColor: YColors.brandLine, borderWidth: 2 }]}
                  onPress={() => nav.navigate('BookingDetail', { bookingId: b.id })}
                >
                  <View style={styles.cardHead}>
                    <View style={{ flex: 1 }}>
                      <YDisplay size={18} color={YColors.ink}>
                        {b.venue?.name ?? 'Court'}
                      </YDisplay>
                      <YUiText size={12} color={YColors.ink2} style={{ marginTop: 2 }}>
                        {b.courtLabel ?? b.court?.name ?? ''} · {b.bookingDate}
                      </YUiText>
                    </View>
                    <YBadge color={sc.fg} bg={sc.bg}>
                      {b.status.toUpperCase()}
                    </YBadge>
                  </View>

                  <View style={styles.cardFoot}>
                    <YMono size={11} color={YColors.ink2} style={{ letterSpacing: 0.5, flexShrink: 1 }}>
                      {b.startTime}–{b.endTime} · ₹{Number(b.amount)}
                    </YMono>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {(() => {
                        const pb = paymentBadge(b);
                        return <YBadge color={pb.fg} bg={pb.bg}>{pb.label}</YBadge>;
                      })()}
                      <Pressable
                        hitSlop={12}
                        onPress={(e) => { e.stopPropagation?.(); nav.navigate('BookingDetail', { bookingId: b.id }); }}
                      >
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                          <Path d="M9 18l6-6-6-6" stroke={YColors.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },
  list: { paddingHorizontal: 16 },
  card: {
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardFoot: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  center: { padding: 40, alignItems: 'center' },
  empty: { paddingHorizontal: 20, paddingVertical: 40 },
});
