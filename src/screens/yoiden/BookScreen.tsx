import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
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
import { venuesApi } from '../../api/venues.api';
import { resizeUrl } from '../../utils/img';
import type { Venue } from '../../types/booking.types';
import type { BookStackParamList } from '../../navigation/YoidenTabNavigator';

type Nav = NativeStackNavigationProp<BookStackParamList, 'Book'>;

// Court prices are per slot-chunk (e.g. 30 min); show an hourly range.
const priceRange = (venue: Venue): string => {
  const prices: number[] = [];
  for (const c of venue.courts ?? []) {
    const perHour = 60 / (c.slotDurationMin || 60);
    if (c.basePrice != null) prices.push(Number(c.basePrice) * perHour);
    if (c.peakPrice != null) prices.push(Number(c.peakPrice) * perHour);
  }
  if (prices.length === 0) return '';
  const min = Math.round(Math.min(...prices));
  const max = Math.round(Math.max(...prices));
  return min === max ? `₹${min}` : `₹${min}–₹${max}`;
};

// First photo of a venue. Prefer a backend-generated thumb; otherwise route the
// raw upload (can be a 12 MB JPG) through the resize proxy — a full-bleed card
// image is only ~150px tall, so the original is wildly oversized.
const venuePhoto = (v: Venue): string | undefined => {
  const p = Array.isArray(v.photos) ? v.photos[0] : undefined;
  if (!p) return undefined;
  if (typeof p === 'string') return resizeUrl(p, { w: 800, h: 300 });
  const thumb = (p as { thumbUrl?: string; url: string }).thumbUrl;
  return thumb ?? resizeUrl(p.url, { w: 800, h: 300 });
};

export default function BookScreen() {
  const nav = useNavigation<Nav>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchVenues = useCallback(async () => {
    try {
      setError(null);
      const res = await venuesApi.list({ limit: 50 });
      const data = (res.data as any)?.data ?? [];
      setVenues(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Could not load courts');
      setVenues([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchVenues();
  }, [fetchVenues]);

  const openVenue = (id: string) => nav.navigate('VenueDetail', { venueId: id });

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YColors.ink2} />
        }
      >
        <YTopBar
          eyebrow="RESERVE A COURT"
          title="BOOK"
          action={
            <Pressable onPress={() => nav.navigate('MyBookings')} style={styles.pill} hitSlop={8}>
              <YMono size={9} bold color={YColors.ink} style={{ letterSpacing: 1 }}>
                MY BOOKINGS
              </YMono>
            </Pressable>
          }
        />

        <YSectionHead
          eyebrow={`${venues.length} VENUE${venues.length === 1 ? '' : 'S'}`}
          title="NEARBY COURTS"
        />

        {loading ? (
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
        ) : venues.length === 0 ? (
          <View style={styles.empty}>
            <YEyebrow color={YColors.ink3}>NO COURTS YET</YEyebrow>
            <YUiText size={13} color={YColors.ink2} style={{ marginTop: 8 }}>
              No bookable courts in your area right now.
            </YUiText>
          </View>
        ) : (
          <View style={styles.list}>
            {venues.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => openVenue(v.id)}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
              >
                <Image
                  source={{ uri: venuePhoto(v) ?? `https://picsum.photos/seed/${v.id}/640/360` }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
                <View style={styles.cardBody}>
                  <View style={styles.cardHead}>
                    <View style={{ flex: 1 }}>
                      <YDisplay size={22} color={YColors.accent} style={{ lineHeight: 24 }}>
                        {v.name}
                      </YDisplay>
                      <YUiText size={12} color={YColors.ink2} style={{ marginTop: 4 }}>
                        {v.city}
                        {v.state ? `, ${v.state}` : ''}
                      </YUiText>
                    </View>
                    {priceRange(v) ? (
                      <YBadge color="#000" bg={YColors.lime}>
                        {priceRange(v)}/hr
                      </YBadge>
                    ) : null}
                  </View>

                  <YUiText size={12} color={YColors.ink3} numberOfLines={2} style={{ marginTop: 10 }}>
                    {v.address}
                  </YUiText>

                  <View style={styles.cardFoot}>
                    <YMono size={10} color={YColors.ink3} style={{ letterSpacing: 1 }}>
                      {(v.courts?.length ?? 0)} COURT{(v.courts?.length ?? 0) === 1 ? '' : 'S'} ·{' '}
                      {v.openTime}–{v.closeTime}
                    </YMono>
                    <YButton variant="primary" size="sm" onPress={() => openVenue(v.id)}>
                      BOOK
                    </YButton>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: YColors.bg3,
    borderWidth: 1,
    borderColor: YColors.line2,
  },
  list: { paddingHorizontal: 16 },
  card: {
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardImage: {
    width: '100%',
    height: 150,
    backgroundColor: YColors.bg3,
  },
  cardBody: { padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardFoot: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  center: { padding: 40, alignItems: 'center' },
  empty: { paddingHorizontal: 20, paddingVertical: 40 },
});
