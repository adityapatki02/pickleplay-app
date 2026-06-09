/**
 * ScoreLoggerScreen — shadow-scoring tool.
 *
 * For events we don't run ourselves (e.g. AIPA West Zone). The organizer
 * picks a category, picks Team A + Team B from a dropdown, punches in the
 * score, and saves. Each save creates a Match row + MatchScore via the
 * /manual-matches endpoint.
 *
 * Flow:
 *   1. Landing grid of all 40 categories (with logged-match counts)
 *   2. Tap category → see logged matches + add-match form
 *   3. After save: form clears, match appears at top of list, stay on category
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { matchesApi } from '../../api/matches.api';
import { tournamentsApi } from '../../api/tournaments.api';
import { xAlert } from '../../utils/alert';
import { YColors, YTopBar } from '../../components/yoiden';

type CategorySummary = {
  id: string;
  name: string;
  format: string;
  gender?: string;
  maxTeams?: number;
  registeredTeams?: number;
  matchCount?: number; // count of logged manual matches (filled lazily on drill-in)
};

type Team = { id: string; name: string; seedNumber?: number };

type LoggedMatch = {
  id: string;
  round: string;
  matchNumber: number;
  teamAId: string;
  teamBId: string;
  winnerId?: string;
  status: string;
  scores?: { gameNumber: number; teamAScore: number; teamBScore: number }[];
};

const ROUND_OPTIONS = ['Pool', 'QF', 'SF', 'Final', 'Other'];

export default function ScoreLoggerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const tournamentId: string = route.params?.tournamentId;

  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  // Two-step picker: 'brackets' → pick U12/U14/.../Beg/Int → 'events' → pick
  // M Singles / W Singles / etc. → 'logger' for the chosen category.
  const [view, setView] = useState<'brackets' | 'events' | 'logger'>('brackets');
  const [activeBracket, setActiveBracket] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<LoggedMatch[]>([]);
  const [loadingCategory, setLoadingCategory] = useState(false);

  // Form state — shadow scoring only, no scheduling here
  const [teamAId, setTeamAId] = useState<string | null>(null);
  const [teamBId, setTeamBId] = useState<string | null>(null);
  const [round, setRound] = useState<string>('Pool');
  // Games array supports best-of-1 by default; +Add Game appends another set
  // for best-of-3 / best-of-5 scoring.
  const [games, setGames] = useState<{ a: string; b: string }[]>([{ a: '', b: '' }]);
  const [saving, setSaving] = useState(false);

  // Picker modal state
  const [pickerOpen, setPickerOpen] = useState<null | 'A' | 'B' | 'round'>(null);

  // Walk-in: free-form player add (for names not in the registration list)
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [walkinName, setWalkinName] = useState('');
  const [walkinPartner, setWalkinPartner] = useState('');
  const [walkinSaving, setWalkinSaving] = useState(false);

  // ── Fetch categories on mount ─────────────────────────────────────
  const fetchCategories = useCallback(async () => {
    try {
      const res = await tournamentsApi.getById(tournamentId);
      const t: any = (res.data as any)?.data ?? res.data;
      const cats: any[] = Array.isArray(t?.categories) ? t.categories : [];
      setCategories(
        cats.map((c) => ({
          id: c.id,
          name: c.name,
          format: c.format,
          gender: c.gender,
          maxTeams: c.maxTeams,
          registeredTeams: c.registeredTeams ?? 0,
        })),
      );
    } catch {}
    setCategoriesLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // ── When a category is opened, fetch its teams + logged matches ───
  const fetchCategoryData = useCallback(async (catId: string) => {
    setLoadingCategory(true);
    try {
      // Logged matches FIRST — server enriches with team names directly from
      // the teams table, so walk-in teams are included.
      const mRes = await matchesApi.listManualMatches(tournamentId, catId);
      const mData: any[] = (mRes.data as any)?.data ?? mRes.data ?? [];
      setMatches(mData);

      // Build the team picker from BOTH sources:
      //   1) the seeding endpoint (registered players + their teams)
      //   2) every team referenced by an existing logged match (catches walk-ins)
      const seedRes = await apiClient.get(
        `/tournaments/${tournamentId}/categories/${catId}/seeding`,
      );
      const seedData: any[] = (seedRes.data as any)?.data ?? seedRes.data ?? [];
      const merged: Record<string, string> = {};
      for (const p of seedData) {
        if (!p.teamId) continue;
        merged[p.teamId] = p.isDoubles && p.partner
          ? `${p.userName} / ${p.partner.userName}`
          : p.userName;
      }
      // Pull names referenced by logged matches that aren't in the seeding list
      for (const m of mData) {
        if (m.teamAId && m.teamAName && !merged[m.teamAId]) merged[m.teamAId] = m.teamAName;
        if (m.teamBId && m.teamBName && !merged[m.teamBId]) merged[m.teamBId] = m.teamBName;
      }
      const teamList: Team[] = Object.entries(merged)
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setTeams(teamList);
    } catch (e: any) {
      xAlert('Error', e?.response?.data?.message ?? 'Failed to load category');
    } finally {
      setLoadingCategory(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    if (view === 'logger' && activeCategoryId) fetchCategoryData(activeCategoryId);
  }, [view, activeCategoryId, fetchCategoryData]);

  // ── Helpers ────────────────────────────────────────────────────────
  const teamName = useCallback((id?: string) => teams.find((t) => t.id === id)?.name ?? 'TBD', [teams]);

  const resetForm = () => {
    setTeamAId(null);
    setTeamBId(null);
    setRound('Pool');
    setGames([{ a: '', b: '' }]);
  };

  // Walk-in: create a free-form team in this category and add to the picker list.
  // Reuses the existing manual-register endpoint already used on SeedingScreen.
  const handleWalkinSave = async () => {
    if (!activeCategoryId) return;
    const cat = categories.find((c) => c.id === activeCategoryId);
    const isDoubles = cat?.format === 'doubles';
    if (!walkinName.trim()) {
      xAlert('Required', 'Player name is required.');
      return;
    }
    if (isDoubles && !walkinPartner.trim()) {
      xAlert('Required', 'Partner name is required for doubles.');
      return;
    }
    setWalkinSaving(true);
    try {
      await apiClient.post(
        `/tournaments/${tournamentId}/categories/${activeCategoryId}/manual-register`,
        {
          name: walkinName.trim(),
          partnerName: isDoubles ? walkinPartner.trim() : undefined,
          paymentMethod: 'venue',
        },
      );
      setWalkinName('');
      setWalkinPartner('');
      setWalkinOpen(false);
      await fetchCategoryData(activeCategoryId);
    } catch (e: any) {
      xAlert('Add failed', e?.response?.data?.message ?? 'Could not add player');
    } finally {
      setWalkinSaving(false);
    }
  };

  const handleSave = async () => {
    if (!activeCategoryId) return;
    if (!teamAId || !teamBId) {
      xAlert('Missing teams', 'Pick both Team A and Team B before saving.');
      return;
    }
    if (teamAId === teamBId) {
      xAlert('Same team', 'Team A and Team B must be different.');
      return;
    }

    // Parse + validate games. Three accepted states:
    //   - all games blank → log matchup with no result
    //   - all games filled → submit games array, winner derived server-side
    //   - mixed (some filled some blank) → error
    const parsed: { teamAScore: number; teamBScore: number }[] = [];
    let filledCount = 0;
    let blankCount = 0;
    for (let i = 0; i < games.length; i++) {
      const g = games[i];
      const aRaw = g.a.trim();
      const bRaw = g.b.trim();
      if (aRaw === '' && bRaw === '') { blankCount++; continue; }
      if (aRaw === '' || bRaw === '') {
        xAlert('Score incomplete', `Game ${i + 1}: enter both scores or leave both blank.`);
        return;
      }
      const a = Number(aRaw);
      const b = Number(bRaw);
      if (Number.isNaN(a) || Number.isNaN(b)) {
        xAlert('Bad number', `Game ${i + 1}: scores must be numeric.`);
        return;
      }
      if (a === b) {
        xAlert('Tied score', `Game ${i + 1}: scores cannot be tied.`);
        return;
      }
      parsed.push({ teamAScore: a, teamBScore: b });
      filledCount++;
    }
    if (filledCount > 0 && blankCount > 0) {
      xAlert('Partial scores', 'Fill all games or clear blanks at the end. Don\'t leave a blank between filled games.');
      return;
    }
    // Best-of-N winner check
    if (filledCount > 0) {
      let aWins = 0, bWins = 0;
      for (const g of parsed) g.teamAScore > g.teamBScore ? aWins++ : bWins++;
      if (aWins === bWins) {
        xAlert('Match tied', 'Add one more game so a winner is decided.');
        return;
      }
    }

    setSaving(true);
    try {
      await matchesApi.logManualMatch(tournamentId, activeCategoryId, {
        teamAId, teamBId,
        round: round.toLowerCase(),
        games: parsed.length > 0 ? parsed : undefined,
      });
      resetForm();
      await fetchCategoryData(activeCategoryId);
    } catch (e: any) {
      xAlert('Save failed', e?.response?.data?.message ?? 'Could not log match');
    } finally {
      setSaving(false);
    }
  };

  // ── Render: loading ────────────────────────────────────────────────
  if (categoriesLoading) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.center}><ActivityIndicator size="large" color={YColors.ink} /></View>
      </SafeAreaView>
    );
  }

  // ── Parse categories into bracket → events map ────────────────────
  // Category names are shaped "<bracket> — <event>" (e.g. "U12 — Boys Singles",
  // "Open — Men's Doubles"). Split on the em dash; fall back to the full name
  // if a category doesn't follow the convention.
  const SEP = ' — ';
  // Stable bracket display order (matches AIPA's poster grouping)
  const BRACKET_ORDER = ['U12', 'U14', 'U18', 'Open', '35+', '50+', '60+', 'Beg/Int'];
  type GroupedCat = { id: string; eventName: string; count: number; format: string };
  const byBracket = new Map<string, GroupedCat[]>();
  for (const c of categories) {
    const i = c.name.indexOf(SEP);
    const bracket = i >= 0 ? c.name.slice(0, i).trim() : c.name;
    const eventName = i >= 0 ? c.name.slice(i + SEP.length).trim() : c.name;
    if (!byBracket.has(bracket)) byBracket.set(bracket, []);
    byBracket.get(bracket)!.push({
      id: c.id,
      eventName,
      count: c.registeredTeams ?? 0,
      format: c.format,
    });
  }
  const bracketList = [
    ...BRACKET_ORDER.filter((b) => byBracket.has(b)),
    ...Array.from(byBracket.keys()).filter((b) => !BRACKET_ORDER.includes(b)),
  ];

  // ── Render: step 1 — bracket grid ─────────────────────────────────
  if (view === 'brackets') {
    return (
      <SafeAreaView style={s.screen}>
        <YTopBar
          eyebrow="ORGANIZER · SHADOW SCORING"
          title="SCORE LOG"
          onBack={() => navigation.goBack()}
        />
        <ScrollView contentContainerStyle={s.gridScroll}>
          <Text style={s.gridHint}>Pick a bracket</Text>
          <View style={s.gridWrap}>
            {bracketList.map((bracket) => {
              const events = byBracket.get(bracket) ?? [];
              const totalTeams = events.reduce((sum, e) => sum + e.count, 0);
              return (
                <TouchableOpacity
                  key={bracket}
                  style={s.bracketTile}
                  onPress={() => {
                    setActiveBracket(bracket);
                    setView('events');
                  }}
                >
                  <Text style={s.bracketTileName} numberOfLines={1}>{bracket}</Text>
                  <View style={s.gridTileFooter}>
                    <View style={s.bracketPill}>
                      <Text style={s.bracketPillText}>
                        {totalTeams} teams · {events.length} events
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Render: step 2 — event grid for the chosen bracket ────────────
  if (view === 'events') {
    const events = activeBracket ? byBracket.get(activeBracket) ?? [] : [];
    return (
      <SafeAreaView style={s.screen}>
        <YTopBar
          eyebrow={`${activeBracket?.toUpperCase()} · PICK EVENT`}
          title="SCORE LOG"
          onBack={() => { setActiveBracket(null); setView('brackets'); }}
        />
        <ScrollView contentContainerStyle={s.gridScroll}>
          <Text style={s.gridHint}>Pick an event in {activeBracket}</Text>
          <View style={s.gridWrap}>
            {events.map((ev) => (
              <TouchableOpacity
                key={ev.id}
                style={s.gridTile}
                onPress={() => {
                  setActiveCategoryId(ev.id);
                  setView('logger');
                }}
              >
                <Text style={s.gridTileName} numberOfLines={2}>{ev.eventName}</Text>
                <View style={s.gridTileFooter}>
                  <View style={[s.pill, ev.count === 0 && s.pillMuted]}>
                    <Text style={[s.pillText, ev.count === 0 && s.pillTextMuted]}>
                      {ev.count} teams
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Render: logger ────────────────────────────────────────────────
  const currentCat = categories.find((c) => c.id === activeCategoryId);
  return (
    <SafeAreaView style={s.screen}>
      <YTopBar
        eyebrow={currentCat?.name?.toUpperCase() ?? 'CATEGORY'}
        title="LOG MATCH"
        onBack={() => setView('events')}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, flexGrow: 1 }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {/* Walk-in: free-form add (for names not on the registration list) */}
        <TouchableOpacity style={s.walkinBtn} onPress={() => setWalkinOpen(true)}>
          <Text style={s.walkinBtnText}>+ ADD PLAYER (walk-in)</Text>
        </TouchableOpacity>

        {/* Add match form */}
        <View style={s.formCard}>
          <Text style={s.formLabel}>ROUND</Text>
          <TouchableOpacity style={s.pickerBtn} onPress={() => setPickerOpen('round')}>
            <Text style={s.pickerBtnText}>{round}</Text>
            <Text style={s.pickerArrow}>▾</Text>
          </TouchableOpacity>

          <Text style={[s.formLabel, { marginTop: 14 }]}>TEAM A</Text>
          <TouchableOpacity
            style={[s.pickerBtn, !teamAId && s.pickerBtnEmpty]}
            onPress={() => setPickerOpen('A')}
          >
            <Text style={[s.pickerBtnText, !teamAId && s.pickerBtnTextEmpty]} numberOfLines={1}>
              {teamAId ? teamName(teamAId) : 'Select team…'}
            </Text>
            <Text style={s.pickerArrow}>▾</Text>
          </TouchableOpacity>

          <View style={s.vs}><Text style={s.vsText}>vs</Text></View>

          <Text style={s.formLabel}>TEAM B</Text>
          <TouchableOpacity
            style={[s.pickerBtn, !teamBId && s.pickerBtnEmpty]}
            onPress={() => setPickerOpen('B')}
          >
            <Text style={[s.pickerBtnText, !teamBId && s.pickerBtnTextEmpty]} numberOfLines={1}>
              {teamBId ? teamName(teamBId) : 'Select team…'}
            </Text>
            <Text style={s.pickerArrow}>▾</Text>
          </TouchableOpacity>

          {/* Games — big mobile-friendly score cards, one per set */}
          <Text style={[s.formLabel, { marginTop: 18 }]}>SCORES</Text>
          {games.map((g, idx) => {
            const teamAShort = teamAId ? teamName(teamAId).split('/')[0].trim().slice(0, 14) : 'TEAM A';
            const teamBShort = teamBId ? teamName(teamBId).split('/')[0].trim().slice(0, 14) : 'TEAM B';
            return (
              <View key={idx} style={s.gameCard}>
                <View style={s.gameCardHeader}>
                  <Text style={s.gameCardLabel}>GAME {idx + 1}</Text>
                  {games.length > 1 && (
                    <TouchableOpacity
                      onPress={() => setGames(games.filter((_, i) => i !== idx))}
                      style={s.gameCardRemove}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Text style={s.gameCardRemoveText}>×</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={s.gameCardScores}>
                  <View style={s.gameCardCol}>
                    <TextInput
                      style={s.gameCardInput}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      value={g.a}
                      onChangeText={(v) => {
                        const cleaned = v.replace(/[^0-9]/g, '').slice(0, 3);
                        const next = [...games]; next[idx] = { ...next[idx], a: cleaned }; setGames(next);
                      }}
                      placeholder="0"
                      placeholderTextColor={YColors.ink3}
                      maxLength={3}
                      selectTextOnFocus
                      autoFocus={idx === games.length - 1 && idx > 0}
                    />
                    <Text style={s.gameCardTeamLabel} numberOfLines={1}>{teamAShort.toUpperCase()}</Text>
                  </View>
                  <Text style={s.gameCardSep}>vs</Text>
                  <View style={s.gameCardCol}>
                    <TextInput
                      style={s.gameCardInput}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      value={g.b}
                      onChangeText={(v) => {
                        const cleaned = v.replace(/[^0-9]/g, '').slice(0, 3);
                        const next = [...games]; next[idx] = { ...next[idx], b: cleaned }; setGames(next);
                      }}
                      placeholder="0"
                      placeholderTextColor={YColors.ink3}
                      maxLength={3}
                      selectTextOnFocus
                    />
                    <Text style={s.gameCardTeamLabel} numberOfLines={1}>{teamBShort.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            );
          })}
          <TouchableOpacity
            style={s.addGameBtn}
            onPress={() => setGames([...games, { a: '', b: '' }])}
          >
            <Text style={s.addGameText}>＋ ADD ANOTHER GAME</Text>
          </TouchableOpacity>

          {/* Live winner preview */}
          {(() => {
            let aWins = 0, bWins = 0;
            for (const g of games) {
              const a = Number(g.a), b = Number(g.b);
              if (g.a.trim() && g.b.trim() && !Number.isNaN(a) && !Number.isNaN(b) && a !== b) {
                a > b ? aWins++ : bWins++;
              }
            }
            if (aWins === 0 && bWins === 0) return null;
            if (aWins === bWins) {
              return (
                <View style={s.winnerBanner}>
                  <Text style={s.winnerLabelMuted}>TIED</Text>
                  <Text style={s.winnerNameMuted}>{aWins}-{bWins} · add another game</Text>
                </View>
              );
            }
            const winnerName = aWins > bWins
              ? (teamAId ? teamName(teamAId) : 'Team A')
              : (teamBId ? teamName(teamBId) : 'Team B');
            return (
              <View style={s.winnerBanner}>
                <Text style={s.winnerLabel}>WINNER</Text>
                <Text style={s.winnerName} numberOfLines={1}>{winnerName} ({aWins}-{bWins})</Text>
              </View>
            );
          })()}

          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={s.saveBtnText}>{saving ? 'SAVING…' : 'SAVE MATCH'}</Text>
          </TouchableOpacity>
        </View>

        {/* Logged matches list */}
        <Text style={s.listHeader}>
          LOGGED MATCHES {matches.length > 0 ? `(${matches.length})` : ''}
        </Text>
        {loadingCategory ? (
          <View style={s.center}><ActivityIndicator color={YColors.ink} /></View>
        ) : matches.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyText}>No matches logged yet. Use the form above to start.</Text>
          </View>
        ) : (
          matches.map((m: any) => {
            const winA = m.winnerId === m.teamAId;
            // Prefer the backend-enriched names (work for walk-in teams), fall
            // back to the picker list, then a final 'TBD'.
            const aName = m.teamAName || teamName(m.teamAId);
            const bName = m.teamBName || teamName(m.teamBId);
            // Show all sets for best-of-N matches: "11-7, 9-11, 11-5"
            const scoresA = (m.scores || []).map((s: any) => s.teamAScore).join(', ');
            const scoresB = (m.scores || []).map((s: any) => s.teamBScore).join(', ');
            return (
              <View key={m.id} style={s.matchCard}>
                <View style={s.matchHeader}>
                  <Text style={s.matchRound}>{m.round.toUpperCase()} · #{m.matchNumber}</Text>
                  <Text style={s.matchStatus}>{m.status.toUpperCase()}</Text>
                </View>
                <View style={s.matchTeams}>
                  <Text style={[s.matchTeamName, winA && s.matchTeamWin]} numberOfLines={1}>
                    {aName}
                  </Text>
                  <Text style={[s.matchScore, winA && s.matchTeamWin]}>
                    {scoresA || '—'}
                  </Text>
                </View>
                <View style={s.matchTeams}>
                  <Text style={[s.matchTeamName, !winA && m.winnerId && s.matchTeamWin]} numberOfLines={1}>
                    {bName}
                  </Text>
                  <Text style={[s.matchScore, !winA && m.winnerId && s.matchTeamWin]}>
                    {scoresB || '—'}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Picker modal */}
      <Modal
        visible={pickerOpen !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(null)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>
              {pickerOpen === 'round' ? 'Pick round' : `Pick Team ${pickerOpen}`}
            </Text>
            <ScrollView style={{ maxHeight: 480 }}>
              {pickerOpen === 'round'
                ? ROUND_OPTIONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={s.modalRow}
                    onPress={() => { setRound(r); setPickerOpen(null); }}
                  >
                    <Text style={s.modalRowText}>{r}</Text>
                  </TouchableOpacity>
                ))
                : (teams.length === 0 ? (
                  <Text style={s.emptyText}>No teams in this category yet.</Text>
                ) : teams.map((t) => {
                  const otherId = pickerOpen === 'A' ? teamBId : teamAId;
                  const disabled = t.id === otherId;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[s.modalRow, disabled && { opacity: 0.4 }]}
                      disabled={disabled}
                      onPress={() => {
                        if (pickerOpen === 'A') setTeamAId(t.id);
                        else setTeamBId(t.id);
                        setPickerOpen(null);
                      }}
                    >
                      <Text style={s.modalRowText}>{t.name}</Text>
                      {disabled && <Text style={s.modalRowHint}>already Team {pickerOpen === 'A' ? 'B' : 'A'}</Text>}
                    </TouchableOpacity>
                  );
                }))
              }
            </ScrollView>
            <TouchableOpacity style={s.modalCancel} onPress={() => setPickerOpen(null)}>
              <Text style={s.modalCancelText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Walk-in add modal */}
      <Modal
        visible={walkinOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setWalkinOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Add walk-in player</Text>
            {(() => {
              const isDoubles = categories.find((c) => c.id === activeCategoryId)?.format === 'doubles';
              return (
                <>
                  <Text style={s.formLabel}>PLAYER NAME</Text>
                  <TextInput
                    style={s.walkinInput}
                    value={walkinName}
                    onChangeText={setWalkinName}
                    placeholder="e.g. Rohan Sharma"
                    placeholderTextColor={YColors.ink3}
                    autoCapitalize="words"
                  />
                  {isDoubles && (
                    <>
                      <Text style={[s.formLabel, { marginTop: 12 }]}>PARTNER NAME</Text>
                      <TextInput
                        style={s.walkinInput}
                        value={walkinPartner}
                        onChangeText={setWalkinPartner}
                        placeholder="e.g. Heet Patel"
                        placeholderTextColor={YColors.ink3}
                        autoCapitalize="words"
                      />
                    </>
                  )}
                </>
              );
            })()}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity
                style={[s.modalCancel, { flex: 1, backgroundColor: '#EEE' }]}
                onPress={() => { setWalkinOpen(false); setWalkinName(''); setWalkinPartner(''); }}
                disabled={walkinSaving}
              >
                <Text style={[s.modalCancelText, { color: YColors.ink }]}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalCancel, { flex: 1, opacity: walkinSaving ? 0.5 : 1 }]}
                onPress={handleWalkinSave}
                disabled={walkinSaving}
              >
                <Text style={s.modalCancelText}>{walkinSaving ? 'SAVING…' : 'ADD'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: YColors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  // Grid
  gridScroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  gridHint: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: YColors.ink2, textTransform: 'uppercase', marginBottom: 12 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridTile: {
    width: '48.5%', minHeight: 92,
    backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12,
    justifyContent: 'space-between',
  },
  gridTileName: { fontSize: 13, fontWeight: '900', color: YColors.ink, letterSpacing: 0.3, textTransform: 'uppercase', lineHeight: 16 },
  // Bracket tiles (step 1) are larger and louder so the 8 options pop
  bracketTile: {
    width: '48.5%', minHeight: 110,
    backgroundColor: YColors.ink, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 16,
    justifyContent: 'space-between',
  },
  bracketTileName: {
    fontSize: 28, fontWeight: '900', color: YColors.lime,
    letterSpacing: 0.5, lineHeight: 30,
  },
  // Lime-pill on ink-tile inverts the regular pill so it's readable on the dark bg
  bracketPill: {
    backgroundColor: YColors.lime,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  bracketPillText: {
    color: YColors.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  gridTileFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  pill: { backgroundColor: YColors.ink, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillMuted: { backgroundColor: YColors.line },
  pillText: { color: YColors.lime, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  pillTextMuted: { color: YColors.ink2 },

  // Form
  formCard: { backgroundColor: YColors.bg2, borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 1, borderColor: YColors.line },
  formLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: YColors.ink2, textTransform: 'uppercase', marginBottom: 6 },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: YColors.bg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: YColors.line },
  pickerBtnEmpty: { borderStyle: 'dashed' },
  pickerBtnText: { fontSize: 14, fontWeight: '700', color: YColors.ink, flex: 1 },
  pickerBtnTextEmpty: { color: YColors.ink3, fontWeight: '500' },
  pickerArrow: { fontSize: 12, color: YColors.ink2, marginLeft: 8 },

  scoreRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 },
  scoreLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: YColors.ink2, textTransform: 'uppercase', flex: 1 },
  scoreInput: { width: 80, backgroundColor: YColors.bg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, fontWeight: '900', color: YColors.ink, borderWidth: 1, borderColor: YColors.line, textAlign: 'center' },

  // Multi-game cards — mobile-friendly big tap targets
  gameCard: {
    marginTop: 10, padding: 14,
    backgroundColor: YColors.bg, borderRadius: 14,
    borderWidth: 1, borderColor: YColors.line,
  },
  gameCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  gameCardLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.6, color: YColors.ink2 },
  gameCardRemove: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: YColors.line, alignItems: 'center', justifyContent: 'center' },
  gameCardRemoveText: { fontSize: 20, color: YColors.ink2, fontWeight: '900', lineHeight: 22 },
  gameCardScores: { flexDirection: 'row', alignItems: 'center' },
  gameCardCol: { flex: 1, alignItems: 'stretch' },
  gameCardInput: {
    height: 64,
    backgroundColor: '#FFFFFF', borderRadius: 12,
    borderWidth: 1.5, borderColor: YColors.line,
    fontSize: 36, fontWeight: '900', color: YColors.ink, textAlign: 'center',
    paddingHorizontal: 8,
  },
  gameCardTeamLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, color: YColors.ink3, textAlign: 'center', marginTop: 6 },
  gameCardSep: { fontSize: 14, fontWeight: '900', color: YColors.ink3, paddingHorizontal: 14, marginBottom: 22 },
  addGameBtn: {
    marginTop: 12, paddingVertical: 14, alignItems: 'center', borderRadius: 12,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: YColors.line, backgroundColor: YColors.bg,
  },
  addGameText: { fontSize: 12, fontWeight: '900', letterSpacing: 1.6, color: YColors.ink2 },

  // Winner banner — appears once enough games are filled to decide a winner
  winnerBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: YColors.ink, borderRadius: 10 },
  winnerLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: YColors.lime },
  winnerName: { fontSize: 14, fontWeight: '900', color: '#FFFFFF', flexShrink: 1 },
  winnerLabelMuted: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: '#FFB300' },
  winnerNameMuted: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },

  vs: { alignItems: 'center', marginVertical: 14 },
  vsText: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: YColors.ink3 },

  saveBtn: { backgroundColor: YColors.ink, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  saveBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },


  // Match list
  listHeader: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: YColors.ink2, textTransform: 'uppercase', marginTop: 24, marginBottom: 10 },
  emptyState: { padding: 24, alignItems: 'center', backgroundColor: YColors.bg2, borderRadius: 14, borderWidth: 1, borderColor: YColors.line, borderStyle: 'dashed' },
  emptyText: { fontSize: 12, color: YColors.ink3, textAlign: 'center' },

  matchCard: { backgroundColor: YColors.bg2, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: YColors.line },
  matchHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  matchRound: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: YColors.ink2 },
  matchStatus: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, color: YColors.ink3 },
  matchTeams: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  matchTeamName: { fontSize: 13, fontWeight: '700', color: YColors.ink, flex: 1 },
  matchTeamWin: { fontWeight: '900' },
  matchScore: { fontSize: 16, fontWeight: '900', color: YColors.ink, minWidth: 30, textAlign: 'right' },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: YColors.bg2, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '75%' },
  modalTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 1.5, color: YColors.ink, textTransform: 'uppercase', marginBottom: 14 },
  modalRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: YColors.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalRowText: { fontSize: 14, fontWeight: '700', color: YColors.ink, flex: 1 },
  modalRowHint: { fontSize: 10, color: YColors.ink3, marginLeft: 8 },
  modalCancel: { marginTop: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: YColors.ink, borderRadius: 12 },
  modalCancelText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12, letterSpacing: 1.5 },

  // Walk-in add button + modal input
  walkinBtn: {
    marginTop: 12, paddingVertical: 10,
    backgroundColor: YColors.lime, borderRadius: 10,
    alignItems: 'center', borderWidth: 1, borderColor: YColors.ink,
  },
  walkinBtnText: { color: YColors.ink, fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  walkinInput: {
    backgroundColor: YColors.bg, borderRadius: 10, borderWidth: 1, borderColor: YColors.line,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontWeight: '700', color: YColors.ink,
    marginTop: 4,
  },
});
