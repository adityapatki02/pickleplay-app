import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';

import { YColors, YDisplay, YUiText, YMono } from '../../components/yoiden';
import { casualMatchesApi } from '../../api/casualMatches.api';
import type { CasualPlayerInput, CasualSide, CasualMatch } from '../../api/casualMatches.api';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../components/Toast';

type Params = {
  bookingId?: string;
  venueId?: string;
  venueName?: string;
  /** Existing match id → amend instead of create. */
  matchId?: string;
};

const MAX_GAMES = 3;
const emptyGames = () => [{ game: 1, a: 0, b: 0 }];

/** A row the user is filling in — kept looser than the API shape while editing. */
type Slot = { key: string; side: CasualSide; name: string; phone: string; userId?: string; me?: boolean };

export default function LogMatchScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<RouteProp<Record<string, Params>, string>>();
  const { bookingId, venueId, venueName, matchId } = route.params ?? {};
  const me = useAuthStore((s) => s.user);
  const { show: showToast, node: toastNode } = useToast();

  const [format, setFormat] = useState<'singles' | 'doubles'>('doubles');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [games, setGames] = useState(emptyGames());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!matchId || !!bookingId);
  const [existing, setExisting] = useState<CasualMatch | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const myName = me?.displayName || me?.fullName || 'You';

  // Seed the roster: me on side A, blanks for the rest.
  const seed = useCallback((fmt: 'singles' | 'doubles') => {
    const per = fmt === 'doubles' ? 2 : 1;
    const next: Slot[] = [];
    for (let i = 0; i < per; i++) {
      next.push(i === 0
        ? { key: `a${i}`, side: 'a', name: myName, phone: '', userId: me?.id, me: true }
        : { key: `a${i}`, side: 'a', name: '', phone: '' });
    }
    for (let i = 0; i < per; i++) next.push({ key: `b${i}`, side: 'b', name: '', phone: '' });
    setSlots(next);
  }, [me?.id, myName]);

  useEffect(() => { if (!existing) seed(format); }, [format, seed, existing]);

  // Load an already-recorded result so this screen doubles as "amend".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!matchId && !bookingId) { setLoading(false); return; }
      try {
        const res: any = matchId
          ? await casualMatchesApi.byBooking(bookingId ?? '')
          : await casualMatchesApi.byBooking(bookingId!);
        const m: CasualMatch | null = res?.data?.data ?? null;
        if (cancelled || !m) { setLoading(false); return; }
        setExisting(m);
        setFormat(m.format);
        setSlots((m.players ?? []).map((p, i) => ({
          key: `${p.side}${i}`,
          side: p.side,
          name: p.user?.displayName || p.user?.fullName || p.guestName || '',
          phone: p.guestPhone || '',
          userId: p.userId ?? undefined,
          me: p.userId === me?.id,
        })));
        setGames(m.scores?.length ? m.scores : emptyGames());
      } catch { /* no existing result — fresh entry */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [matchId, bookingId, me?.id]);

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

  // Running tally so the winner is obvious before saving.
  const tally = useMemo(() => {
    let a = 0, b = 0;
    for (const g of games) { if (g.a > g.b) a++; else if (g.b > g.a) b++; }
    return { a, b, winner: a === b ? null : a > b ? 'a' : 'b' };
  }, [games]);

  const named = (s: Slot) => s.name.trim() || s.phone.trim();
  const canSave =
    slots.some(s => s.side === 'a' && named(s)) &&
    slots.some(s => s.side === 'b' && named(s)) &&
    games.some(g => g.a > 0 || g.b > 0) &&
    !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true); setErr(null);
    const players: CasualPlayerInput[] = slots
      .filter(named)
      .map(s => ({
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

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.backBtn}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M12 5l-7 7 7 7" stroke={YColors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <YDisplay size={26} color={YColors.accent} style={{ marginTop: 8 }}>
            {existing ? 'EDIT RESULT' : 'ADD RESULT'}
          </YDisplay>
          <YUiText size={12.5} color={YColors.ink3} style={{ marginTop: 2 }}>
            {venueName ? `${venueName} · ` : ''}Saved to every player's profile
          </YUiText>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* Format */}
          <View style={styles.fmtRow}>
            {(['doubles', 'singles'] as const).map(f => (
              <Pressable
                key={f}
                onPress={() => { if (!existing) { setFormat(f); seed(f); } else setFormat(f); }}
                style={[styles.fmtChip, format === f && styles.fmtChipOn]}
              >
                <YUiText size={12.5} weight={format === f ? 800 : 600} color={format === f ? '#fff' : YColors.ink2}>
                  {f === 'doubles' ? 'Doubles' : 'Singles'}
                </YUiText>
              </Pressable>
            ))}
          </View>

          {/* Who played */}
          <YUiText size={12} weight={800} color={YColors.ink2} style={styles.sectionTitle}>WHO PLAYED</YUiText>
          {(['a', 'b'] as const).map((side, si) => (
            <View key={side} style={[styles.teamCard, tally.winner === side && styles.teamCardWin]}>
              <View style={styles.teamHead}>
                <YMono size={10} color={YColors.ink3} style={{ letterSpacing: 1 }}>
                  {si === 0 ? 'YOUR SIDE' : 'OPPONENTS'}
                </YMono>
                {tally.winner === side && (
                  <View style={styles.winPill}><YUiText size={9.5} weight={800} color="#0b7a37">WON</YUiText></View>
                )}
              </View>
              {sideSlots(side).map(s => (
                <View key={s.key} style={styles.playerRow}>
                  {s.me ? (
                    <View style={styles.mePill}>
                      <YUiText size={13} weight={800} color={YColors.accent}>{myName} (you)</YUiText>
                    </View>
                  ) : (
                    <>
                      <TextInput
                        style={[styles.input, { flex: 1.2 }]}
                        placeholder="Name"
                        placeholderTextColor={YColors.ink3}
                        value={s.name}
                        onChangeText={t => setSlot(s.key, { name: t, userId: undefined })}
                        autoCapitalize="words"
                      />
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder="Phone (optional)"
                        placeholderTextColor={YColors.ink3}
                        value={s.phone}
                        onChangeText={t => setSlot(s.key, { phone: t, userId: undefined })}
                        keyboardType="phone-pad"
                      />
                    </>
                  )}
                </View>
              ))}
            </View>
          ))}
          <YUiText size={11} color={YColors.ink3} style={{ marginTop: -4, marginBottom: 6, lineHeight: 17 }}>
            Add a phone number and the match lands on their Yoiden profile too — they'll find it waiting when they sign up.
          </YUiText>

          {/* Score */}
          <YUiText size={12} weight={800} color={YColors.ink2} style={styles.sectionTitle}>SCORE</YUiText>
          <View style={styles.card}>
            {games.map((g, i) => (
              <View key={i} style={styles.gameRow}>
                <YMono size={11} color={YColors.ink3} style={{ width: 54 }}>GAME {g.game}</YMono>
                <TextInput
                  style={styles.scoreInput}
                  value={String(g.a)}
                  onChangeText={t => setGame(i, 'a', t)}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                />
                <YUiText size={13} color={YColors.ink3}>–</YUiText>
                <TextInput
                  style={styles.scoreInput}
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
              <Pressable onPress={addGame} hitSlop={8} style={{ marginTop: 6 }}>
                <YUiText size={12} weight={800} color={YColors.accent}>+ Add game</YUiText>
              </Pressable>
            )}
            <View style={styles.tallyRow}>
              <YUiText size={11.5} color={YColors.ink3}>Games won</YUiText>
              <YMono size={13} bold color={YColors.ink}>{tally.a} – {tally.b}</YMono>
            </View>
          </View>

          {err ? <YUiText size={11.5} color={YColors.live} style={{ marginTop: 12 }}>{err}</YUiText> : null}

          <Pressable
            onPress={save}
            disabled={!canSave}
            style={[styles.saveBtn, !canSave && { opacity: 0.45 }]}
          >
            <YUiText size={13.5} weight={900} color="#fff" style={{ letterSpacing: 0.8 }}>
              {busy ? 'SAVING…' : existing ? 'UPDATE RESULT' : 'SAVE RESULT'}
            </YUiText>
          </Pressable>

          <YUiText size={10.5} color={YColors.ink3} style={{ marginTop: 12, textAlign: 'center', lineHeight: 16 }}>
            Casual results build your match history. They don't affect DUPR or any rating.
          </YUiText>
        </ScrollView>
      </KeyboardAvoidingView>
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
  sectionTitle: { letterSpacing: 1, marginTop: 20, marginBottom: 10 },
  card: { backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line2, borderRadius: 14, padding: 16 },
  fmtRow: { flexDirection: 'row', gap: 8 },
  fmtChip: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
    borderWidth: 1.5, borderColor: YColors.line2, backgroundColor: YColors.bg,
  },
  fmtChipOn: { backgroundColor: YColors.accent, borderColor: YColors.accent },
  teamCard: {
    backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line2,
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  teamCardWin: { borderColor: 'rgba(11,122,55,0.45)', backgroundColor: 'rgba(11,122,55,0.05)' },
  teamHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  winPill: { backgroundColor: 'rgba(11,122,55,0.14)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  playerRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  mePill: {
    flex: 1, backgroundColor: 'rgba(24,88,214,0.08)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  input: {
    backgroundColor: YColors.bg, borderWidth: 1, borderColor: YColors.line2, borderRadius: 10,
    paddingHorizontal: 12, height: 44, fontSize: 14, color: YColors.ink,
  },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  scoreInput: {
    width: 58, height: 46, borderRadius: 10, borderWidth: 1.5, borderColor: YColors.line2,
    backgroundColor: YColors.bg, textAlign: 'center', fontSize: 17, fontWeight: '800', color: YColors.ink,
  },
  tallyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: YColors.line,
  },
  saveBtn: {
    height: 52, borderRadius: 12, backgroundColor: YColors.accent,
    alignItems: 'center', justifyContent: 'center', marginTop: 20,
  },
});
