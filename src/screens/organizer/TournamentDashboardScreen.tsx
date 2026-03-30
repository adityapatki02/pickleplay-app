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
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useTournamentStore } from '../../store/tournamentStore';
import { Tournament, TournamentStatus, TournamentCategory } from '../../types/tournament.types';
import { colors, spacing, typography, borderRadius, shadows } from '../../config/theme';
import { OrgTournamentsStackParamList } from '../../navigation/types';
import apiClient from '../../api/client';

type NavProp = NativeStackNavigationProp<OrgTournamentsStackParamList, 'TournamentManage'>;
type RouteType = RouteProp<OrgTournamentsStackParamList, 'TournamentManage'>;

// Status transitions
const STATUS_ACTIONS: Record<TournamentStatus, { label: string; next: TournamentStatus } | null> = {
  draft: { label: 'Publish', next: 'published' },
  published: { label: 'Open Registration', next: 'registration_open' },
  registration_open: { label: 'Close Registration', next: 'registration_closed' },
  registration_closed: { label: 'Start Tournament', next: 'in_progress' },
  in_progress: { label: 'Complete Tournament', next: 'completed' },
  completed: null,
  cancelled: null,
};

interface DashboardStats {
  totalRegistrations: number;
  confirmedCount: number;
  pendingCount: number;
  revenue: number;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <View style={statStyles.card}>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
      {sub ? <Text style={statStyles.sub}>{sub}</Text> : null}
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  value: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '800',
    color: colors.primary,
  },
  label: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 2,
    textAlign: 'center',
  },
  sub: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 2,
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
          pendingCount: d.pendingCount ?? d.pending ?? 0,
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
      `Change status to "${action.next.replace(/_/g, ' ')}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.label,
          onPress: async () => {
            setStatusUpdating(true);
            try {
              const res = await apiClient.patch(`/tournaments/${tournamentId}/status`, {
                status: action.next,
              });
              const updated = res.data?.data ?? res.data;
              const newStatus: TournamentStatus = updated?.status ?? action.next;
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
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView style={styles.safeArea}>
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
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* Nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backTouchable}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backIcon}>{'←'}</Text>
          <Text style={styles.backLabel}>BACK</Text>
        </TouchableOpacity>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            tintColor={colors.onPrimary}
            colors={[colors.onPrimary]}
          />
        }
      >
        {/* Hero header */}
        <View style={styles.heroSection}>
          <Text style={styles.tournamentName}>{tournament.name.toUpperCase()}</Text>
          <View style={styles.heroMeta}>
            <StatusBadge status={tournament.status} size="md" />
            <Text style={styles.heroDates}>
              {tournament.startDate} – {tournament.endDate}
            </Text>
          </View>
          <Text style={styles.heroVenue}>{tournament.venueName}, {tournament.city}</Text>
        </View>

        {/* Status action button */}
        {statusAction && (
          <View style={styles.actionSection}>
            <Button
              title={statusUpdating ? 'Updating…' : statusAction.label}
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleStatusAction}
              disabled={statusUpdating}
            />
          </View>
        )}

        {/* Stats row */}
        {stats && (
          <View style={styles.statsRow}>
            <StatCard
              label="Registrations"
              value={stats.totalRegistrations}
            />
            <StatCard
              label="Confirmed"
              value={stats.confirmedCount}
            />
            {stats.revenue > 0 && (
              <StatCard
                label="Revenue"
                value={`₹${stats.revenue.toLocaleString()}`}
              />
            )}
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MANAGE</Text>
          <Card variant="filled" style={styles.quickLinksCard}>
            <TouchableOpacity
              style={styles.quickLink}
              onPress={() => (navigation as any).navigate('RegistrationManage', { tournamentId })}
              activeOpacity={0.75}
            >
              <View style={styles.quickLinkLeft}>
                <Text style={styles.quickLinkIcon}>📋</Text>
                <View>
                  <Text style={styles.quickLinkLabel}>Registrations</Text>
                  <Text style={styles.quickLinkSub}>
                    {stats ? `${stats.totalRegistrations} total · ${stats.confirmedCount} confirmed` : 'View all'}
                  </Text>
                </View>
              </View>
              <Text style={styles.quickLinkChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.quickLink}
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
              activeOpacity={0.75}
            >
              <View style={styles.quickLinkLeft}>
                <Text style={styles.quickLinkIcon}>🏆</Text>
                <View>
                  <Text style={styles.quickLinkLabel}>Brackets & Draw</Text>
                  <Text style={styles.quickLinkSub}>Generate draw, manage scores</Text>
                </View>
              </View>
              <Text style={styles.quickLinkChevron}>›</Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Categories */}
        {categories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CATEGORIES</Text>
            {categories.map((cat) => (
              <Card key={cat.id} variant="outlined" style={styles.categoryCard}>
                <View style={styles.categoryRow}>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryName}>{cat.name}</Text>
                    <Text style={styles.categoryMeta}>
                      {cat.format.toUpperCase()} · {cat.gender.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.categoryRight}>
                    <Text style={styles.categoryTeams}>
                      {cat.registeredTeams ?? 0}/{cat.maxTeams}
                    </Text>
                    <Text style={styles.categoryTeamsLabel}>teams</Text>
                    <TouchableOpacity
                      onPress={() =>
                        (navigation as any).navigate('BracketManage', {
                          tournamentId,
                          categoryId: cat.id,
                        })
                      }
                      style={styles.categoryAction}
                    >
                      <Text style={styles.categoryActionText}>BRACKET</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
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
    backgroundColor: colors.primary,
  },
  backTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backIcon: {
    fontSize: typography.fontSize.lg,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  backLabel: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.onPrimary,
    letterSpacing: 1.5,
  },
  navSpacer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing['3xl'],
  },
  heroSection: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing['2xl'],
  },
  tournamentName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '900',
    color: colors.onPrimary,
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
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surfaceContainerLowest,
    ...shadows.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
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
  quickLinksCard: {
    overflow: 'hidden',
  },
  quickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    justifyContent: 'space-between',
  },
  quickLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  quickLinkIcon: {
    fontSize: 22,
  },
  quickLinkLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.text,
  },
  quickLinkSub: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 1,
  },
  quickLinkChevron: {
    fontSize: typography.fontSize.xl,
    color: colors.textTertiary,
    fontWeight: '300',
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.base,
  },
  categoryCard: {
    marginBottom: spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.text,
  },
  categoryMeta: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    color: colors.textTertiary,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  categoryRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  categoryTeams: {
    fontSize: typography.fontSize.lg,
    fontWeight: '800',
    color: colors.primary,
  },
  categoryTeamsLabel: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  categoryAction: {
    marginTop: spacing.xs,
    backgroundColor: colors.primaryFixed,
    borderRadius: borderRadius.DEFAULT,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  categoryActionText: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
  },
});
