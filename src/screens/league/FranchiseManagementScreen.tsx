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
  Modal,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { getFranchises, createFranchise, getSeasons, deleteFranchise } from '../../api/leagues.api';
import { useLeagueStore } from '../../store/leagueStore';
import { colors, spacing, typography, borderRadius, shadows } from '../../config/theme';
import type { Franchise, CreateFranchiseInput } from '../../types/league.types';
import type { LeagueStackParamList } from '../../navigation/types';

// ─── Design tokens ──────────────────────────────────────────────────────────
const NAVY = '#001E40';
const BLUE = '#2196F3';
const GREEN = '#06D6A0';
const SURFACE = '#F5F7FA';
const BORDER = '#E2E8F0';
const TEXT_COLOR = '#1A1D21';
const TEXT_SUB = '#64748B';

type RouteType = RouteProp<LeagueStackParamList, 'FranchiseManagement'>;

export default function FranchiseManagementScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteType>();
  const { leagueId } = route.params;

  const storeFranchises = useLeagueStore((s) => s.franchises);
  const setFranchises = useLeagueStore((s) => s.setFranchises);
  const addFranchiseToStore = useLeagueStore((s) => s.addFranchise);
  const currentLeague = useLeagueStore((s) => s.currentLeague);
  const currentSeason = useLeagueStore((s) => s.currentSeason);
  const setCurrentSeason = useLeagueStore((s) => s.setCurrentSeason);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modal form
  const [fname, setFname] = useState('');
  const [fshortName, setFshortName] = useState('');
  const [fprimary, setFprimary] = useState('#2196F3');
  const [fsecondary, setFsecondary] = useState('#001E40');
  const [modalError, setModalError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const data = await getFranchises(leagueId);
      setFranchises(data);
    } catch (err) {
      console.error('Failed to load franchises', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leagueId, setFranchises]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const resetModal = () => {
    setFname('');
    setFshortName('');
    setFprimary('#2196F3');
    setFsecondary('#001E40');
    setModalError('');
  };

  const handleAddFranchise = async () => {
    if (!fname.trim()) {
      setModalError('Franchise name is required');
      return;
    }
    setSaving(true);
    setModalError('');
    try {
      const input: CreateFranchiseInput = {
        name: fname.trim(),
        shortName: fshortName.trim() || undefined,
        primaryColor: fprimary.trim() || undefined,
        secondaryColor: fsecondary.trim() || undefined,
      };
      const franchise = await createFranchise(leagueId, input);
      addFranchiseToStore(franchise);
      setShowModal(false);
      resetModal();
    } catch (err: any) {
      setModalError(err?.message || 'Failed to add franchise');
    } finally {
      setSaving(false);
    }
  };

  const handleFranchiseTap = async (franchise: Franchise) => {
    let seasonId = currentSeason?.id;
    if (!seasonId) {
      try {
        const seasons = await getSeasons(leagueId);
        const list = Array.isArray(seasons) ? seasons : [];
        if (list.length > 0) {
          seasonId = list[0].id;
          setCurrentSeason(list[0]);
        }
      } catch {}
    }
    if (seasonId) {
      navigation.navigate('RosterManagement', {
        franchiseId: franchise.id,
        seasonId,
      });
    }
  };

  // ── Render ──

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>FRANCHISES</Text>
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
            {currentLeague?.name ?? 'FRANCHISES'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {storeFranchises.length} FRANCHISE{storeFranchises.length !== 1 ? 'S' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowModal(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.addBtnText}>+ ADD</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} />
        }
      >
        {storeFranchises.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>NO FRANCHISES YET</Text>
            <Text style={styles.emptySubtitle}>
              Tap "+ ADD" to create your first franchise
            </Text>
          </View>
        ) : (
          storeFranchises.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={styles.card}
              onPress={() => handleFranchiseTap(f)}
              activeOpacity={0.8}
            >
              <View style={styles.cardRow}>
                {/* Logo placeholder */}
                <View
                  style={[
                    styles.logoCircle,
                    { backgroundColor: f.primaryColor || BLUE },
                  ]}
                >
                  <Text style={styles.logoText}>
                    {(f.shortName || f.name).substring(0, 2).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.cardContent}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {f.name}
                  </Text>
                  {f.shortName ? (
                    <Text style={styles.cardShort}>{f.shortName}</Text>
                  ) : null}

                  <View style={styles.cardMeta}>
                    {f.owner?.fullName ? (
                      <Text style={styles.cardMetaText}>
                        Owner: {f.owner.fullName}
                      </Text>
                    ) : null}
                    {f.captain?.fullName ? (
                      <Text style={styles.cardMetaText}>
                        Captain: {f.captain.fullName}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Roster count badge */}
                {f.rosterCount !== undefined && f.rosterCount > 0 ? (
                  <View style={styles.rosterBadge}>
                    <Text style={styles.rosterBadgeText}>{f.rosterCount}</Text>
                  </View>
                ) : null}
              </View>

              {/* Color bar + delete */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <View style={styles.colorBar}>
                  <View
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: f.primaryColor || BLUE },
                    ]}
                  />
                  <View
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: f.secondaryColor || NAVY },
                    ]}
                  />
                </View>
                <TouchableOpacity
                  style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    const doDelete = () => {
                      deleteFranchise(f.id).then(() => {
                        setFranchises(storeFranchises.filter((x) => x.id !== f.id));
                      }).catch(() => {});
                    };
                    if (typeof window !== 'undefined' && window.confirm) {
                      if (window.confirm(`Delete "${f.name}"?`)) doDelete();
                    } else {
                      doDelete();
                    }
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#EF4444' }}>✕</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Add Franchise Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>ADD FRANCHISE</Text>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>FRANCHISE NAME</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Pune Panthers"
                placeholderTextColor="#94A3B8"
                value={fname}
                onChangeText={setFname}
                maxLength={60}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>SHORT NAME</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. PNP"
                placeholderTextColor="#94A3B8"
                value={fshortName}
                onChangeText={setFshortName}
                maxLength={6}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>PRIMARY COLOR (HEX)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="#2196F3"
                placeholderTextColor="#94A3B8"
                value={fprimary}
                onChangeText={setFprimary}
                maxLength={7}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>SECONDARY COLOR (HEX)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="#001E40"
                placeholderTextColor="#94A3B8"
                value={fsecondary}
                onChangeText={setFsecondary}
                maxLength={7}
              />
            </View>

            {modalError ? (
              <Text style={styles.modalError}>{modalError}</Text>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowModal(false);
                  resetModal();
                }}
              >
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleAddFranchise}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalSaveText}>SAVE</Text>
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
  addBtn: {
    backgroundColor: GREEN,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  addBtnText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '800',
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
  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: BORDER,
    padding: spacing.base,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  logoText: {
    fontSize: typography.fontSize.lg,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  cardContent: {
    flex: 1,
  },
  cardName: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: TEXT_COLOR,
  },
  cardShort: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    color: TEXT_SUB,
    letterSpacing: 1,
    marginTop: 2,
  },
  cardMeta: {
    marginTop: spacing.xs,
  },
  cardMetaText: {
    fontSize: typography.fontSize.xs,
    color: TEXT_SUB,
  },
  rosterBadge: {
    backgroundColor: SURFACE,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginLeft: spacing.sm,
  },
  rosterBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: NAVY,
  },
  colorBar: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  colorSwatch: {
    width: 24,
    height: 6,
    borderRadius: 3,
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
  modalError: {
    fontSize: typography.fontSize.xs,
    color: colors.error,
    fontWeight: '600',
    marginBottom: spacing.md,
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
