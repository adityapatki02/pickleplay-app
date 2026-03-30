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

type NavProp = NativeStackNavigationProp<OrgTournamentsStackParamList, 'RegistrationManage'>;
type RouteType = RouteProp<OrgTournamentsStackParamList, 'RegistrationManage'>;

interface Registration {
  id: string;
  categoryId: string;
  categoryName?: string;
  status: string;
  createdAt: string;
  playerName?: string;
  teamName?: string;
  partnerName?: string;
  paymentMethod?: string;
  player?: { name?: string; displayName?: string; phone?: string };
  partner?: { name?: string; displayName?: string };
  category?: { name?: string };
}

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

export default function RegistrationManagementScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const { tournamentId } = route.params;

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [categories, setCategories] = useState<TournamentCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
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
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to load registrations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusUpdate = async (registrationId: string, newStatus: 'confirmed' | 'rejected') => {
    setUpdatingId(registrationId);
    try {
      await registrationsApi.updateStatus(registrationId, newStatus);
      setRegistrations((prev) =>
        prev.map((r) => (r.id === registrationId ? { ...r, status: newStatus } : r))
      );
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmAction = (registrationId: string, action: 'confirmed' | 'rejected') => {
    const label = action === 'confirmed' ? 'Confirm' : 'Reject';
    Alert.alert(
      `${label} Registration`,
      `Are you sure you want to ${label.toLowerCase()} this registration?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: label,
          style: action === 'rejected' ? 'destructive' : 'default',
          onPress: () => handleStatusUpdate(registrationId, action),
        },
      ]
    );
  };

  // Build category filter options
  const filterOptions: { id: string | null; label: string }[] = [
    { id: null, label: 'ALL' },
    ...categories.map((c) => ({ id: c.id, label: c.name })),
  ];

  const filtered = selectedCategoryId
    ? registrations.filter((r) => r.categoryId === selectedCategoryId || r.category?.name === selectedCategoryId)
    : registrations;

  const getPlayerName = (reg: Registration): string => {
    return (
      reg.playerName ??
      reg.player?.displayName ??
      reg.player?.name ??
      reg.teamName ??
      'Unknown Player'
    );
  };

  const getCategoryName = (reg: Registration): string => {
    return (
      reg.categoryName ??
      reg.category?.name ??
      categories.find((c) => c.id === reg.categoryId)?.name ??
      '—'
    );
  };

  const renderItem = ({ item }: { item: Registration }) => {
    const isPending = item.status === 'pending' || item.status === 'pending_payment';
    const isUpdating = updatingId === item.id;

    return (
      <View style={styles.regCard}>
        <View style={styles.regCardTop}>
          <View style={styles.regCardLeft}>
            <Text style={styles.playerName}>{getPlayerName(item)}</Text>
            {item.partnerName || item.partner ? (
              <Text style={styles.partnerName}>
                + {item.partnerName ?? item.partner?.displayName ?? item.partner?.name}
              </Text>
            ) : null}
            <Text style={styles.regMeta}>
              {getCategoryName(item)}  ·  {formatDate(item.createdAt)}
            </Text>
          </View>
          <StatusBadge status={item.status} size="sm" />
        </View>

        {isPending && (
          <View style={styles.regActions}>
            {isUpdating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.confirmBtn]}
                  onPress={() => confirmAction(item.id, 'confirmed')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmBtnText}>CONFIRM</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => confirmAction(item.id, 'rejected')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.rejectBtnText}>REJECT</Text>
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
        <Text style={styles.navTitle}>REGISTRATIONS</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Category filter tabs */}
      <View style={styles.filterBar}>
        <FlatList
          horizontal
          data={filterOptions}
          keyExtractor={(item) => item.id ?? 'all'}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item: opt }) => {
            const active = selectedCategoryId === opt.id;
            return (
              <TouchableOpacity
                style={[styles.filterTab, active && styles.filterTabActive]}
                onPress={() => setSelectedCategoryId(opt.id)}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Registrations count */}
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
          <ActivityIndicator size="large" color={colors.primary} />
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
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="📋"
              title="No registrations yet"
              subtitle="Registrations will appear here once players sign up."
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
    flex: 1,
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
  navTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: colors.onPrimary,
    letterSpacing: 1.5,
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
  filterTab: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHigh,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
  filterTabTextActive: {
    color: colors.onPrimary,
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
  regCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  regCardLeft: {
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
    letterSpacing: 0.3,
  },
  regActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    justifyContent: 'flex-end',
  },
  actionBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.DEFAULT,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
  },
  confirmBtnText: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.onPrimary,
    letterSpacing: 1,
  },
  rejectBtn: {
    backgroundColor: colors.errorContainer,
  },
  rejectBtnText: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: colors.error,
    letterSpacing: 1,
  },
});
