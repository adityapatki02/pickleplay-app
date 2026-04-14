import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { getRoster, addRosterPlayer, getFranchise } from '../../api/leagues.api';
import { useLeagueStore } from '../../store/leagueStore';
import { colors, spacing, typography, borderRadius, shadows } from '../../config/theme';
import type {
  FranchiseRoster,
  CategorySlug,
  AddRosterPlayerInput,
  RosterStatus,
} from '../../types/league.types';
import { CATEGORY_LABELS } from '../../types/league.types';
import type { LeagueStackParamList } from '../../navigation/types';

// ─── Design tokens ──────────────────────────────────────────────────────────
const NAVY = '#001E40';
const BLUE = '#2196F3';
const GREEN = '#06D6A0';
const ORANGE = '#F59E0B';
const RED = '#EF4444';
const SURFACE = '#F5F7FA';
const BORDER = '#E2E8F0';
const TEXT_COLOR = '#1A1D21';
const TEXT_SUB = '#64748B';

const CATEGORY_ORDER: CategorySlug[] = [
  'kids',
  'teen',
  'women1',
  'women2',
  'men1',
  'men2',
  'men3',
];

const STATUS_COLORS: Record<RosterStatus, { bg: string; text: string }> = {
  active: { bg: '#E6FFF5', text: GREEN },
  injured: { bg: '#FFF7E6', text: ORANGE },
  suspended: { bg: '#FFEBE6', text: RED },
  released: { bg: SURFACE, text: TEXT_SUB },
};

type RouteType = RouteProp<LeagueStackParamList, 'RosterManagement'>;

interface RosterSection {
  title: string;
  slug: CategorySlug;
  data: FranchiseRoster[];
}

export default function RosterManagementScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteType>();
  const { franchiseId, seasonId } = route.params;

  const currentFranchise = useLeagueStore((s) => s.currentFranchise);
  const setCurrentFranchise = useLeagueStore((s) => s.setCurrentFranchise);

  const [roster, setRoster] = useState<FranchiseRoster[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add player form
  const [playerPhone, setPlayerPhone] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerCategory, setPlayerCategory] = useState<CategorySlug>('men1');
  const [playerJersey, setPlayerJersey] = useState('');
  const [addError, setAddError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [rosterData, franchiseData] = await Promise.all([
        getRoster(franchiseId, seasonId),
        !currentFranchise ? getFranchise(franchiseId) : Promise.resolve(null),
      ]);
      setRoster(rosterData);
      if (franchiseData) setCurrentFranchise(franchiseData);
    } catch (err) {
      console.error('Failed to load roster', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [franchiseId, seasonId, currentFranchise, setCurrentFranchise]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // ── Build sections ──

  const sections: RosterSection[] = CATEGORY_ORDER.map((slug) => ({
    title: CATEGORY_LABELS[slug],
    slug,
    data: roster.filter((r) => r.categorySlug === slug),
  })).filter((s) => s.data.length > 0);

  // If no players at all, show all categories empty for context
  const displaySections =
    sections.length > 0
      ? sections
      : CATEGORY_ORDER.map((slug) => ({
          title: CATEGORY_LABELS[slug],
          slug,
          data: [] as FranchiseRoster[],
        }));

  // ── Add player ──

  const resetAddForm = () => {
    setPlayerPhone('');
    setPlayerName('');
    setPlayerCategory('men1');
    setPlayerJersey('');
    setAddError('');
  };

  const handleAddPlayer = async () => {
    if (!playerName.trim() && !playerPhone.trim()) {
      setAddError('Player name or phone is required');
      return;
    }

    setSaving(true);
    setAddError('');
    try {
      const input: AddRosterPlayerInput = {
        seasonId,
        playerName: playerName.trim() || undefined,
        playerPhone: playerPhone.trim() || undefined,
        categorySlug: playerCategory,
        jerseyNumber: playerJersey ? parseInt(playerJersey, 10) : undefined,
      };
      const entry = await addRosterPlayer(franchiseId, input);
      setRoster((prev) => [...prev, entry]);
      setShowAddModal(false);
      resetAddForm();
    } catch (err: any) {
      setAddError(err?.message || 'Failed to add player');
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
          <Text style={styles.headerTitle}>ROSTER</Text>
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
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentFranchise?.name ?? 'ROSTER'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {roster.length} PLAYER{roster.length !== 1 ? 'S' : ''}
          </Text>
        </View>
      </View>

      {/* Section List */}
      <SectionList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        sections={displaySections}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{section.data.length}</Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.playerRow}>
            <View style={styles.playerInfo}>
              <Text style={styles.playerName} numberOfLines={1}>
                {item.player?.fullName ?? item.player?.displayName ?? 'Unknown'}
              </Text>
              {item.player?.phone ? (
                <Text style={styles.playerPhone}>{item.player.phone}</Text>
              ) : null}
            </View>
            {item.jerseyNumber !== undefined && item.jerseyNumber !== null ? (
              <View style={styles.jerseyBadge}>
                <Text style={styles.jerseyText}>#{item.jerseyNumber}</Text>
              </View>
            ) : null}
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: STATUS_COLORS[item.status]?.bg ?? SURFACE },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: STATUS_COLORS[item.status]?.text ?? TEXT_SUB },
                ]}
              >
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>
        )}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? (
            <Text style={styles.emptySection}>No players in this category</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>NO PLAYERS YET</Text>
            <Text style={styles.emptySubtitle}>
              Tap the + button to add players
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Player Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>ADD PLAYER</Text>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>PHONE NUMBER</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Search by phone..."
                placeholderTextColor="#94A3B8"
                value={playerPhone}
                onChangeText={setPlayerPhone}
                keyboardType="phone-pad"
                maxLength={15}
              />
              <Text style={styles.modalHint}>
                If player exists, they will be linked automatically
              </Text>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>PLAYER NAME</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Full name"
                placeholderTextColor="#94A3B8"
                value={playerName}
                onChangeText={setPlayerName}
                maxLength={60}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>CATEGORY</Text>
              <View style={styles.categoryPicker}>
                {CATEGORY_ORDER.map((slug) => {
                  const active = playerCategory === slug;
                  return (
                    <TouchableOpacity
                      key={slug}
                      style={[
                        styles.categoryChip,
                        active && styles.categoryChipActive,
                      ]}
                      onPress={() => setPlayerCategory(slug)}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          active && styles.categoryChipTextActive,
                        ]}
                      >
                        {CATEGORY_LABELS[slug]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>JERSEY NUMBER</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 7"
                placeholderTextColor="#94A3B8"
                value={playerJersey}
                onChangeText={setPlayerJersey}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>

            {addError ? (
              <Text style={styles.modalError}>{addError}</Text>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowAddModal(false);
                  resetAddForm();
                }}
              >
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleAddPlayer}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalSaveText}>ADD PLAYER</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: NAVY,
    gap: spacing.md,
  },
  headerBackBtn: {
    paddingRight: spacing.sm,
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
  headerSubtitle: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  list: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  listContent: {
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: NAVY,
    letterSpacing: 1.5,
    flex: 1,
  },
  sectionBadge: {
    backgroundColor: NAVY,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  sectionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Player row
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  playerPhone: {
    fontSize: typography.fontSize.xs,
    color: TEXT_SUB,
    marginTop: 2,
  },
  jerseyBadge: {
    backgroundColor: SURFACE,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginRight: spacing.sm,
  },
  jerseyText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: NAVY,
  },
  statusBadge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  emptySection: {
    fontSize: typography.fontSize.sm,
    color: TEXT_SUB,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    fontStyle: 'italic',
  },
  // Empty
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing['4xl'],
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '800',
    color: NAVY,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.md,
    color: TEXT_SUB,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 100,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
    elevation: 6,
  },
  fabText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#FFFFFF',
    marginTop: -2,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,30,64,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    paddingBottom: spacing['4xl'],
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '900',
    fontStyle: 'italic',
    color: NAVY,
    letterSpacing: 0.5,
    marginBottom: spacing.xl,
  },
  modalField: {
    marginBottom: spacing.md,
  },
  modalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: NAVY,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  modalInput: {
    backgroundColor: SURFACE,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: BORDER,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.fontSize.base,
    fontWeight: '500',
    color: TEXT_COLOR,
    minHeight: 48,
  },
  modalHint: {
    fontSize: typography.fontSize.xs,
    color: TEXT_SUB,
    marginTop: spacing.xs,
  },
  modalError: {
    fontSize: typography.fontSize.xs,
    color: colors.error,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  categoryPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: SURFACE,
  },
  categoryChipActive: {
    backgroundColor: NAVY,
  },
  categoryChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: TEXT_SUB,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: TEXT_SUB,
    letterSpacing: 0.5,
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: GREEN,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalSaveText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
