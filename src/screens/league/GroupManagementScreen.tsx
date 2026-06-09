import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
  getFranchises,
  getGroups,
  createGroups,
  assignFranchisesToGroups,
} from '../../api/leagues.api';
import { useLeagueStore } from '../../store/leagueStore';
import { colors, spacing, typography, borderRadius, shadows } from '../../config/theme';
import type { Franchise, LeagueGroup, GroupAssignment } from '../../types/league.types';
import type { LeagueStackParamList } from '../../navigation/types';

import { YColors, YTopBar } from '../../components/yoiden';

// ─── Design tokens ──────────────────────────────────────────────────────────
const NAVY: string = YColors.ink;
const BLUE: string = YColors.accent;
const GREEN = '#06D6A0';
const ORANGE = '#F59E0B';
const SURFACE: string = YColors.bg;
const BORDER: string = YColors.line2;
const TEXT_COLOR: string = YColors.ink;
const TEXT_SUB: string = YColors.ink2;

const POOL_NAMES = ['Pool A', 'Pool B', 'Pool C', 'Pool D'];
const POOL_COLORS = [BLUE, '#8B5CF6', '#F97316', '#06D6A0'];
const GROUP_LABELS: Record<string, string> = {
  'Pool A': 'GROUP 1',
  'Pool B': 'GROUP 1',
  'Pool C': 'GROUP 2',
  'Pool D': 'GROUP 2',
};
const MAX_PER_POOL = 4;
// Keep backward compat
const GROUP_NAMES = POOL_NAMES;
const GROUP_COLORS = POOL_COLORS;

type RouteType = RouteProp<LeagueStackParamList, 'GroupManagement'>;

interface GroupState {
  [groupName: string]: string[]; // franchiseIds
}

export default function GroupManagementScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteType>();
  const { leagueId, seasonId } = route.params;

  const storeFranchises = useLeagueStore((s) => s.franchises);
  const setFranchises = useLeagueStore((s) => s.setFranchises);
  const storeGroups = useLeagueStore((s) => s.groups);
  const setGroups = useLeagueStore((s) => s.setGroups);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Local assignment state
  const [groupAssignments, setGroupAssignments] = useState<GroupState>({
    'Pool A': [],
    'Pool B': [],
    'Pool C': [],
    'Pool D': [],
  });

  const fetchData = useCallback(async () => {
    try {
      const [franchiseRaw, groupRaw] = await Promise.all([
        getFranchises(leagueId),
        getGroups(leagueId, seasonId).catch(() => []),
      ]);
      const franchiseData = Array.isArray(franchiseRaw) ? franchiseRaw : [];
      const groupData = Array.isArray(groupRaw) ? groupRaw : [];
      setFranchises(franchiseData);
      setGroups(groupData);

      // Populate local state from existing groups
      const assignments: GroupState = {
        'Pool A': [],
        'Pool B': [],
        'Pool C': [],
        'Pool D': [],
      };
      groupData.forEach((g: any) => {
        if (g.franchises && assignments[g.name] !== undefined) {
          assignments[g.name] = g.franchises.map((f: any) => f.franchiseId || f.franchise?.id || f.id);
        }
      });
      setGroupAssignments(assignments);
    } catch (err) {
      console.error('Failed to load groups data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leagueId, seasonId, setFranchises, setGroups]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // ── Derived data ──

  const assignedIds = new Set(
    POOL_NAMES.flatMap((pn) => groupAssignments[pn] || []),
  );

  const unassigned = storeFranchises.filter((f) => !assignedIds.has(f.id));

  const getFranchiseById = (id: string): Franchise | undefined =>
    storeFranchises.find((f) => f.id === id);

  // ── Actions ──

  const assignToGroup = (franchiseId: string, groupName: string) => {
    // Remove from any existing group first
    setGroupAssignments((prev) => {
      const updated = { ...prev };
      GROUP_NAMES.forEach((gn) => {
        updated[gn] = updated[gn].filter((id) => id !== franchiseId);
      });
      updated[groupName] = [...updated[groupName], franchiseId];
      return updated;
    });
  };

  const removeFromGroup = (franchiseId: string, groupName: string) => {
    setGroupAssignments((prev) => ({
      ...prev,
      [groupName]: prev[groupName].filter((id) => id !== franchiseId),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // Ensure groups exist
      const existingGroupNames = storeGroups.map((g) => g.name);
      const missingGroups = GROUP_NAMES.filter(
        (gn) => !existingGroupNames.includes(gn),
      );
      if (missingGroups.length > 0) {
        const newGroups = await createGroups(leagueId, seasonId, GROUP_NAMES);
        setGroups(newGroups);
      }

      // Assign franchises
      const assignments: GroupAssignment[] = GROUP_NAMES.map((gn) => ({
        groupName: gn,
        franchiseIds: groupAssignments[gn],
      }));

      await assignFranchisesToGroups(leagueId, seasonId, assignments);
      navigation.goBack();
    } catch (err: any) {
      setError(err?.message || 'Failed to save groups');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>GROUPS</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BLUE} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn}>
          <Text style={styles.headerBackText}>BACK</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>GROUP ASSIGNMENT</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} />
        }
      >
        {/* Unassigned */}
        {unassigned.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>UNASSIGNED ({unassigned.length})</Text>
            <View style={styles.franchiseGrid}>
              {unassigned.map((f) => (
                <View key={f.id} style={styles.unassignedCard}>
                  <View
                    style={[
                      styles.miniLogo,
                      { backgroundColor: f.primaryColor || BLUE },
                    ]}
                  >
                    <Text style={styles.miniLogoText}>
                      {(f.shortName || f.name).substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.unassignedName} numberOfLines={1}>
                    {f.shortName || f.name}
                  </Text>
                  <View style={styles.assignBtns}>
                    {POOL_NAMES.map((gn, gi) => (
                      <TouchableOpacity
                        key={gn}
                        style={[
                          styles.assignBtn,
                          { backgroundColor: POOL_COLORS[gi] },
                          groupAssignments[gn].length >= MAX_PER_POOL && { opacity: 0.3 },
                        ]}
                        onPress={() => {
                          if (groupAssignments[gn].length < MAX_PER_POOL) {
                            assignToGroup(f.id, gn);
                          }
                        }}
                        activeOpacity={0.8}
                        disabled={groupAssignments[gn].length >= MAX_PER_POOL}
                      >
                        <Text style={styles.assignBtnText}>
                          {gn.replace('Pool ', '')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Group 1: Pool A + Pool B */}
        <Text style={{ fontSize: 13, fontWeight: '800', color: NAVY, letterSpacing: 1, marginBottom: 8, marginTop: 16 }}>
          GROUP 1 (Pool A vs Pool B)
        </Text>
        <View style={styles.groupsRow}>
          {POOL_NAMES.slice(0, 2).map((gn, gi) => (
            <View key={gn} style={styles.groupColumn}>
              <View
                style={[
                  styles.groupHeader,
                  { backgroundColor: POOL_COLORS[gi] },
                ]}
              >
                <Text style={styles.groupHeaderText}>{gn.toUpperCase()}</Text>
                <Text style={styles.groupCount}>
                  {groupAssignments[gn].length}/{MAX_PER_POOL}
                </Text>
              </View>
              {groupAssignments[gn].length === 0 ? (
                <Text style={styles.groupEmpty}>No teams</Text>
              ) : (
                groupAssignments[gn].map((fId) => {
                  const f = getFranchiseById(fId);
                  if (!f) return null;
                  return (
                    <View key={fId} style={styles.groupItem}>
                      <View style={[styles.groupItemDot, { backgroundColor: f.primaryColor || POOL_COLORS[gi] }]} />
                      <Text style={styles.groupItemName} numberOfLines={1}>{f.shortName || f.name}</Text>
                      <TouchableOpacity onPress={() => removeFromGroup(fId, gn)} style={styles.removeBtn}>
                        <Text style={styles.removeBtnText}>X</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>
          ))}
        </View>

        {/* Group 2: Pool C + Pool D */}
        <Text style={{ fontSize: 13, fontWeight: '800', color: NAVY, letterSpacing: 1, marginBottom: 8, marginTop: 20 }}>
          GROUP 2 (Pool C vs Pool D)
        </Text>
        <View style={styles.groupsRow}>
          {POOL_NAMES.slice(2, 4).map((gn, gi) => (
            <View key={gn} style={styles.groupColumn}>
              <View
                style={[
                  styles.groupHeader,
                  { backgroundColor: POOL_COLORS[gi + 2] },
                ]}
              >
                <Text style={styles.groupHeaderText}>{gn.toUpperCase()}</Text>
                <Text style={styles.groupCount}>
                  {groupAssignments[gn].length}/{MAX_PER_POOL}
                </Text>
              </View>
              {groupAssignments[gn].length === 0 ? (
                <Text style={styles.groupEmpty}>No teams</Text>
              ) : (
                groupAssignments[gn].map((fId) => {
                  const f = getFranchiseById(fId);
                  if (!f) return null;
                  return (
                    <View key={fId} style={styles.groupItem}>
                      <View style={[styles.groupItemDot, { backgroundColor: f.primaryColor || POOL_COLORS[gi + 2] }]} />
                      <Text style={styles.groupItemName} numberOfLines={1}>{f.shortName || f.name}</Text>
                      <TouchableOpacity onPress={() => removeFromGroup(fId, gn)} style={styles.removeBtn}>
                        <Text style={styles.removeBtnText}>X</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>
          ))}
        </View>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}
      </ScrollView>

      {/* Save button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveBtnText}>SAVE GROUPS</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: NAVY,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 8,
    paddingBottom: spacing.md,
    backgroundColor: NAVY,
  },
  headerBackBtn: {
    width: 50,
  },
  headerBackText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  scroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: 120,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  // Section
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: NAVY,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  franchiseGrid: {
    gap: spacing.sm,
  },
  // Unassigned card
  unassignedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  miniLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniLogoText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  unassignedName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  assignBtns: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  assignBtn: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  assignBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  // Groups
  groupsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  groupColumn: {
    flex: 1,
  },
  groupHeader: {
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  groupHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  groupCount: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  groupEmpty: {
    fontSize: typography.fontSize.xs,
    color: TEXT_SUB,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  groupItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  groupItemName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  removeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_SUB,
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    color: colors.error,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  // Bottom bar
  bottomBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.base,
    paddingBottom: 100,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  saveBtn: {
    backgroundColor: GREEN,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  saveBtnText: {
    fontSize: typography.fontSize.md,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});
