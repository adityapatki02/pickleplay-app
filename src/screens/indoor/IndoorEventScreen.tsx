import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, Modal, TextInput } from 'react-native';
import { indoorApi } from '../../api/indoor.api';
import { BracketView } from './components/BracketView';
import { IndoorHeader } from './components/IndoorHeader';
import { SportyBackground } from './components/SportyBackground';
import { useManage } from './manageContext';
import { T } from './indoorTheme';

export default function IndoorEventScreen({ route, navigation }: any) {
  const { competitionId } = route.params;
  const { role, pass } = useManage();
  const canScore = role === 'scorer' || role === 'admin';
  const isAdmin = role === 'admin';
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState(0);
  const [mode, setMode] = useState<'view' | 'score' | 'edit'>('view');
  const [editing, setEditing] = useState<any | null>(null);
  const [sa, setSa] = useState(''); const [sb, setSb] = useState('');
  const [winSide, setWinSide] = useState<'A' | 'B' | null>(null);
  const [player, setPlayer] = useState<any | null>(null);
  const [rename, setRename] = useState('');
  const [swapFilter, setSwapFilter] = useState('');
  const load = useCallback(() => indoorApi.competition(competitionId).then(setData), [competitionId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setMode(canScore ? 'score' : 'view'); }, [canScore]);
  useEffect(() => { if (mode !== 'view') return; const t = setInterval(load, 8000); return () => clearInterval(t); }, [mode, load]);

  if (!data) return <View style={{ flex: 1, backgroundColor: T.bg }}><IndoorHeader onBack={() => navigation.goBack()} title="Loading…" /></View>;
  const groups = data.groups; const g = groups[Math.min(tab, groups.length - 1)];
  const groupMatches = data.matches.filter((m: any) => m.groupId === g.id);
  const byName = new Map<string, any>(data.entrants.map((e: any) => [e.id, e]));
  const nameOf = (id: string | null) => (id && byName.get(id) ? byName.get(id).name : '—');

  const drawSlots = data.groups.flatMap((gg: any) =>
    data.matches.filter((mm: any) => mm.groupId === gg.id && mm.round === 0).flatMap((mm: any) => {
      const out: any[] = [];
      if (mm.entrantAId) out.push({ entrantId: mm.entrantAId, matchId: mm.id, slot: 'A', group: gg.label });
      if (mm.entrantBId) out.push({ entrantId: mm.entrantBId, matchId: mm.id, slot: 'B', group: gg.label });
      return out;
    }));

  const openScore = (m: any) => {
    setEditing(m);
    setSa(m.scoreA != null ? String(m.scoreA) : '');
    setSb(m.scoreB != null ? String(m.scoreB) : '');
    setWinSide(m.winnerEntrantId ? (m.winnerEntrantId === m.entrantAId ? 'A' : 'B') : null);
  };
  const onScoreChange = (side: 'A' | 'B', val: string) => {
    if (side === 'A') setSa(val); else setSb(val);
    const a = parseInt(side === 'A' ? val : sa, 10);
    const b = parseInt(side === 'B' ? val : sb, 10);
    if (!isNaN(a) && !isNaN(b) && a !== b) setWinSide(a > b ? 'A' : 'B');
  };
  const saveScore = async () => {
    if (!winSide || !editing) return;
    const a = parseInt(sa, 10), b = parseInt(sb, 10);
    const winnerId = winSide === 'A' ? editing.entrantAId : editing.entrantBId;
    await indoorApi.submit(editing.id, winnerId, pass, isNaN(a) ? undefined : a, isNaN(b) ? undefined : b);
    setEditing(null); setWinSide(null); await load();
  };
  const onClear = async (matchId: string) => { await indoorApi.clear(matchId, pass); await load(); };
  const onPlayerTap = (matchId: string, slot: 'A' | 'B', entrantId: string | null) => {
    if (!entrantId) return;
    setPlayer({ matchId, slot, entrantId }); setRename(nameOf(entrantId)); setSwapFilter('');
  };
  const doRename = async () => { if (rename.trim()) await indoorApi.rename(player.entrantId, rename.trim(), pass); setPlayer(null); await load(); };
  const swapWith = async (t: { matchId: string; slot: 'A' | 'B' }) => {
    await indoorApi.swap({ aMatchId: player.matchId, aSlot: player.slot, bMatchId: t.matchId, bSlot: t.slot }, pass);
    setPlayer(null); await load();
  };
  const doRedraw = async () => {
    const ok = Platform.OS !== 'web' || (globalThis as any).confirm?.('Re-draw this entire event? All current results will be cleared.');
    if (!ok) return;
    await indoorApi.redraw(competitionId, pass); await load();
  };

  const headerRight = isAdmin ? (
    <View style={s.adminBar}>
      <Pressable onPress={() => setMode('score')} style={[s.chip, mode === 'score' && s.chipOn]}><Text style={[s.chipT, mode === 'score' && s.chipTOn]}>Score</Text></Pressable>
      <Pressable onPress={() => setMode('edit')} style={[s.chip, mode === 'edit' && s.chipOn]}><Text style={[s.chipT, mode === 'edit' && s.chipTOn]}>Edit</Text></Pressable>
      <Pressable onPress={doRedraw} style={s.redraw}><Text style={s.redrawT}>Re-draw</Text></Pressable>
    </View>
  ) : canScore ? (
    <View style={s.badge}><Text style={s.badgeT}>SCORER</Text></View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <SportyBackground />
      <IndoorHeader onBack={() => navigation.goBack()} title={data.competition.eventName} right={headerRight} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ alignItems: 'center', padding: 16 }}>
        <View style={{ width: '100%', maxWidth: 1200 }}>
          {data.competition.isDraft ? <Text style={s.draft}>{'⚠️'}  Draft draw — doubles auto-paired; admin can rename pairs.</Text> : null}
          {mode === 'score' ? <Text style={s.hint}>Tap a match to enter its score.</Text> : null}
          {mode === 'edit' ? <Text style={s.hintEdit}>Tap a first-round player to rename or swap.</Text> : null}
          {groups.length > 1 ? (
            <View style={s.tabs}>{groups.map((gr: any, i: number) => (
              <Pressable key={gr.id} onPress={() => setTab(i)} style={[s.tab, i === tab && s.tabOn]}><Text style={[s.tabT, i === tab && { color: '#fff' }]}>Group {gr.label}</Text></Pressable>
            ))}</View>
          ) : null}
          <BracketView matches={groupMatches} entrants={data.entrants} mode={mode}
            onScore={openScore} onClear={onClear} onPlayerTap={onPlayerTap} />
        </View>
      </ScrollView>

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={s.overlay}><View style={s.modal}>
          <Text style={s.modalTitle}>ENTER RESULT</Text>
          <Text style={s.modalSub}>Tap the winner, enter the scores.</Text>
          {editing ? (['A', 'B'] as const).map((side) => {
            const id = side === 'A' ? editing.entrantAId : editing.entrantBId;
            const sel = winSide === side;
            return (
              <Pressable key={side} onPress={() => setWinSide(side)} style={[s.resRow, sel && s.resRowWin]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.resName, sel && s.resNameWin]} numberOfLines={1}>{nameOf(id)}</Text>
                  <Text style={[s.resTag, sel && s.resTagWin]}>{sel ? '🏆 WINNER' : 'tap to set winner'}</Text>
                </View>
                <TextInput value={side === 'A' ? sa : sb} onChangeText={(v) => onScoreChange(side, v)}
                  keyboardType="number-pad" placeholder="0" placeholderTextColor={T.faint} style={s.resScore} />
              </Pressable>
            );
          }) : null}
          <Pressable onPress={saveScore} disabled={!winSide} style={[s.mBtn, s.mSave, { marginTop: 6 }, !winSide && { opacity: 0.45 }]}>
            <Text style={s.mSaveT}>Save result</Text>
          </Pressable>
          <Pressable onPress={() => { setEditing(null); setWinSide(null); }} style={[s.mBtn, s.mCancel, { marginTop: 8 }]}>
            <Text style={s.mCancelT}>Cancel</Text>
          </Pressable>
        </View></View>
      </Modal>

      <Modal visible={!!player} transparent animationType="fade" onRequestClose={() => setPlayer(null)}>
        <View style={s.overlay}><View style={s.modal}>
          <Text style={s.modalTitle}>EDIT PLAYER</Text>
          <TextInput value={rename} onChangeText={setRename} style={[s.input, { width: '100%', textAlign: 'left', marginBottom: 10 }]} placeholder="Player / pair name" placeholderTextColor={T.faint} />
          <Pressable onPress={doRename} style={[s.mBtn, s.mSave, { marginBottom: 14 }]}><Text style={s.mSaveT}>Save name</Text></Pressable>
          <Text style={s.swapHdr}>SWAP POSITION WITH</Text>
          <TextInput value={swapFilter} onChangeText={setSwapFilter} style={[s.input, { width: '100%', textAlign: 'left', marginBottom: 8 }]} placeholder="Search player…" placeholderTextColor={T.faint} autoCapitalize="none" />
          <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
            {drawSlots
              .filter((d: any) => d.entrantId !== player?.entrantId && nameOf(d.entrantId).toLowerCase().includes(swapFilter.trim().toLowerCase()))
              .map((d: any) => (
                <Pressable key={d.matchId + d.slot} onPress={() => swapWith(d)} style={s.swapRow}>
                  <Text style={s.swapName} numberOfLines={1}>{nameOf(d.entrantId)}</Text>
                  <Text style={s.swapGrp}>{data.groups.length > 1 ? `Grp ${d.group}` : ''}</Text>
                </Pressable>
              ))}
          </ScrollView>
          <Pressable onPress={() => setPlayer(null)} style={[s.mBtn, s.mCancel, { marginTop: 12 }]}><Text style={s.mCancelT}>Cancel</Text></Pressable>
        </View></View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  adminBar: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: { borderWidth: 1, borderColor: T.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: T.navy, borderColor: T.navy },
  chipT: { color: T.muted, fontWeight: '700', fontSize: 12.5 }, chipTOn: { color: '#fff' },
  redraw: { backgroundColor: T.blue, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 2 },
  redrawT: { color: '#fff', fontWeight: '800', fontSize: 12.5 },
  badge: { backgroundColor: T.bgSoft, borderColor: T.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeT: { color: T.navy, fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  draft: { color: T.gold, backgroundColor: '#FFF7E6', borderColor: '#FCE3B3', borderWidth: 1, borderRadius: 9, padding: 11, fontSize: 12.5, marginBottom: 14 },
  hint: { color: T.blue, fontSize: 12.5, marginBottom: 12, fontWeight: '600' },
  hintEdit: { color: T.navy, fontSize: 12.5, marginBottom: 12, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  tab: { backgroundColor: T.bgSoft, borderColor: T.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 7 },
  tabOn: { backgroundColor: T.navy, borderColor: T.navy },
  tabT: { color: T.muted, fontWeight: '700', fontSize: 12.5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,30,64,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 380 },
  modalTitle: { fontFamily: T.head, color: T.navy, fontSize: 14, fontWeight: '800', letterSpacing: 1, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  rowName: { flex: 1, color: T.ink, fontSize: 14, fontWeight: '600' },
  input: { width: 72, borderWidth: 1, borderColor: T.line, borderRadius: 10, paddingVertical: 8, textAlign: 'center', fontSize: 18, fontWeight: '700', color: T.ink, backgroundColor: T.bgSoft },
  mBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  mBtn: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  mCancel: { backgroundColor: T.bgSoft }, mCancelT: { color: T.muted, fontWeight: '700' },
  mSave: { backgroundColor: T.blue }, mSaveT: { color: '#fff', fontWeight: '700' },
  modalSub: { color: T.muted, fontSize: 12.5, marginTop: -8, marginBottom: 16 },
  resRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: T.line, borderRadius: 12, padding: 12, marginBottom: 10 },
  resRowWin: { borderColor: T.winStrong, backgroundColor: T.winBg2 },
  resName: { color: T.ink, fontSize: 15, fontWeight: '700' },
  resNameWin: { color: '#075E40' },
  resTag: { color: T.faint, fontSize: 11, fontWeight: '700', marginTop: 2 },
  resTagWin: { color: T.winStrong },
  resScore: { width: 64, borderWidth: 1, borderColor: T.line, borderRadius: 10, paddingVertical: 8, textAlign: 'center', fontSize: 20, fontWeight: '800', color: T.ink, backgroundColor: T.bgSoft },
  swapHdr: { fontFamily: T.head, color: T.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 },
  swapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, borderBottomColor: T.line, borderBottomWidth: 1 },
  swapName: { color: T.ink, fontSize: 13.5, fontWeight: '600', flex: 1 },
  swapGrp: { color: T.faint, fontSize: 11, fontWeight: '700', marginLeft: 8 },
});
