import React, { useCallback, useEffect, useState } from 'react';
import {
  View, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';
import type { MeStackParamList } from '../../navigation/nav-types';
import { YColors, YDisplay, YUiText } from '../../components/yoiden';
import { venuesApi } from '../../api/venues.api';
import type { Venue, VenueCourt, Booking } from '../../types/booking.types';

type Props = NativeStackScreenProps<MeStackParamList, 'VenueAdmin'>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function toMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function toTime(mins: number) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
function to12h(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
}
function generateSlots(open: string, close: string, dur: number) {
  const slots: { start: string; end: string }[] = [];
  let cur = toMins(open);
  const end = toMins(close);
  while (cur + dur <= end) {
    slots.push({ start: toTime(cur), end: toTime(cur + dur) });
    cur += dur;
  }
  return slots;
}
function formatDate(d: Date) {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}
function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
function offsetDate(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function VenueAdminScreen({ route }: Props) {
  const nav = useNavigation();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [selectedCourt, setSelectedCourt] = useState<VenueCourt | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sportDropdownOpen, setSportDropdownOpen] = useState(false);

  const [selectedDate, setSelectedDate] = useState(toISO(new Date()));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelModal, setCancelModal] = useState<{ bookingId: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [payModal, setPayModal] = useState<{ bookingId: string; amount: number } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [addModal, setAddModal] = useState<{ slot: { start: string; end: string } } | null>(null);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addPaid, setAddPaid] = useState(false);

  useEffect(() => {
    venuesApi.getMyVenues().then((res: any) => {
      const list: Venue[] = res?.data?.data ?? res?.data ?? [];
      setVenues(Array.isArray(list) ? list : []);
    });
  }, []);

  const fetchBookings = useCallback(async (venueId: string) => {
    setLoadingSlots(true);
    try {
      const res = await venuesApi.getVenueBookings(venueId, 200, 0) as any;
      const data: Booking[] = res?.data?.data ?? res?.data ?? [];
      setBookings(Array.isArray(data) ? data : []);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCourt && selectedVenue) fetchBookings(selectedVenue.id);
  }, [selectedCourt, selectedDate, selectedVenue, fetchBookings]);

  const handleMarkPaid = (bookingId: string, currentAmount: number) => {
    setPayAmount(String(currentAmount));
    setPayModal({ bookingId, amount: currentAmount });
  };

  const confirmMarkPaid = async () => {
    if (!payModal || !selectedVenue) return;
    const amount = Number(payAmount);
    if (!payAmount.trim() || isNaN(amount) || amount < 0) { Alert.alert('Invalid amount', 'Please enter a valid amount.'); return; }
    const { bookingId } = payModal;
    setPayModal(null);
    setActionLoading(bookingId);
    try {
      await venuesApi.markBookingPaid(selectedVenue.id, bookingId, amount);
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, paymentStatus: 'paid' as any, amount } : b));
    } catch { Alert.alert('Error', 'Could not mark as paid.'); }
    finally { setActionLoading(null); }
  };

  const handleAddSlot = (slot: { start: string; end: string }) => {
    setAddName(''); setAddPhone(''); setAddAmount(String(Number(selectedCourt?.basePrice ?? 0))); setAddPaid(false);
    setAddModal({ slot });
  };

  const confirmAddBooking = async () => {
    if (!addModal || !selectedVenue || !selectedCourt) return;
    if (!addName.trim()) { Alert.alert('Name required', 'Please enter the guest name.'); return; }
    const amount = Number(addAmount);
    if (isNaN(amount) || amount < 0) { Alert.alert('Invalid amount', 'Please enter a valid amount.'); return; }
    setAddModal(null);
    try {
      const res = await venuesApi.createManualBooking(selectedVenue.id, {
        courtId: selectedCourt.id,
        bookingDate: selectedDate,
        startTime: addModal.slot.start,
        endTime: addModal.slot.end,
        guestName: addName.trim(),
        guestPhone: addPhone.trim() || undefined,
        amount,
        paymentStatus: addPaid ? 'paid' : 'pending',
      }) as any;
      const newBooking = res?.data?.data ?? res?.data;
      if (newBooking) setBookings(prev => [...prev, newBooking]);
    } catch { Alert.alert('Error', 'Could not create booking.'); }
  };

  const handleCancel = (bookingId: string) => {
    setCancelReason('');
    setCancelModal({ bookingId });
  };

  const confirmCancel = async () => {
    if (!cancelModal || !selectedVenue) return;
    if (!cancelReason.trim()) { Alert.alert('Reason required', 'Please enter a reason for cancellation.'); return; }
    const { bookingId } = cancelModal;
    setCancelModal(null);
    setActionLoading(bookingId);
    try {
      await venuesApi.cancelBooking(selectedVenue.id, bookingId, cancelReason.trim());
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'cancelled' as any } : b));
    } catch { Alert.alert('Error', 'Could not cancel booking.'); }
    finally { setActionLoading(null); }
  };

  // Slots for selected court + date
  const slots = selectedCourt
    ? generateSlots(
        selectedCourt.openTime || selectedVenue?.openTime || '06:00',
        selectedCourt.closeTime || selectedVenue?.closeTime || '22:00',
        selectedCourt.slotDurationMin || 30,
      )
    : [];

  const bookedForDate = bookings.filter(
    b => b.courtId === selectedCourt?.id && b.bookingDate === selectedDate && b.status !== 'cancelled',
  );
  const bookedCount = bookedForDate.length;

  const getBooking = (start: string) =>
    bookedForDate.find(b => b.startTime === start) ?? null;

  // Group slots into rows of 3
  const rows: { start: string; end: string }[][] = [];
  for (let i = 0; i < slots.length; i += 3) rows.push(slots.slice(i, i + 3));

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => nav.goBack()} style={styles.backBtn} hitSlop={8}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M12 5l-7 7 7 7" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <YDisplay size={32} color={YColors.accent} style={{ fontStyle: 'italic', marginTop: 8 }}>
            VENUE ADMIN
          </YDisplay>
        </View>

        <View style={styles.content}>
          {/* Venue dropdown */}
          <YUiText size={12} weight={700} color={YColors.ink2} style={styles.dropdownLabel}>SELECT YOUR VENUE</YUiText>
          <View style={styles.dropdownWrap}>
            <Pressable style={styles.dropdownTrigger} onPress={() => setDropdownOpen(o => !o)}>
              <YUiText size={14} color={selectedVenue ? YColors.ink : YColors.ink3} style={{ flex: 1 }}>
                {selectedVenue ? selectedVenue.name : 'Choose a location'}
              </YUiText>
              <Chevron open={dropdownOpen} />
            </Pressable>
            {dropdownOpen && (
              <View style={styles.dropdownList}>
                {venues.map((v, i) => (
                  <Pressable
                    key={v.id}
                    style={[styles.dropdownItem, i < venues.length - 1 && styles.itemBorder, selectedVenue?.id === v.id && styles.dropdownItemActive]}
                    onPress={() => { setSelectedVenue(v); setSelectedSport(null); setSelectedCourt(null); setDropdownOpen(false); }}
                  >
                    <YUiText size={14} color={YColors.ink}>{v.name}</YUiText>
                    <YUiText size={11} color={YColors.ink3} style={{ marginTop: 2 }} numberOfLines={1}>{v.address}</YUiText>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Sport dropdown */}
          <YUiText size={12} weight={700} color={YColors.ink2} style={[styles.dropdownLabel, { marginTop: 20 }]}>SELECT A SPORT</YUiText>
          <View style={styles.dropdownWrap}>
            <Pressable
              style={[styles.dropdownTrigger, !selectedVenue && styles.dropdownDisabled]}
              onPress={() => selectedVenue && setSportDropdownOpen(o => !o)}
            >
              <YUiText size={14} color={selectedSport ? YColors.ink : YColors.ink3} style={{ flex: 1 }}>
                {selectedSport ? cap(selectedSport) : selectedVenue ? 'Choose a sport' : 'Select a venue first'}
              </YUiText>
              <Chevron open={sportDropdownOpen} />
            </Pressable>
            {sportDropdownOpen && (
              <View style={styles.dropdownList}>
                {(selectedVenue?.sports ?? []).map((s, i) => (
                  <Pressable
                    key={s}
                    style={[styles.dropdownItem, i < (selectedVenue?.sports?.length ?? 0) - 1 && styles.itemBorder, selectedSport === s && styles.dropdownItemActive]}
                    onPress={() => { setSelectedSport(s); setSelectedCourt(null); setSportDropdownOpen(false); }}
                  >
                    <YUiText size={14} color={YColors.ink}>{cap(s)}</YUiText>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Court cards */}
          {selectedSport && (() => {
            const courts = (selectedVenue?.courts ?? []).filter(c => !c.sport || c.sport.toLowerCase() === selectedSport.toLowerCase());
            return (
              <View style={{ marginTop: 20 }}>
                <YUiText size={12} weight={700} color={YColors.ink2} style={styles.dropdownLabel}>SELECT A COURT</YUiText>
                {courts.length === 0 ? (
                  <View style={styles.noCourtsBox}>
                    <YUiText size={13} color={YColors.ink3} style={{ textAlign: 'center' }}>No courts for this sport</YUiText>
                  </View>
                ) : courts.map(c => {
                  const isSel = selectedCourt?.id === c.id;
                  return (
                    <Pressable key={c.id} style={[styles.courtCard, isSel && styles.courtCardSelected]} onPress={() => setSelectedCourt(isSel ? null : c)}>
                      <View style={styles.courtCardTop}>
                        <YUiText size={16} weight={900} color={YColors.ink} style={{ fontStyle: 'italic', letterSpacing: 0.5 }}>{c.name.toUpperCase()}</YUiText>
                        <View style={[styles.courtBadge, c.isActive ? styles.badgeActive : styles.badgeInactive]}>
                          <YUiText size={10} weight={800} color={c.isActive ? '#1a6b35' : '#991b1b'} style={{ letterSpacing: 0.8 }}>
                            {c.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </YUiText>
                        </View>
                      </View>
                      <View style={styles.courtCardMeta}>
                        <YUiText size={12} color={YColors.ink3}>{`₹${Number(c.basePrice)} · ${selectedVenue?.openTime} - ${selectedVenue?.closeTime}`}</YUiText>
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                          <Path d="M9 6l6 6-6 6" stroke={isSel ? YColors.accent : YColors.ink3} strokeWidth={2} strokeLinecap="round" />
                        </Svg>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            );
          })()}

          {/* Slot grid */}
          {selectedCourt && (
            <View style={{ marginTop: 24 }}>
              {/* Court header bar */}
              <View style={styles.slotHeader}>
                <View style={styles.slotHeaderDot} />
                <YUiText size={14} weight={800} color="#fff" style={{ flex: 1, letterSpacing: 0.4 }}>
                  {selectedCourt.name.toUpperCase()}
                </YUiText>
                <YUiText size={12} color="rgba(255,255,255,0.8)">
                  ({bookedCount}/{slots.length} booked)
                </YUiText>
              </View>

              {/* Date navigation */}
              <View style={styles.dateRow}>
                <Pressable onPress={() => setSelectedDate(d => offsetDate(d, -1))} hitSlop={8} style={styles.dateArrow}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M15 6l-6 6 6 6" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" />
                  </Svg>
                </Pressable>
                <YUiText size={13} weight={700} color={YColors.ink} style={{ letterSpacing: 0.3 }}>
                  {formatDate(new Date(selectedDate))}
                </YUiText>
                <Pressable onPress={() => setSelectedDate(d => offsetDate(d, 1))} hitSlop={8} style={styles.dateArrow}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M9 6l6 6-6 6" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" />
                  </Svg>
                </Pressable>
              </View>

              {/* Slots */}
              {loadingSlots ? (
                <ActivityIndicator color={YColors.accent} style={{ marginTop: 24 }} />
              ) : (
                <View style={styles.slotGrid}>
                  {rows.map((row, ri) => (
                    <View key={ri} style={styles.slotRow}>
                      {row.map(slot => {
                        const booking = getBooking(slot.start);
                        const isActioning = actionLoading === booking?.id;
                        const guestLabel = booking
                          ? (booking.user?.displayName ?? booking.user?.fullName ?? booking.guestName ?? booking.user?.phone ?? 'Guest')
                          : null;
                        return booking ? (
                          <View key={slot.start} style={styles.slotBooked}>
                            <YUiText size={11} weight={800} color={YColors.ink} style={{ letterSpacing: 0.2 }}>
                              {to12h(slot.start)}–{to12h(slot.end)}
                            </YUiText>
                            <YUiText size={12} weight={800} color={YColors.ink} style={{ marginTop: 4 }} numberOfLines={1}>
                              {guestLabel}
                            </YUiText>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <YUiText size={11} color={YColors.ink2}>₹{Number(booking.amount)}</YUiText>
                              {booking.paymentStatus === 'paid'
                                ? <YUiText size={10} weight={700} color="#16a34a"> PAID</YUiText>
                                : <YUiText size={10} weight={700} color="#b45309"> UNPAID</YUiText>
                              }
                            </View>
                            <View style={styles.slotActions}>
                              {isActioning ? (
                                <ActivityIndicator size="small" color={YColors.accent} />
                              ) : (
                                <>
                                  <Pressable onPress={() => handleCancel(booking.id)} style={styles.slotActionBtn}>
                                    <YUiText size={14} color="#dc2626">✕</YUiText>
                                  </Pressable>
                                  {booking.paymentStatus !== 'paid' && (
                                    <Pressable onPress={() => handleMarkPaid(booking.id, Number(booking.amount))} style={[styles.slotActionBtn, { backgroundColor: '#dcfce7' }]}>
                                      <YUiText size={14} color="#16a34a">✓</YUiText>
                                    </Pressable>
                                  )}
                                </>
                              )}
                            </View>
                          </View>
                        ) : (
                          <Pressable key={slot.start} style={styles.slotAvailable} onPress={() => handleAddSlot(slot)}>
                            <YUiText size={11} color={YColors.ink3} style={{ textAlign: 'center' }}>
                              {to12h(slot.start)}–{to12h(slot.end)}
                            </YUiText>
                            <YUiText size={11} color={YColors.ink3} style={{ marginTop: 4, textAlign: 'center' }}>Available</YUiText>
                            <YUiText size={18} color={YColors.accent} style={{ marginTop: 2, textAlign: 'center' }}>+</YUiText>
                          </Pressable>
                        );
                      })}
                      {/* Fill empty cells in last row */}
                      {row.length < 3 && Array(3 - row.length).fill(0).map((_, i) => (
                        <View key={`empty-${i}`} style={styles.slotEmpty} />
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Cancel reason modal */}
      <Modal visible={!!cancelModal} transparent animationType="fade" onRequestClose={() => setCancelModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <YUiText size={16} weight={800} color={YColors.ink} style={{ marginBottom: 6 }}>Cancel Booking</YUiText>
            <YUiText size={13} color={YColors.ink3} style={{ marginBottom: 16 }}>
              Please provide a reason. This will be logged against the booking.
            </YUiText>
            <TextInput
              style={styles.reasonInput}
              placeholder="e.g. Court maintenance, Guest request..."
              placeholderTextColor={YColors.ink3}
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              maxLength={200}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtnSecondary} onPress={() => setCancelModal(null)}>
                <YUiText size={14} weight={700} color={YColors.ink2}>Keep Booking</YUiText>
              </Pressable>
              <Pressable style={styles.modalBtnDanger} onPress={confirmCancel}>
                <YUiText size={14} weight={700} color="#fff">Cancel Booking</YUiText>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Confirm payment modal */}
      <Modal visible={!!payModal} transparent animationType="fade" onRequestClose={() => setPayModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <YUiText size={16} weight={800} color={YColors.ink} style={{ marginBottom: 6 }}>Confirm Payment</YUiText>
            <YUiText size={13} color={YColors.ink3} style={{ marginBottom: 16 }}>
              Confirm the amount collected for this booking.
            </YUiText>
            <YUiText size={12} weight={700} color={YColors.ink2} style={{ marginBottom: 6, letterSpacing: 0.8 }}>AMOUNT RECEIVED (₹)</YUiText>
            <TextInput
              style={[styles.reasonInput, { minHeight: 0, height: 48 }]}
              placeholder="e.g. 500"
              placeholderTextColor={YColors.ink3}
              value={payAmount}
              onChangeText={setPayAmount}
              keyboardType="numeric"
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtnSecondary} onPress={() => setPayModal(null)}>
                <YUiText size={14} weight={700} color={YColors.ink2}>Cancel</YUiText>
              </Pressable>
              <Pressable style={styles.modalBtnConfirm} onPress={confirmMarkPaid}>
                <YUiText size={14} weight={700} color="#fff">Mark as Paid</YUiText>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add manual booking modal */}
      <Modal visible={!!addModal} transparent animationType="slide" onRequestClose={() => setAddModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <YUiText size={16} weight={800} color={YColors.ink} style={{ marginBottom: 4 }}>Add Booking</YUiText>
            <YUiText size={12} color={YColors.ink3} style={{ marginBottom: 16 }}>
              {addModal ? `${to12h(addModal.slot.start)} – ${to12h(addModal.slot.end)}` : ''}
              {'  ·  Phone / walk-in booking'}
            </YUiText>

            <YUiText size={12} weight={700} color={YColors.ink2} style={styles.fieldLabel}>GUEST NAME *</YUiText>
            <TextInput style={styles.fieldInput} placeholder="e.g. Rahul Sharma" placeholderTextColor={YColors.ink3} value={addName} onChangeText={setAddName} autoFocus />

            <YUiText size={12} weight={700} color={YColors.ink2} style={styles.fieldLabel}>PHONE (optional)</YUiText>
            <TextInput style={styles.fieldInput} placeholder="e.g. 9876543210" placeholderTextColor={YColors.ink3} value={addPhone} onChangeText={setAddPhone} keyboardType="phone-pad" />

            <YUiText size={12} weight={700} color={YColors.ink2} style={styles.fieldLabel}>AMOUNT (₹)</YUiText>
            <TextInput style={styles.fieldInput} placeholder="0" placeholderTextColor={YColors.ink3} value={addAmount} onChangeText={setAddAmount} keyboardType="numeric" />

            <Pressable onPress={() => setAddPaid(p => !p)} style={styles.paidToggleRow}>
              <View style={[styles.paidToggleBox, addPaid && styles.paidToggleBoxOn]}>
                {addPaid && <YUiText size={12} color="#fff">✓</YUiText>}
              </View>
              <YUiText size={14} color={YColors.ink}>Paid now (cash / UPI)</YUiText>
            </Pressable>

            <View style={[styles.modalActions, { marginTop: 20 }]}>
              <Pressable style={styles.modalBtnSecondary} onPress={() => setAddModal(null)}>
                <YUiText size={14} weight={700} color={YColors.ink2}>Discard</YUiText>
              </Pressable>
              <Pressable style={styles.modalBtnConfirm} onPress={confirmAddBooking}>
                <YUiText size={14} weight={700} color="#fff">Add Booking</YUiText>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const Chevron = ({ open }: { open: boolean }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d={open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} stroke={YColors.ink3} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },
  header: { flexDirection: 'column', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 999,
    backgroundColor: YColors.bg3, borderWidth: 1, borderColor: YColors.line2,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: 16 },

  // Dropdowns
  dropdownLabel: { marginBottom: 8, letterSpacing: 1 },
  dropdownWrap: {},
  dropdownTrigger: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: YColors.bg, borderWidth: 1.5, borderColor: YColors.line2,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
  },
  dropdownList: {
    backgroundColor: YColors.bg, borderWidth: 1.5, borderColor: YColors.line2,
    borderTopWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, overflow: 'hidden',
  },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 14 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: YColors.line },
  dropdownItemActive: { backgroundColor: 'rgba(24,88,214,0.07)' },
  dropdownDisabled: { opacity: 0.45 },

  // Courts
  noCourtsBox: { padding: 20, borderRadius: 12, borderWidth: 1.5, borderColor: YColors.line2, alignItems: 'center' },
  courtCard: { backgroundColor: YColors.bg, borderWidth: 1.5, borderColor: YColors.line2, borderRadius: 12, padding: 16, marginBottom: 10 },
  courtCardSelected: { borderColor: YColors.accent },
  courtCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  courtCardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: YColors.line },
  courtBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeActive: { backgroundColor: '#d4f7de' },
  badgeInactive: { backgroundColor: '#fee2e2' },

  // Slot grid
  slotHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: YColors.accent, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  slotHeaderDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: '#fff' },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, paddingHorizontal: 4,
  },
  dateArrow: { padding: 6 },
  slotGrid: { marginTop: 12 },
  slotRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  slotAvailable: {
    flex: 1, borderWidth: 1.5, borderColor: YColors.line2, borderStyle: 'dashed',
    borderRadius: 10, padding: 10, alignItems: 'center', minHeight: 90,
  },
  slotBooked: {
    flex: 1, backgroundColor: '#eff4ff', borderWidth: 1.5, borderColor: YColors.accent,
    borderRadius: 10, padding: 10, minHeight: 90,
  },
  slotEmpty: { flex: 1 },
  slotActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  slotActionBtn: {
    width: 28, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },

  // Cancel modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: YColors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 36,
  },
  reasonInput: {
    borderWidth: 1.5, borderColor: YColors.line2, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: YColors.ink, minHeight: 80, textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtnSecondary: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: YColors.line2, alignItems: 'center',
  },
  modalBtnDanger: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#dc2626', alignItems: 'center',
  },
  modalBtnConfirm: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: YColors.accent, alignItems: 'center',
  },
  fieldLabel: { marginBottom: 6, letterSpacing: 0.8, marginTop: 14 },
  fieldInput: {
    borderWidth: 1.5, borderColor: YColors.line2, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: YColors.ink, height: 48,
  },
  paidToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  paidToggleBox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: YColors.line2,
    alignItems: 'center', justifyContent: 'center',
  },
  paidToggleBoxOn: { backgroundColor: YColors.accent, borderColor: YColors.accent },
});
