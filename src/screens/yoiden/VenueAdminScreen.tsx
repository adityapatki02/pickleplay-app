import React, { useCallback, useEffect, useState } from 'react';
import {
  View, StyleSheet, Pressable, ScrollView, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';

// Height of the scrollable grid body — the court header stays pinned above it.
const GRID_BODY_H = Math.round(Dimensions.get('window').height * 0.52);
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';
import type { MeStackParamList } from '../../navigation/nav-types';
import { YColors, YDisplay, YUiText } from '../../components/yoiden';
import { venuesApi } from '../../api/venues.api';
import { useToast } from '../../components/Toast';
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
// Indian-format rupee amount, no Intl dependency (works on web + Hermes).
function money(n: number | string) {
  const v = Math.round(Number(n) || 0);
  const s = Math.abs(v).toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return (v < 0 ? '-₹' : '₹') + grouped;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function VenueAdminScreen({ route }: Props) {
  const nav = useNavigation();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
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
  const [addModal, setAddModal] = useState<{ slot: { start: string; end: string }; court: VenueCourt } | null>(null);
  const [manageModal, setManageModal] = useState<{ booking: Booking } | null>(null);
  const [rescheduling, setRescheduling] = useState<{ booking: Booking } | null>(null);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addEnd, setAddEnd] = useState('');
  const [addPaid, setAddPaid] = useState(false);
  const [addError, setAddError] = useState('');
  const [payError, setPayError] = useState('');
  const [cancelError, setCancelError] = useState('');
  const { show: showToast, node: toastNode } = useToast();

  useEffect(() => {
    venuesApi.getMyVenues().then((res: any) => {
      const list: Venue[] = res?.data?.data ?? res?.data ?? [];
      const owned = Array.isArray(list) ? list : [];
      setVenues(owned);
      // Only one venue → select it automatically (skip the venue picker).
      if (owned.length === 1) setSelectedVenue(owned[0]);
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
    if (selectedVenue) fetchBookings(selectedVenue.id);
  }, [selectedVenue, selectedDate, fetchBookings]);

  // Auto-select the sport when the venue offers only one.
  useEffect(() => {
    if (!selectedVenue) return;
    const sports = selectedVenue.sports ?? [];
    if (sports.length === 1) setSelectedSport(prev => prev ?? sports[0]);
  }, [selectedVenue]);

  const handleMarkPaid = (bookingId: string, currentAmount: number) => {
    setPayAmount(String(currentAmount));
    setPayError('');
    setPayModal({ bookingId, amount: currentAmount });
  };

  const confirmMarkPaid = async () => {
    if (!payModal || !selectedVenue) return;
    const amount = Number(payAmount);
    if (!payAmount.trim() || isNaN(amount) || amount < 0) { setPayError('Enter a valid amount.'); return; }
    const { bookingId } = payModal;
    setPayError('');
    setPayModal(null);
    setActionLoading(bookingId);
    try {
      await venuesApi.markBookingPaid(selectedVenue.id, bookingId, amount);
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, paymentStatus: 'paid' as any, amount } : b));
    } catch { showToast('Could not mark as paid. Try again.'); }
    finally { setActionLoading(null); }
  };

  const handleAddSlot = (court: VenueCourt, slot: { start: string; end: string }) => {
    setAddName(''); setAddPhone(''); setAddError('');
    setAddEnd(slot.end);
    setAddAmount(String(Math.round(Number(court.basePrice ?? 0) * ((toMins(slot.end) - toMins(slot.start)) / 60))));
    setAddPaid(false);
    setAddModal({ slot, court });
  };

  // Furthest a booking can extend on this court/date (blocked by close time or the next booking).
  const maxEndMin = (courtId: string, start: string) => {
    const closeMin = toMins(selectedVenue?.closeTime || '23:00');
    const startM = toMins(start);
    const nexts = dateBookings
      .filter(b => b.courtId === courtId && toMins(b.startTime) > startM)
      .map(b => toMins(b.startTime));
    return nexts.length ? Math.min(closeMin, ...nexts) : closeMin;
  };

  const stepEnd = (dir: 1 | -1) => {
    if (!addModal) return;
    const startM = toMins(addModal.slot.start);
    const nextM = toMins(addEnd) + dir * 30;
    const cap = maxEndMin(addModal.court.id, addModal.slot.start);
    if (nextM < startM + 30 || nextM > cap) return;
    setAddEnd(toTime(nextM));
    setAddAmount(String(Math.round(Number(addModal.court.basePrice ?? 0) * ((nextM - startM) / 60))));
  };

  const confirmAddBooking = async () => {
    if (!addModal || !selectedVenue) return;
    if (!addName.trim()) { setAddError('Please enter the guest name.'); return; }
    if (addPhone.replace(/\D/g, '').length < 10) {
      setAddError('Enter a valid phone number — the player needs it to receive the booking confirmation.');
      return;
    }
    const amount = Number(addAmount);
    if (isNaN(amount) || amount < 0) { setAddError('Please enter a valid amount.'); return; }
    setAddError('');
    setAddModal(null);
    try {
      const res = await venuesApi.createManualBooking(selectedVenue.id, {
        courtId: addModal.court.id,
        bookingDate: selectedDate,
        startTime: addModal.slot.start,
        endTime: addEnd,
        guestName: addName.trim(),
        guestPhone: addPhone.trim(),
        amount,
        paymentStatus: addPaid ? 'paid' : 'pending',
      }) as any;
      const newBooking = res?.data?.data ?? res?.data;
      if (newBooking) setBookings(prev => [...prev, newBooking]);
    } catch { showToast('Could not create booking. Try again.'); }
  };

  const handleCancel = (bookingId: string) => {
    setCancelReason('');
    setCancelError('');
    setCancelModal({ bookingId });
  };

  const confirmCancel = async () => {
    if (!cancelModal || !selectedVenue) return;
    if (!cancelReason.trim()) { setCancelError('Please add a reason for cancellation.'); return; }
    const { bookingId } = cancelModal;
    setCancelError('');
    setCancelModal(null);
    setActionLoading(bookingId);
    try {
      await venuesApi.cancelBooking(selectedVenue.id, bookingId, cancelReason.trim());
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'cancelled' as any } : b));
    } catch { showToast('Could not cancel booking. Try again.'); }
    finally { setActionLoading(null); }
  };

  // Reschedule: move the booking to a freshly-tapped free slot (any court / time).
  const performReschedule = async (court: VenueCourt, slot: { start: string; end: string }) => {
    if (!selectedVenue || !rescheduling) return;
    const bk = rescheduling.booking;
    setRescheduling(null);
    setActionLoading(bk.id);
    try {
      await venuesApi.rescheduleBooking(selectedVenue.id, bk.id, selectedDate, slot.start, slot.end, court.id);
      setBookings(prev => prev.map(b => b.id === bk.id
        ? ({ ...b, bookingDate: selectedDate, startTime: slot.start, endTime: slot.end, courtId: court.id } as any)
        : b));
    } catch { showToast('Could not reschedule booking. Try again.'); }
    finally { setActionLoading(null); }
  };

  // Daily cashflow — across all courts for the selected date, plus per-court revenue.
  const dateBookings = bookings.filter(
    b => b.bookingDate === selectedDate && b.status !== 'cancelled',
  );
  const totalRevenue = dateBookings.reduce((s, b) => s + Number(b.amount || 0), 0);
  const paidRevenue = dateBookings
    .filter(b => b.paymentStatus === 'paid')
    .reduce((s, b) => s + Number(b.amount || 0), 0);
  const pendingRevenue = totalRevenue - paidRevenue;

  // ── Booking grid: all active courts (for the sport) × half-hour slots ──
  const courtsForSport = (selectedVenue?.courts ?? []).filter(
    c => c.isActive && (!c.sport || !selectedSport || c.sport.toLowerCase() === selectedSport.toLowerCase()),
  );
  const gridSlots = selectedVenue
    ? generateSlots(selectedVenue.openTime || '06:00', selectedVenue.closeTime || '23:00', 30)
    : [];
  const isToday = selectedDate === toISO(new Date());
  const nowMins = (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); })();
  const bookingAt = (courtId: string, start: string) =>
    dateBookings.find(
      b => b.courtId === courtId && toMins(b.startTime) <= toMins(start) && toMins(b.endTime) > toMins(start),
    ) ?? null;
  const isPast = (start: string) => isToday && toMins(start) + 30 <= nowMins;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable onPress={() => nav.goBack()} style={styles.backBtn} hitSlop={8}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M19 12H5M12 5l-7 7 7 7" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          </View>
          <YDisplay size={32} color={YColors.accent} style={{ marginTop: 8 }}>
            VENUE ADMIN
          </YDisplay>

          {/* Primary CTA — the dashboard is the most valuable screen; keep it unmissable. */}
          <Pressable
            onPress={() => (nav as any).navigate('OwnerDashboard', { venueId: selectedVenue?.id })}
            style={styles.dashCta}
          >
            <View style={styles.dashCtaIcon}>
              <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
                <Path d="M3 13h4v8H3zM10 3h4v18h-4zM17 9h4v12h-4z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <YUiText size={14} weight={900} color={YColors.accent} style={{ letterSpacing: 0.3 }}>VIEW FULL DASHBOARD</YUiText>
              <YUiText size={11} color={YColors.ink3} style={{ marginTop: 1 }}>Revenue, demand, customers &amp; more</YUiText>
            </View>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M9 6l6 6-6 6" stroke={YColors.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </View>

        <View style={styles.content}>
          {/* Daily cashflow — collective across all courts for the selected date */}
          {selectedVenue && (
            <View style={styles.cashflowCard}>
              <View style={styles.cashflowTopRow}>
                <YUiText size={11} weight={800} color="rgba(255,255,255,0.65)" style={{ letterSpacing: 1 }}>DAILY CASHFLOW</YUiText>
                <YUiText size={11} weight={700} color="rgba(255,255,255,0.65)">{formatDate(new Date(selectedDate))}</YUiText>
              </View>
              <YDisplay size={36} color="#fff" style={{ marginTop: 4 }}>{money(totalRevenue)}</YDisplay>
              <View style={styles.cashflowMetaRow}>
                <View style={[styles.cashflowChip, { backgroundColor: 'rgba(22,163,74,0.22)' }]}>
                  <YUiText size={11} weight={800} color="#4ade80">{money(paidRevenue)} collected</YUiText>
                </View>
                {pendingRevenue > 0 && (
                  <View style={[styles.cashflowChip, { backgroundColor: 'rgba(180,83,9,0.26)' }]}>
                    <YUiText size={11} weight={800} color="#fbbf24">{money(pendingRevenue)} pending</YUiText>
                  </View>
                )}
                <YUiText size={11} color="rgba(255,255,255,0.6)">{dateBookings.length} booking{dateBookings.length === 1 ? '' : 's'}</YUiText>
              </View>
            </View>
          )}

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
                    onPress={() => { setSelectedVenue(v); setSelectedSport(null); setDropdownOpen(false); }}
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
                    onPress={() => { setSelectedSport(s); setSportDropdownOpen(false); }}
                  >
                    <YUiText size={14} color={YColors.ink}>{cap(s)}</YUiText>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Booking grid — courts as columns, half-hour rows */}
          {selectedSport && (
            <View style={{ marginTop: 22 }}>
              {courtsForSport.length === 0 ? (
                <View style={styles.noCourtsBox}>
                  <YUiText size={13} color={YColors.ink3} style={{ textAlign: 'center' }}>No courts for this sport</YUiText>
                </View>
              ) : (
                <>
                  {/* Date navigation */}
                  <View style={styles.dateRow}>
                    <Pressable onPress={() => setSelectedDate(d => offsetDate(d, -1))} hitSlop={8} style={styles.dateArrow}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M15 6l-6 6 6 6" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" /></Svg>
                    </Pressable>
                    <YUiText size={14} weight={800} color={YColors.ink} style={{ letterSpacing: 0.3 }}>{formatDate(new Date(selectedDate))}{isToday ? ' · Today' : ''}</YUiText>
                    <Pressable onPress={() => setSelectedDate(d => offsetDate(d, 1))} hitSlop={8} style={styles.dateArrow}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M9 6l6 6 6-6" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" /></Svg>
                    </Pressable>
                  </View>

                  {rescheduling && (
                    <View style={styles.reschedBanner}>
                      <YUiText size={12.5} weight={700} color="#fff" style={{ flex: 1 }}>
                        Rescheduling {rescheduling.booking.user?.displayName ?? rescheduling.booking.user?.fullName ?? rescheduling.booking.guestName ?? 'booking'} — tap a free slot
                      </YUiText>
                      <Pressable onPress={() => setRescheduling(null)} hitSlop={8}><YUiText size={13} weight={800} color="#fff">Cancel</YUiText></Pressable>
                    </View>
                  )}

                  {loadingSlots ? (
                    <ActivityIndicator color={YColors.accent} style={{ marginTop: 24 }} />
                  ) : (
                    <View style={styles.grid}>
                      {/* Header: court names */}
                      <View style={styles.gridHeaderRow}>
                        <View style={styles.railCell} />
                        {courtsForSport.map(c => (
                          <View key={c.id} style={styles.gridHeadCell}>
                            <YUiText size={12.5} weight={900} color="#fff" numberOfLines={1} style={{ letterSpacing: 0.3 }}>{c.name.toUpperCase()}</YUiText>
                          </View>
                        ))}
                      </View>

                      <ScrollView style={{ maxHeight: GRID_BODY_H }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      {gridSlots.map(slot => {
                        const onHour = slot.start.endsWith(':00');
                        const day = Number(slot.start.split(':')[0]) < 18;
                        return (
                          <View key={slot.start} style={[styles.gridRow, onHour && styles.gridRowHour]}>
                            <View style={styles.railCell}>
                              {onHour ? <DayNight day={day} /> : null}
                              <YUiText size={9.5} weight={onHour ? 800 : 400} color={onHour ? YColors.ink2 : YColors.ink3}>{to12h(slot.start)}</YUiText>
                            </View>
                            {courtsForSport.map(c => {
                              const bk = bookingAt(c.id, slot.start);
                              if (bk) {
                                const noShow = (bk as any).status === 'no_show';
                                const nm = bk.user?.displayName ?? bk.user?.fullName ?? bk.guestName ?? 'Guest';
                                const statusColor = noShow ? '#dc2626' : bk.paymentStatus === 'paid' ? '#16a34a' : '#b45309';
                                const statusLabel = noShow ? 'NO-SHOW' : bk.paymentStatus === 'paid' ? 'PAID' : 'UNPAID';
                                return (
                                  <Pressable key={c.id} style={[styles.gridCell, noShow ? styles.cellNoShow : styles.cellBooked]} onPress={() => { if (!rescheduling) setManageModal({ booking: bk }); }}>
                                    <View style={styles.bookedInner}>
                                      <View style={styles.bookedContent}>
                                        <YUiText size={10.5} weight={800} color={YColors.accent} numberOfLines={1} style={{ textAlign: 'center', width: '100%' }}>{nm}</YUiText>
                                        <View style={styles.bookedDivider} />
                                        <View style={styles.bookedStatusRow}>
                                          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                                          <YUiText size={8.5} weight={800} color={statusColor} style={{ letterSpacing: 0.3 }}>{statusLabel}</YUiText>
                                        </View>
                                      </View>
                                      <View style={styles.kebab}><View style={styles.kebabDot} /><View style={styles.kebabDot} /><View style={styles.kebabDot} /></View>
                                    </View>
                                  </Pressable>
                                );
                              }
                              if (isPast(slot.start)) return <View key={c.id} style={[styles.gridCell, styles.cellPast]} />;
                              return (
                                <Pressable key={c.id} style={[styles.gridCell, styles.cellFree, rescheduling && styles.cellTarget]} onPress={() => rescheduling ? performReschedule(c, slot) : handleAddSlot(c, slot)}>
                                  <YUiText size={16} weight={900} color={YColors.lime}>+</YUiText>
                                </Pressable>
                              );
                            })}
                          </View>
                        );
                      })}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Manage booking (tapped a booked cell) */}
      <Modal visible={!!manageModal} transparent animationType="fade" onRequestClose={() => setManageModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setManageModal(null)}>
          <Pressable style={styles.modalBox} onPress={() => {}}>
            {manageModal && (() => {
              const b = manageModal.booking;
              const nm = b.user?.displayName ?? b.user?.fullName ?? b.guestName ?? 'Guest';
              const noShow = (b as any).status === 'no_show';
              return (
                <>
                  <YUiText size={16} weight={800} color={YColors.ink}>{nm}</YUiText>
                  <YUiText size={13} color={YColors.ink3} style={{ marginTop: 4, marginBottom: 18 }}>
                    {to12h(b.startTime)}–{to12h(b.endTime)} · ₹{Number(b.amount)} · {noShow ? 'No-show' : b.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                  </YUiText>
                  <View style={{ gap: 10 }}>
                    {b.paymentStatus !== 'paid' && !noShow && (
                      <Pressable style={styles.manageBtn} onPress={() => { setManageModal(null); handleMarkPaid(b.id, Number(b.amount)); }}>
                        <YUiText size={14} weight={700} color="#0b7a37">Mark as paid</YUiText>
                      </Pressable>
                    )}
                    <Pressable style={styles.manageBtn} onPress={() => { setManageModal(null); setRescheduling({ booking: b }); }}>
                      <YUiText size={14} weight={700} color={YColors.accent}>Reschedule</YUiText>
                    </Pressable>
                    <Pressable style={styles.manageBtn} onPress={() => { setManageModal(null); handleCancel(b.id); }}>
                      <YUiText size={14} weight={700} color="#dc2626">Cancel booking</YUiText>
                    </Pressable>
                    <Pressable style={[styles.manageBtn, { borderColor: 'transparent' }]} onPress={() => setManageModal(null)}>
                      <YUiText size={14} weight={700} color={YColors.ink2}>Close</YUiText>
                    </Pressable>
                  </View>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

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
              onChangeText={t => { setCancelReason(t); if (cancelError) setCancelError(''); }}
              multiline
              maxLength={200}
              autoFocus
            />
            {cancelError ? (
              <View style={styles.addErrorBox}><YUiText size={12.5} weight={600} color="#b91c1c">{cancelError}</YUiText></View>
            ) : null}
            <View style={[styles.modalActions, { marginTop: cancelError ? 12 : undefined }]}>
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
              onChangeText={t => { setPayAmount(t); if (payError) setPayError(''); }}
              keyboardType="numeric"
              autoFocus
            />
            {payError ? (
              <View style={styles.addErrorBox}><YUiText size={12.5} weight={600} color="#b91c1c">{payError}</YUiText></View>
            ) : null}
            <View style={[styles.modalActions, { marginTop: payError ? 12 : undefined }]}>
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
              {addModal ? `${addModal.court.name} · ${to12h(addModal.slot.start)}–${to12h(addEnd)}` : ''}
              {'  ·  Phone / walk-in booking'}
            </YUiText>

            {addModal && (() => {
              const startM = toMins(addModal.slot.start);
              const endM = toMins(addEnd);
              const cap = maxEndMin(addModal.court.id, addModal.slot.start);
              const durM = endM - startM;
              const h = Math.floor(durM / 60), m = durM % 60;
              const durLabel = ((h ? `${h}h` : '') + (h && m ? ' ' : '') + (m ? `${m}m` : '')) || '0m';
              return (
                <>
                  <YUiText size={12} weight={700} color={YColors.ink2} style={styles.fieldLabel}>DURATION</YUiText>
                  <View style={styles.endStepper}>
                    <Pressable onPress={() => stepEnd(-1)} style={[styles.stepBtn, endM <= startM + 30 && styles.stepBtnDisabled]} disabled={endM <= startM + 30}>
                      <YUiText size={20} weight={800} color={YColors.ink}>−</YUiText>
                    </Pressable>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <YUiText size={15} weight={800} color={YColors.ink}>{to12h(addModal.slot.start)} – {to12h(addEnd)}</YUiText>
                      <YUiText size={11} color={YColors.ink3} style={{ marginTop: 1 }}>{durLabel}</YUiText>
                    </View>
                    <Pressable onPress={() => stepEnd(1)} style={[styles.stepBtn, endM >= cap && styles.stepBtnDisabled]} disabled={endM >= cap}>
                      <YUiText size={20} weight={800} color={YColors.ink}>+</YUiText>
                    </Pressable>
                  </View>
                </>
              );
            })()}

            <YUiText size={12} weight={700} color={YColors.ink2} style={styles.fieldLabel}>GUEST NAME *</YUiText>
            <TextInput style={styles.fieldInput} placeholder="e.g. Rahul Sharma" placeholderTextColor={YColors.ink3} value={addName} onChangeText={setAddName} autoFocus />

            <YUiText size={12} weight={700} color={YColors.ink2} style={styles.fieldLabel}>PHONE *</YUiText>
            <TextInput style={styles.fieldInput} placeholder="e.g. 9876543210" placeholderTextColor={YColors.ink3} value={addPhone} onChangeText={t => { setAddPhone(t); if (addError) setAddError(''); }} keyboardType="phone-pad" />
            <YUiText size={10.5} color={YColors.ink3} style={{ marginTop: 4 }}>Required — the player gets their booking confirmation here.</YUiText>

            <YUiText size={12} weight={700} color={YColors.ink2} style={styles.fieldLabel}>AMOUNT (₹)</YUiText>
            <TextInput style={styles.fieldInput} placeholder="0" placeholderTextColor={YColors.ink3} value={addAmount} onChangeText={setAddAmount} keyboardType="numeric" />

            <Pressable onPress={() => setAddPaid(p => !p)} style={styles.paidToggleRow}>
              <View style={[styles.paidToggleBox, addPaid && styles.paidToggleBoxOn]}>
                {addPaid && <YUiText size={12} color="#fff">✓</YUiText>}
              </View>
              <YUiText size={14} color={YColors.ink}>Paid now (cash / UPI)</YUiText>
            </Pressable>

            {addError ? (
              <View style={styles.addErrorBox}>
                <YUiText size={12.5} weight={600} color="#b91c1c">{addError}</YUiText>
              </View>
            ) : null}

            <View style={[styles.modalActions, { marginTop: addError ? 12 : 20 }]}>
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

      {toastNode}
    </SafeAreaView>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const Chevron = ({ open }: { open: boolean }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d={open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} stroke={YColors.ink3} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);
// Sun (daytime) / moon (evening) marker for the time rail.
const DayNight = ({ day }: { day: boolean }) => day ? (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
    <Path d="M12 4v1M12 19v1M4 12h1M19 12h1M6.3 6.3l.7.7M17 17l.7.7M6.3 17.7l.7-.7M17 7l.7-.7" stroke="#E0A020" strokeWidth={2} strokeLinecap="round" />
    <Path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" stroke="#E0A020" strokeWidth={2} />
  </Svg>
) : (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
    <Path d="M20 13.5A8 8 0 1110.5 4a6.2 6.2 0 009.5 9.5z" stroke="#6D5AE6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },
  header: { flexDirection: 'column', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 12 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  dashCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#EEF1F6', borderWidth: 1, borderColor: '#E1E6EE',
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    marginTop: 16, alignSelf: 'stretch',
    shadowColor: '#0A1B3D', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  dashCtaIcon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: YColors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 999,
    backgroundColor: YColors.bg3, borderWidth: 1, borderColor: YColors.line2,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: 16 },

  // Daily cashflow
  cashflowCard: { backgroundColor: YColors.accent, borderRadius: 16, padding: 18, marginBottom: 22 },
  cashflowTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cashflowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  cashflowChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  courtRevRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },

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
  courtCard: {
    backgroundColor: '#EEF1F6', borderWidth: 1, borderColor: '#E1E6EE', borderRadius: 12, padding: 16, marginBottom: 10,
    shadowColor: '#0A1B3D', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
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
  noShowPill: { backgroundColor: '#fde68a', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },

  // Booking grid — soft rounded tiles with breathing room (on-theme, not boxy)
  grid: { marginTop: 12 },
  gridHeaderRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  gridHeadCell: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: YColors.accent, borderRadius: 10 },
  railCell: { width: 52, alignItems: 'center', justifyContent: 'center', gap: 1 },
  gridRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  gridRowHour: { marginTop: 3 },
  gridCell: { flex: 1, minHeight: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, paddingHorizontal: 4, backgroundColor: '#F1F4F8' },
  cellFree: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0A1B3D', shadowOpacity: 0.09, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cellBooked: {
    backgroundColor: '#EAF0FE',
    shadowColor: '#0A1B3D', shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cellNoShow: {
    backgroundColor: '#FBEEDD',
    shadowColor: '#0A1B3D', shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  bookedInner: { flexDirection: 'row', alignItems: 'stretch', width: '100%' },
  bookedContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingLeft: 12 },
  bookedDivider: { height: 1, backgroundColor: 'rgba(10,27,61,0.15)', marginTop: 3, marginBottom: 3, width: '78%' },
  bookedStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  statusDot: { width: 5, height: 5, borderRadius: 999 },
  kebab: { width: 18, alignItems: 'center', justifyContent: 'center', gap: 3 },
  kebabDot: { width: 3.5, height: 3.5, borderRadius: 999, backgroundColor: YColors.ink3 },
  cellPast: { backgroundColor: '#E7EAEF' },
  cellTarget: { backgroundColor: 'rgba(148,196,0,0.20)' },
  reschedBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: YColors.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10 },
  manageBtn: { borderWidth: 1.5, borderColor: YColors.line2, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  endStepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: YColors.line2, borderRadius: 12, padding: 6, gap: 6 },
  stepBtn: { width: 46, height: 46, borderRadius: 10, backgroundColor: YColors.bg3, alignItems: 'center', justifyContent: 'center' },
  stepBtnDisabled: { opacity: 0.35 },
  addErrorBox: { backgroundColor: '#fee2e2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 16 },

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
