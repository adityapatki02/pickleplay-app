import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Platform,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ScrollView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Alert,
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
import { xAlert, xConfirm } from '../../utils/alert';
import { YColors, YTopBar, YButton } from '../../components/yoiden';

const NAVY = YColors.ink;

type NavProp = NativeStackNavigationProp<OrgTournamentsStackParamList, 'RegistrationManage'>;
type RouteType = RouteProp<OrgTournamentsStackParamList, 'RegistrationManage'>;

interface Registration {
  id: string;
  categoryId: string;
  status: string;
  createdAt: string;
  lookingForPartner?: boolean;
  partnerId?: string;
  playerName?: string;
  teamName?: string;
  partnerName?: string;
  user?: { fullName?: string; displayName?: string; phone?: string };
  player?: { name?: string; displayName?: string; phone?: string };
  partnerUser?: { fullName?: string; displayName?: string; phone?: string };
  partner?: { name?: string; displayName?: string };
  category?: { name?: string; format?: string };
}

const STATUS_FILTERS = [
  { label: 'ALL', value: 'all' },
  { label: 'CONFIRMED', value: 'confirmed' },
  { label: 'PENDING', value: 'pending' },
  { label: 'NEED PARTNER', value: 'pending_partner' },
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
  return reg.user?.displayName ?? reg.user?.fullName ?? reg.playerName ?? reg.player?.displayName ?? reg.player?.name ?? reg.teamName ?? 'Unknown Player';
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addPartner, setAddPartner] = useState('');
  const [addPartnerPhone, setAddPartnerPhone] = useState('');
  const [addCategoryId, setAddCategoryId] = useState('');
  const [addingPlayer, setAddingPlayer] = useState(false);

  // Edit modal state
  const [editReg, setEditReg] = useState<Registration | null>(null);
  const [editPlayerName, setEditPlayerName] = useState('');
  const [editPlayerPhone, setEditPlayerPhone] = useState('');
  const [editPartnerName, setEditPartnerName] = useState('');
  const [editPartnerPhone, setEditPartnerPhone] = useState('');
  const [saving, setSaving] = useState(false);

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
      xAlert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to load');
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
      xAlert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to update');
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmAction = (registrationId: string, action: string, label: string) => {
    xConfirm(
      `${label} Registration`,
      `Are you sure you want to ${label.toLowerCase()} this registration?`,
      () => handleStatusUpdate(registrationId, action),
      label,
    );
  };

  const handleRemove = (registrationId: string) => {
    xConfirm(
      'Remove Registration',
      'This will permanently delete this registration. Are you sure?',
      async () => {
        setUpdatingId(registrationId);
        try {
          await registrationsApi.removeRegistration(tournamentId, registrationId);
          setRegistrations((prev) => prev.filter((r) => r.id !== registrationId));
        } catch (err: any) {
          xAlert('Error', err?.response?.data?.message ?? 'Failed to remove');
        } finally {
          setUpdatingId(null);
        }
      },
      'Remove',
    );
  };

  const handleAddPlayer = async () => {
    if (!addName.trim()) return;
    const catId = addCategoryId || categories[0]?.id;
    if (!catId) {
      xAlert('Error', 'No category available');
      return;
    }
    setAddingPlayer(true);
    try {
      await registrationsApi.manualRegister(tournamentId, catId, {
        name: addName.trim(),
        phone: addPhone.trim() || undefined,
        partnerName: addPartner.trim() || undefined,
        partnerPhone: addPartnerPhone.trim() || undefined,
      });
      setAddName('');
      setAddPhone('');
      setAddPartner('');
      setAddPartnerPhone('');
      setShowAddModal(false);
      fetchData(true);
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? 'Failed to add player');
    } finally {
      setAddingPlayer(false);
    }
  };

  const handleCsvImport = async () => {
    const catId = addCategoryId || categories[0]?.id;
    if (!catId) {
      xAlert('Error', 'No category available');
      return;
    }
    const lines = csvText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      xAlert('Error', 'No data found. Paste CSV rows.');
      return;
    }

    const isDoubles =
      categories.find((c) => c.id === catId)?.format === 'doubles';

    setCsvImporting(true);
    let success = 0;
    let failed = 0;
    for (const line of lines) {
      // Skip header row if detected
      const lower = line.toLowerCase();
      if (lower.includes('name') && (lower.includes('phone') || lower.includes('partner'))) continue;

      const cols = line.split(',').map((c) => c.trim());
      // Singles: Name, Phone
      // Doubles: Name, Phone, PartnerName, PartnerPhone
      const name = cols[0];
      const phone = cols[1] || undefined;
      const partnerName = isDoubles ? cols[2] || undefined : undefined;
      const partnerPhone = isDoubles ? cols[3] || undefined : undefined;

      if (!name) { failed++; continue; }

      try {
        await registrationsApi.manualRegister(tournamentId, catId, {
          name,
          phone,
          partnerName,
          partnerPhone,
        });
        success++;
      } catch {
        failed++;
      }
    }
    setCsvImporting(false);
    setCsvText('');
    setShowCsvModal(false);
    fetchData(true);
    xAlert(
      'Import Complete',
      `${success} player${success !== 1 ? 's' : ''} added successfully.${failed > 0 ? ` ${failed} failed.` : ''}`,
    );
  };

  const openEditModal = (reg: Registration) => {
    setEditReg(reg);
    setEditPlayerName(getPlayerName(reg));
    setEditPlayerPhone(reg.user?.phone ?? '');
    const pName = reg.partnerUser?.displayName ?? reg.partnerUser?.fullName ?? reg.partnerName ?? reg.partner?.displayName ?? reg.partner?.name ?? '';
    setEditPartnerName(pName);
    setEditPartnerPhone(reg.partnerUser?.phone ?? '');
  };

  const handleEditSave = async () => {
    if (!editReg) return;
    setSaving(true);
    try {
      const isDoubles = editReg.category?.format === 'doubles' ||
        categories.find((c) => c.id === editReg.categoryId)?.format === 'doubles';
      const payload: any = {
        playerName: editPlayerName.trim() || undefined,
        playerPhone: editPlayerPhone.trim() || undefined,
      };
      if (isDoubles) {
        payload.partnerName = editPartnerName.trim() || undefined;
        payload.partnerPhone = editPartnerPhone.trim() || undefined;
      }
      await registrationsApi.editRegistration(tournamentId, editReg.id, payload);
      setEditReg(null);
      fetchData(true);
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const selectedCategoryFormat = categories.find((c) => c.id === addCategoryId)?.format ?? 'singles';

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

    const isDoubles = item.category?.format === 'doubles' ||
      categories.find((c) => c.id === item.categoryId)?.format === 'doubles';
    const partnerName = item.partnerUser?.displayName ?? item.partnerUser?.fullName ??
      item.partnerName ?? item.partner?.displayName ?? item.partner?.name;
    const hasPartner = !!partnerName;

    return (
      <View style={styles.regCard}>
        <View style={styles.regTop}>
          <View style={styles.regLeft}>
            {isDoubles ? (
              <View style={styles.teamBracket}>
                <View style={styles.bracketLine} />
                <View style={styles.bracketPlayers}>
                  <View style={styles.bracketSlot}>
                    <View style={[styles.bracketDot, { backgroundColor: '#06D6A0' }]} />
                    <Text style={styles.playerName}>{getPlayerName(item)}</Text>
                  </View>
                  <View style={styles.bracketSlot}>
                    <View style={[styles.bracketDot, { backgroundColor: hasPartner ? '#06D6A0' : '#FFB703' }]} />
                    {hasPartner ? (
                      <Text style={styles.playerName}>{partnerName}</Text>
                    ) : (
                      <Text style={styles.vacantSlot}>Partner needed</Text>
                    )}
                  </View>
                </View>
              </View>
            ) : (
              <Text style={styles.playerName}>{getPlayerName(item)}</Text>
            )}
            <Text style={styles.regMeta}>
              {getCategoryName(item)}  ·  {formatDate(item.createdAt)}
            </Text>
          </View>
          <StatusBadge status={item.status} size="sm" />
        </View>

        {(isPending || isConfirmed || item.status === 'cancelled' || item.status === 'pending_partner') && (
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
                  style={styles.editBtn}
                  onPress={() => openEditModal(item)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.editBtnText}>EDIT</Text>
                </TouchableOpacity>
                {(isPending || isConfirmed) && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => confirmAction(item.id, 'cancelled', 'Cancel')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelBtnText}>CANCEL</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleRemove(item.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.removeBtnText}>REMOVE</Text>
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
      <StatusBar barStyle="dark-content" backgroundColor={YColors.bg} />
      <YTopBar
        eyebrow="ORGANIZER"
        title="REGISTRATIONS"
        onBack={() => navigation.goBack()}
      />

      {/* Action buttons row */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.addPlayerBtn}
          onPress={() => {
            if (categories.length > 0) setAddCategoryId(categories[0].id);
            setShowAddModal(true);
          }}
        >
          <Text style={styles.addPlayerBtnText}>+ ADD PLAYER</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.csvImportBtn}
          onPress={() => {
            if (categories.length > 0) setAddCategoryId(categories[0].id);
            setShowCsvModal(true);
          }}
        >
          <Text style={styles.csvImportBtnText}>IMPORT CSV</Text>
        </TouchableOpacity>
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
          <ActivityIndicator size="large" color="#2196F3" />
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
              tintColor="#2196F3"
              colors={['#2196F3']}
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
      {/* Add Player Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
            keyboardShouldPersistTaps="handled"
          >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Player</Text>
                <Text style={styles.modalFormatHint}>
                  {selectedCategoryFormat === 'doubles' ? 'Doubles — 2 players needed' : 'Singles'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalClose}>{'\u2715'}</Text>
              </TouchableOpacity>
            </View>

            {categories.length > 1 && (
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.catChip, addCategoryId === cat.id && styles.catChipActive]}
                      onPress={() => setAddCategoryId(cat.id)}
                    >
                      <Text style={[styles.catChipText, addCategoryId === cat.id && styles.catChipTextActive]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Player Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Full name"
                placeholderTextColor="#94A3B8"
                value={addName}
                onChangeText={setAddName}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Phone (optional)</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ backgroundColor: '#F5F7FA', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center', alignItems: 'center', minWidth: 54 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#001E40' }}>+91</Text>
                </View>
                <TextInput
                  style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                  placeholder="XXXXX XXXXX"
                  placeholderTextColor="#94A3B8"
                  value={addPhone}
                  onChangeText={(t) => setAddPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
            </View>

            {selectedCategoryFormat === 'doubles' && (
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Partner Name</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Partner's full name"
                  placeholderTextColor="#94A3B8"
                  value={addPartner}
                  onChangeText={setAddPartner}
                />
                {addPartner.trim() ? (
                  <>
                    <Text style={[styles.modalLabel, { marginTop: spacing.sm }]}>Partner Phone</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ backgroundColor: '#F5F7FA', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center', alignItems: 'center', minWidth: 54 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#001E40' }}>+91</Text>
                      </View>
                      <TextInput
                        style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                        placeholder="XXXXX XXXXX"
                        placeholderTextColor="#94A3B8"
                        value={addPartnerPhone}
                        onChangeText={(t) => setAddPartnerPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                        keyboardType="phone-pad"
                        maxLength={10}
                      />
                    </View>
                  </>
                ) : (
                  <Text style={styles.modalHint}>
                    Without a partner, this will be a temporary registration (pending partner).
                  </Text>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[styles.modalSubmitBtn, (!addName.trim() || addingPlayer) && { opacity: 0.4 }]}
              onPress={handleAddPlayer}
              disabled={!addName.trim() || addingPlayer}
              activeOpacity={0.8}
            >
              {addingPlayer ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalSubmitText}>
                  {selectedCategoryFormat === 'doubles' && !addPartner.trim()
                    ? 'Add (Pending Partner)'
                    : 'Add Player'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Registration Modal */}
      <Modal visible={!!editReg} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Registration</Text>

            <Text style={styles.inputLabel}>Player Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editPlayerName}
              onChangeText={setEditPlayerName}
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Player Phone</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ backgroundColor: '#F5F7FA', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center', alignItems: 'center', minWidth: 54 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#001E40' }}>+91</Text>
              </View>
              <TextInput
                style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                placeholder="XXXXX XXXXX"
                placeholderTextColor="#94A3B8"
                value={editPlayerPhone}
                onChangeText={(t) => setEditPlayerPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>

            {(editReg?.category?.format === 'doubles' ||
              categories.find((c) => c.id === editReg?.categoryId)?.format === 'doubles') && (
              <>
                <Text style={styles.inputLabel}>Partner Name</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editPartnerName}
                  onChangeText={setEditPartnerName}
                  placeholder="Add partner name"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.inputLabel}>Partner Phone</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ backgroundColor: '#F5F7FA', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center', alignItems: 'center', minWidth: 54 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#001E40' }}>+91</Text>
                  </View>
                  <TextInput
                    style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                    placeholder="XXXXX XXXXX"
                    placeholderTextColor="#94A3B8"
                    value={editPartnerPhone}
                    onChangeText={(t) => setEditPartnerPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditReg(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, saving && { opacity: 0.6 }]}
                onPress={handleEditSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CSV Import Modal */}
      <Modal visible={showCsvModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Import from CSV</Text>
                <Text style={styles.modalFormatHint}>Paste rows below</Text>
              </View>
              <TouchableOpacity onPress={() => { setShowCsvModal(false); setCsvText(''); }}>
                <Text style={styles.modalClose}>{'\u2715'}</Text>
              </TouchableOpacity>
            </View>

            {categories.length > 1 && (
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.catChip, addCategoryId === cat.id && styles.catChipActive]}
                      onPress={() => setAddCategoryId(cat.id)}
                    >
                      <Text style={[styles.catChipText, addCategoryId === cat.id && styles.catChipTextActive]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Format</Text>
              <Text style={styles.csvFormatHelp}>
                {categories.find((c) => c.id === (addCategoryId || categories[0]?.id))?.format === 'doubles'
                  ? 'Name, Phone, PartnerName, PartnerPhone'
                  : 'Name, Phone'}
              </Text>
              <Text style={styles.csvFormatExample}>
                {categories.find((c) => c.id === (addCategoryId || categories[0]?.id))?.format === 'doubles'
                  ? 'e.g.\nRahul, 9876543210, Priya, 9123456789\nAmit, 9988776655, Neha, 9112233445'
                  : 'e.g.\nRahul, 9876543210\nAmit, 9988776655'}
              </Text>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Paste CSV Data</Text>
              <TextInput
                style={[styles.modalInput, { height: 140, textAlignVertical: 'top' }]}
                placeholder="Paste rows here..."
                placeholderTextColor="#94A3B8"
                value={csvText}
                onChangeText={setCsvText}
                multiline
                numberOfLines={6}
              />
            </View>

            <TouchableOpacity
              style={[styles.modalSubmitBtn, (!csvText.trim() || csvImporting) && { opacity: 0.4 }]}
              onPress={handleCsvImport}
              disabled={!csvText.trim() || csvImporting}
            >
              {csvImporting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalSubmitText}>
                  IMPORT {csvText.split('\n').filter((l) => l.trim()).length || 0} PLAYERS
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: YColors.bg,
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + spacing.md : spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    width: 60,
  },
  backIcon: {
    fontSize: typography.fontSize.lg,
    color: '#2196F3',
    fontWeight: '700',
  },
  backLabel: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: '#2196F3',
    letterSpacing: 1.5,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    color: NAVY,
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  filterBar: {
    backgroundColor: YColors.bg,
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
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: YColors.line2,
  },
  filterChipActive: {
    backgroundColor: YColors.ink,
    borderColor: YColors.ink,
  },
  filterChipText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  countBar: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    backgroundColor: '#FFFFFF',
  },
  countText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    color: '#64748B',
  },
  listContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: 160,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  regCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: spacing.base,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  // Team bracket visual
  teamBracket: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 4,
  },
  bracketLine: {
    width: 2,
    backgroundColor: '#E2E8F0',
    borderRadius: 1,
    marginRight: spacing.sm,
  },
  bracketPlayers: {
    flex: 1,
    gap: 6,
  },
  bracketSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bracketDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  playerName: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: '#1A1D21',
  },
  vacantSlot: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: '#FFB703',
    fontStyle: 'italic',
  },
  regMeta: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    color: '#64748B',
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
    backgroundColor: '#06D6A0',
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
    backgroundColor: '#FEF2F2',
  },
  cancelBtnText: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 1,
  },
  editBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.DEFAULT,
    backgroundColor: '#EFF6FF',
  },
  editBtnText: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: '#2196F3',
    letterSpacing: 1,
  },
  removeBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.DEFAULT,
    backgroundColor: '#F5F7FA',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  removeBtnText: {
    fontSize: typography.fontSize['2xs'],
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  addPlayerBtn: {
    flex: 1,
    backgroundColor: '#001E40',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlayerBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  csvImportBtn: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#2196F3',
  },
  csvImportBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2196F3',
    letterSpacing: 1,
  },
  csvFormatHelp: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2196F3',
    marginTop: 4,
  },
  csvFormatExample: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    fontStyle: 'italic',
    lineHeight: 16,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    paddingBottom: spacing['3xl'],
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '800',
    color: NAVY,
  },
  modalFormatHint: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
  modalClose: {
    fontSize: typography.fontSize.lg,
    color: '#94A3B8',
    padding: spacing.xs,
  },
  modalField: {
    marginBottom: spacing.base,
  },
  modalLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  modalInput: {
    backgroundColor: '#F5F7FA',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    color: '#1A1D21',
  },
  catChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: '#F5F7FA',
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catChipActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  catChipText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: '#64748B',
  },
  catChipTextActive: {
    color: '#FFFFFF',
  },
  modalHint: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    color: '#FFB703',
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  modalSubmitBtn: {
    backgroundColor: '#06D6A0',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    flex: 1,
  },
  modalSubmitText: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  inputLabel: {
    color: '#64748B',
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: spacing.sm,
    letterSpacing: 0.3,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalCancelText: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    color: '#64748B',
  },
});
