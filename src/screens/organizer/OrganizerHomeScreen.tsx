import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
  RefreshControl,
  Modal,
  Animated,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { tournamentsApi } from '../../api/tournaments.api';
import { matchesApi } from '../../api/matches.api';
import { registrationsApi } from '../../api/registrations.api';
import { useAuthStore } from '../../store/authStore';
import { Tournament, BracketData } from '../../types/tournament.types';
import TournamentCarousel from '../../components/ui/TournamentCarousel';
import {
  findActiveLive,
  findUpcoming,
  computeLiveProgress,
  buildActionItems,
  computeQuickStats,
  recentTournaments,
  formatCountdown,
  formatRegProgress,
  ActionItem,
  LiveProgress,
  QuickStats,
} from '../../utils/organizerDashboard';

// ─── Design tokens ──────────────────────────────────────────────────────────
const NAVY = '#001E40';
const BLUE = '#2196F3';
const GREEN = '#06D6A0';
const ORANGE = '#F59E0B';
const RED = '#EF4444';
const BG = '#FFFFFF';
const SURFACE = '#F5F7FA';
const BORDER = '#E2E8F0';
const TEXT = '#1A1D21';
const TEXT_SUB = '#64748B';
const TEXT_MUTED = '#94A3B8';

// ─── Helpers ────────────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'GOOD MORNING';
  if (h < 17) return 'GOOD AFTERNOON';
  return 'GOOD EVENING';
}

function getFirstName(fullName?: string): string {
  if (!fullName) return 'Organizer';
  const first = fullName.split(' ')[0];
  if (!first) return 'Organizer';
  // Title-case: first letter upper, rest lower
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

// ─── Main Screen ────────────────────────────────────────────────────────────
export default function OrganizerHomeScreen() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [recommended, setRecommended] = useState<Tournament[]>([]);
  const [liveProgress, setLiveProgress] = useState<LiveProgress | null>(null);
  const [pendingPartnerCount, setPendingPartnerCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);

  const isMounted = useRef(false);

  // ── Data fetch ──
  const fetchData = useCallback(async () => {
    try {
      const res = await tournamentsApi.getMyTournaments();
      const data = (res.data?.data ?? []) as Tournament[];
      setTournaments(data);

      // Determine "top" tournament = live OR next upcoming
      const live = findActiveLive(data);
      const upcoming = live ? null : findUpcoming(data);
      const top = live ?? upcoming;

      // Fetch bracket progress for live tournament
      if (live && live.categories && live.categories.length > 0) {
        try {
          const bracketResponses = await Promise.all(
            live.categories.map((c) =>
              matchesApi.getBracket(live.id, c.id).catch(() => null),
            ),
          );
          const brackets = bracketResponses
            .map((r: any) => r?.data?.data ?? r?.data ?? null)
            .filter(Boolean) as BracketData[];
          setLiveProgress(computeLiveProgress(brackets));
        } catch {
          setLiveProgress(null);
        }
      } else {
        setLiveProgress(null);
      }

      // Fetch pending partner count for top tournament
      if (top) {
        try {
          const regRes = await registrationsApi.getByTournament(top.id);
          const regs = (regRes.data?.data ?? regRes.data ?? []) as any[];
          const pending = regs.filter((r) => r.status === 'pending_partner').length;
          setPendingPartnerCount(pending);
        } catch {
          setPendingPartnerCount(0);
        }
      } else {
        setPendingPartnerCount(0);
      }

      // Fetch recommended tournaments (other organizers' events)
      try {
        const recRes = await tournamentsApi.list({
          status: 'registration_open,published,in_progress',
          limit: 10,
        });
        const recData = (recRes.data?.data ?? recRes.data ?? []) as Tournament[];
        const ownIds = new Set(data.map((t) => t.id));
        setRecommended(recData.filter((t) => !ownIds.has(t.id)).slice(0, 6));
      } catch {
        setRecommended([]);
      }
    } catch (err) {
      console.warn('[OrganizerHome] fetchData failed', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isMounted.current) {
        isMounted.current = true;
        fetchData();
      } else {
        fetchData();
      }
    }, [fetchData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // ── Derived data ──
  const live = findActiveLive(tournaments);
  const upcoming = live ? null : findUpcoming(tournaments);
  const topTournamentId = (live ?? upcoming)?.id ?? null;
  const quickStats = computeQuickStats(tournaments);
  const actionItems = buildActionItems(tournaments, topTournamentId, pendingPartnerCount);
  const recent = recentTournaments(tournaments, 3);

  // ── Navigation helpers ──
  const openMatchHub = (tournamentId: string) => {
    navigation.navigate('MyEventsTab', {
      screen: 'MatchHub',
      params: { tournamentId },
    });
  };
  const openTournamentDashboard = (tournamentId: string) => {
    navigation.navigate('MyEventsTab', {
      screen: 'TournamentManage',
      params: { tournamentId },
    });
  };
  const openRegistrationManage = (tournamentId: string) => {
    navigation.navigate('MyEventsTab', {
      screen: 'RegistrationManage',
      params: { tournamentId },
    });
  };
  const openCreateTournament = () => {
    navigation.navigate('MyEventsTab', { screen: 'CreateTournament' });
  };
  const openCreateLeague = () => {
    navigation.navigate('MyEventsTab', { screen: 'CreateLeague' });
  };

  // ── Render ──
  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <Text style={s.greeting}>{getGreeting()}</Text>
          <Text style={s.name}>{getFirstName(user?.fullName)}</Text>
        </View>
        <View style={s.loadingWrap}>
          <ActivityIndicator color={NAVY} />
        </View>
      </SafeAreaView>
    );
  }

  const hasAnyTournaments = tournaments.length > 0;

  return (
    <SafeAreaView style={s.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NAVY} />
        }
      >
        {/* ─── Header ─── */}
        <View style={s.header}>
          <Text style={s.greeting}>{getGreeting()}</Text>
          {(() => {
            const first = getFirstName(user?.fullName);
            const firstLetter = first.charAt(0);
            const rest = first.slice(1);
            return (
              <Text style={s.name}>
                <Text style={s.nameFirstChar}>{firstLetter}</Text>
                <Text style={s.nameRest}>{rest}</Text>
                <Text style={s.namePeriod}>.</Text>
              </Text>
            );
          })()}
        </View>

        {/* ─── Empty state ─── */}
        {!hasAnyTournaments && (
          <View style={s.emptyCard}>
            <Text style={{ fontSize: 48 }}>🏆</Text>
            <Text style={s.emptyTitle}>CREATE YOUR FIRST TOURNAMENT</Text>
            <Text style={s.emptyDesc}>
              Get started by creating a tournament.{'\n'}Add categories, invite players, and
              run matches.
            </Text>
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={openCreateTournament}
              activeOpacity={0.85}
            >
              <Text style={s.emptyBtnText}>+ CREATE TOURNAMENT</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Live hero ─── */}
        {live && (
          <LiveHeroCard
            tournament={live}
            progress={liveProgress}
            onPress={() => openMatchHub(live.id)}
          />
        )}

        {/* ─── Upcoming hero ─── */}
        {!live && upcoming && (
          <UpcomingHeroCard
            tournament={upcoming}
            pendingPartnerCount={pendingPartnerCount}
            onPress={() => openMatchHub(upcoming.id)}
          />
        )}

        {/* ─── Action items ─── */}
        {hasAnyTournaments && actionItems.length > 0 && (
          <ActionItemsSection
            items={actionItems}
            onItemPress={(item) => {
              if (item.type === 'pending_partner') {
                openRegistrationManage(item.tournamentId);
              } else {
                openTournamentDashboard(item.tournamentId);
              }
            }}
          />
        )}

        {/* ─── Quick stats ─── */}
        {hasAnyTournaments && <QuickStatsStrip stats={quickStats} />}

        {/* ─── Recent tournaments (horizontal slider) ─── */}
        {hasAnyTournaments && recent.length > 0 && (
          <HorizontalTournamentSlider
            title="YOUR TOURNAMENTS"
            tournaments={recent}
            onItemPress={(t) => openTournamentDashboard(t.id)}
          />
        )}

        {/* ─── Recommended for you (horizontal slider) ─── */}
        {recommended.length > 0 && (
          <HorizontalTournamentSlider
            title={hasAnyTournaments ? 'DISCOVER MORE' : 'RECOMMENDED FOR YOU'}
            tournaments={recommended}
            onItemPress={(t) => {
              navigation.navigate('DiscoverTab', {
                screen: 'TournamentDetail',
                params: { tournamentId: t.id },
              });
            }}
          />
        )}
      </ScrollView>

      {/* ─── FAB ─── */}
      {hasAnyTournaments && (
        <TouchableOpacity style={s.fab} onPress={() => setShowFabMenu(true)} activeOpacity={0.85}>
          <Text style={s.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* ─── FAB expand modal ─── */}
      <Modal visible={showFabMenu} transparent animationType="fade">
        <TouchableOpacity
          style={s.fabOverlay}
          activeOpacity={1}
          onPress={() => setShowFabMenu(false)}
        >
          <View style={s.fabMenuCard}>
            <TouchableOpacity
              style={s.fabMenuItem}
              onPress={() => {
                setShowFabMenu(false);
                openCreateTournament();
              }}
              activeOpacity={0.8}
            >
              <View style={s.fabMenuIcon}>
                <Text style={s.fabMenuIconText}>🏆</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fabMenuTitle}>New Tournament</Text>
                <Text style={s.fabMenuSub}>Create and publish a new event</Text>
              </View>
              <Text style={s.fabMenuArrow}>›</Text>
            </TouchableOpacity>

            {/* New League option */}
            <View style={{ height: 1, backgroundColor: '#E2E8F0', marginHorizontal: 12 }} />
            <TouchableOpacity
              style={s.fabMenuItem}
              onPress={() => {
                setShowFabMenu(false);
                openCreateLeague();
              }}
              activeOpacity={0.8}
            >
              <View style={[s.fabMenuIcon, { backgroundColor: '#EDE9FE' }]}>
                <Text style={s.fabMenuIconText}>🏅</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fabMenuTitle}>New League</Text>
                <Text style={s.fabMenuSub}>Create a franchise league (SPPL format)</Text>
              </View>
              <Text style={s.fabMenuArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Close hint */}
          <View style={s.fabCloseHint}>
            <View style={s.fabCloseBtn}>
              <Text style={s.fabCloseBtnText}>✕</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Live hero card ─────────────────────────────────────────────────────────
function LiveHeroCard({
  tournament,
  progress,
  onPress,
}: {
  tournament: Tournament;
  progress: LiveProgress | null;
  onPress: () => void;
}) {
  const pct = progress?.pct ?? 0;
  const { registered } = formatRegProgress(tournament);
  return (
    <View style={hero.card}>
      <View style={hero.topRow}>
        <View style={hero.liveBadge}>
          <View style={hero.liveDot} />
          <Text style={hero.liveText}>LIVE NOW</Text>
        </View>
        <Text style={hero.pctText}>{pct}%</Text>
      </View>

      <Text style={hero.name} numberOfLines={2}>
        {tournament.name}
      </Text>
      <Text style={hero.sub}>
        {tournament.city} • {registered} teams
      </Text>

      {/* Progress bar */}
      <View style={hero.progressWrap}>
        <View style={[hero.progressBar, { width: `${pct}%` }]} />
      </View>
      <Text style={hero.progressLabel}>
        {progress ? `${progress.done} / ${progress.total} matches done` : 'Loading progress...'}
      </Text>

      <TouchableOpacity style={hero.cta} onPress={onPress} activeOpacity={0.85}>
        <Text style={hero.ctaText}>OPEN MATCH HUB  →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Upcoming hero card ─────────────────────────────────────────────────────
function UpcomingHeroCard({
  tournament,
  pendingPartnerCount,
  onPress,
}: {
  tournament: Tournament;
  pendingPartnerCount: number;
  onPress: () => void;
}) {
  const { registered, max } = formatRegProgress(tournament);
  const startMs = new Date(tournament.startDate).getTime();
  const hasStarted = startMs <= Date.now();
  const countdown = hasStarted ? null : formatCountdown(tournament.startDate);
  const badgeLabel = hasStarted ? 'READY TO START' : `STARTING IN ${countdown}`;
  const regDeadlineMs = tournament.registrationDeadline
    ? new Date(tournament.registrationDeadline).getTime()
    : 0;
  const regIsOpen = regDeadlineMs > Date.now();
  const regClose = regIsOpen ? formatCountdown(tournament.registrationDeadline) : null;

  return (
    <View style={hero.cardUpcoming}>
      <View style={hero.topRow}>
        <View style={hero.upcomingBadge}>
          <Text style={hero.upcomingText}>{badgeLabel}</Text>
        </View>
      </View>

      <Text style={[hero.name, { color: NAVY }]} numberOfLines={2}>
        {tournament.name}
      </Text>
      <Text style={[hero.sub, { color: 'rgba(26,29,33,0.55)' }]}>
        {tournament.city}
        {tournament.state ? `, ${tournament.state}` : ''}
      </Text>

      <View style={hero.statRow}>
        <View style={hero.statItem}>
          <Text style={hero.statValue}>
            {registered}
            <Text style={hero.statOf}> / {max}</Text>
          </Text>
          <Text style={hero.statLabel}>TEAMS REGISTERED</Text>
        </View>
        {pendingPartnerCount > 0 && (
          <View style={hero.statItem}>
            <Text style={[hero.statValue, { color: ORANGE }]}>{pendingPartnerCount}</Text>
            <Text style={hero.statLabel}>PENDING PARTNER</Text>
          </View>
        )}
      </View>

      {regClose && (
        <Text style={hero.deadline}>⏰ Reg closes in {regClose}</Text>
      )}

      <TouchableOpacity style={hero.ctaNavy} onPress={onPress} activeOpacity={0.85}>
        <Text style={hero.ctaText}>MANAGE  →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Action items section ──────────────────────────────────────────────────
function ActionItemsSection({
  items,
  onItemPress,
}: {
  items: ActionItem[];
  onItemPress: (item: ActionItem) => void;
}) {
  return (
    <View style={action.section}>
      <Text style={action.header}>NEEDS ATTENTION  ({items.length})</Text>
      {items.map((item) => {
        const accent =
          item.type === 'draft' ? ORANGE : item.type === 'closing_soon' ? RED : BLUE;
        const icon =
          item.type === 'draft' ? '📝' : item.type === 'closing_soon' ? '⏰' : '👥';
        return (
          <TouchableOpacity
            key={item.id}
            style={[action.item, { borderLeftColor: accent }]}
            onPress={() => onItemPress(item)}
            activeOpacity={0.75}
          >
            <Text style={action.itemIcon}>{icon}</Text>
            <Text style={action.itemLabel} numberOfLines={2}>
              {item.label}
            </Text>
            <Text style={action.itemArrow}>›</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Quick stats strip ─────────────────────────────────────────────────────
function QuickStatsStrip({ stats }: { stats: QuickStats }) {
  return (
    <View style={stat.strip}>
      <StatPill value={String(stats.liveCount)} label="LIVE" accent={stats.liveCount > 0 ? RED : TEXT_SUB} />
      <View style={stat.divider} />
      <StatPill value={String(stats.registrationsThisMonth)} label="REGS / MO" accent={NAVY} />
      <View style={stat.divider} />
      <StatPill value={String(stats.tournamentsThisMonth)} label="EVENTS / MO" accent={NAVY} />
      <View style={stat.divider} />
      <StatPill
        value={stats.completionRate === null ? '—' : `${stats.completionRate}%`}
        label="COMPLETED"
        accent={GREEN}
      />
    </View>
  );
}

function StatPill({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <View style={stat.pill}>
      <Text style={[stat.pillValue, { color: accent }]}>{value}</Text>
      <Text style={stat.pillLabel}>{label}</Text>
    </View>
  );
}

// ─── Recent tournaments ────────────────────────────────────────────────────
function HorizontalTournamentSlider({
  title,
  tournaments,
  onItemPress,
}: {
  title: string;
  tournaments: Tournament[];
  onItemPress: (t: Tournament) => void;
}) {
  if (!tournaments || tournaments.length === 0) return null;
  return (
    <View style={recent.section}>
      <View style={{ paddingHorizontal: 20 }}>
        <Text style={recent.header}>{title}</Text>
      </View>
      <TournamentCarousel tournaments={tournaments} onPress={onItemPress} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    paddingHorizontal: 24,
    paddingTop:
      Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 16 : 16,
    paddingBottom: 10,
  },
  greeting: {
    fontSize: 10,
    fontWeight: '800',
    color: TEXT_MUTED,
    letterSpacing: 2,
    marginBottom: 2,
  },
  name: {
    fontSize: 30,
    fontWeight: '900',
    fontStyle: 'italic',
    color: NAVY,
    letterSpacing: -0.5,
  },
  nameFirstChar: {
    color: BLUE,
    fontStyle: 'italic',
    fontWeight: '900',
  },
  nameRest: {
    color: NAVY,
    fontStyle: 'italic',
    fontWeight: '900',
  },
  namePeriod: {
    color: NAVY,
    fontStyle: 'italic',
    fontWeight: '900',
  },

  loadingWrap: {
    paddingTop: 60,
    alignItems: 'center',
  },

  emptyCard: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: NAVY,
    letterSpacing: 1.5,
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    color: TEXT_SUB,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyBtn: {
    backgroundColor: NAVY,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  fab: {
    position: 'absolute',
    bottom: 110,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 32,
    marginTop: -2,
  },

  // FAB expand menu
  fabOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingBottom: 180,
    paddingRight: 20,
  },
  fabMenuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 6,
    width: 260,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  fabMenuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(33,150,243,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabMenuIconText: {
    fontSize: 20,
  },
  fabMenuTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: NAVY,
    letterSpacing: 0.2,
  },
  fabMenuSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 1,
  },
  fabMenuArrow: {
    fontSize: 22,
    fontWeight: '300',
    color: '#94A3B8',
  },
  fabCloseHint: {
    alignItems: 'flex-end',
    marginTop: 12,
    paddingRight: 8,
  },
  fabCloseBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '300',
  },
});

const hero = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 6,
    backgroundColor: NAVY,
    borderRadius: 16,
    padding: 16,
  },
  cardUpcoming: {
    marginHorizontal: 20,
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: RED,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '900',
    color: RED,
    letterSpacing: 1.5,
  },
  upcomingBadge: {
    backgroundColor: 'rgba(33,150,243,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  upcomingText: {
    fontSize: 10,
    fontWeight: '900',
    color: BLUE,
    letterSpacing: 1.5,
  },
  pctText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  sub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 12,
  },
  progressWrap: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 5,
  },
  progressBar: {
    height: '100%',
    backgroundColor: GREEN,
    borderRadius: 3,
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 4,
    marginBottom: 8,
  },
  statItem: {},
  statValue: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '900',
  },
  statOf: {
    color: TEXT_SUB,
    fontSize: 12,
    fontWeight: '700',
  },
  statLabel: {
    color: TEXT_SUB,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginTop: 2,
  },
  deadline: {
    color: TEXT_SUB,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 10,
  },
  cta: {
    backgroundColor: BLUE,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 2,
  },
  ctaNavy: {
    backgroundColor: NAVY,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 2,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
});

const action = StyleSheet.create({
  section: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  header: {
    fontSize: 10,
    fontWeight: '800',
    color: TEXT_SUB,
    letterSpacing: 1.8,
    marginBottom: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: BORDER,
  },
  itemIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  itemLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: TEXT,
  },
  itemArrow: {
    fontSize: 22,
    color: TEXT_MUTED,
    fontWeight: '300',
  },
});

const stat = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: SURFACE,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
  },
  pillValue: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  pillLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: TEXT_SUB,
    letterSpacing: 1,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: BORDER,
  },
});

const recent = StyleSheet.create({
  section: {
    marginTop: 24,
  },
  header: {
    fontSize: 10,
    fontWeight: '800',
    color: TEXT_SUB,
    letterSpacing: 1.8,
    marginBottom: 12,
  },
});
