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
                    <YMono size={11} color={YColors.ink2} style={{ letterSpacing: 0.5 }}>
                      {b.startTime}–{b.endTime} · ₹{Number(b.amount)} ·{' '}
                      {b.channel === 'online' ? 'ONLINE' : 'AT VENUE'} ·{' '}
                      {b.paymentStatus.toUpperCase()}
                    </YMono>
                    <Pressable
                      hitSlop={12}
                      onPress={(e) => { e.stopPropagation?.(); nav.navigate('BookingDetail', { bookingId: b.id }); }}
                    >
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path d="M9 18l6-6-6-6" stroke={YColors.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </Pressable>
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
