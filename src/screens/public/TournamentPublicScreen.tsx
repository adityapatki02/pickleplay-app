import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  TextInput,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import {
  YColors,
  YDisplay,
  YEyebrow,
  YMono,
  YUiText,
  YBadge,
  YButton,
  YChip,
  YCoverImage,
  YWordmark,
} from '../../components/yoiden';
import { tournamentsApi } from '../../api/tournaments.api';
import { authApi } from '../../api/auth.api';
import { openRazorpay } from '../../utils/razorpay';
import { matchesApi } from '../../api/matches.api';
import type { Tournament, TournamentCategory } from '../../types/tournament.types';

// Route params: the kiosk build passes tournamentId via initialParams
// (EXPO_PUBLIC_TOURNAMENT_ID); /t/:slug deep links pass slug. slug wins.
type PublicParams = { tournamentId?: string; slug?: string };

type TabKey = 'events' | 'players' | 'schedule';

type Entrant = { name: string; seed: number | null; status: string; registeredAt: string };
type EntrantsData = { entrants: Entrant[]; confirmedCount: number; pendingCount: number };

type ScheduleMatch = {
  id: string;
  categoryId: string;
  round: string;
  matchNumber: number;
  teamAId: string | null;
  teamBId: string | null;
  winnerId: string | null;
  status: string;
  scores: { gameNumber: number; teamAScore: number; teamBScore: number }[];
  courtId: string | null;
  courtName: string | null;
  scheduledStart: string | null;
};
type ScheduleData = {
  matches: ScheduleMatch[];
  courts: { id: string; name: string }[];
  teamNames: Record<string, string>;
};

const POLL_MS = 30000;
const CONTENT_MAX_WIDTH = 760;

const STATUS_LABEL: Record<string, string> = {
  draft: 'DRAFT',
  published: 'UPCOMING',
  registration_open: 'OPEN',
  registration_closed: 'CLOSED',
  in_progress: 'LIVE',
  completed: 'FINISHED',
  cancelled: 'CANCELLED',
};
const STATUS_COLOR: Record<string, string> = {
  draft: YColors.ink3,
  published: YColors.accent,
  registration_open: YColors.lime,
  registration_closed: YColors.ink3,
  in_progress: YColors.live,
  completed: YColors.ink3,
  cancelled: YColors.ink3,
};

const GENDER_FILTERS = [
  { key: 'all', label: 'ALL' },
  { key: 'male', label: 'MEN' },
  { key: 'female', label: 'WOMEN' },
  { key: 'mixed', label: 'MIXED' },
  { key: 'open', label: 'OPEN' },
] as const;
const FORMAT_FILTERS = [
  { key: 'all', label: 'ALL' },
  { key: 'singles', label: 'SINGLES' },
  { key: 'doubles', label: 'DOUBLES' },
] as const;

const fmtDate = (iso: string) =>
  new Date(iso)
    .toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    .toUpperCase();

export default function TournamentPublicScreen() {
  const route = useRoute<RouteProp<Record<string, PublicParams>, string>>();
  const nav = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const params = (route.params ?? {}) as PublicParams;
  const slug = params.slug;
  const tournamentId = params.tournamentId;

  const [t, setT] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const tRef = useRef<Tournament | null>(null);

  const [tab, setTab] = useState<TabKey>('events');
  const tabRef = useRef<TabKey>('events');
  tabRef.current = tab;

  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [wizardOpen, setWizardOpen] = useState(false);

  const [playersCategoryId, setPlayersCategoryId] = useState<string | null>(null);
  const [entrants, setEntrants] = useState<EntrantsData | null>(null);
  const [entrantsLoading, setEntrantsLoading] = useState(false);
  const [entrantsError, setEntrantsError] = useState<string | null>(null);

  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const fetchTournament = useCallback(async () => {
    try {
      const res = slug
        ? await tournamentsApi.getPublicBySlug(slug)
        : await tournamentsApi.getById(tournamentId as string);
      const data = (res.data as any)?.data ?? res.data;
      setT(data);
      tRef.current = data;
      setError(null);
      setOffline(false);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setError('This tournament could not be found.');
      } else if (tRef.current) {
        // Network hiccup after we already have data — keep it, flag offline.
        setOffline(true);
      } else {
        setError(e?.message || 'Could not load tournament');
      }
    } finally {
      setLoading(false);
    }
  }, [tournamentId, slug]);

  const fetchSchedule = useCallback(async () => {
    const id = tRef.current?.id;
    if (!id) return;
    try {
      const res = await matchesApi.getSchedule(id);
      setSchedule((res.data as any)?.data ?? res.data);
      setScheduleError(null);
    } catch (e: any) {
      setScheduleError(e?.message || 'Could not load schedule');
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  const fetchEntrants = useCallback(async (categoryId: string) => {
    const slugForCalls = tRef.current?.slug;
    if (!slugForCalls) return;
    setEntrantsLoading(true);
    setEntrantsError(null);
    try {
      const res = await tournamentsApi.getPublicEntrants(slugForCalls, categoryId);
      setEntrants((res.data as any)?.data ?? res.data);
    } catch (e: any) {
      setEntrantsError(e?.message || 'Could not load players');
      setEntrants(null);
    } finally {
      setEntrantsLoading(false);
    }
  }, []);

  // Initial load + silent 30s live poll while focused (kiosk screens stay
  // open for hours) — mirrors LeagueDashboardScreen's auto-refresh.
  useFocusEffect(
    useCallback(() => {
      fetchTournament();
      const id = setInterval(() => {
        fetchTournament();
        if (tabRef.current === 'schedule') fetchSchedule();
      }, POLL_MS);
      return () => clearInterval(id);
    }, [fetchTournament, fetchSchedule]),
  );

  // Players tab: default to the first category once data exists.
  useEffect(() => {
    if (tab === 'players' && !playersCategoryId && t?.categories?.length) {
      setPlayersCategoryId(t.categories[0].id);
    }
  }, [tab, playersCategoryId, t]);

  useEffect(() => {
    if (tab === 'players' && playersCategoryId) fetchEntrants(playersCategoryId);
  }, [tab, playersCategoryId, fetchEntrants]);

  // Schedule tab: lazy first fetch.
  useEffect(() => {
    if (tab === 'schedule' && !schedule) {
      setScheduleLoading(true);
      fetchSchedule();
    }
  }, [tab, schedule, fetchSchedule]);

  const categoriesById = useMemo(
    () => Object.fromEntries((t?.categories ?? []).map((c) => [c.id, c])),
    [t],
  );

  // After a guest registers, pull fresh counts so the spots-left meter and the
  // players tab reflect the new entry without waiting for the 30s poll.
  const onRegistered = useCallback(() => {
    fetchTournament();
    if (playersCategoryId) fetchEntrants(playersCategoryId);
  }, [fetchTournament, fetchEntrants, playersCategoryId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={YColors.ink2} />
      </SafeAreaView>
    );
  }

  if (error || !t) {
    return (
      <SafeAreaView style={styles.center}>
        <YWordmark size={20} />
        <YUiText size={13} color={YColors.ink2} style={{ marginTop: 16, textAlign: 'center', paddingHorizontal: 32 }}>
          {error || 'This tournament could not be loaded.'}
        </YUiText>
        <View style={{ marginTop: 16 }}>
          <YButton
            variant="ghost"
            size="sm"
            onPress={() => {
              setLoading(true);
              setError(null);
              fetchTournament();
            }}
          >
            RETRY
          </YButton>
        </View>
      </SafeAreaView>
    );
  }

  const statusLabel = STATUS_LABEL[t.status] || t.status.toUpperCase();
  const statusColor = STATUS_COLOR[t.status] || YColors.accent;
  const sameDay = new Date(t.startDate).toDateString() === new Date(t.endDate).toDateString();
  const dateRange = sameDay ? fmtDate(t.startDate) : `${fmtDate(t.startDate)} — ${fmtDate(t.endDate)}`;
  const registrationOpen = t.status === 'registration_open';

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {offline ? (
        <View style={styles.offlineBar}>
          <YMono size={10} color="#fff" style={{ letterSpacing: 1 }}>
            CONNECTION LOST — SHOWING LAST DATA
          </YMono>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.page, isWide && styles.pageWide]}>
          {/* Yoiden platform bar */}
          <View style={styles.platformBar}>
            <YWordmark size={18} />
            <YBadge color={statusColor === YColors.lime ? '#000' : '#fff'} bg={statusColor}>
              {statusLabel}
            </YBadge>
          </View>

          {/* Hero — banner or accent-gradient fallback (YCoverImage handles both) */}
          <YCoverImage src={t.bannerUrl || undefined} height={isWide ? 320 : 220} rounded={isWide}>
            <View style={styles.coverTitleBlock}>
              {t.city ? <YEyebrow color="rgba(255,255,255,0.75)">{t.city.toUpperCase()}</YEyebrow> : null}
              <YDisplay size={isWide ? 44 : 34} color="#fff" style={{ marginTop: 6 }}>
                {t.name}
              </YDisplay>
              <YMono size={11} color="rgba(255,255,255,0.8)" style={{ marginTop: 10, letterSpacing: 1.2 }}>
                {dateRange} · {(t.venueName || '').toUpperCase()}
              </YMono>
            </View>
          </YCoverImage>

          {/* Key facts */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={{ flex: 1 }}>
                <YEyebrow color={YColors.ink3}>DATES</YEyebrow>
                <YUiText size={13} weight={800} color={YColors.ink} style={{ marginTop: 4 }}>
                  {dateRange}
                </YUiText>
              </View>
              <View style={{ flex: 1 }}>
                <YEyebrow color={YColors.ink3}>REGISTER BY</YEyebrow>
                <YUiText size={13} weight={800} color={YColors.ink} style={{ marginTop: 4 }}>
                  {t.registrationDeadline ? fmtDate(t.registrationDeadline) : '—'}
                </YUiText>
              </View>
            </View>
            <View style={styles.divider} />
            <YEyebrow color={YColors.ink3}>VENUE</YEyebrow>
            <YUiText size={13} weight={800} color={YColors.ink} style={{ marginTop: 4 }}>
              {t.venueName}
            </YUiText>
            {t.venueAddress ? (
              <YUiText size={12} color={YColors.ink2} style={{ marginTop: 4, lineHeight: 18 }}>
                {t.venueAddress}
              </YUiText>
            ) : null}
            {t.description ? (
              <>
                <View style={styles.divider} />
                <YEyebrow color={YColors.ink3}>ABOUT</YEyebrow>
                <YUiText size={12} color={YColors.ink2} style={{ marginTop: 6, lineHeight: 18 }}>
                  {t.description}
                </YUiText>
              </>
            ) : null}
          </View>

          {/* Draws & standings (read-only StandingsScreen, public GETs) */}
          <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
            <YButton
              variant="dark"
              size="md"
              fullWidth
              onPress={() => nav.navigate('TournamentStandings', { tournamentId: t.id })}
            >
              DRAWS & STANDINGS →
            </YButton>
          </View>

          {/* Section tabs */}
          <View style={styles.tabRow}>
            {(['events', 'players', 'schedule'] as TabKey[]).map((k) => (
              <Pressable
                key={k}
                onPress={() => setTab(k)}
                style={[styles.tabBtn, tab === k && styles.tabBtnActive]}
              >
                <YUiText size={11} weight={900} color={tab === k ? '#fff' : YColors.ink2} style={{ letterSpacing: 1.2 }}>
                  {k === 'events' ? `EVENTS (${t.categories?.length ?? 0})` : k.toUpperCase()}
                </YUiText>
              </Pressable>
            ))}
          </View>

          {tab === 'events' ? (
            <EventsSection
              categories={t.categories ?? []}
              registrationOpen={registrationOpen}
              genderFilter={genderFilter}
              formatFilter={formatFilter}
              onGender={setGenderFilter}
              onFormat={setFormatFilter}
              slug={t.slug}
              onRegistered={onRegistered}
            />
          ) : null}

          {tab === 'players' ? (
            <PlayersSection
              categories={t.categories ?? []}
              selectedId={playersCategoryId}
              onSelect={setPlayersCategoryId}
              entrants={entrants}
              loading={entrantsLoading}
              error={entrantsError}
              onRetry={() => playersCategoryId && fetchEntrants(playersCategoryId)}
            />
          ) : null}

          {tab === 'schedule' ? (
            <ScheduleSection
              schedule={schedule}
              loading={scheduleLoading}
              error={scheduleError}
              onRetry={() => {
                setScheduleLoading(true);
                fetchSchedule();
              }}
              categoriesById={categoriesById}
            />
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky BOOK NOW → opens the multi-step registration wizard */}
      {registrationOpen ? (
        <View style={styles.bookBar}>
          <Pressable style={styles.bookNow} onPress={() => setWizardOpen(true)}>
            <YUiText size={14} weight={900} color="#fff" style={{ letterSpacing: 1 }}>
              BOOK NOW
            </YUiText>
          </Pressable>
        </View>
      ) : null}

      <RegistrationWizard
        visible={wizardOpen}
        onClose={() => setWizardOpen(false)}
        tournament={t}
        onRegistered={onRegistered}
      />
    </SafeAreaView>
  );
}

// ─── Sections ────────────────────────────────────────────────────

function EmptyBox({ text }: { text: string }) {
  return (
    <View style={styles.centerBox}>
      <YUiText size={12} color={YColors.ink3} style={{ textAlign: 'center' }}>
        {text}
      </YUiText>
    </View>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.centerBox}>
      <YUiText size={12} color={YColors.ink2} style={{ textAlign: 'center' }}>
        {message}
      </YUiText>
      {onRetry ? (
        <View style={{ marginTop: 10 }}>
          <YButton variant="ghost" size="sm" onPress={onRetry}>
            RETRY
          </YButton>
        </View>
      ) : null}
    </View>
  );
}

function EventsSection({
  categories,
  registrationOpen,
  genderFilter,
  formatFilter,
  onGender,
  onFormat,
  slug,
  onRegistered,
}: {
  categories: TournamentCategory[];
  registrationOpen: boolean;
  genderFilter: string;
  formatFilter: string;
  onGender: (v: string) => void;
  onFormat: (v: string) => void;
  slug?: string;
  onRegistered: () => void;
}) {
  const filtered = categories.filter(
    (c) =>
      (genderFilter === 'all' || c.gender === genderFilter) &&
      (formatFilter === 'all' || c.format === formatFilter),
  );
  return (
    <View style={{ paddingHorizontal: 16 }}>
      <View style={styles.filterRow}>
        {GENDER_FILTERS.map((f) => (
          <YChip key={f.key} active={genderFilter === f.key} onPress={() => onGender(f.key)}>
            {f.label}
          </YChip>
        ))}
      </View>
      <View style={[styles.filterRow, { marginBottom: 12 }]}>
        {FORMAT_FILTERS.map((f) => (
          <YChip key={f.key} active={formatFilter === f.key} onPress={() => onFormat(f.key)}>
            {f.label}
          </YChip>
        ))}
      </View>
      {categories.length === 0 ? (
        <EmptyBox text="Categories will be announced soon." />
      ) : filtered.length === 0 ? (
        <EmptyBox text="No categories match these filters." />
      ) : (
        filtered.map((c) => (
          <PublicCategoryCard
            key={c.id}
            c={c}
            registrationOpen={registrationOpen}
            slug={slug}
            onRegistered={onRegistered}
          />
        ))
      )}
    </View>
  );
}

function PublicCategoryCard({
  c,
  registrationOpen,
  slug,
  onRegistered,
}: {
  c: TournamentCategory;
  registrationOpen: boolean;
  slug?: string;
  onRegistered: () => void;
}) {
  const registered = c.registeredTeams ?? 0;
  const waitlisted = c.waitlistedCount ?? 0;
  const spotsLeft = Math.max(0, c.maxTeams - registered);
  const full = spotsLeft === 0;
  const pct = c.maxTeams > 0 ? Math.min(100, Math.round((registered / c.maxTeams) * 100)) : 0;
  const bestOf = c.matchFormat?.replace('best_of_', '') || '1';
  return (
    <View style={styles.catCard}>
      <View style={styles.catTop}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <YUiText size={13} weight={900} color={YColors.ink} style={{ letterSpacing: 0.5 }}>
            {c.name.toUpperCase()}
          </YUiText>
          <YUiText size={11} color={YColors.ink2} style={{ marginTop: 3 }}>
            {c.format.toUpperCase()} · {c.gender.toUpperCase()} · BEST OF {bestOf}
          </YUiText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <YMono size={14} bold color={YColors.ink}>
            {Number(c.entryFee) === 0 ? 'FREE' : `₹${c.entryFee}`}
          </YMono>
          <YEyebrow size={8} color={YColors.ink3} style={{ marginTop: 2 }}>
            ENTRY
          </YEyebrow>
        </View>
      </View>
      <View style={styles.catMeter}>
        <View style={styles.progressBg}>
          <View
            style={[
              styles.progressFill,
              { width: `${pct}%`, backgroundColor: full ? YColors.live : YColors.accent },
            ]}
          />
        </View>
        <View style={styles.catMeterRow}>
          <YMono size={10} color={YColors.ink3}>
            {registered}/{c.maxTeams} REGISTERED
          </YMono>
          {full ? (
            <YBadge color="#fff" bg={YColors.live}>
              {waitlisted > 0 ? `WAITLIST · ${waitlisted}` : 'FULL — WAITLIST'}
            </YBadge>
          ) : registrationOpen ? (
            <YBadge color="#000" bg={YColors.lime}>
              {spotsLeft} {spotsLeft === 1 ? 'SPOT' : 'SPOTS'} LEFT
            </YBadge>
          ) : (
            <YBadge color={YColors.ink3}>CLOSED</YBadge>
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * Multi-step registration wizard (KheloMore-style). Opened by the sticky
 * BOOK NOW bar. Steps: phone → OTP (auto-creates a Yoiden account, no PIN) →
 * pick a category → player details → pay/confirm. Replaces the old inline
 * per-card guest form so registration is one guided flow for a cold visitor.
 */
function RegistrationWizard({
  visible,
  onClose,
  tournament,
  onRegistered,
}: {
  visible: boolean;
  onClose: () => void;
  tournament: Tournament;
  onRegistered: () => void;
}) {
  const cats = tournament.categories ?? [];
  type Step = 'phone' | 'otp' | 'category' | 'details' | 'done';
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [cat, setCat] = useState<TournamentCategory | null>(null);
  const [name, setName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ status?: string; waitlistPosition?: number | null } | null>(null);

  const reset = () => {
    setStep('phone'); setPhone(''); setOtp(''); setCat(null); setName('');
    setPartnerName(''); setPartnerPhone(''); setBusy(false); setErr(null); setResult(null);
  };
  const close = () => { reset(); onClose(); };

  const phoneOk = phone.replace(/\D/g, '').length >= 10;
  const otpOk = otp.replace(/\D/g, '').length >= 4;
  const isDoubles = cat?.format === 'doubles';
  const isPaid = cat ? Number(cat.entryFee) > 0 : false;
  const detailsOk = name.trim().length >= 2;

  // Step 1 → send the OTP.
  const sendOtp = async () => {
    if (!phoneOk || busy) return;
    setBusy(true); setErr(null);
    try {
      await authApi.sendPhoneOtp({ phone: phone.trim() });
      setStep('otp');
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Could not send the code. Please try again.');
    } finally { setBusy(false); }
  };

  // Step 2 → verify OTP, create/return the Yoiden account (no PIN), advance.
  const verifyOtp = async () => {
    if (!otpOk || busy) return;
    setBusy(true); setErr(null);
    try {
      const vres = await authApi.verifyPhoneOtp({ phone: phone.trim(), otp: otp.trim() });
      const verificationToken = vres.data?.data?.verificationToken;
      const cres = await authApi.phoneOtpContinue({ phone: phone.trim(), verificationToken });
      const existingName = cres.data?.data?.user?.fullName;
      if (existingName && !name.trim()) setName(existingName);
      setStep('category');
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'That code didn’t work. Check it and try again.');
    } finally { setBusy(false); }
  };

  // Final → register (+ payment for paid categories).
  const submit = async () => {
    if (!cat || !tournament.slug || !detailsOk || busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await tournamentsApi.guestRegister(tournament.slug, {
        name: name.trim(),
        phone: phone.trim(),
        categoryId: cat.id,
        partnerName: partnerName.trim() || undefined,
        partnerPhone: partnerPhone.trim() || undefined,
      });
      const data = res.data?.data;
      if (data?.free) {
        setResult({ status: data.status, waitlistPosition: data.waitlistPosition });
        setStep('done'); onRegistered(); return;
      }
      if (!data?.orderId || !data?.key) {
        setErr('Could not start payment. Please try again.'); return;
      }
      await openRazorpay({
        key: data.key,
        amount: data.amount as number,
        currency: data.currency ?? 'INR',
        order_id: data.orderId,
        name: data.eventName ?? 'Yoiden',
        description: data.categoryName ?? cat.name,
        prefill: { name: name.trim(), contact: phone.trim() },
        theme: { color: YColors.accent },
      });
      setResult({ status: 'paid' });
      setStep('done'); onRegistered();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.description || e?.message || 'Could not register. Please try again.';
      setErr(
        msg === 'Payment cancelled'
          ? 'Payment cancelled — your spot is held for a few minutes if you want to retry.'
          : msg,
      );
    } finally { setBusy(false); }
  };

  const titles: Record<Step, string> = {
    phone: 'Enter your mobile',
    otp: 'Verify your number',
    category: 'Select a category',
    details: 'Your details',
    done: 'Registration',
  };
  const stepIndex: Record<Step, number> = { phone: 0, otp: 1, category: 2, details: 3, done: 4 };
  const back = () => {
    setErr(null);
    if (step === 'otp') setStep('phone');
    else if (step === 'category') setStep('otp');
    else if (step === 'details') setStep('category');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.wizOverlay}>
        <View style={styles.wizSheet}>
          {/* Header */}
          <View style={styles.wizHead}>
            {step !== 'phone' && step !== 'done' ? (
              <Pressable onPress={back} hitSlop={10}>
                <YUiText size={20} color={YColors.ink2}>‹</YUiText>
              </Pressable>
            ) : (
              <View style={{ width: 20 }} />
            )}
            <YUiText size={13} weight={900} color={YColors.ink} style={{ letterSpacing: 0.5 }}>
              {titles[step]}
            </YUiText>
            <Pressable onPress={close} hitSlop={10}>
              <YUiText size={16} color={YColors.ink2}>✕</YUiText>
            </Pressable>
          </View>

          {/* Progress rail */}
          <View style={styles.wizRail}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[styles.wizRailSeg, i <= stepIndex[step] && { backgroundColor: YColors.accent }]}
              />
            ))}
          </View>

          {/* Event strip */}
          <View style={styles.wizEvent}>
            <YUiText size={12} weight={800} color={YColors.ink} numberOfLines={1}>
              {tournament.name}
            </YUiText>
            {tournament.venueName ? (
              <YMono size={9.5} color={YColors.ink3} style={{ marginTop: 2, letterSpacing: 0.6 }}>
                {tournament.venueName.toUpperCase()}
              </YMono>
            ) : null}
          </View>

          <ScrollView contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled">
            {step === 'phone' ? (
              <>
                <YUiText size={12} color={YColors.ink2} style={{ marginBottom: 12 }}>
                  Enter your 10-digit mobile number. We’ll text you a one-time code and set up your Yoiden account automatically — no password needed.
                </YUiText>
                <TextInput
                  style={styles.regInput}
                  placeholder="+91  Mobile number"
                  placeholderTextColor={YColors.ink3}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoFocus
                />
              </>
            ) : null}

            {step === 'otp' ? (
              <>
                <YUiText size={12} color={YColors.ink2} style={{ marginBottom: 12 }}>
                  Enter the code sent to {phone.trim()}.
                </YUiText>
                <TextInput
                  style={styles.regInput}
                  placeholder="6-digit code"
                  placeholderTextColor={YColors.ink3}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={8}
                  autoFocus
                />
                <Pressable onPress={sendOtp} disabled={busy} hitSlop={6} style={{ marginTop: 4 }}>
                  <YUiText size={10.5} weight={700} color={YColors.accent}>Resend code</YUiText>
                </Pressable>
              </>
            ) : null}

            {step === 'category' ? (
              <View style={{ gap: 10 }}>
                {cats.length === 0 ? (
                  <YUiText size={12} color={YColors.ink3}>Categories will be announced soon.</YUiText>
                ) : (
                  cats.map((c) => {
                    const reg = c.registeredTeams ?? 0;
                    const spots = Math.max(0, c.maxTeams - reg);
                    const cFull = spots === 0;
                    const on = cat?.id === c.id;
                    const filling = !cFull && spots <= 4;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setCat(c)}
                        style={[styles.wizCat, on && styles.wizCatOn]}
                      >
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <YUiText size={12.5} weight={900} color={YColors.ink}>{c.name}</YUiText>
                          <YMono size={9.5} color={YColors.ink3} style={{ marginTop: 3, letterSpacing: 0.5 }}>
                            {c.format.toUpperCase()} · {c.gender.toUpperCase()}
                          </YMono>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <YMono size={12} bold color={YColors.ink}>
                            {Number(c.entryFee) === 0 ? 'FREE' : `₹${c.entryFee}`}
                          </YMono>
                          <YUiText
                            size={9}
                            weight={800}
                            color={cFull ? YColors.live : filling ? YColors.accent : YColors.ink3}
                            style={{ marginTop: 4, letterSpacing: 0.4 }}
                          >
                            {cFull ? 'SOLD OUT' : filling ? 'FILLING FAST' : `${spots} LEFT`}
                          </YUiText>
                        </View>
                        <View style={[styles.wizRadio, on && styles.wizRadioOn]}>
                          {on ? <View style={styles.wizRadioDot} /> : null}
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : null}

            {step === 'details' ? (
              <>
                <TextInput
                  style={styles.regInput}
                  placeholder="Your name"
                  placeholderTextColor={YColors.ink3}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoFocus
                />
                {isDoubles ? (
                  <>
                    <TextInput
                      style={styles.regInput}
                      placeholder="Partner name (optional)"
                      placeholderTextColor={YColors.ink3}
                      value={partnerName}
                      onChangeText={setPartnerName}
                      autoCapitalize="words"
                    />
                    {partnerName.trim() ? (
                      <TextInput
                        style={styles.regInput}
                        placeholder="Partner phone (optional)"
                        placeholderTextColor={YColors.ink3}
                        value={partnerPhone}
                        onChangeText={setPartnerPhone}
                        keyboardType="phone-pad"
                      />
                    ) : null}
                  </>
                ) : null}
                {cat ? (
                  <View style={styles.wizSummary}>
                    <YUiText size={11.5} weight={800} color={YColors.ink}>{cat.name}</YUiText>
                    <YMono size={12} bold color={YColors.ink}>
                      {Number(cat.entryFee) === 0 ? 'FREE' : `₹${cat.entryFee}`}
                    </YMono>
                  </View>
                ) : null}
              </>
            ) : null}

            {step === 'done' ? (
              <View style={[styles.catNote, { backgroundColor: YColors.lime, marginTop: 4 }]}>
                <YUiText size={12} weight={900} color="#000">
                  {result?.status === 'waitlisted'
                    ? `You’re on the waitlist${result?.waitlistPosition ? ` — position ${result.waitlistPosition}` : ''}.`
                    : result?.status === 'pending_partner'
                      ? 'You’re in — add your partner at the venue to complete the team.'
                      : result?.status === 'paid'
                        ? 'Payment received — you’re registered!'
                        : 'You’re registered!'}
                </YUiText>
                <YUiText size={10} color="rgba(0,0,0,0.7)" style={{ marginTop: 4 }}>
                  A confirmation has been sent to {phone.trim()}. Download the Yoiden app to manage your booking and see the draw.
                </YUiText>
              </View>
            ) : null}

            {err ? <YUiText size={10.5} color={YColors.live} style={{ marginTop: 10 }}>{err}</YUiText> : null}
          </ScrollView>

          {/* Footer action */}
          <View style={styles.wizFoot}>
            {step === 'phone' ? (
              <Pressable style={[styles.wizBtn, (!phoneOk || busy) && styles.wizBtnOff]} disabled={!phoneOk || busy} onPress={sendOtp}>
                <YUiText size={13} weight={900} color="#fff" style={{ letterSpacing: 0.8 }}>{busy ? 'SENDING…' : 'GET OTP'}</YUiText>
              </Pressable>
            ) : null}
            {step === 'otp' ? (
              <Pressable style={[styles.wizBtn, (!otpOk || busy) && styles.wizBtnOff]} disabled={!otpOk || busy} onPress={verifyOtp}>
                <YUiText size={13} weight={900} color="#fff" style={{ letterSpacing: 0.8 }}>{busy ? 'VERIFYING…' : 'VERIFY & CONTINUE'}</YUiText>
              </Pressable>
            ) : null}
            {step === 'category' ? (
              <Pressable style={[styles.wizBtn, !cat && styles.wizBtnOff]} disabled={!cat} onPress={() => { setErr(null); setStep('details'); }}>
                <YUiText size={13} weight={900} color="#fff" style={{ letterSpacing: 0.8 }}>PROCEED</YUiText>
              </Pressable>
            ) : null}
            {step === 'details' ? (
              <Pressable style={[styles.wizBtn, (!detailsOk || busy) && styles.wizBtnOff]} disabled={!detailsOk || busy} onPress={submit}>
                <YUiText size={13} weight={900} color="#fff" style={{ letterSpacing: 0.8 }}>
                  {busy ? (isPaid ? 'OPENING PAYMENT…' : 'REGISTERING…') : isPaid ? `PAY ₹${cat?.entryFee}` : 'CONFIRM REGISTRATION'}
                </YUiText>
              </Pressable>
            ) : null}
            {step === 'done' ? (
              <Pressable style={styles.wizBtn} onPress={close}>
                <YUiText size={13} weight={900} color="#fff" style={{ letterSpacing: 0.8 }}>DONE</YUiText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PlayersSection({
  categories,
  selectedId,
  onSelect,
  entrants,
  loading,
  error,
  onRetry,
}: {
  categories: TournamentCategory[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  entrants: EntrantsData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (!categories.length) return <EmptyBox text="Categories will be announced soon." />;
  return (
    <View style={{ paddingHorizontal: 16 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingVertical: 8 }}
      >
        {categories.map((c) => (
          <YChip key={c.id} active={c.id === selectedId} onPress={() => onSelect(c.id)}>
            {c.name}
          </YChip>
        ))}
      </ScrollView>
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={YColors.ink2} />
        </View>
      ) : error ? (
        <ErrorBox message={error} onRetry={onRetry} />
      ) : !entrants || entrants.entrants.length === 0 ? (
        <EmptyBox text="No players registered in this category yet." />
      ) : (
        <>
          <YMono size={10} color={YColors.ink3} style={{ marginTop: 4, marginBottom: 8 }}>
            {entrants.confirmedCount} CONFIRMED
            {entrants.pendingCount ? ` · ${entrants.pendingCount} PENDING` : ''}
          </YMono>
          {entrants.entrants.map((p, i) => (
            <View key={`${p.name}-${i}`} style={styles.entrantRow}>
              <YMono size={11} color={YColors.ink3} style={{ width: 28 }}>
                {String(i + 1).padStart(2, '0')}
              </YMono>
              <YUiText size={13} weight={700} color={YColors.ink} style={{ flex: 1 }}>
                {p.name}
              </YUiText>
              {p.seed ? <YBadge color={YColors.ink}>SEED {p.seed}</YBadge> : null}
              {p.status === 'pending_payment' ? (
                <YMono size={9} color={YColors.ink3}>
                  PENDING
                </YMono>
              ) : null}
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function ScheduleSection({
  schedule,
  loading,
  error,
  onRetry,
  categoriesById,
}: {
  schedule: ScheduleData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  categoriesById: Record<string, TournamentCategory>;
}) {
  if (loading && !schedule) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator color={YColors.ink2} />
      </View>
    );
  }
  if (error && !schedule) return <ErrorBox message={error} onRetry={onRetry} />;
  if (!schedule || schedule.matches.length === 0) {
    return <EmptyBox text="The schedule appears once draws are generated." />;
  }
  const name = (id: string | null) => (id && schedule.teamNames[id]) || 'TBD';
  const scheduled = schedule.matches
    .filter((m) => m.scheduledStart)
    .sort((a, b) => new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime());
  const pending = schedule.matches.filter((m) => !m.scheduledStart);
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const scoreLine = (m: ScheduleMatch) =>
    m.scores.map((s) => `${s.teamAScore}-${s.teamBScore}`).join(', ');
  const catName = (id: string) => (categoriesById[id]?.name || '').toUpperCase();
  return (
    <View style={{ paddingHorizontal: 16 }}>
      {scheduled.map((m) => (
        <View key={m.id} style={styles.matchRow}>
          <View style={{ width: 74 }}>
            <YMono size={12} bold color={YColors.ink}>
              {fmtTime(m.scheduledStart!)}
            </YMono>
            {m.courtName ? (
              <YMono size={9} color={YColors.ink3} style={{ marginTop: 2 }}>
                {m.courtName.toUpperCase()}
              </YMono>
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            <YUiText size={12} weight={800} color={YColors.ink}>
              {name(m.teamAId)} vs {name(m.teamBId)}
            </YUiText>
            <YMono size={9} color={YColors.ink3} style={{ marginTop: 2 }}>
              {catName(m.categoryId)} · {String(m.round).toUpperCase()} · M{m.matchNumber}
            </YMono>
          </View>
          {m.status === 'completed' ? (
            <YMono size={11} bold color={YColors.ink}>
              {scoreLine(m)}
            </YMono>
          ) : m.status === 'in_progress' ? (
            <YBadge color="#fff" bg={YColors.live}>
              LIVE
            </YBadge>
          ) : null}
        </View>
      ))}
      {pending.length > 0 ? (
        <>
          <YEyebrow color={YColors.ink3} style={{ marginTop: 16, marginBottom: 8 }}>
            AWAITING SCHEDULING · {pending.length}
          </YEyebrow>
          {pending.map((m) => (
            <View key={m.id} style={[styles.matchRow, { opacity: 0.7 }]}>
              <View style={{ flex: 1 }}>
                <YUiText size={12} weight={700} color={YColors.ink2}>
                  {name(m.teamAId)} vs {name(m.teamBId)}
                </YUiText>
                <YMono size={9} color={YColors.ink3} style={{ marginTop: 2 }}>
                  {catName(m.categoryId)} · {String(m.round).toUpperCase()}
                </YMono>
              </View>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: YColors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: YColors.bg },
  centerBox: { paddingVertical: 40, alignItems: 'center' },
  scrollContent: { paddingBottom: 120, alignItems: 'center' },

  // Sticky BOOK NOW bar + multi-step registration wizard
  bookBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: YColors.bg,
    borderTopWidth: 1,
    borderTopColor: YColors.line,
  },
  bookNow: {
    height: 52,
    borderRadius: 12,
    backgroundColor: YColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  wizOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  wizSheet: {
    backgroundColor: YColors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  wizHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  wizRail: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 12 },
  wizRailSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: YColors.line2 },
  wizEvent: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: YColors.bg3,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: YColors.line,
  },
  wizFoot: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: YColors.line,
  },
  wizBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: YColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wizBtnOff: { opacity: 0.45 },
  wizCat: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: YColors.line,
    backgroundColor: YColors.bg2,
  },
  wizCatOn: { borderColor: YColors.accent, backgroundColor: 'rgba(24,88,214,0.06)' },
  wizRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: YColors.line2,
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wizRadioOn: { borderColor: YColors.accent },
  wizRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: YColors.accent },
  wizSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: YColors.bg3,
  },
  page: { width: '100%' },
  pageWide: { maxWidth: CONTENT_MAX_WIDTH, paddingTop: 16 },
  platformBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  offlineBar: { backgroundColor: YColors.ink, paddingVertical: 6, alignItems: 'center' },
  coverTitleBlock: { position: 'absolute', left: 18, right: 18, bottom: 18 },
  infoCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line,
  },
  infoRow: { flexDirection: 'row', gap: 12 },
  divider: { height: 1, backgroundColor: YColors.line, marginVertical: 14 },
  tabRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginTop: 20, marginBottom: 12 },
  tabBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: YColors.line2,
  },
  tabBtnActive: { backgroundColor: YColors.ink, borderColor: YColors.ink },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  catCard: {
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  catTop: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingBottom: 10 },
  catMeter: { paddingHorizontal: 14, paddingBottom: 12 },
  catMeterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressBg: { height: 4, borderRadius: 2, backgroundColor: YColors.bg3, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  catNote: { paddingVertical: 9, paddingHorizontal: 14, backgroundColor: YColors.bg3 },
  regBtn: {
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: YColors.lime,
    alignItems: 'center',
  },
  regCancel: {
    flex: 1,
    backgroundColor: YColors.bg3,
    borderWidth: 1,
    borderColor: YColors.line2,
  },
  regForm: {
    padding: 12,
    backgroundColor: YColors.bg3,
    gap: 8,
  },
  regInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: YColors.line2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: YColors.ink,
  },
  entrantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: YColors.line,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: YColors.line,
  },
});
