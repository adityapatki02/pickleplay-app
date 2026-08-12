import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { xAlert, xConfirm } from '../../utils/alert';
import { tournamentsApi } from '../../api/tournaments.api';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useTournamentStore } from '../../store/tournamentStore';
import { Tournament, TournamentStatus, TournamentCategory } from '../../types/tournament.types';
import { colors, spacing, typography, borderRadius } from '../../config/theme';
import { MyEventsStackParamList } from '../../navigation/types';

const BLUE_ACCENT = '#1858D6';
const NAVY = '#001E40';

type NavProp = NativeStackNavigationProp<MyEventsStackParamList, 'TournamentManage'>;
type RouteType = RouteProp<MyEventsStackParamList, 'TournamentManage'>;

const STATUS_ACTIONS: Record<TournamentStatus, { label: string; next: TournamentStatus; desc: string } | null> = {
  draft: { label: 'PUBLISH', next: 'published', desc: 'Make tournament visible to players' },
  published: { label: 'OPEN REGISTRATION', next: 'registration_open', desc: 'Allow players to register' },
  registration_open: { label: 'CLOSE REGISTRATION', next: 'registration_closed', desc: 'Stop accepting registrations' },
  registration_closed: { label: 'GENERATE BRACKETS', next: 'in_progress', desc: 'Generate draw and start tournament' },
  in_progress: { label: 'MARK COMPLETE', next: 'completed', desc: 'Mark tournament as finished' },
  completed: null,
  cancelled: null,
};

interface DashboardStats {
  totalRegistrations: number;
  confirmedCount: number;
  waitlistedCount: number;
  revenue: number;
}

export default function TournamentDashboardScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const { tournamentId } = route.params;
  const { updateTournament } = useTournamentStore();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [hasDraws, setHasDraws] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const tournRes = await tournamentsApi.getById(tournamentId);
      const t = tournRes.data?.data ?? tournRes.data;
      setTournament(t);

      try {
        const { registrationsApi } = await import('../../api/registrations.api');
        const regsRes = await registrationsApi.getByTournament(tournamentId);
        const regs = regsRes.data?.data ?? regsRes.data ?? [];
        const regsList = Array.isArray(regs) ? regs : [];
        setStats({
          totalRegistrations: regsList.length,
          confirmedCount: regsList.filter((r: any) => r.status === 'confirmed').length,
          waitlistedCount: regsList.filter((r: any) => r.status === 'waitlisted').length,
          revenue: 0,
        });
      } catch (regErr: any) {
        console.warn('Registration fetch failed:', regErr?.response?.status, regErr?.response?.data?.message);
        setStats({ totalRegistrations: 0, confirmedCount: 0, waitlistedCount: 0, revenue: 0 });
      }

      try {
        if (t.categories && t.categories.length > 0) {
          const { matchesApi } = await import('../../api/matches.api');
          const bracketRes = await matchesApi.getBracket(tournamentId, t.categories[0].id);
          const bracketData = bracketRes.data?.data ?? bracketRes.data;
          setHasDraws(!!(bracketData?.pools?.length > 0 || bracketData?.knockout?.length > 0));
        }
      } catch {
        setHasDraws(false);
      }
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to load tournament');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tournamentId]);

  // Fetch on mount + refresh when screen regains focus
  const isMounted = React.useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (isMounted.current) {
        fetchData(true);
      } else {
        isMounted.current = true;
        fetchData();
      }
    }, [fetchData]),
  );

  const handleStatusAction = async () => {
    if (!tournament) return;
    const action = STATUS_ACTIONS[tournament.status];
    if (!action) return;

    xConfirm(
      action.label,
      action.desc,
      async () => {
        setStatusUpdating(true);
        try {
          await tournamentsApi.changeStatus(tournamentId, action.next);
          const newStatus = action.next;
          setTournament((prev) => prev ? { ...prev, status: newStatus } : prev);
          updateTournament(tournamentId, { status: newStatus });
        } catch (err: any) {
          xAlert('Error', err?.response?.data?.message ?? err?.message ?? 'Status update failed');
        } finally {
          setStatusUpdating(false);
        }
      },
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>{'\u2190'}</Text>
            <Text style={styles.backLabel}>BACK</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={BLUE_ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>{'\u2190'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Tournament not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusAction = STATUS_ACTIONS[tournament.status];
  const categories: TournamentCategory[] = tournament.categories ?? [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backIcon}>{'\u2190'}</Text>
          <Text style={styles.backLabel}>BACK</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            tintColor={BLUE_ACCENT}
            colors={[BLUE_ACCENT]}
          />
        }
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName}>{tournament.name}</Text>
              <Text style={styles.heroVenue}>{tournament.venueName}, {tournament.city}</Text>
            </View>
            <StatusBadge status={tournament.status} size="md" />
          </View>
          <Text style={styles.heroDates}>{tournament.startDate} — {tournament.endDate}</Text>
        </View>

        {/* Status action button */}
        {statusAction && (
          <View style={styles.actionSection}>
            <TouchableOpacity
              style={[styles.statusBtn, statusUpdating && styles.statusBtnDisabled]}
              onPress={handleStatusAction}
              disabled={statusUpdating}
              activeOpacity={0.85}
            >
              {statusUpdating ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.statusBtnText}>{statusAction.label}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Stats row — compact inline */}
        <View style={styles.statsRow}>
          <View style={[styles.statItem, styles.statItemAccent]}>
            <Text style={styles.statValue}>{stats?.totalRegistrations ?? 0}</Text>
            <Text style={styles.statLabel}>Registered</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats?.confirmedCount ?? 0}</Text>
            <Text style={styles.statLabel}>Confirmed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats?.waitlistedCount ?? 0}</Text>
            <Text style={styles.statLabel}>Waitlisted</Text>
          </View>
        </View>

        {/* Manage — 3 cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MANAGE</Text>
          <View style={styles.manageRow}>
            <TouchableOpacity
              style={styles.manageCard}
              onPress={() => (navigation as any).navigate('RegistrationManage', { tournamentId })}
              activeOpacity={0.8}
            >
              <View style={[styles.manageIconWrap, { backgroundColor: 'rgba(33,150,243,0.12)' }]}>
                <Text style={styles.manageIcon}>R</Text>
              </View>
              <Text style={styles.manageLabel}>Registrations</Text>
              {stats && (
                <Text style={styles.manageSub}>{stats.totalRegistrations} total</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.manageCard}
              onPress={() => (navigation as any).navigate('MatchHub', { tournamentId })}
              activeOpacity={0.8}
            >
              <View style={[styles.manageIconWrap, { backgroundColor: 'rgba(6,214,160,0.12)' }]}>
                <Text style={[styles.manageIcon, { color: '#06D6A0' }]}>M</Text>
              </View>
              <Text style={styles.manageLabel}>Match Hub</Text>
              <Text style={styles.manageSub}>Draw, schedule & scores</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Categories */}
        {categories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CATEGORIES ({categories.length})</Text>
            {categories.map((cat) => (
              <View key={cat.id} style={styles.catCard}>
                <View style={styles.catCardLeft}>
                  <Text style={styles.catName}>{cat.name}</Text>
                  <Text style={styles.catMeta}>
                    {cat.format.toUpperCase()} · {cat.gender.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.catCardRight}>
                  <Text style={styles.catTeams}>
                    {stats?.confirmedCount ?? 0}/{cat.maxTeams}
                  </Text>
                  <Text style={styles.catTeamsLabel}>registered</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    color: '#64748B',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + spacing.md : spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backIcon: {
    fontSize: typography.fontSize.lg,
    color: BLUE_ACCENT,
    fontWeight: '700',
  },
  backLabel: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: BLUE_ACCENT,
    letterSpacing: 1.5,
  },
  scrollContent: {
    paddingBottom: 140,
  },

  // Hero
  hero: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.lg,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  heroName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '900',
    color: NAVY,
    letterSpacing: typography.letterSpacing.tight,
    lineHeight: 28,
  },
  heroVenue: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 4,
  },
  heroDates: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: BLUE_ACCENT,
  },

  // Status button
  actionSection: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.lg,
  },
  statusBtn: {
    backgroundColor: BLUE_ACCENT,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  statusBtnDisabled: {
    opacity: 0.6,
  },
  statusBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },

  // Stats — compact inline bar
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemAccent: {},
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: '800',
    color: NAVY,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },

  // Sections
  section: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: NAVY,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },

  // Manage
  manageRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  manageCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  manageIconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  manageIcon: {
    fontSize: typography.fontSize.base,
    fontWeight: '900',
    color: BLUE_ACCENT,
  },
  manageLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    color: '#1A1D21',
    marginBottom: 2,
  },
  manageSub: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    color: '#64748B',
  },

  // Categories
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: spacing.base,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  catCardLeft: {
    flex: 1,
  },
  catName: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: '#1A1D21',
  },
  catMeta: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  catCardRight: {
    alignItems: 'flex-end',
  },
  catTeams: {
    fontSize: typography.fontSize.xl,
    fontWeight: '800',
    color: NAVY,
  },
  catTeamsLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
