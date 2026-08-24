import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform, Modal, Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';

import { YColors, YDisplay, YUiText, YMono, YAvatar } from '../../components/yoiden';
import { casualMatchesApi } from '../../api/casualMatches.api';
import type {
  CasualPlayerInput, CasualSide, CasualMatch, RecentPartner,
} from '../../api/casualMatches.api';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../components/Toast';

type Params = {
  bookingId?: string;
  venueId?: string;
  venueName?: string;
  matchId?: string;
};

const MAX_GAMES = 3;
const emptyGames = () => [{ game: 1, a: 0, b: 0 }];
const INVITE_URL = 'https://yoiden.com';

/** One roster position. Empty until a player is picked or typed in. */
type Slot = {
  key: string;
  side: CasualSide;
  name: string;
  phone: string;
  userId?: string;
  onYoiden?: boolean;
  me?: boolean;
};

const initialsOf = (name: string) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?';

export default function LogMatchScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<RouteProp<Record<string, Params>, string>>();
  const { bookingId, venueId, venueName } = route.params ?? {};
  const me = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();
  const { show: showToast, node: toastNode } = useToast();
  // The tab bar floats over screen content in this app, so the sticky footer
  // has to clear it explicitly (72pt bar + safe-area inset).
  const tabBarClearance = 72 + Math.max(insets.bottom, 12);

  const [format, setFormat] = useState<'singles' | 'doubles'>('doubles');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [games, setGames] = useState(emptyGames());
  const [partners, setPartners] = useState<RecentPartner[]>([]);
  const [picking, setPicking] = useState<string | null>(null); // slot key
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!bookingId);
  const [existing, setExisting] = useState<CasualMatch | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const myName = me?.displayName || me?.fullName || 'You';

  const seed = useCallback((fmt: 'singles' | 'doubles') => {
    const per = fmt === 'doubles' ? 2 : 1;
    const next: Slot[] = [];
    for (let i = 0; i < per; i++) {
      next.push(i === 0
        ? { key: `a${i}`, side: 'a', name: myName, phone: '', userId: me?.id, onYoiden: true, me: true }
        : { key: `a${i}`, side: 'a', name: '', phone: '' });
    }
    for (let i = 0; i < per; i++) next.push({ key: `b${i}`, side: 'b', name: '', phone: '' });
    setSlots(next);
  }, [me?.id, myName]);

  useEffect(() => { if (!existing) seed(format); }, [format, seed, existing]);

  useEffect(() => {
    casualMatchesApi.partners()
      .then((r: any) => setPartners(r?.data?.data ?? []))
      .catch(() => setPartners([]));
  }, []);

  // Load an existing result so this screen doubles as "edit".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!bookingId) { setLoading(false); return; }
      try {
        const res: any = await casualMatchesApi.byBooking(bookingId);
        const m: CasualMatch | null = res?.data?.data ?? null;
        if (cancelled || !m) { setLoading(false); return; }
        setExisting(m);
        setFormat(m.format);
        setSlots((m.players ?? []).map((p, i) => ({
          key: `${p.side}${i}`,
          side: p.side,
          name: p.user?.displayName || p.user?.fullName || p.guestName || '',
          phone: p.guestPhone || p.user?.phone || '',
          userId: p.userId ?? undefined,
          onYoiden: !!p.userId,
          me: p.userId === me?.id,
        })));
        setGames(m.scores?.length ? m.scores : emptyGames());
      } catch { /* nothing logged yet */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [bookingId, me?.id]);

  const setSlot = (key: string, patch: Partial<Slot>) =>
    setSlots(prev => prev.map(s => (s.key === key ? { ...s, ...patch } : s)));

  const setGame = (idx: number, side: 'a' | 'b', raw: string) => {
    const v = Math.max(0, Math.min(99, Number(raw.replace(/\D/g, '')) || 0));
    setGames(prev => prev.map((g, i) => (i === idx ? { ...g, [side]: v } : g)));
  };
  const addGame = () =>
    setGames(prev => (prev.length >= MAX_GAMES ? prev : [...prev, { game: prev.length + 1, a: 0, b: 0 }]));
  const removeGame = (idx: number) =>
    setGames(prev => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx).map((g, i) => ({ ...g, game: i + 1 }))));

  const tally = useMemo(() => {
    let a = 0, b = 0;
    for (const g of games) { if (g.a > g.b) a++; else if (g.b > g.a) b++; }
    return { a, b, winner: a === b ? null : a > b ? 'a' : 'b' };
  }, [games]);

  const filled = (s: Slot) => !!(s.name.trim() || s.phone.trim());
  const canSave =
    slots.some(s => s.side === 'a' && filled(s)) &&
    slots.some(s => s.side === 'b' && filled(s)) &&
    games.some(g => g.a > 0 || g.b > 0) &&
    !busy;

  // Already-picked people shouldn't show up again in the picker.
  const takenKeys = useMemo(
    () => new Set(slots.filter(filled).map(s => s.userId ?? s.phone.replace(/\D/g, '').slice(-10) ?? s.name)),
    [slots],
  );

  const pick = (p: RecentPartner) => {
    if (!picking) return;
    setSlot(picking, {
      name: p.name,
      phone: p.phone ?? '',
      userId: p.userId ?? undefined,
      onYoiden: p.onYoiden,
    });
    setPicking(null);
  };

  const addTyped = () => {
    if (!picking || !newName.trim()) return;
    setSlot(picking, { name: newName.trim(), phone: newPhone.trim(), userId: undefined, onYoiden: false });
    setNewName(''); setNewPhone(''); setPicking(null);
  };

  const invite = (s: Slot) => {
    const who = s.name.trim() || 'there';
    Share.share({
      message: `Hi ${who}! I logged our match on Yoiden — join to see the result and build your own match record: ${INVITE_URL}`,
      url: INVITE_URL,
    }).catch(() => {});
  };

  const save = async () => {
    if (!canSave) return;
    setBusy(true); setErr(null);
    const players: CasualPlayerInput[] = slots.filter(filled).map(s => ({
      side: s.side,
      ...(s.userId ? { userId: s.userId } : {}),
      ...(s.name.trim() ? { name: s.name.trim() } : {}),
      ...(s.phone.trim() ? { phone: s.phone.trim() } : {}),
    }));
    const body = {
      ...(bookingId ? { venueBookingId: bookingId } : {}),
      ...(venueId ? { venueId } : {}),
      format,
      players,
      scores: games.filter(g => g.a > 0 || g.b > 0),
    };
    try {
      if (existing) await casualMatchesApi.amend(existing.id, body);
      else await casualMatchesApi.log(body);
      showToast(existing ? 'Result updated' : 'Result saved to your profile');
      nav.goBack();
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Could not save the result. Please try again.');
    } finally { setBusy(false); }
  };

  const sideSlots = (side: CasualSide) => slots.filter(s => s.side === side);

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={styles.root}>
        <ActivityIndicator color={YColors.accent} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const TeamCard = ({ side, label }: { side: CasualSide; label: string }) => {
    const won = tally.winner === side;
    return (
      <View style={[styles.teamCard, won && styles.teamCardWin]}>
        <View style={styles.teamHead}>
          <YMono size={9.5} color={won ? '#0b7a37' : YColors.ink3} style={{ letterSpacing: 1 }}>
            {label}
          </YMono>
          {won && (
            <View style={styles.winPill}>
              <YUiText size={9} weight={900} color="#0b7a37" style={{ letterSpacing: 0.6 }}>WINNING</YUiText>
            </View>
          )}
        </View>

        {sideSlots(side).map(s => {
          if (!filled(s)) {
            return (
              <Pressable key={s.key} style={styles.addSlot} onPress={() => setPicking(s.key)}>
                <View style={styles.addCircle}>
                  <YUiText size={17} weight={700} color={YColors.accent}>+</YUiText>
                </View>
                <YUiText size={13} weight={700} color={YColors.accent}>Add player</YUiText>
              </Pressable>
            );
          }
          const canInvite = !s.me && !s.onYoiden;
          return (
            <View key={s.key} style={styles.playerCard}>
              <YAvatar
                initials={initialsOf(s.name || '?')}
                size={36}
                color={s.me ? YColors.accent : YColors.bg3}
                textColor={s.me ? '#fff' : YColors.ink2}
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <YUiText size={13.5} weight={800} color={YColors.ink} numberOfLines={1}>
                  {s.name || s.phone}{s.me ? ' (you)' : ''}
                </YUiText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  {s.onYoiden ? (
                    <YUiText size={10.5} weight={700} color={YColors.accent}>On Yoiden</YUiText>
                  ) : s.phone ? (
                    <YUiText size={10.5} color={YColors.ink3} numberOfLines={1}>{s.phone}</YUiText>
                  ) : (
                    <YUiText size={10.5} color={YColors.ink3}>Guest · no phone</YUiText>
                  )}
                </View>
              </View>

              {canInvite && (
                <Pressable style={styles.inviteBtn} onPress={() => invite(s)} hitSlop={6}>
                  <YUiText size={10.5} weight={900} color={YColors.accent} style={{ letterSpacing: 0.4 }}>
                    INVITE
                  </YUiText>
                </Pressable>
              )}
              {!s.me && (
                <Pressable
                  onPress={() => setSlot(s.key, { name: '', phone: '', userId: undefined, onYoiden: false })}
                  hitSlop={10}
                  style={{ marginLeft: 8 }}
                >
                  <YUiText size={14} color={YColors.ink3}>✕</YUiText>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.backBtn}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M12 5l-7 7 7 7" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <YDisplay size={26} color={YColors.accent} style={{ marginTop: 10 }}>
            {existing ? 'EDIT RESULT' : 'ADD RESULT'}
          </YDisplay>
          {!!venueName && (
            <YUiText size={12.5} color={YColors.ink3} style={{ marginTop: 2 }}>{venueName}</YUiText>
          )}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.fmtRow}>
            {(['doubles', 'singles'] as const).map(f => (
              <Pressable
                key={f}
                onPress={() => { setFormat(f); if (!existing) seed(f); }}
                style={[styles.fmtChip, format === f && styles.fmtChipOn]}
              >
                <YUiText size={12.5} weight={format === f ? 800 : 600} color={format === f ? '#fff' : YColors.ink2}>
                  {f === 'doubles' ? 'Doubles' : 'Singles'}
                </YUiText>
              </Pressable>
            ))}
          </View>

          <TeamCard side="a" label="YOUR SIDE" />
          <View style={styles.vsRow}>
            <View style={styles.vsLine} />
            <YMono size={11} bold color={YColors.ink3} style={{ letterSpacing: 1.5 }}>VS</YMono>
            <View style={styles.vsLine} />
          </View>
          <TeamCard side="b" label="OPPONENTS" />

          {/* Score */}
          <YUiText size={12} weight={800} color={YColors.ink2} style={styles.sectionTitle}>SCORE</YUiText>
          <View style={styles.card}>
            {games.map((g, i) => (
              <View key={i} style={styles.gameRow}>
                <YMono size={10.5} color={YColors.ink3} style={{ width: 50 }}>GAME {g.game}</YMono>
                <TextInput
                  style={[styles.scoreInput, g.a > g.b && styles.scoreInputWin]}
                  value={String(g.a)}
                  onChangeText={t => setGame(i, 'a', t)}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                />
                <YUiText size={13} color={YColors.ink3}>–</YUiText>
                <TextInput
                  style={[styles.scoreInput, g.b > g.a && styles.scoreInputWin]}
                  value={String(g.b)}
                  onChangeText={t => setGame(i, 'b', t)}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                />
                {games.length > 1 && (
                  <Pressable onPress={() => removeGame(i)} hitSlop={10} style={{ marginLeft: 'auto' }}>
                    <YUiText size={13} color={YColors.ink3}>✕</YUiText>
                  </Pressable>
                )}
              </View>
            ))}
            {games.length < MAX_GAMES && (
              <Pressable onPress={addGame} hitSlop={8} style={{ marginTop: 4 }}>
                <YUiText size={12} weight={800} color={YColors.accent}>+ Add game</YUiText>
              </Pressable>
            )}
            <View style={styles.tallyRow}>
              <YUiText size={11.5} color={YColors.ink3}>Games won</YUiText>
              <YMono size={13} bold color={YColors.ink}>{tally.a} – {tally.b}</YMono>
            </View>
          </View>

          {err ? <YUiText size={11.5} color={YColors.live} style={{ marginTop: 12 }}>{err}</YUiText> : null}

          <YUiText size={10.5} color={YColors.ink3} style={{ marginTop: 16, textAlign: 'center', lineHeight: 16 }}>
            Casual results build your match history. They don't affect DUPR or any rating.
          </YUiText>
        </ScrollView>

        {/* Sticky save — the score is long enough to scroll past a button */}
        <View style={[styles.footer, { paddingBottom: tabBarClearance }]}>
          <Pressable onPress={save} disabled={!canSave} style={[styles.saveBtn, !canSave && { opacity: 0.4 }]}>
            <YUiText size={13.5} weight={900} color="#fff" style={{ letterSpacing: 0.8 }}>
              {busy ? 'SAVING…' : existing ? 'UPDATE RESULT' : 'SAVE RESULT'}
            </YUiText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Player picker */}
      <Modal visible={!!picking} transparent animationType="slide" onRequestClose={() => setPicking(null)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setPicking(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHead}>
              <YUiText size={14} weight={900} color={YColors.ink}>Add player</YUiText>
              <Pressable onPress={() => setPicking(null)} hitSlop={10}>
                <YUiText size={16} color={YColors.ink3}>✕</YUiText>
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 380 }}>
              {partners.filter(p => !takenKeys.has(p.userId ?? (p.phone || '').replace(/\D/g, '').slice(-10) ?? p.name)).length > 0 && (
                <>
                  <YMono size={9.5} color={YColors.ink3} style={styles.sheetLabel}>YOU'VE PLAYED WITH</YMono>
                  {partners
                    .filter(p => !takenKeys.has(p.userId ?? (p.phone || '').replace(/\D/g, '').slice(-10) ?? p.name))
                    .map((p, i) => (
                      <Pressable key={i} style={styles.partnerRow} onPress={() => pick(p)}>
                        <YAvatar initials={initialsOf(p.name)} size={34} color={YColors.bg3} textColor={YColors.ink2} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <YUiText size={13.5} weight={700} color={YColors.ink} numberOfLines={1}>{p.name}</YUiText>
                          <YUiText size={10.5} color={YColors.ink3}>
                            {p.playedTogether} match{p.playedTogether === 1 ? '' : 'es'} together
                            {p.onYoiden ? ' · on Yoiden' : ''}
                          </YUiText>
                        </View>
                        <YUiText size={12} weight={800} color={YColors.accent}>Add</YUiText>
                      </Pressable>
                    ))}
                </>
              )}

              <YMono size={9.5} color={YColors.ink3} style={styles.sheetLabel}>SOMEONE NEW</YMono>
              <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                <TextInput
                  style={styles.input}
                  placeholder="Name"
                  placeholderTextColor={YColors.ink3}
                  value={newName}
                  onChangeText={setNewName}
                  autoCapitalize="words"
                />
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  placeholder="Phone (optional)"
                  placeholderTextColor={YColors.ink3}
                  value={newPhone}
                  onChangeText={setNewPhone}
                  keyboardType="phone-pad"
                />
                <YUiText size={10.5} color={YColors.ink3} style={{ marginTop: 8, lineHeight: 16 }}>
                  With a phone number the match lands on their Yoiden profile — waiting for them when they join.
                </YUiText>
                <Pressable
                  onPress={addTyped}
                  disabled={!newName.trim()}
                  style={[styles.sheetAddBtn, !newName.trim() && { opacity: 0.4 }]}
                >
                  <YUiText size={12.5} weight={900} color="#fff" style={{ letterSpacing: 0.5 }}>ADD</YUiText>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {toastNode}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 999, backgroundColor: YColors.bg3,
    borderWidth: 1, borderColor: YColors.line2, alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { letterSpacing: 1, marginTop: 22, marginBottom: 10 },
  card: { backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line2, borderRadius: 14, padding: 16 },

  fmtRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  fmtChip: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
    borderWidth: 1.5, borderColor: YColors.line2, backgroundColor: YColors.bg,
  },
  fmtChipOn: { backgroundColor: YColors.accent, borderColor: YColors.accent },

  teamCard: {
    backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line2,
    borderRadius: 14, padding: 14,
  },
  teamCardWin: { borderColor: 'rgba(11,122,55,0.4)', backgroundColor: 'rgba(11,122,55,0.04)' },
  teamHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  winPill: { backgroundColor: 'rgba(11,122,55,0.13)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },

  playerCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: YColors.bg, borderRadius: 12, padding: 10, marginBottom: 8,
  },
  addSlot: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: 'rgba(24,88,214,0.35)', borderStyle: 'dashed',
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  addCircle: {
    width: 34, height: 34, borderRadius: 999, backgroundColor: 'rgba(24,88,214,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  inviteBtn: {
    borderWidth: 1.5, borderColor: 'rgba(24,88,214,0.4)', borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 6,
  },

  vsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  vsLine: { flex: 1, height: 1, backgroundColor: YColors.line },

  gameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  scoreInput: {
    width: 58, height: 46, borderRadius: 10, borderWidth: 1.5, borderColor: YColors.line2,
    backgroundColor: YColors.bg, textAlign: 'center', fontSize: 17, fontWeight: '800', color: YColors.ink,
  },
  scoreInputWin: { borderColor: 'rgba(11,122,55,0.5)', backgroundColor: 'rgba(11,122,55,0.06)' },
  tallyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: YColors.line,
  },

  // A flex sibling of the ScrollView rather than absolutely positioned, so it
  // always lands above the tab bar instead of underneath it.
  footer: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14,
    backgroundColor: YColors.bg, borderTopWidth: 1, borderTopColor: YColors.line,
  },
  saveBtn: {
    height: 52, borderRadius: 12, backgroundColor: YColors.accent,
    alignItems: 'center', justifyContent: 'center',
  },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: YColors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 24, maxHeight: '85%',
  },
  sheetHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: YColors.line,
  },
  sheetLabel: { letterSpacing: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  partnerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  input: {
    backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line2, borderRadius: 10,
    paddingHorizontal: 12, height: 46, fontSize: 14, color: YColors.ink,
  },
  sheetAddBtn: {
    height: 48, borderRadius: 12, backgroundColor: YColors.accent,
    alignItems: 'center', justifyContent: 'center', marginTop: 14,
  },
});
