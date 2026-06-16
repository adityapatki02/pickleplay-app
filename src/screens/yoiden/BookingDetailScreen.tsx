import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { YColors, YDisplay, YEyebrow, YUiText, YMono } from '../../components/yoiden';
import { bookingsApi } from '../../api/bookings.api';
import { useAuthStore } from '../../store/authStore';
import type { Booking } from '../../types/booking.types';
import type { BookStackParamList } from '../../navigation/YoidenTabNavigator';
import { buildInvoiceHtml } from '../../utils/invoiceTemplate';

type Nav = NativeStackNavigationProp<BookStackParamList, 'BookingDetail'>;
type Rt = RouteProp<BookStackParamList, 'BookingDetail'>;

const bookingRef = (id: string) => '#' + id.replace(/-/g, '').slice(-8).toUpperCase();

const prettyDateLong = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'long' });
};

const prettyDateShort = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const to12h = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
};

const BackIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Path d="M15 6l-6 6 6 6" stroke={YColors.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);

const CopyIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24">
    <Path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" stroke={YColors.accent} strokeWidth={2} strokeLinecap="round" fill="none" />
    <Path d="M8 5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V5z" stroke={YColors.accent} strokeWidth={2} fill="none" />
  </Svg>
);

const PhoneIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6.06 6.06l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" stroke={YColors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);

const Row = ({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) => (
  <View style={styles.summaryRow}>
    <YUiText size={13} color={YColors.ink2}>{label}</YUiText>
    <YUiText size={13} color={valueColor ?? YColors.ink}>{value}</YUiText>
  </View>
);

export default function BookingDetailScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { bookingId } = route.params;
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showModify, setShowModify] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await bookingsApi.getById(bookingId);
      setBooking((res.data as any)?.data ?? null);
    } catch (e: any) {
      setError(e?.message || 'Could not load booking');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  const doCancel = async () => {
    setCancelling(true);
    try {
      await bookingsApi.cancel(bookingId);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.message || 'Could not cancel');
    } finally {
      setCancelling(false);
    }
  };

  const handleModify = () => setShowModify(true);

  const handleDirections = () => {
    const addr = (booking?.venue as any)?.address ?? '';
    const q = encodeURIComponent(addr);
    Linking.openURL(`https://maps.google.com/?q=${q}`);
  };

  const handleCall = () => {
    const phone = (booking?.venue as any)?.contactPhone ?? '';
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleDownloadInvoice = async () => {
    if (!booking) return;
    if (!booking.invoiceNumber) {
      Alert.alert('Invoice Not Ready', 'Invoice is generated after payment is confirmed. Please try again in a moment.');
      return;
    }
    setDownloading(true);
    try {
      const name = user?.displayName ?? user?.fullName ?? 'Guest';
      const email = (user as any)?.email ?? '';
      const phone = (user as any)?.phone ?? '';
      const html = buildInvoiceHtml(booking, name, email, phone);

      if (Platform.OS === 'web') {
        // expo-print uses a hidden iframe on web — no popup blocker issues
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Invoice ${booking.invoiceNumber}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Saved', `Invoice saved to: ${uri}`);
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not generate invoice');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.root, styles.center]}>
        <ActivityIndicator color={YColors.accent} />
      </SafeAreaView>
    );
  }

  if (error || !booking) {
    return (
      <SafeAreaView edges={['top']} style={[styles.root, styles.center]}>
        <YUiText size={14} color={YColors.ink2}>{error ?? 'Booking not found'}</YUiText>
        <Pressable style={{ marginTop: 16 }} onPress={() => nav.goBack()}>
          <YUiText size={13} color={YColors.accent}>Go Back</YUiText>
        </Pressable>
      </SafeAreaView>
    );
  }

  const ref = bookingRef(booking.id);
  const amount = Number(booking.amount);
  const isPaid = booking.paymentStatus === 'paid';
  const venueName = (booking.venue as any)?.name ?? 'Venue';
  const venueAddress = (booking.venue as any)?.address ?? '';
  const courtName = (booking.court as any)?.name ?? booking.courtLabel ?? 'Court';

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.backBtn}>
          <BackIcon />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.refRow}>
            <YDisplay size={17} color={YColors.accent}>{ref}</YDisplay>
            <Pressable hitSlop={8} onPress={() => {}}>
              <CopyIcon />
            </Pressable>
          </View>
          <YUiText size={12} color={YColors.ink3}>{prettyDateLong(booking.bookingDate)}</YUiText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Venue card */}
        <View style={styles.section}>
          <View style={styles.venueNameRow}>
            <YDisplay size={16} color={YColors.ink} style={{ flex: 1 }}>{venueName}</YDisplay>
            <Pressable hitSlop={10} onPress={handleCall} style={styles.phoneBtn}>
              <PhoneIcon />
            </Pressable>
          </View>
          {!!venueAddress && (
            <YUiText size={12} color={YColors.ink2} style={{ marginTop: 4 }}>
              {venueAddress}
            </YUiText>
          )}
          <View style={styles.venueActions}>
            <Pressable style={styles.outlineBtn} onPress={handleDirections}>
              <YEyebrow color={YColors.accent}>GET DIRECTIONS</YEyebrow>
            </Pressable>
            <Pressable style={styles.outlineBtn} onPress={handleModify}>
              <YEyebrow color={YColors.accent}>MODIFY</YEyebrow>
            </Pressable>
          </View>
        </View>

        {/* Invoice */}
        <View style={[styles.section, styles.invoiceBox]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <YEyebrow color={YColors.ink2}>INVOICE</YEyebrow>
              {booking.invoiceNumber ? (
                <YMono size={12} color={YColors.accent} style={{ marginTop: 4 }}>
                  {booking.invoiceNumber}
                </YMono>
              ) : (
                <YUiText size={12} color={YColors.ink3} style={{ marginTop: 4 }}>
                  Processing…
                </YUiText>
              )}
            </View>
            {booking.invoiceNumber && (
              <Pressable
                style={styles.downloadBtn}
                disabled={downloading}
                onPress={handleDownloadInvoice}
              >
                <YEyebrow color="#fff">{downloading ? '…' : 'DOWNLOAD'}</YEyebrow>
              </Pressable>
            )}
          </View>
        </View>

        {/* Payment Summary */}
        <View style={styles.section}>
          <YEyebrow color={YColors.ink2} style={{ marginBottom: 14 }}>PAYMENT SUMMARY</YEyebrow>

          {/* Table header */}
          <View style={styles.tableHeader}>
            <YMono size={10} color={YColors.ink3} style={{ flex: 1 }}>SLOTS</YMono>
            <YMono size={10} color={YColors.ink3} style={{ width: 36, textAlign: 'center' }}>QTY</YMono>
            <YMono size={10} color={YColors.ink3} style={{ width: 60, textAlign: 'right' }}>PRICE</YMono>
          </View>

          {/* Court row */}
          <YUiText size={13} color={YColors.accent} style={{ marginTop: 10, marginBottom: 4 }}>
            {courtName}
          </YUiText>
          <View style={styles.tableRow}>
            <View style={{ flex: 1 }}>
              <YUiText size={12} color={YColors.ink2}>{prettyDateShort(booking.bookingDate)}</YUiText>
              <YMono size={12} color={YColors.ink2}>
                {to12h(booking.startTime)} to {to12h(booking.endTime)}
              </YMono>
            </View>
            <YUiText size={13} color={YColors.ink} style={{ width: 36, textAlign: 'center' }}>1</YUiText>
            <YUiText size={13} color={YColors.ink} style={{ width: 60, textAlign: 'right' }}>₹{amount}</YUiText>
          </View>

          <View style={styles.divider} />

          <Row label="Sub Total" value={`₹${amount}`} />
          <Row label="GST" value="₹0" />
          <Row label="Discount" value="₹0" valueColor={YColors.accent} />
          <View style={styles.divider} />
          <Row label="Total Add-ons Amount" value="₹0" />
          <Row label="Total Booking Amount" value={`₹${amount}`} />
          <Row label="Total Amount Paid" value={isPaid ? `₹${amount}` : '₹0'} />
          <Row label="Total Amount Due" value={isPaid ? '₹0' : `₹${amount}`} valueColor={isPaid ? undefined : YColors.live} />
        </View>

        {/* Booked By */}
        <View style={styles.section}>
          <YEyebrow color={YColors.ink2} style={{ marginBottom: 14 }}>BOOKED BY</YEyebrow>
          <View style={styles.bookedByGrid}>
            <View style={styles.bookedByCell}>
              <YMono size={10} color={YColors.ink3}>NAME</YMono>
              <YUiText size={13} color={YColors.ink} style={{ marginTop: 4 }}>
                {booking.guestName ?? user?.displayName ?? user?.fullName ?? '—'}
              </YUiText>
            </View>
            <View style={styles.bookedByCell}>
              <YMono size={10} color={YColors.ink3}>MOBILE</YMono>
              <YUiText size={13} color={YColors.ink} style={{ marginTop: 4 }}>
                {booking.guestPhone ?? (user as any)?.phone ?? '—'}
              </YUiText>
            </View>
          </View>
          <View style={[styles.bookedByCell, { marginTop: 12 }]}>
            <YMono size={10} color={YColors.ink3}>EMAIL</YMono>
            <YUiText size={13} color={YColors.ink} style={{ marginTop: 4 }}>
              {(user as any)?.email ?? '—'}
            </YUiText>
          </View>
        </View>

        {/* Policy links */}
        <View style={styles.policyRow}>
          <Pressable hitSlop={8}>
            <YUiText size={12} color={YColors.accent}>Reschedule Policy</YUiText>
          </Pressable>
          <Pressable hitSlop={8}>
            <YUiText size={12} color={YColors.accent}>Cancellation Policy</YUiText>
          </Pressable>
        </View>
      </ScrollView>

      {/* Modify action sheet */}
      <Modal visible={showModify} transparent animationType="fade" onRequestClose={() => setShowModify(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowModify(false)}>
          <View style={styles.modalSheet}>
            <YEyebrow color={YColors.ink3} style={{ marginBottom: 16 }}>MODIFY BOOKING</YEyebrow>
            <Pressable
              style={styles.modalBtn}
              onPress={() => {
                setShowModify(false);
                Alert.alert('Coming Soon', 'Rescheduling will be available soon.');
              }}
            >
              <YUiText size={15} color={YColors.accent} style={{ fontWeight: '600' }}>Reschedule</YUiText>
            </Pressable>
            <View style={styles.modalDivider} />
            <Pressable
              style={styles.modalBtn}
              disabled={cancelling}
              onPress={() => {
                setShowModify(false);
                doCancel();
              }}
            >
              <YUiText size={15} color={YColors.live} style={{ fontWeight: '600' }}>
                {cancelling ? 'Cancelling…' : 'Cancel Booking'}
              </YUiText>
            </Pressable>
            <View style={styles.modalDivider} />
            <Pressable style={styles.modalBtn} onPress={() => setShowModify(false)}>
              <YUiText size={15} color={YColors.ink2}>Dismiss</YUiText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View>
          <YMono size={11} color={YColors.ink3}>YOU PAID</YMono>
          <YDisplay size={20} color={YColors.ink}>₹{amount}</YDisplay>
        </View>
        <View style={styles.bottomActions}>
          <Pressable style={styles.bottomBtn}>
            <YEyebrow color={YColors.accent}>HELP</YEyebrow>
          </Pressable>
          <Pressable
            style={[styles.bottomBtn, { backgroundColor: YColors.lime }]}
            onPress={() => nav.navigate('VenueDetail', { venueId: booking.venueId })}
          >
            <YEyebrow color="#000">VIEW VENUE</YEyebrow>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  center: { justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: YColors.line,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  section: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: YColors.line,
  },
  invoiceBox: {
    backgroundColor: YColors.bg,
    borderRadius: 12,
    padding: 14,
    marginVertical: 4,
    borderWidth: 0,
  },
  downloadBtn: {
    backgroundColor: YColors.accent,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  venueNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phoneBtn: {
    padding: 6,
  },
  venueActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  outlineBtn: {
    flex: 1,
    height: 38,
    borderWidth: 1.5,
    borderColor: YColors.accent,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: YColors.line,
    paddingBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 4,
  },
  divider: {
    height: 1,
    backgroundColor: YColors.line,
    marginVertical: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },

  bookedByGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  bookedByCell: { flex: 1 },

  policyRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    marginBottom: 8,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  modalBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalDivider: {
    height: 1,
    backgroundColor: YColors.line,
  },

  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: YColors.line,
    backgroundColor: '#fff',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
  },
  bottomBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: YColors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
