import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { registrationsApi } from '../../api/registrations.api';
import { tournamentsApi } from '../../api/tournaments.api';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { TournamentCategory } from '../../types/tournament.types';
import { colors, spacing, typography, borderRadius, shadows } from '../../config/theme';
import { OrgTournamentsStackParamList } from '../../navigation/types';

const NAVY = '#001E40';

type NavProp = NativeStackNavigationProp<OrgTournamentsStackParamList, 'RegistrationManage'>;
type RouteType = RouteProp<OrgTournamentsStackParamList, 'RegistrationManage'>;

interface Registration {
  id: string;
  categoryId: string;
  status: string;
  createdAt: string;
  playerName?: string;
  teamName?: string;
  partnerName?: string;
  player?: { name?: string; displayName?: string; phone?: string };
  partner?: { name?: string; displayName?: string };
  category?: { name?: string };
}

const STATUS_FILTERS = [
  { label: 'ALL', value: 'all' },
  { label: 'CONFIRMED', value: 'confirmed' },
  { label: 'PENDING', value: 'pending' },
  { label: 'WAITLISTED', value: 'waitlisted' },
  { label: 'CANCELLED', value: 'cancelled' },
];

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getPlayerName(reg: Registration): string {
  return reg.playerName ?? reg.player?.displayName ?? reg.player?.name ?? reg.teamName ?? 'Unknown Player';
}

export default function RegistrationManagementScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const { tournamentId } = route.params;

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [categories, setCategories] = useState<TournamentCategory[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [regRes, catRes] = await Promise.allSettled([
        registrationsApi.getByTournament(tournamentId),
        tournamentsApi.listCategories(tournamentId),
      ]);

      if (regRes.status === 'fulfilled') {
        const data = regRes.value.data?.data ?? regRes.value.data ?? [];
        setRegistrations(Array.isArray(data) ? data : []);
      }

      if (catRes.status === 'fulfilled') {
        const data = catRes.value.data?.data ?? catRes.value.data ?? [];
        setCategories(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusUpdate = async (registrationId: string, newStatus: string) => {
    setUpdatingId(registrationId);
    try {
      await registrationsApi.updateStatus(registrationId, newStatus);
      setRegistrations((prev) =>
        prev.map((r) => (r.id === registrationId ? { ...r, status: newStatus } : r))
      );
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to update');
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmAction = (registrationId: string, action: string, label: string) => {
    Alert.alert(
      `${label} Registration`,
      `Are you sure you want to ${label.toLowerCase()} this registration?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: label,
          style: action === 'cancelled' ? 'destructive' : 'default',
          onPress: () => handleStatusUpdate(registrationId, action),
        },
      ]
    );
  };

  const filtered = registrations.filter((r) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return r.status === 'pending' || r.status === 'pending_payment';
    return r.status === statusFilter;
  });

  const getCategoryName = (reg: Registration): string => {
    return reg.category?.name ?? categories.find((c) => c.id === reg.categoryId)?.name ?? '—';
  };

  const renderItem = ({ item }: { item: Registration }) => {
    const isPending = item.status === 'pending' || item.status === 'pending_payment';
    const isConfirmed = item.status === 'confirmed';
    const isUpdating = updatingId === item.id;

    return (
      <View style={styles.regCard}>
        <View style={styles.regTop}>
          <View style={styles.regLeft}>
            <Text style={styles.playerName}>{getPlayerName(item)}</Text>
            {(item.partnerName || item.partner) && (
              <Text style={styles.partnerName}>
                + {item.partnerName ?? item.partner?.displayName ?? item.partner?.name}
              </Text>
            )}
            <Text style={styles.regMeta}>
              {getCategoryName(item)}  ·  {formatDate(item.createdAt)}
            </Text>
          </View>
          <StatusBadge status={item.status} size="sm" />
        </View>

        {(isPending || isConfirmed) && (
          <View style={styles.regActions}>
            {isUpdating ? (
              <ActivityIndicator size="small" color={NAVY} />
            ) : (
              <>
                {isPending && (
                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={() => confirmAction(item.id, 'confirmed', 'Confirm')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.confirmBtnText}>CONFIRM</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => confirmAction(item.id, 'cancelled', 'Cancel')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelBtnText}>CANCEL</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backIcon}>←</Text>
          <Text style={styles.backLabel}>BACK</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>REGISTRATIONS</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Status filter chips */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {STATUS_FILTERS.map((opt) => {
            const active = statusFilter === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setStatusFilter(opt.value)}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Count */}
      {!loading && (
        <View style={styles.countBar}>
          <Text style={styles.countText}>
            {filtered.length} {filtered.length === 1 ? 'registration' : 'registrations'}
          </Text>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={NAVY} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            filtered.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData(true)}
              tintColor={NAVY}
              colors={[NAVY]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="📋"
              title="No registrations"
              subtitle={statusFilter === 'all' ? 'Registrations will appear here once players sign up.' : `No ${statusFilter} registrations.`}
            />
          }
        />
      )}
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
  header: {
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
    flex: 1,
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
  headerTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  filterBar: {
    backgroundColor: colors.surfaceContainerLowest,
    ...shadows.sm,
  },
  filterContent: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  filterChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHigh,
  },
  filterChipActive: {
    backgroundColor: NAVY,
  },
  filterChipText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  countBar: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceContainerLow,
  },
  countText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  listContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing['2xl'],
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  regCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  regTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  regLeft: {
    flex: 1,
  },
  playerName: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.text,
  },
  partnerName: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 1,
  },
  regMeta: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  regActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    justifyContent: 'flex-end',
  },
  confirmBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.DEFAULT,
    backgroundColor: '#198754',
  },
  confirmBtnText: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  cancelBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.DEFAULT,
    backgroundColor: colors.errorContainer,
  },
  cancelBtnText: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.error,
    letterSpacing: 1,
  },
});
