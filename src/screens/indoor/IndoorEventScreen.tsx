import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, Modal, TextInput } from 'react-native';
import { indoorApi } from '../../api/indoor.api';
import { BracketView } from './components/BracketView';
import { IndoorHeader } from './components/IndoorHeader';
import { T } from './indoorTheme';

export default function IndoorEventScreen({ route, navigation }: any) {
  const { competitionId } = route.params;
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState(0);
  const [scorer, setScorer] = useState(false);
  const [pass, setPass] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [sa, setSa] = useState(''); const [sb, setSb] = useState('');
  const load = useCallback(() => indoorApi.competition(competitionId).then(setData), [competitionId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (scorer) return; const t = setInterval(load, 8000); return () => clearInterval(t); }, [scorer, load]);

  const askPass = (): string => {
    let p = pass;
    if (!p && Platform.OS === 'web') { p = (globalThis as any).prompt('Scorer passcode') || ''; setPass(p); }
    return p;
  };
  const toggleScorer = () => { if (scorer) { setScorer(false); return; } if (askPass()) setScorer(true); };
  const openScore = (m: any) => { setEditing(m); setSa(m.scoreA != null ? String(m.scoreA) : ''); setSb(m.scoreB != null ? String(m.scoreB) : ''); };
  const saveScore = async () => {
    const a = parseInt(sa, 10), b = parseInt(sb, 10);
    if (isNaN(a) || isNaN(b)) return;
    if (a === b) { (globalThis as any).alert?.('Scores must have a winner — they cannot be equal.'); return; }
    const p = askPass(); if (!p) return;
    const winnerId = a > b ? editing.entrantAId : editing.entrantBId;
    await indoorApi.submit(editing.id, winnerId, p, a, b);
    setEditing(null); setSa(''); setSb(''); await load();
  };
  const onClear = async (matchId: string) => { const p = askPass(); if (!p) return; await indoorApi.clear(matchId, p); await load(); };

  if (!data) return <View style={{ flex: 1, backgroundColor: T.bg }}><IndoorHeader onBack={() => navigation.goBack()} title="Loading…" /></View>;
  const groups = data.groups; const g = groups[Math.min(tab, groups.length - 1)];
  const groupMatches = data.matches.filter((m: any) => m.groupId === g.id);
  const byName = new Map<string, any>(data.entrants.map((e: any) => [e.id, e]));
  const nameOf = (id: string | null) => (id && byName.get(id) ? byName.get(id).name : '—');

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <IndoorHeader onBack={() => navigation.goBack()} title={data.competition.eventName}
        right={<Pressable onPress={toggleScorer} style={[s.scoreBtn, scorer && s.scoreBtnOn]}>
          <Text style={[s.scoreBtnT, scorer && { color: '#fff' }]}>{scorer ? 'Done' : 'Score'}</Text></Pressable>} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ alignItems: 'center', padding: 16 }}>
        <View style={{ width: '100%', maxWidth: 1200 }}>
        {data.competition.isDraft ? <Text style={s.draft}>{'⚠️'}  Draft draw — doubles auto-paired; pairings need confirming.</Text> : null}
        {scorer ? <Text style={s.hint}>Scoring on — tap a match to enter its score.</Text> : null}
        {groups.length > 1 ? (
          <View style={s.tabs}>
            {groups.map((gr: any, i: number) => (
              <Pressable key={gr.id} onPress={() => setTab(i)} style={[s.tab, i === tab && s.tabOn]}>
                <Text style={[s.tabT, i === tab && { color: '#fff' }]}>Group {gr.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <BracketView matches={groupMatches} entrants={data.entrants} scorer={scorer} onScore={openScore} onClear={onClear} />
        </View>
      </ScrollView>

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>ENTER SCORE</Text>
            {editing ? (<>
              <View style={s.scoreRow}>
                <Text style={s.scoreName} numberOfLines={1}>{nameOf(editing.entrantAId)}</Text>
                <TextInput value={sa} onChangeText={setSa} keyboardType="number-pad" placeholder="0" placeholderTextColor={T.faint} style={s.input} />
              </View>
              <View style={s.scoreRow}>
                <Text style={s.scoreName} numberOfLines={1}>{nameOf(editing.entrantBId)}</Text>
                <TextInput value={sb} onChangeText={setSb} keyboardType="number-pad" placeholder="0" placeholderTextColor={T.faint} style={s.input} />
              </View>
            </>) : null}
            <View style={s.modalBtns}>
              <Pressable onPress={() => setEditing(null)} style={[s.mBtn, s.mCancel]}><Text style={s.mCancelT}>Cancel</Text></Pressable>
              <Pressable onPress={saveScore} style={[s.mBtn, s.mSave]}><Text style={s.mSaveT}>Save result</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  scoreBtn: { borderWidth: 1, borderColor: T.blue, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  scoreBtnOn: { backgroundColor: T.blue },
  scoreBtnT: { color: T.blue, fontWeight: '700', fontSize: 13 },
  draft: { color: T.gold, backgroundColor: '#FFF7E6', borderColor: '#FCE3B3', borderWidth: 1, borderRadius: 9, padding: 11, fontSize: 12.5, marginBottom: 14 },
  hint: { color: T.blue, fontSize: 12.5, marginBottom: 12, fontWeight: '600' },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  tab: { backgroundColor: T.bgSoft, borderColor: T.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 7 },
  tabOn: { backgroundColor: T.navy, borderColor: T.navy },
  tabT: { color: T.muted, fontWeight: '700', fontSize: 12.5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,30,64,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 380 },
  modalTitle: { fontFamily: T.head, color: T.navy, fontSize: 14, fontWeight: '800', letterSpacing: 1, marginBottom: 16 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  scoreName: { flex: 1, color: T.ink, fontSize: 14, fontWeight: '600' },
  input: { width: 72, borderWidth: 1, borderColor: T.line, borderRadius: 10, paddingVertical: 8, textAlign: 'center', fontSize: 18, fontWeight: '700', color: T.ink, backgroundColor: T.bgSoft },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  mBtn: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  mCancel: { backgroundColor: T.bgSoft }, mCancelT: { color: T.muted, fontWeight: '700' },
  mSave: { backgroundColor: T.blue }, mSaveT: { color: '#fff', fontWeight: '700' },
});
