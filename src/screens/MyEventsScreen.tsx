import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { tournamentsApi } from '../api/tournaments.api';
import { registrationsApi } from '../api/registrations.api';
import { getLeagues, deleteLeague } from '../api/leagues.api';
import { useAuthStore } from '../store/authStore';
import { Tournament } from '../types/tournament.types';
import type { League } from '../types/league.types';
import TournamentTile from '../components/ui/TournamentTile';
import TournamentCarousel from '../components/ui/TournamentCarousel';
// Light theme
const NAVY = '#001E40';
const BLUE = '#1858D6';
const BG = '#FFFFFF';
const SURFACE = '#F5F7FA';
const TEXT = '#1A1D21';
const TEXT2 = '#64748B';
const TEXT3 = '#94A3B8';
const BORDER = '#E2E8F0';

// ─── Design tokens ────────────────────────────────────────────────────────────
const BLUE_ACCENT = '#1858D6';
const RED = '#EF4444';
const GREEN = '#22C55E';

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'playing' | 'organizing' | 'past';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft:               { color: '#F59E0B', label: 'DRAFT' },
  published:           { color: BLUE_ACCENT, label: 'PUBLISHED' },
  registration_open:   { color: GREEN, label: 'REG. OPEN' },
  registration_closed: { color: '#F59E0B', label: 'REG. CLOSED' },
  in_progress:         { color: RED, label: '● LIVE' },
  completed:           { color: '#6B7280', label: 'COMPLETED' },
  cancelled:           { color: '#9CA3AF', label: 'CANCELLED' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: string): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isCompleted(status: string): boolean {
  return status === 'completed' || status === 'cancelled';
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ text }: { text: string }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={styles.sectionLabelText}>{text}</Text>
      <View style={styles.sectionLabelLine} />
    </View>
  );
}

// ─── Playing card ─────────────────────────────────────────────────────────────
function PlayingCard({
  item,
  onPress,
  onBracket,
}: {
  item: any;
  onPress: () => void;
  onBracket: () => void;
}) {
  const t: Tournament = item.tournament ?? item;
  const categoryName: string = item.category?.name ?? item.categoryName ?? '';
  const cfg = STATUS_CONFIG[t.status] ?? { color: '#6B7280', label: t.status?.toUpperCase() };
  const isLive = t.status === 'in_progress';
  const awaitingDraw =
    t.status === 'registration_open' || t.status === 'registration_closed';
  const accentColor = isLive ? RED : awaitingDraw ? BLUE_ACCENT : GREEN;

  return (
    <TouchableOpacity style={styles.playingCard} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.playingCardAccent, { backgroundColor: accentColor }]} />
      <View style={styles.playingCardBody}>
        {/* Name + status */}
        <View style={styles.cardTopRow}>
          <Text style={styles.cardName} numberOfLines={1}>{t.name}</Text>
          <View style={[styles.statusPill, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '50' }]}>
            <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Category */}
        {categoryName ? (
          <View style={styles.categoryRow}>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText}>{categoryName.toUpperCase()}</Text>
            </View>
          </View>
        ) : null}

        {/* Meta */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>📅 {fmtDate(t.startDate)}</Text>
          <Text style={styles.metaText}>  📍 {t.city}</Text>
        </View>

        {/* State-specific footer */}
        {isLive ? (
          <View style={styles.liveFooter}>
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>● LIVE</Text>
            </View>
            <TouchableOpacity style={styles.bracketBtn} onPress={onBracket} activeOpacity={0.85}>
              <Text style={styles.bracketBtnText}>VIEW BRACKET →</Text>
            </TouchableOpacity>
          </View>
        ) : awaitingDraw ? (
          <View style={styles.awaitRow}>
            <Text style={styles.awaitText}>⏳ AWAITING DRAW</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Organizing card ──────────────────────────────────────────────────────────
function OrgCard({
  item,
  index,
  onPress,
}: {
  item: Tournament;
  index: number;
  onPress: () => void;
}) {
  const status = item?.status ?? 'draft';
  const cfg = STATUS_CONFIG[status] ?? { color: '#6B7280', label: status.toUpperCase() };
  const isLive = status === 'in_progress';
  const regCount =
    (item as any).registrationCount ??
    item.categories?.reduce((s, c) => s + (c.registeredTeams ?? 0), 0) ?? 0;

  return (
    <TouchableOpacity
      style={[styles.orgCard, isLive && styles.orgCardLive]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={[styles.orgIndex, { backgroundColor: isLive ? '#EF444415' : SURFACE }]}>
        <Text style={[styles.orgIndexText, { color: isLive ? RED : TEXT }]}>
          {String(index + 1).padStart(2, '0')}
        </Text>
      </View>
      <View style={styles.orgContent}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.statusPill, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '50' }]}>
            <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>📅 {fmtDate(item.startDate)}</Text>
          <Text style={styles.metaText}>  📍 {item.city}</Text>
        </View>
        <View style={styles.orgFooter}>
          <Text style={styles.regCount}>{regCount}</Text>
          <Text style={styles.regCountLabel}> REGISTERED</Text>
        </View>
      </View>
      <View style={styles.cardArrow}>
        <Text style={styles.arrowText}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Past card ────────────────────────────────────────────────────────────────
function PastCard({ item, onPress }: { item: any; onPress: () => void }) {
  const t: Tournament = item.tournament ?? item;
  return (
    <TouchableOpacity style={styles.pastCard} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.pastCardBody}>
        <Text style={styles.pastCardName} numberOfLines={1}>{t.name}</Text>
        <Text style={styles.pastCardDate}>📅 {fmtDate(t.startDate)} · {t.city}</Text>
      </View>
      <Text style={styles.arrowText}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Compact tournament row (list/table style, matches draws brackets theme) ──
function CompactTournamentRow({
  tournament,
  onPress,
}: {
  tournament: Tournament;
  onPress: () => void;
}) {
  const cfg = STATUS_CONFIG[tournament.status] ?? STATUS_CONFIG.draft;
  const registered = (tournament.categories ?? []).reduce(
    (sum: number, c: any) => sum + (c.registeredTeams ?? 0),
    0,
  );
  const maxTeams = (tournament.categories ?? []).reduce(
    (sum: number, c: any) => sum + (c.maxTeams ?? 0),
    0,
  );
  return (
    <TouchableOpacity
      style={styles.compactRow}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Left accent bar */}
      <View style={[styles.compactAccentBar, { backgroundColor: cfg.color }]} />

      {/* Main content: name + date + city stacked */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.compactTopRow}>
          <Text style={styles.compactRowName} numberOfLines={1}>
            {tournament.name}
          </Text>
          <View style={[styles.compactRowBadge, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '40' }]}>
            <Text style={[styles.compactRowBadgeText, { color: cfg.color }]}>
              {cfg.label}
            </Text>
          </View>
        </View>
        <View style={styles.compactMetaRow}>
          <Text style={styles.compactMetaIcon}>📅</Text>
          <Text style={styles.compactMetaText} numberOfLines={1}>
            {fmtDate(tournament.startDate)}
          </Text>
        </View>
        <View style={styles.compactMetaRow}>
          <Text style={styles.compactMetaIcon}>📍</Text>
          <Text style={styles.compactMetaText} numberOfLines={1}>
            {tournament.city}
          </Text>
        </View>
        <View style={styles.compactMetaRow}>
          <Text style={styles.compactMetaIcon}>👥</Text>
          <Text style={styles.compactMetaText}>
            <Text style={styles.compactTeamsValue}>
              {registered}
              {maxTeams > 0 ? `/${maxTeams}` : ''}
            </Text>
            {'  teams registered'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function MyEventsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<Tab>('organizing');
  const [myRegistrations, setMyRegistrations] = useState<any[]>([]);
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(true);
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [myLeagues, setMyLeagues] = useState<League[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    const [regsResult, toursResult, leaguesResult] = await Promise.allSettled([
      registrationsApi.getMyRegistrations(),
      tournamentsApi.getMyTournaments(),
      getLeagues({ organizerId: user?.id }),
    ]);

    if (regsResult.status === 'fulfilled') {
      const raw = regsResult.value.data?.data ?? regsResult.value.data ?? [];
      setMyRegistrations(Array.isArray(raw) ? raw : []);
    }
    setLoadingRegs(false);

    if (toursResult.status === 'fulfilled') {
      const raw = toursResult.value.data?.data ?? toursResult.value.data ?? [];
      setAllTournaments(Array.isArray(raw) ? raw : []);
    }

    if (leaguesResult.status === 'fulfilled') {
      const raw = leaguesResult.value;
      setMyLeagues(Array.isArray(raw) ? raw : []);
    }
    setLoadingOrg(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Refetch when screen regains focus (e.g., after marking a tournament complete)
  const isMountedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (isMountedRef.current) {
        fetchAll();
      } else {
        isMountedRef.current = true;
      }
    }, [fetchAll]),
  );

  // Derived data
  const playingActive = myRegistrations.filter((r) => {
    const s = (r.tournament ?? r)?.status;
    return !isCompleted(s ?? '');
  });
  const playingPast = myRegistrations.filter((r) => {
    const s = (r.tournament ?? r)?.status;
    return isCompleted(s ?? '');
  });
  const orgPast = allTournaments.filter((t) => isCompleted(t.status));
  const orgActive = allTournaments.filter((t) => !isCompleted(t.status));

  // Summary counts
  const totalCount = new Set([
    ...myRegistrations.map((r) => (r.tournament ?? r)?.id),
    ...allTournaments.map((t) => t.id),
  ]).size;
  const activeCount = playingActive.filter((r) => (r.tournament ?? r)?.status === 'in_progress').length
    + orgActive.filter((t) => t.status === 'in_progress').length;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'organizing', label: 'ORGANIZING' },
    { id: 'playing', label: 'PLAYING' },
    { id: 'past', label: 'PAST' },
    { id: 'overview', label: 'OVERVIEW' },
  ];

  const showFAB = activeTab !== 'past';

  // ── OVERVIEW TAB ──
  const renderOverview = () => {
    if (loadingRegs && loadingOrg) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={BLUE_ACCENT} />
        </View>
      );
    }

    const topPlaying = playingActive.slice(0, 2);
    const topOrganizing = orgActive.slice(0, 2);

    return (
      <View style={styles.tabContent}>
        {/* PLAYING section */}
        <View style={styles.overviewSection}>
          <View style={styles.overviewSectionHeader}>
            <Text style={styles.overviewSectionTitle}>
              PLAYING {playingActive.length > 0 ? `(${playingActive.length})` : ''}
            </Text>
            {playingActive.length > 2 && (
              <TouchableOpacity onPress={() => setActiveTab('playing')}>
                <Text style={styles.seeAllLink}>SEE ALL →</Text>
              </TouchableOpacity>
            )}
          </View>
          {topPlaying.length === 0 ? (
            <View style={styles.overviewEmpty}>
              <Text style={styles.overviewEmptyText}>
                Not registered in any tournaments yet.
              </Text>
              <TouchableOpacity onPress={() => (navigation as any).navigate('Discover')}>
                <Text style={styles.seeAllLink}>DISCOVER TOURNAMENTS →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            topPlaying.map((item: any) => {
              const t: Tournament = item.tournament ?? item;
              return (
                <TournamentTile
                  key={item.id ?? t.id}
                  tournament={t}
                  variant="compact"
                  onPress={() => navigation.navigate('TournamentDetail', { tournamentId: t.id })}
                  badge="REGISTERED"
                  badgeColor="#06D6A0"
                />
              );
            })
          )}
        </View>

        {/* ORGANIZING section */}
        <View style={[styles.overviewSection, { marginTop: 20 }]}>
          <View style={styles.overviewSectionHeader}>
            <Text style={styles.overviewSectionTitle}>
              ORGANIZING {orgActive.length > 0 ? `(${orgActive.length})` : ''}
            </Text>
            {orgActive.length > 2 && (
              <TouchableOpacity onPress={() => setActiveTab('organizing')}>
                <Text style={styles.seeAllLink}>SEE ALL →</Text>
              </TouchableOpacity>
            )}
          </View>
          {topOrganizing.length === 0 ? (
            <View style={styles.overviewEmpty}>
              <Text style={styles.overviewEmptyText}>
                No tournaments organized yet.
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('CreateTournament')}>
                <Text style={styles.seeAllLink}>CREATE YOUR FIRST →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            topOrganizing.map((t) => (
              <TournamentTile
                key={t.id}
                tournament={t}
                variant="compact"
                onPress={() => navigation.navigate('TournamentManage', { tournamentId: t.id })}
              />
            ))
          )}
        </View>

        {/* Quick stats */}
        {(playingActive.length > 0 || orgActive.length > 0) && (
          <View style={styles.overviewStatsRow}>
            <View style={styles.overviewStat}>
              <Text style={styles.overviewStatValue}>{playingActive.length}</Text>
              <Text style={styles.overviewStatLabel}>Playing</Text>
            </View>
            <View style={[styles.overviewStat, { borderLeftWidth: 1, borderLeftColor: BORDER }]}>
              <Text style={styles.overviewStatValue}>{orgActive.length}</Text>
              <Text style={styles.overviewStatLabel}>Organizing</Text>
            </View>
            <View style={[styles.overviewStat, { borderLeftWidth: 1, borderLeftColor: BORDER }]}>
              <Text style={styles.overviewStatValue}>{playingPast.length + orgPast.length}</Text>
              <Text style={styles.overviewStatLabel}>Completed</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  // ── PLAYING TAB ──
  const renderPlaying = () => {
    if (loadingRegs) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={BLUE_ACCENT} />
        </View>
      );
    }
    if (playingActive.length === 0) {
      return (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>🏓</Text>
          <Text style={styles.emptyTitle}>NOT PLAYING YET</Text>
          <Text style={styles.emptySub}>Register for a tournament to see it here.</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => navigation.navigate('Discover')}
            activeOpacity={0.85}
          >
            <Text style={styles.emptyBtnText}>DISCOVER TOURNAMENTS</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.tabContent}>
        {playingActive.map((item: any) => {
          const t: Tournament = item.tournament ?? item;
          return (
            <TournamentTile
              key={item.id ?? t.id}
              tournament={t}
              variant="card"
              onPress={() => navigation.navigate('TournamentDetail', { tournamentId: t.id })}
              badge="REGISTERED"
              badgeColor="#06D6A0"
            />
          );
        })}
      </View>
    );
  };

  // ── ORGANIZING TAB ──
  const renderOrganizing = () => {
    if (loadingOrg) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={BLUE_ACCENT} />
        </View>
      );
    }

    // Sort: in_progress first, then registration_open, then others by startDate
    const statusRank: Record<string, number> = {
      in_progress: 0,
      registration_open: 1,
      registration_closed: 2,
      published: 3,
      draft: 4,
    };
    const sorted = [...orgActive].sort((a, b) => {
      const ra = statusRank[a.status] ?? 9;
      const rb = statusRank[b.status] ?? 9;
      if (ra !== rb) return ra - rb;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

    const topFive = sorted.slice(0, 5);

    return (
      <View style={styles.tabContent}>
        {/* Create new button */}
        <TouchableOpacity
          style={styles.createNewBtn}
          onPress={() => navigation.navigate('CreateTournament')}
          activeOpacity={0.85}
        >
          <Text style={styles.createNewBtnText}>+ CREATE NEW TOURNAMENT</Text>
        </TouchableOpacity>

        {orgActive.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🏆</Text>
            <Text style={styles.emptyTitle}>NO TOURNAMENTS YET</Text>
            <Text style={styles.emptySub}>Tap the button above to create your first tournament.</Text>
          </View>
        ) : (
          <>
            {/* Top 5 as a Hotstar-style stacked carousel */}
            {topFive.length > 0 && (
              <View style={{ marginHorizontal: -20, marginBottom: 8 }}>
                <TournamentCarousel
                  tournaments={topFive}
                  onPress={(t) =>
                    navigation.navigate('TournamentManage', { tournamentId: t.id })
                  }
                />
              </View>
            )}

            {/* Full compact list of ALL tournaments */}
            <View style={styles.compactListSection}>
              <View style={styles.compactListHeader}>
                <Text style={styles.compactListHeaderText}>
                  ALL TOURNAMENTS
                </Text>
                <Text style={styles.compactListHeaderCount}>
                  {orgActive.length} total
                </Text>
              </View>
              {sorted.map((t) => (
                <CompactTournamentRow
                  key={t.id}
                  tournament={t}
                  onPress={() =>
                    navigation.navigate('TournamentManage', { tournamentId: t.id })
                  }
                />
              ))}
            </View>
          </>
        )}

        {/* ── LEAGUES section ── */}
        {myLeagues.length > 0 && (
          <View style={styles.compactListSection}>
            <View style={styles.compactListHeader}>
              <Text style={styles.compactListHeaderText}>MY LEAGUES</Text>
              <Text style={styles.compactListHeaderCount}>
                {myLeagues.length} total
              </Text>
            </View>
            {myLeagues.map((league) => (
              <View key={league.id} style={styles.leagueRow}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                  activeOpacity={0.7}
                  onPress={() =>
                    navigation.navigate('LeagueDashboard', {
                      leagueId: league.id,
                    })
                  }
                >
                  <View style={styles.leagueRowDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leagueRowName}>{league.name}</Text>
                    <Text style={styles.leagueRowSub}>
                      {league.city || 'League'} · {league.status?.toUpperCase()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.leagueStatusBadge,
                      league.status === 'active' && { backgroundColor: '#DCFCE7' },
                      league.status === 'draft' && { backgroundColor: '#FEF3C7' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.leagueStatusText,
                        league.status === 'active' && { color: '#16A34A' },
                        league.status === 'draft' && { color: '#D97706' },
                      ]}
                    >
                      {league.status?.toUpperCase() || 'DRAFT'}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.leagueDeleteBtn}
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      if (window.confirm(`Delete league "${league.name}"?`)) {
                        deleteLeague(league.id).then(() => fetchAll()).catch(() => {});
                      }
                    } else {
                      Alert.alert('Delete League', `Delete "${league.name}"?`, [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => deleteLeague(league.id).then(() => fetchAll()).catch(() => {}),
                        },
                      ]);
                    }
                  }}
                >
                  <Text style={styles.leagueDeleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Create League button */}
        <TouchableOpacity
          style={[styles.createNewBtn, { backgroundColor: '#EDE9FE', marginTop: 8 }]}
          onPress={() => navigation.navigate('CreateLeague')}
          activeOpacity={0.85}
        >
          <Text style={[styles.createNewBtnText, { color: '#7C3AED' }]}>
            🏅 CREATE NEW LEAGUE
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── PAST TAB ──
  const renderPast = () => {
    if (loadingRegs || loadingOrg) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={BLUE_ACCENT} />
        </View>
      );
    }
    const nothingPast = playingPast.length === 0 && orgPast.length === 0;
    if (nothingPast) {
      return (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>NO PAST EVENTS</Text>
          <Text style={styles.emptySub}>Completed tournaments will appear here.</Text>
        </View>
      );
    }
    return (
      <View style={styles.tabContent}>
        {playingPast.length > 0 && (
          <>
            <SectionLabel text="AS PLAYER" />
            {playingPast.map((item: any) => {
              const t: Tournament = item.tournament ?? item;
              return (
                <PastCard
                  key={item.id ?? t.id}
                  item={item}
                  onPress={() => navigation.navigate('TournamentDetail', { tournamentId: t.id })}
                />
              );
            })}
          </>
        )}
        {orgPast.length > 0 && (
          <>
            <SectionLabel text="AS ORGANIZER" />
            {orgPast.map((t) => (
              <TournamentTile
                key={t.id}
                tournament={t}
                variant="card"
                onPress={() => navigation.navigate('TournamentManage', { tournamentId: t.id })}
              />
            ))}
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: BG }]}>
        <StatusBar barStyle="dark-content" backgroundColor={BG} />

        {/* ── HEADER ── */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>YOUR TOURNAMENT WORLD</Text>
          <Text style={styles.heroTitle}>MY EVENTS</Text>
          <Text style={styles.heroSubtitle}>
            {totalCount} tournament{totalCount !== 1 ? 's' : ''} · {activeCount} active
          </Text>

          {/* Tab bar */}
          <View style={styles.tabBar}>
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={styles.tabItem}
                  onPress={() => setActiveTab(tab.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {tab.label}
                  </Text>
                  {active && <View style={styles.tabUnderline} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── CONTENT ── */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchAll(true)}
              tintColor={BLUE_ACCENT}
              colors={[BLUE_ACCENT]}
            />
          }
        >
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'playing' && renderPlaying()}
          {activeTab === 'organizing' && renderOrganizing()}
          {activeTab === 'past' && renderPast()}
        </ScrollView>

        {/* ── FLOATING ACTION BUTTON ── */}
        {showFAB && (
          <TouchableOpacity
            style={styles.fab}
            onPress={() => navigation.navigate('CreateTournament')}
            activeOpacity={0.85}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },

  // Header
  header: {
    backgroundColor: 'transparent',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 16 : 16,
    paddingBottom: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '700',
    color: TEXT3,
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '900',
    fontStyle: 'italic',
    color: TEXT,
    letterSpacing: -1,
    lineHeight: 36,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT3,
    marginBottom: 20,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: TEXT3,
    letterSpacing: 1.2,
  },
  tabLabelActive: {
    color: TEXT,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 12,
    right: 12,
    height: 2.5,
    backgroundColor: BLUE_ACCENT,
    borderRadius: 2,
  },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 160,
  },
  tabContent: { gap: 10 },
  centered: { paddingTop: 60, alignItems: 'center' },

  // Playing card
  playingCard: {
    backgroundColor: BG,
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
  },
  playingCardAccent: {
    width: 5,
  },
  playingCardBody: {
    flex: 1,
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  cardName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
  },
  statusPill: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  categoryRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  categoryPill: {
    backgroundColor: BLUE_ACCENT + '15',
    borderWidth: 1,
    borderColor: BLUE_ACCENT + '40',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  categoryPillText: {
    fontSize: 8,
    fontWeight: '800',
    color: BLUE_ACCENT,
    letterSpacing: 0.8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  metaText: {
    fontSize: 11,
    color: TEXT2,
    fontWeight: '500',
  },
  liveFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  liveBadge: {
    backgroundColor: '#FEE2E220',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: RED,
    letterSpacing: 0.5,
  },
  bracketBtn: {
    backgroundColor: RED,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  bracketBtnText: {
    fontSize: 9,
    fontWeight: '900',
    color: TEXT,
    letterSpacing: 0.8,
  },
  awaitRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  awaitText: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT2,
    letterSpacing: 0.5,
  },

  // Organizer card
  orgCard: {
    backgroundColor: BG,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
  },
  orgCardLive: {
    borderWidth: 1.5,
    borderColor: RED + '30',
  },
  orgIndex: {
    width: 48,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgIndexText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  orgContent: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 8,
  },
  orgFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  regCount: {
    fontSize: 18,
    fontWeight: '900',
    color: TEXT,
  },
  regCountLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: TEXT3,
    letterSpacing: 1,
  },
  cardArrow: {
    paddingHorizontal: 10,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 22,
    color: TEXT3,
  },

  // Create new button
  createNewBtn: {
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  createNewBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },

  // Compact tournament list (same theme as draws brackets)
  compactListSection: {
    marginTop: 16,
  },
  compactListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  compactListHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    color: TEXT2,
    letterSpacing: 1.8,
  },
  compactListHeaderCount: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT3,
    letterSpacing: 0.8,
  },
  compactRow: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    paddingLeft: 0,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  compactAccentBar: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 12,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  compactTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  compactRowName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    color: TEXT,
    letterSpacing: -0.2,
  },
  compactMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  compactMetaIcon: {
    fontSize: 11,
    width: 16,
  },
  compactMetaText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: TEXT2,
  },
  compactTeamsValue: {
    fontWeight: '900',
    color: NAVY,
  },
  compactRowBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  compactRowBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // Past card
  pastCard: {
    backgroundColor: BG,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  pastCardBody: { flex: 1 },
  pastCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 4,
  },
  pastCardDate: {
    fontSize: 11,
    color: TEXT3,
    fontWeight: '500',
  },

  // Section label
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
    marginTop: 10,
  },
  sectionLabelText: {
    fontSize: 9,
    fontWeight: '900',
    color: TEXT3,
    letterSpacing: 2.5,
  },
  sectionLabelLine: {
    flex: 1,
    height: 1,
    backgroundColor: BORDER,
  },

  // Empty
  emptyBox: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  emptyIcon: { fontSize: 44, marginBottom: 14 },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '900',
    fontStyle: 'italic',
    color: TEXT,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: TEXT2,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  emptyBtn: {
    backgroundColor: BLUE_ACCENT,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 999,
  },
  emptyBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: TEXT,
    letterSpacing: 1,
  },

  // FAB
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
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
    lineHeight: 32,
    marginTop: -2,
  },

  // Overview tab styles
  overviewSection: {},
  overviewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  overviewSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: 2,
  },
  seeAllLink: {
    fontSize: 11,
    fontWeight: '700',
    color: BLUE_ACCENT,
    letterSpacing: 0.5,
  },
  overviewEmpty: {
    backgroundColor: BG,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  overviewEmptyText: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT2,
    textAlign: 'center',
  },
  overviewStatsRow: {
    flexDirection: 'row',
    backgroundColor: BG,
    borderRadius: 14,
    marginTop: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  overviewStat: {
    flex: 1,
    alignItems: 'center',
  },
  overviewStatValue: {
    fontSize: 24,
    fontWeight: '900',
    color: TEXT,
    marginBottom: 2,
  },
  overviewStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT2,
    letterSpacing: 0.5,
  },
  // League rows
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  leagueRowDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#7C3AED',
    marginRight: 12,
  },
  leagueRowName: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
  },
  leagueRowSub: {
    fontSize: 12,
    color: TEXT2,
    marginTop: 2,
  },
  leagueStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: SURFACE,
  },
  leagueStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT3,
    letterSpacing: 0.5,
  },
  leagueDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  leagueDeleteText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
});
