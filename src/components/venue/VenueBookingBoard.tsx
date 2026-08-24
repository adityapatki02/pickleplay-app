import React, { useCallback, useEffect, useState } from 'react';
import {
  View, StyleSheet, Pressable, ScrollView, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { YColors, YDisplay, YUiText } from '../yoiden';
import { venuesApi } from '../../api/venues.api';
import { useToast } from '../Toast';
import type { Venue, VenueCourt, Booking } from '../../types/booking.types';

// Height of the scrollable grid body — the court header stays pinned above it.
// Must be derived reactively: a module-level Dimensions.get() can evaluate to 0
// before layout exists (web), collapsing the grid to nothing, and never updates
// on rotation/resize. The floor keeps the board usable in tiny viewports.
const gridBodyHeight = (windowHeight: number) => Math.max(320, Math.round((windowHeight || 800) * 0.52));
// Sentinel for venues with no declared sports → show every active court.
const ALL_SPORTS = '__all__';

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
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
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

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  /** The venue whose slots are shown & managed. */
  venue: Venue;
  /** Show the blue daily-cashflow card above the grid (default true). */
  showCashflow?: boolean;
  /**
   * When set, the cashflow card becomes the entry point to the full analytics
   * dashboard. Put here (rather than below the grid) so it's reachable without
   * scrolling past a whole day of slots.
   */
  onOpenDashboard?: () => void;
}

/**
 * The full booking board for a single venue — daily cashflow, sport switcher,
 * date navigation, the courts × half-hour slot grid, and every management modal
 * (add walk-in, mark paid, cancel, reschedule). Extracted from VenueAdminScreen
 * so it can be embedded both there and inline on the Home "My court" view — one
 * implementation, identical behaviour in both places.
 */
export default function VenueBookingBoard({ venue, showCashflow = true, onOpenDashboard }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const gridBodyH = gridBodyHeight(windowHeight);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
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

  const sports = venue.sports ?? [];

  // Auto-select the first sport (or the "all" sentinel) as soon as the venue
  // loads or changes — so the slots appear immediately, no empty picker.
  useEffect(() => {
    setSelectedSport(sports.length ? sports[0] : ALL_SPORTS);
    setRescheduling(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue.id]);

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
    fetchBookings(venue.id);
  }, [venue.id, selectedDate, fetchBookings]);

  const dateBookings = bookings.filter(
    b => b.bookingDate === selectedDate && b.status !== 'cancelled',
  );

  const handleMarkPaid = (bookingId: string, currentAmount: number) => {
    setPayAmount(String(currentAmount));
    setPayError('');
    setPayModal({ bookingId, amount: currentAmount });
  };

  const confirmMarkPaid = async () => {
    if (!payModal) return;
    const amount = Number(payAmount);
    if (!payAmount.trim() || isNaN(amount) || amount < 0) { setPayError('Enter a valid amount.'); return; }
    const { bookingId } = payModal;
    setPayError('');
    setPayModal(null);
    setActionLoading(bookingId);
    try {
      await venuesApi.markBookingPaid(venue.id, bookingId, amount);
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, paymentStatus: 'paid' as any, amount } : b));
    } catch { showToast('Could not mark as paid. Try again.'); }
    finally { setActionLoading(null); }
  };

  // Check a player in (or undo). Marks the slot as *played* — feeds utilisation
  // and player-hours, and clears any no-show flag.
  const handleCheckIn = async (bookingId: string, currentlyIn: boolean) => {
    setManageModal(null);
    setActionLoading(bookingId);
    try {
      await venuesApi.checkInBooking(venue.id, bookingId, { checkedIn: !currentlyIn });
      setBookings(prev => prev.map(b => b.id === bookingId
        ? {
            ...b,
            checkedInAt: currentlyIn ? null : new Date().toISOString(),
            ...(currentlyIn ? {} : (b as any).status === 'no_show' ? { status: 'confirmed' as any } : {}),
          } as any
        : b));
    } catch { showToast('Could not update check-in. Try again.'); }
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
    const closeMin = toMins(venue.closeTime || '23:00');
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
    const cap2 = maxEndMin(addModal.court.id, addModal.slot.start);
    if (nextM < startM + 30 || nextM > cap2) return;
    setAddEnd(toTime(nextM));
    setAddAmount(String(Math.round(Number(addModal.court.basePrice ?? 0) * ((nextM - startM) / 60))));
  };

  const confirmAddBooking = async () => {
    if (!addModal) return;
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
      const res = await venuesApi.createManualBooking(venue.id, {
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
    if (!cancelModal) return;
    if (!cancelReason.trim()) { setCancelError('Please add a reason for cancellation.'); return; }
    const { bookingId } = cancelModal;
    setCancelError('');
    setCancelModal(null);
    setActionLoading(bookingId);
    try {
      await venuesApi.cancelBooking(venue.id, bookingId, cancelReason.trim());
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'cancelled' as any } : b));
    } catch { showToast('Could not cancel booking. Try again.'); }
    finally { setActionLoading(null); }
  };

  // Reschedule: move the booking to a freshly-tapped free slot (any court / time).
  const performReschedule = async (court: VenueCourt, slot: { start: string; end: string }) => {
    if (!rescheduling) return;
    const bk = rescheduling.booking;
    setRescheduling(null);
    setActionLoading(bk.id);
    try {
      await venuesApi.rescheduleBooking(venue.id, bk.id, selectedDate, slot.start, slot.end, court.id);
      setBookings(prev => prev.map(b => b.id === bk.id
        ? ({ ...b, bookingDate: selectedDate, startTime: slot.start, endTime: slot.end, courtId: court.id } as any)
        : b));
    } catch { showToast('Could not reschedule booking. Try again.'); }
    finally { setActionLoading(null); }
  };

  const totalRevenue = dateBookings.reduce((s, b) => s + Number(b.amount || 0), 0);
  const paidRevenue = dateBookings
    .filter(b => b.paymentStatus === 'paid')
    .reduce((s, b) => s + Number(b.amount || 0), 0);
  const pendingRevenue = totalRevenue - paidRevenue;

  // ── Booking grid: all active courts (for the sport) × half-hour slots ──
  const courtsForSport = (venue.courts ?? []).filter(
    c => c.isActive && (selectedSport === ALL_SPORTS || !c.sport || !selectedSport || c.sport.toLowerCase() === selectedSport.toLowerCase()),
  );
  const gridSlots = generateSlots(venue.openTime || '06:00', venue.closeTime || '23:00', 30);
  const isToday = selectedDate === toISO(new Date());
  const nowMins = (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); })();
  const bookingAt = (courtId: string, start: string) =>
    dateBookings.find(
      b => b.courtId === courtId && toMins(b.startTime) <= toMins(start) && toMins(b.endTime) > toMins(start),
    ) ?? null;
  const isPast = (start: string) => isToday && toMins(start) + 30 <= nowMins;

  return (
    <View>
      {/* Daily cashflow — collective across all courts for the selected date */}
      {showCashflow && (() => {
        const Card: any = onOpenDashboard ? Pressable : View;
        return (
          <Card
            style={styles.cashflowCard}
            onPress={onOpenDashboard}
            accessibilityRole={onOpenDashboard ? 'button' : undefined}
            accessibilityLabel={onOpenDashboard ? "Today's cashflow — open the full dashboard" : undefined}
          >
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

            {/* Dashboard entry lives on the money card so revenue, demand and
                customers are one tap away — no scrolling past the slot grid. */}
            {onOpenDashboard && (
              <View style={styles.cashflowDashRow}>
                <YUiText size={11.5} weight={800} color="#fff">
                  Revenue · demand · customers
                </YUiText>
                <View style={styles.cashflowDashBtn}>
                  <YUiText size={11} weight={900} color={YColors.accent} style={{ letterSpacing: 0.6 }}>
                    DASHBOARD →
                  </YUiText>
                </View>
              </View>
            )}
          </Card>
        );
      })()}

      {/* Sport switcher — chips, only when the venue offers more than one sport */}
      {sports.length > 1 && (
        <View style={styles.sportChipRow}>
          {sports.map(s => {
            const on = selectedSport === s;
            return (
              <Pressable
                key={s}
                onPress={() => setSelectedSport(s)}
                style={[styles.sportChip, on && styles.sportChipOn]}
              >
                <YUiText size={12.5} weight={on ? 800 : 600} color={on ? '#fff' : YColors.ink2}>{cap(s)}</YUiText>
              </Pressable>
            );
          })}
        </View>
      )}

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

      {courtsForSport.length === 0 ? (
        <View style={styles.noCourtsBox}>
          <YUiText size={13} color={YColors.ink3} style={{ textAlign: 'center' }}>No active courts to show</YUiText>
        </View>
      ) : loadingSlots ? (
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

          <ScrollView style={{ maxHeight: gridBodyH }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
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

      {/* Manage booking (tapped a booked cell) */}
      <Modal visible={!!manageModal} transparent animationType="fade" onRequestClose={() => setManageModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setManageModal(null)}>
          <Pressable style={styles.modalBox} onPress={() => {}}>
            {manageModal && (() => {
              const b = manageModal.booking;
              const nm = b.user?.displayName ?? b.user?.fullName ?? b.guestName ?? 'Guest';
              const noShow = (b as any).status === 'no_show';
              const checkedIn = !!(b as any).checkedInAt;
              const funded = !!(b as any).campaignId;
              return (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <YUiText size={16} weight={800} color={YColors.ink}>{nm}</YUiText>
                    {funded && (
                      <View style={styles.sponsorChip}>
                        <YUiText size={9} weight={800} color={YColors.accent} style={{ letterSpacing: 0.6 }}>SPONSORED</YUiText>
                      </View>
                    )}
                    {checkedIn && (
                      <View style={styles.checkedChip}>
                        <YUiText size={9} weight={800} color="#0b7a37" style={{ letterSpacing: 0.6 }}>CHECKED IN</YUiText>
                      </View>
                    )}
                  </View>
                  <YUiText size={13} color={YColors.ink3} style={{ marginTop: 4, marginBottom: 18 }}>
                    {to12h(b.startTime)}–{to12h(b.endTime)} · ₹{Number(b.amount)} · {noShow ? 'No-show' : b.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                  </YUiText>
                  <View style={{ gap: 10 }}>
                    <Pressable style={[styles.manageBtn, !checkedIn && styles.checkInBtn]} onPress={() => handleCheckIn(b.id, checkedIn)}>
                      <YUiText size={14} weight={700} color={checkedIn ? YColors.ink2 : '#0b7a37'}>
                        {checkedIn ? 'Undo check-in' : '✓ Check in player'}
                      </YUiText>
                    </Pressable>
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
              const cap2 = maxEndMin(addModal.court.id, addModal.slot.start);
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
                    <Pressable onPress={() => stepEnd(1)} style={[styles.stepBtn, endM >= cap2 && styles.stepBtnDisabled]} disabled={endM >= cap2}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  // Daily cashflow
  cashflowCard: { backgroundColor: YColors.accent, borderRadius: 16, padding: 18, marginBottom: 18 },
  cashflowTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cashflowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  cashflowChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  cashflowDashRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)',
  },
  cashflowDashBtn: {
    backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
  },

  // Sport chips
  sportChipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  sportChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1.5, borderColor: YColors.line2, backgroundColor: YColors.bg,
  },
  sportChipOn: { backgroundColor: YColors.accent, borderColor: YColors.accent },

  noCourtsBox: { padding: 20, borderRadius: 12, borderWidth: 1.5, borderColor: YColors.line2, alignItems: 'center', marginTop: 12 },

  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, paddingHorizontal: 4,
  },
  dateArrow: { padding: 6 },

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
  reschedBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: YColors.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 10 },
  manageBtn: { borderWidth: 1.5, borderColor: YColors.line2, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  checkInBtn: { borderColor: 'rgba(11,122,55,0.4)', backgroundColor: 'rgba(11,122,55,0.06)' },
  sponsorChip: { backgroundColor: 'rgba(24,88,214,0.12)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  checkedChip: { backgroundColor: 'rgba(11,122,55,0.12)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  endStepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: YColors.line2, borderRadius: 12, padding: 6, gap: 6 },
  stepBtn: { width: 46, height: 46, borderRadius: 10, backgroundColor: YColors.bg3, alignItems: 'center', justifyContent: 'center' },
  stepBtnDisabled: { opacity: 0.35 },
  addErrorBox: { backgroundColor: '#fee2e2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 16 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
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
  modalBtnDanger: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#dc2626', alignItems: 'center' },
  modalBtnConfirm: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: YColors.accent, alignItems: 'center' },
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
