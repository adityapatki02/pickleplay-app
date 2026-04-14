import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';


import apiClient from '../../api/client';
import { registrationsApi } from '../../api/registrations.api';
import { xAlert, xConfirm } from '../../utils/alert';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SeedPartner {
  userId: string;
  userName: string;
  displayName?: string;
  phone?: string;
  rating: number | null;
}

interface SeedPlayer {
  id: string;
  userId: string;
  teamId?: string;
  userName: string;
  displayName?: string;
  city?: string;
  skillLevel?: string;
  phone?: string;
  rating: number | null;
  registeredAt: string;
  isDoubles?: boolean;
  partner?: SeedPartner | null;
}

// ---------------------------------------------------------------------------
// PlayerRow
// ---------------------------------------------------------------------------

function PlayerRow({
  player,
  index,
  total,
  onMoveUp,
  onMoveDown,
}: {
  player: SeedPlayer;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const hasRating = player.rating != null && Number(player.rating) > 2.0;
  const phone = player.phone ? player.phone.replace('+91', '') : '';
  const p1Name = player.displayName ?? player.userName;
  const isDoubles = !!player.isDoubles;
  const hasPartner = isDoubles && !!player.partner;
  const p2Name = hasPartner
    ? (player.partner!.displayName ?? player.partner!.userName)
    : null;
  const p2HasRating =
    hasPartner && player.partner!.rating != null && Number(player.partner!.rating) > 2.0;

  return (
    <View style={s.playerRow}>
      <View style={s.seedBadge}>
        <Text style={s.seedNum}>{index + 1}</Text>
      </View>
      <View style={s.playerInfo}>
        {/* Player 1 */}
        <View style={s.teamPlayerLine}>
          <Text style={s.playerName} numberOfLines={1}>{p1Name}</Text>
          {phone ? (
            <Text style={s.phoneInline}>{'\u260E'} {phone}</Text>
          ) : null}
        </View>
        {/* Player 2 (doubles) or Partner Needed tag */}
        {isDoubles && hasPartner && p2Name ? (
          <View style={s.teamPlayerLine}>
            <Text style={s.partnerName} numberOfLines={1}>{p2Name}</Text>
            {player.partner!.phone ? (
              <Text style={s.phoneInline}>
                {'\u260E'} {player.partner!.phone.replace('+91', '')}
              </Text>
            ) : null}
          </View>
        ) : isDoubles && !hasPartner ? (
          <View style={s.partnerNeededWrap}>
            <Text style={s.partnerNeededText}>PARTNER NEEDED</Text>
          </View>
        ) : null}
      </View>

      {/* Rating column — show avg for doubles or individual */}
      <View style={s.ratingCol}>
        {hasRating ? (
          <View style={s.ratingBadge}>
            <Text style={s.ratingText}>{Number(player.rating).toFixed(1)}</Text>
          </View>
        ) : (
          <View style={s.newBadge}>
            <Text style={s.newBadgeText}>NEW</Text>
          </View>
        )}
        {isDoubles && hasPartner && (
          p2HasRating ? (
            <View style={[s.ratingBadge, { marginTop: 2 }]}>
              <Text style={s.ratingText}>{Number(player.partner!.rating).toFixed(1)}</Text>
            </View>
          ) : (
            <View style={[s.newBadge, { marginTop: 2 }]}>
              <Text style={s.newBadgeText}>NEW</Text>
            </View>
          )
        )}
      </View>

      <View style={s.arrows}>
        <TouchableOpacity onPress={onMoveUp} disabled={index === 0} hitSlop={8}>
          <Text style={[s.arrow, index === 0 && s.arrowDisabled]}>{'\u25B2'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onMoveDown} disabled={index === total - 1} hitSlop={8}>
          <Text style={[s.arrow, index === total - 1 && s.arrowDisabled]}>{'\u25BC'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SeedingScreen
// ---------------------------------------------------------------------------

export default function SeedingScreen() {
  const navigation = useNavigation();
  const route = useRoute<{ key: string; name: string; params: { tournamentId: string; categoryId: string } }>();
  const { tournamentId, categoryId } = route.params;

  // Player list
  const [players, setPlayers] = useState<SeedPlayer[]>([]);
  const [categoryFormat, setCategoryFormat] = useState<string>('singles');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addPartnerName, setAddPartnerName] = useState('');
  const [addPartnerPhone, setAddPartnerPhone] = useState('');
  const [adding, setAdding] = useState(false);

  // Draw preview
  const [showPreview, setShowPreview] = useState(false);

  // Auto-seed menu
  const [showAutoMenu, setShowAutoMenu] = useState(false);

  // Resolve partners modal
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [addPartnerForId, setAddPartnerForId] = useState<string | null>(null);
  const [resolvePartnerName, setResolvePartnerName] = useState('');
  const [resolvePartnerPhone, setResolvePartnerPhone] = useState('');
  const [resolving, setResolving] = useState(false);

  // --------------------------------------------------------------------
  // Data fetching
  // --------------------------------------------------------------------

  const fetchPlayers = useCallback(async () => {
    try {
      // Fetch category format
      try {
        const catRes = await apiClient.get(`/tournaments/${tournamentId}`);
        const t = catRes.data?.data ?? catRes.data;
        const cat = t?.categories?.find((c: any) => c.id === categoryId);
        if (cat?.format) setCategoryFormat(cat.format);
      } catch {}

      const res = await apiClient.get(
        `/tournaments/${tournamentId}/categories/${categoryId}/seeding`,
      );
      const raw = res.data?.data ?? res.data ?? [];
      setPlayers(Array.isArray(raw) ? raw : []);
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? 'Failed to load seeding data');
    } finally {
      setLoading(false);
    }
  }, [tournamentId, categoryId]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // --------------------------------------------------------------------
  // Reorder helpers
  // --------------------------------------------------------------------

  const movePlayer = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= players.length) return;
    const newList = [...players];
    const [moved] = newList.splice(fromIndex, 1);
    newList.splice(toIndex, 0, moved);
    setPlayers(newList);
  };

  // --------------------------------------------------------------------
  // Auto-seed
  // --------------------------------------------------------------------

  const autoSeedByRating = () => {
    const sorted = [...players].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    setPlayers(sorted);
    setShowAutoMenu(false);
  };

  const autoSeedRandom = () => {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    setPlayers(shuffled);
    setShowAutoMenu(false);
  };

  // --------------------------------------------------------------------
  // Pool preview (snake seeding)
  // --------------------------------------------------------------------

  const getPoolPreview = (): SeedPlayer[][] => {
    const groupSize = 4;
    const numPools = Math.ceil(players.length / groupSize);
    if (numPools === 0) return [];
    const pools: SeedPlayer[][] = Array.from({ length: numPools }, () => []);
    let forward = true;
    let poolIdx = 0;

    for (const player of players) {
      pools[poolIdx].push(player);
      if (forward) {
        if (poolIdx >= numPools - 1) forward = false;
        else poolIdx++;
      } else {
        if (poolIdx <= 0) forward = true;
        else poolIdx--;
      }
    }
    return pools;
  };

  // --------------------------------------------------------------------
  // Generate draw
  // --------------------------------------------------------------------

  const pendingPlayers = players.filter((p) => p.isDoubles && !p.partner);

  const handleGenerateDraw = () => {
    // Check for unresolved partners
    if (pendingPlayers.length > 0) {
      setShowResolveModal(true);
      return;
    }
    proceedGenerateDraw();
  };

  const proceedGenerateDraw = () => {
    const readyPlayers = players.filter((p) => !!p.teamId);
    if (readyPlayers.length < 2) {
      xAlert('Not Enough Teams', 'Need at least 2 teams with partners to generate a draw.');
      return;
    }
    xConfirm(
      'Generate Draw',
      `Create pools and matches for ${readyPlayers.length} teams with this seeding order?`,
      async () => {
        setGenerating(true);
        try {
          const teamOrder = readyPlayers.map((p) => p.teamId).filter(Boolean);
          await apiClient.post(
            `/tournaments/${tournamentId}/categories/${categoryId}/generate-draw`,
            { teamOrder },
          );
          xAlert('Draw Generated', 'Pools and matches have been created.');
          navigation.goBack();
        } catch (err: any) {
          xAlert('Error', err?.response?.data?.message ?? 'Failed to generate draw');
        } finally {
          setGenerating(false);
        }
      },
      'Generate',
    );
  };

  // Merge two single entries
  const handleMerge = async (regId1: string, regId2: string) => {
    setResolving(true);
    try {
      await registrationsApi.mergeRegistrations(tournamentId, categoryId, regId1, regId2);
      setMergeTargetId(null);
      await fetchPlayers();
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? 'Failed to merge');
    } finally {
      setResolving(false);
    }
  };

  // Add partner to a single entry
  const handleAddPartner = async (regId: string) => {
    if (!resolvePartnerName.trim()) {
      xAlert('Required', 'Partner name is required');
      return;
    }
    setResolving(true);
    try {
      await registrationsApi.editRegistration(tournamentId, regId, {
        partnerName: resolvePartnerName.trim(),
        partnerPhone: resolvePartnerPhone.trim() || undefined,
      });
      setAddPartnerForId(null);
      setResolvePartnerName('');
      setResolvePartnerPhone('');
      await fetchPlayers();
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? 'Failed to add partner');
    } finally {
      setResolving(false);
    }
  };

  // --------------------------------------------------------------------
  // Add player
  // --------------------------------------------------------------------

  // Detect if this category is doubles
  const isDoublesCategory = categoryFormat === 'doubles' || (players.length > 0 && !!players[0]?.isDoubles);

  const handleAddPlayer = async () => {
    if (!addName.trim()) {
      xAlert('Required', 'Player name is required');
      return;
    }
    setAdding(true);
    try {
      await apiClient.post(
        `/tournaments/${tournamentId}/categories/${categoryId}/manual-register`,
        {
          name: addName.trim(),
          phone: addPhone.trim() || undefined,
          partnerName: addPartnerName.trim() || undefined,
          partnerPhone: addPartnerPhone.trim() || undefined,
          paymentMethod: 'venue',
        },
      );
      setAddName('');
      setAddPhone('');
      setAddPartnerName('');
      setAddPartnerPhone('');
      setShowAddForm(false);
      fetchPlayers();
    } catch (err: any) {
      xAlert('Error', err?.response?.data?.message ?? 'Failed to add player');
    } finally {
      setAdding(false);
    }
  };

  // --------------------------------------------------------------------
  // Render helpers
  // --------------------------------------------------------------------

  const pools = showPreview ? getPoolPreview() : [];

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <SafeAreaView style={s.center}>
          <ActivityIndicator size="large" color={'#2196F3'} />
        </SafeAreaView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <SafeAreaView style={s.container}>
        {/* ---- HEADER ---- */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={s.backBtn}>{'\u2190'} BACK</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>SEED PLAYERS</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* ---- QUICK ACTIONS ---- */}
        <View style={s.actionsRow}>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => setShowAddForm(!showAddForm)}
          >
            <Text style={s.actionBtnText}>+ ADD {isDoublesCategory ? 'TEAM' : 'PLAYER'}</Text>
          </TouchableOpacity>

          <View>
            <TouchableOpacity
              style={s.actionBtn}
              onPress={() => setShowAutoMenu(!showAutoMenu)}
            >
              <Text style={s.actionBtnText}>
                AUTO SEED {showAutoMenu ? '\u25B2' : '\u25BC'}
              </Text>
            </TouchableOpacity>
            {showAutoMenu && (
              <View style={s.autoMenu}>
                <TouchableOpacity style={s.autoMenuItem} onPress={autoSeedByRating}>
                  <Text style={s.autoMenuText}>By Rating (Highest First)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.autoMenuItem} onPress={autoSeedRandom}>
                  <Text style={s.autoMenuText}>Random Shuffle</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* ---- ADD PLAYER/TEAM FORM (inline) ---- */}
        {showAddForm && (
          <View style={s.addForm}>
            <Text style={s.addFormTitle}>
              {isDoublesCategory ? 'Add Walk-in Team' : 'Add Walk-in Player'}
            </Text>

            {isDoublesCategory && (
              <Text style={s.addSectionLabel}>PLAYER 1</Text>
            )}
            <TextInput
              style={s.input}
              placeholder="Player Name *"
              placeholderTextColor={'#94A3B8'}
              value={addName}
              onChangeText={setAddName}
            />
            <View style={s.phoneRow}>
              <View style={s.phonePrefix}><Text style={s.phonePrefixText}>+91</Text></View>
              <TextInput
                style={[s.input, s.phoneInput]}
                placeholder="Phone (optional)"
                placeholderTextColor={'#94A3B8'}
                value={addPhone}
                onChangeText={(t) => setAddPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>

            {isDoublesCategory && (
              <>
                <Text style={s.addSectionLabel}>PLAYER 2</Text>
                <TextInput
                  style={s.input}
                  placeholder="Partner Name"
                  placeholderTextColor={'#94A3B8'}
                  value={addPartnerName}
                  onChangeText={setAddPartnerName}
                />
                <View style={s.phoneRow}>
                  <View style={s.phonePrefix}><Text style={s.phonePrefixText}>+91</Text></View>
                  <TextInput
                    style={[s.input, s.phoneInput]}
                    placeholder="Partner Phone (optional)"
                    placeholderTextColor={'#94A3B8'}
                    value={addPartnerPhone}
                    onChangeText={(t) => setAddPartnerPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
                {!addPartnerName.trim() && (
                  <Text style={s.addHint}>
                    Leave partner empty to add as "Partner Needed"
                  </Text>
                )}
              </>
            )}

            <View style={s.addFormActions}>
              <TouchableOpacity
                style={s.addCancelBtn}
                onPress={() => setShowAddForm(false)}
              >
                <Text style={s.addCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.addSubmitBtn, adding && { opacity: 0.6 }]}
                onPress={handleAddPlayer}
                disabled={adding}
              >
                {adding ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.addSubmitText}>
                    {isDoublesCategory ? 'Add Team' : 'Add Player'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ---- PLAYER LIST ---- */}
        <ScrollView
          style={s.list}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        >
          {players.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyText}>No confirmed players yet.</Text>
              <Text style={s.emptySubText}>
                Add walk-in players or wait for registrations.
              </Text>
            </View>
          ) : (
            players.map((player, idx) => (
              <PlayerRow
                key={player.id}
                player={player}
                index={idx}
                total={players.length}
                onMoveUp={() => movePlayer(idx, idx - 1)}
                onMoveDown={() => movePlayer(idx, idx + 1)}
              />
            ))
          )}
        </ScrollView>

        {/* ---- DRAW PREVIEW ---- */}
        {players.length > 0 && (
          <TouchableOpacity
            style={s.previewToggle}
            onPress={() => setShowPreview(!showPreview)}
          >
            <Text style={s.previewToggleText}>
              {showPreview ? '\u25B2' : '\u25BC'} DRAW PREVIEW
            </Text>
          </TouchableOpacity>
        )}
        {showPreview && pools.length > 0 && (
          <ScrollView style={s.previewContainer} nestedScrollEnabled>
            {pools.map((pool, i) => (
              <View key={i} style={s.poolRow}>
                <Text style={s.poolLabel}>Pool {String.fromCharCode(65 + i)}</Text>
                <Text style={s.poolPlayers} numberOfLines={2}>
                  {pool.map((p) => p.displayName ?? p.userName).join(', ')}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* ---- STICKY GENERATE BUTTON ---- */}
        {players.length > 0 && (
          <View style={s.stickyFooter}>
            <TouchableOpacity
              style={[s.generateBtn, generating && { opacity: 0.6 }]}
              onPress={handleGenerateDraw}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.generateBtnText}>
                  GENERATE DRAW ({players.length} {players[0]?.isDoubles ? 'teams' : 'players'})
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        {/* ---- RESOLVE PARTNERS MODAL ---- */}
        <Modal visible={showResolveModal} transparent animationType="slide">
          <View style={s.modalOverlay}>
            <View style={s.modalContent}>
              <Text style={s.modalTitle}>Resolve Partners</Text>
              <Text style={s.modalSubtitle}>
                {pendingPlayers.length} {pendingPlayers.length === 1 ? 'entry needs' : 'entries need'} a partner before generating the draw.
              </Text>

              <ScrollView style={s.modalScroll} showsVerticalScrollIndicator={false}>
                {pendingPlayers.map((p) => {
                  const pName = p.displayName ?? p.userName;
                  const isMergeOpen = mergeTargetId === p.id;
                  const isAddOpen = addPartnerForId === p.id;
                  const otherPending = pendingPlayers.filter((o) => o.id !== p.id);

                  return (
                    <View key={p.id} style={s.resolveCard}>
                      <View style={s.resolveCardHeader}>
                        <Text style={s.resolvePlayerName}>{pName}</Text>
                        {p.phone ? (
                          <Text style={s.resolvePhone}>{'\u260E'} {p.phone.replace('+91', '')}</Text>
                        ) : null}
                      </View>

                      {/* Action buttons */}
                      {!isMergeOpen && !isAddOpen && (
                        <View style={s.resolveActions}>
                          {otherPending.length > 0 && (
                            <TouchableOpacity
                              style={s.mergeBtn}
                              onPress={() => { setMergeTargetId(p.id); setAddPartnerForId(null); }}
                            >
                              <Text style={s.mergeBtnText}>MERGE</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={s.addPartnerBtn}
                            onPress={() => { setAddPartnerForId(p.id); setMergeTargetId(null); }}
                          >
                            <Text style={s.addPartnerBtnText}>ADD PARTNER</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Merge picker */}
                      {isMergeOpen && (
                        <View style={s.mergeSection}>
                          <Text style={s.mergeSectionLabel}>Select player to merge with:</Text>
                          {otherPending.map((o) => (
                            <TouchableOpacity
                              key={o.id}
                              style={s.mergeOption}
                              onPress={() => handleMerge(p.id, o.id)}
                              disabled={resolving}
                            >
                              <Text style={s.mergeOptionText}>
                                {o.displayName ?? o.userName}
                              </Text>
                              {resolving ? (
                                <ActivityIndicator size="small" color={'#2196F3'} />
                              ) : (
                                <Text style={s.mergeArrow}>{'\u2192'}</Text>
                              )}
                            </TouchableOpacity>
                          ))}
                          <TouchableOpacity onPress={() => setMergeTargetId(null)}>
                            <Text style={s.cancelLink}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Add partner inline */}
                      {isAddOpen && (
                        <View style={s.addPartnerSection}>
                          <TextInput
                            style={s.input}
                            placeholder="Partner Name *"
                            placeholderTextColor={'#94A3B8'}
                            value={resolvePartnerName}
                            onChangeText={setResolvePartnerName}
                          />
                          <View style={s.phoneRow}>
                            <View style={s.phonePrefix}><Text style={s.phonePrefixText}>+91</Text></View>
                            <TextInput
                              style={[s.input, s.phoneInput]}
                              placeholder="Partner Phone (optional)"
                              placeholderTextColor={'#94A3B8'}
                              value={resolvePartnerPhone}
                              onChangeText={(t) => setResolvePartnerPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                              keyboardType="phone-pad"
                              maxLength={10}
                            />
                          </View>
                          <View style={s.addPartnerActions}>
                            <TouchableOpacity onPress={() => { setAddPartnerForId(null); setResolvePartnerName(''); setResolvePartnerPhone(''); }}>
                              <Text style={s.cancelLink}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[s.savePartnerBtn, resolving && { opacity: 0.6 }]}
                              onPress={() => handleAddPartner(p.id)}
                              disabled={resolving}
                            >
                              {resolving ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text style={s.savePartnerBtnText}>Save</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}

                {pendingPlayers.length === 0 && (
                  <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                    <Text style={{ color: '#06D6A0', fontSize: 14, fontWeight: '700' }}>
                      All partners resolved!
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Modal footer */}
              <View style={s.modalFooter}>
                <TouchableOpacity
                  style={s.modalCancelBtn}
                  onPress={() => setShowResolveModal(false)}
                >
                  <Text style={s.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                {pendingPlayers.length === 0 ? (
                  <TouchableOpacity
                    style={s.modalGenerateBtn}
                    onPress={() => { setShowResolveModal(false); proceedGenerateDraw(); }}
                  >
                    <Text style={s.modalGenerateBtnText}>GENERATE DRAW</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={s.modalSkipBtn}
                    onPress={() => {
                      setShowResolveModal(false);
                      xConfirm(
                        'Skip Unresolved',
                        `${pendingPlayers.length} entries without partners will be excluded from the draw.`,
                        () => proceedGenerateDraw(),
                        'Generate Anyway',
                      );
                    }}
                  >
                    <Text style={s.modalSkipBtnText}>SKIP & GENERATE</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CARD_BG = '#F5F7FA';
const CARD_BORDER = '#F5F7FA';

const s = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#1A1D21',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Quick actions
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
    zIndex: 10,
  },
  actionBtn: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionBtnText: {
    color: '#2196F3',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Auto-seed menu
  autoMenu: {
    position: 'absolute',
    top: 42,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 8,
    minWidth: 200,
    zIndex: 20,
  },
  autoMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  autoMenuText: {
    color: '#1A1D21',
    fontSize: 13,
    fontWeight: '500',
  },

  // Add form
  addForm: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
  },
  addFormTitle: {
    color: '#1A1D21',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  addSectionLabel: {
    color: '#2196F3',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 4,
  },
  addHint: {
    color: '#FFB300',
    fontSize: 11,
    fontWeight: '500',
    marginTop: -4,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F5F7FA',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 8,
    color: '#1A1D21',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  phonePrefix: {
    backgroundColor: '#F5F7FA',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 54,
  },
  phonePrefixText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#001E40',
  },
  phoneInput: {
    flex: 1,
    marginBottom: 0,
  },
  addFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 10,
  },
  addCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addCancelText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  addSubmitBtn: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  addSubmitText: {
    color: '#1A1D21',
    fontSize: 13,
    fontWeight: '700',
  },

  // Player list
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 200,
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#1A1D21',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubText: {
    color: '#64748B',
    fontSize: 13,
  },

  // Player row
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  seedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  seedNum: {
    color: '#1A1D21',
    fontSize: 14,
    fontWeight: '900',
  },
  playerInfo: {
    flex: 1,
    marginLeft: 4,
  },
  teamPlayerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 1,
  },
  playerName: {
    color: '#1A1D21',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  partnerName: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  phoneInline: {
    color: '#94A3B8',
    fontSize: 11,
  },
  partnerNeededWrap: {
    backgroundColor: 'rgba(255,152,0,0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  partnerNeededText: {
    color: '#FFB300',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ratingCol: {
    alignItems: 'center',
    marginRight: 8,
  },
  ratingBadge: {
    backgroundColor: 'rgba(255,183,3,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  ratingText: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '800',
  },
  newBadge: {
    backgroundColor: 'rgba(33,150,243,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  newBadgeText: {
    color: '#2196F3',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  arrows: {
    alignItems: 'center',
    gap: 4,
  },
  arrow: {
    color: '#475569',
    fontSize: 16,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  arrowDisabled: {
    opacity: 0.2,
  },

  // Preview
  previewToggle: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  previewToggleText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  previewContainer: {
    maxHeight: 160,
    paddingHorizontal: 16,
  },
  poolRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  poolLabel: {
    color: '#2196F3',
    fontSize: 13,
    fontWeight: '700',
    width: 56,
  },
  poolPlayers: {
    color: '#475569',
    fontSize: 13,
    flex: 1,
  },

  // Sticky footer
  stickyFooter: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  generateBtn: {
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(33,150,243,0.3)',
  },
  generateBtnText: {
    color: '#1A1D21',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Resolve Partners Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalTitle: {
    color: '#1A1D21',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: '#64748B',
    fontSize: 13,
    marginBottom: 16,
  },
  modalScroll: {
    maxHeight: 400,
  },
  resolveCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  resolveCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resolvePlayerName: {
    color: '#1A1D21',
    fontSize: 15,
    fontWeight: '700',
  },
  resolvePhone: {
    color: '#94A3B8',
    fontSize: 12,
  },
  resolveActions: {
    flexDirection: 'row',
    gap: 8,
  },
  mergeBtn: {
    flex: 1,
    backgroundColor: 'rgba(33,150,243,0.15)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  mergeBtnText: {
    color: '#2196F3',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  addPartnerBtn: {
    flex: 1,
    backgroundColor: 'rgba(6,214,160,0.15)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addPartnerBtnText: {
    color: '#06D6A0',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mergeSection: {
    marginTop: 4,
  },
  mergeSectionLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  mergeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(33,150,243,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  mergeOptionText: {
    color: '#1A1D21',
    fontSize: 14,
    fontWeight: '600',
  },
  mergeArrow: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelLink: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 6,
  },
  addPartnerSection: {
    marginTop: 4,
  },
  addPartnerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  savePartnerBtn: {
    backgroundColor: '#06D6A0',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  savePartnerBtnText: {
    color: '#1A1D21',
    fontSize: 13,
    fontWeight: '700',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },
  modalGenerateBtn: {
    flex: 1,
    backgroundColor: '#2196F3',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalGenerateBtnText: {
    color: '#1A1D21',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  modalSkipBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,152,0,0.15)',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSkipBtnText: {
    color: '#FFB300',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
