import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { tournamentsApi } from '../../api/tournaments.api';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useTournamentStore } from '../../store/tournamentStore';
import { Tournament, TournamentStatus, TournamentCategory } from '../../types/tournament.types';
import { colors, spacing, typography, borderRadius, shadows } from '../../config/theme';
import { OrgTournamentsStackParamList } from '../../navigation/types';

const NAVY = '#001E40';
const BLUE_ACCENT = '#2196F3';

type NavProp = NativeStackNavigationProp<OrgTournamentsStackParamList, 'TournamentManage'>;
type RouteType = RouteProp<OrgTournamentsStackParamList, 'TournamentManage'>;

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

function StatBox({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <View style={[statBoxStyles.box, accent && statBoxStyles.boxAccent]}>
      <Text style={[statBoxStyles.value, accent && statBoxStyles.valueAccent]}>{value}</Text>
      <Text style={statBoxStyles.label}>{label}</Text>
    </View>
  );
}

const statBoxStyles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  boxAccent: {
    backgroundColor: NAVY,
  },
  value: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '900',
    color: NAVY,
  },
  valueAccent: {
    color: '#FFFFFF',
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 2,
    textAlign: 'center',
  },
});

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

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [tournRes, dashRes] = await Promise.allSettled([
        tournamentsApi.getById(tournamentId),
        tournamentsApi.getDashboard(tournamentId),
      ]);

      if (tournRes.status === 'fulfilled') {
        const t = tournRes.value.data?.data ?? tournRes.value.data;
        setTournament(t);
      }

      if (dashRes.status === 'fulfilled') {
        const d = dashRes.value.data?.data ?? dashRes.value.data ?? {};
        setStats({
          totalRegistrations: d.totalRegistrations ?? d.registrationsCount ?? 0,
          confirmedCount: d.confirmedCount ?? d.confirmed ?? 0,
          waitlistedCount: d.waitlistedCount ?? d.waitlisted ?? 0,
          revenue: d.revenue ?? d.totalRevenue ?? 0,
        });
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusAction = async () => {
    if (!tournament) return;
    const action = STATUS_ACTIONS[tournament.status];
    if (!action) return;

    Alert.alert(
      action.label,
      action.desc,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.label,
          onPress: async () => {
            setStatusUpdating(true);
            try {
              await tournamentsApi.changeStatus(tournamentId, action.next);
              const newStatus = action.next;
              setTournament((prev) => prev ? { ...prev, status: newStatus } : prev);
              updateTournament(tournamentId, { status: newStatus });
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Status update failed');
            } finally {
              setStatusUpdating(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
            <Text style={styles.backLabel}>BACK</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={NAVY} />
        </View>
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
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
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backIcon}>←</Text>
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
            tintColor={colors.primaryFixedDim}
            colors={[colors.primaryFixedDim]}
          />
        }
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroName}>{tournament.name.toUpperCase()}</Text>
          <View style={styles.heroMeta}>
            <StatusBadge status={tournament.status} size="md" />
            <Text style={styles.heroDates}>{tournament.startDate} – {tournament.endDate}</Text>
          </View>
          <Text style={styles.heroVenue}>{tournament.venueName}, {tournament.city}</Text>
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

        {/* Stats row */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>OVERVIEW</Text>
          <View style={styles.statsRow}>
            <StatBox
              label="Total Registrations"
              value={stats?.totalRegistrations ?? 0}
              accent
            />
            <StatBox label="Confirmed" value={stats?.confirmedCount ?? 0} />
            <StatBox label="Waitlisted" value={stats?.waitlistedCount ?? 0} />
          </View>
        </View>

        {/* Quick nav */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MANAGE</Text>
          <View style={styles.quickNavGrid}>
            <TouchableOpacity
              style={styles.quickNavCard}
              onPress={() => (navigation as any).navigate('RegistrationManage', { tournamentId })}
              activeOpacity={0.8}
            >
              <Text style={styles.quickNavIcon}>📋</Text>
              <Text style={styles.quickNavLabel}>REGISTRATIONS</Text>
              {stats && (
                <Text style={styles.quickNavSub}>
                  {stats.totalRegistrations} total
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickNavCard}
              onPress={() => {
                if (categories.length > 0) {
                  (navigation as any).navigate('BracketManage', {
                    tournamentId,
                    categoryId: categories[0].id,
                  });
                } else {
                  Alert.alert('No Categories', 'Add categories before managing brackets.');
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.quickNavIcon}>🏆</Text>
              <Text style={styles.quickNavLabel}>BRACKETS</Text>
              <Text style={styles.quickNavSub}>Draw & manage</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickNavCard}
              onPress={() => {
                if (categories.length > 0) {
                  (navigation as any).navigate('ScoreEntry', {
                    tournamentId,
                    categoryId: categories[0].id,
                  });
                } else {
                  Alert.alert('No Categories', 'Add categories first.');
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.quickNavIcon}>✏️</Text>
              <Text style={styles.quickNavLabel}>SCORE ENTRY</Text>
              <Text style={styles.quickNavSub}>Enter results</Text>
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
                    {cat.registeredTeams ?? 0}/{cat.maxTeams}
                  </Text>
                  <Text style={styles.catTeamsLabel}>teams</Text>
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
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: NAVY,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backIcon: {
    fontSize: typography.fontSize.lg,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  backLabel: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  scrollContent: {
    paddingBottom: spacing['3xl'],
  },
  hero: {
    backgroundColor: NAVY,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing['2xl'],
  },
  heroName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: typography.letterSpacing.tight,
    lineHeight: 28,
    marginBottom: spacing.sm,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  heroDates: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.primaryFixedDim,
  },
  heroVenue: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.primaryFixedDim,
    marginTop: 2,
  },
  actionSection: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceContainerLowest,
    ...shadows.sm,
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
  statsSection: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  section: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  quickNavGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickNavCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  quickNavIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  quickNavLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: NAVY,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 2,
  },
  quickNavSub: {
    fontSize: 9,
    fontWeight: '500',
    color: colors.textTertiary,
    textAlign: 'center',
  },
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  catCardLeft: {
    flex: 1,
  },
  catName: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.text,
  },
  catMeta: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    color: colors.textTertiary,
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
    color: colors.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
