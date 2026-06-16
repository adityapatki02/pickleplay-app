import React from 'react';
import { View, StyleSheet, Pressable, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { YColors, YDisplay, YUiText, YMono } from '../../components/yoiden';
import type { BookStackParamList, YoidenTabParamList } from '../../navigation/YoidenTabNavigator';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<BookStackParamList, 'BookingSuccess'>,
  BottomTabNavigationProp<YoidenTabParamList>
>;
type Rt = RouteProp<BookStackParamList, 'BookingSuccess'>;

const to12h = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
};

const prettyDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'long' });
};

const bookingRef = (id: string) => '#' + id.replace(/-/g, '').slice(-8).toUpperCase();

const confirmBg = require('../../../assets/confirm_bg.png');

export default function BookingSuccessScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { bookingId, venueName, date, courts, total } = route.params;

  const ref = bookingRef(bookingId);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Illustration */}
        <View style={styles.hero}>
          <Image source={confirmBg} style={styles.heroImage} resizeMode="contain" />
          <YDisplay size={24} color={YColors.accent} style={{ marginTop: 12, textAlign: 'center' }}>
            Booking Successful!
          </YDisplay>
          <YUiText size={14} color={YColors.ink2} style={{ marginTop: 6, textAlign: 'center' }}>
            Your booking{' '}
            <YMono size={14} color={YColors.accent}>{ref}</YMono>
            {' '}is confirmed.
          </YUiText>
        </View>

        {/* Summary card */}
        <View style={styles.card}>
          <YUiText size={11} color={YColors.ink3} style={{ marginBottom: 4, letterSpacing: 1 }}>
            {venueName.toUpperCase()}
          </YUiText>
          <YUiText size={13} color={YColors.ink2} style={{ marginBottom: 10 }}>
            {prettyDate(date)}
          </YUiText>

          {courts.map((c, i) => (
            <View key={i} style={styles.courtRow}>
              <YUiText size={13} color={YColors.ink} style={{ flex: 1 }}>
                {c.name}
              </YUiText>
              <YMono size={12} color={YColors.ink2}>
                {to12h(c.startTime)}–{to12h(c.endTime)}
              </YMono>
              <YUiText size={13} color={YColors.ink} style={{ width: 44, textAlign: 'right' }}>
                ₹{c.price}
              </YUiText>
            </View>
          ))}

          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <YUiText size={14} color={YColors.ink}>Total Paid</YUiText>
            <YUiText size={15} color={YColors.accent} style={{ fontWeight: '700' }}>
              ₹{total}
            </YUiText>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={styles.btnPrimary}
            onPress={() => nav.navigate('BookingDetail', { bookingId })}
          >
            <YUiText size={14} color="#fff" style={{ letterSpacing: 1, fontWeight: '700' }}>
              VIEW BOOKING
            </YUiText>
          </Pressable>

          <Pressable
            style={styles.btnGhost}
            onPress={() => nav.navigate('HomeTab', { screen: 'Home' })}
          >
            <YUiText size={14} color={YColors.ink2} style={{ letterSpacing: 1 }}>
              GO HOME
            </YUiText>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 20,
  },
  heroImage: {
    width: 180,
    height: 160,
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: YColors.line2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  courtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: YColors.line,
    marginVertical: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actions: {
    gap: 10,
  },
  btnPrimary: {
    backgroundColor: YColors.accent,
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
