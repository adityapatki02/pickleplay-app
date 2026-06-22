import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { indoorApi } from '../../api/indoor.api';
import { BracketView } from './components/BracketView';
import { T } from './indoorTheme';

export default function IndoorEventScreen({ route }: any) {
  const { competitionId } = route.params;
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState(0);
  const [scorer, setScorer] = useState(false);
  const [pass, setPass] = useState('');
  const load = useCallback(() => indoorApi.competition(competitionId).then(setData), [competitionId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (scorer) return; const t = setInterval(load, 8000); return () => clearInterval(t); }, [scorer, load]);
  if (!data) return null;
  const groups = data.groups; const g = groups[Math.min(tab, groups.length - 1)];
  const groupMatches = data.matches.filter((m: any) => m.groupId === g.id);
  const onPick = async (matchId: string, entrantId: string) => {
    let p = pass;
    if (!p && Platform.OS === 'web') { p = (globalThis as any).prompt('Scorer passcode') || ''; setPass(p); }
    if (!p) return;
    await indoorApi.submit(matchId, entrantId, p); await load();
  };
  const onClear = async (matchId: string) => {
    let p = pass;
    if (!p && Platform.OS === 'web') { p = (globalThis as any).prompt('Scorer passcode') || ''; setPass(p); }
    if (!p) return;
    await indoorApi.clear(matchId, p); await load();
  };
  return (
    <ScrollView style={{ backgroundColor: T.bg }} contentContainerStyle={{ padding: 20 }}>
      <View style={st.head}>
        <Text style={st.h1}>{data.competition.eventName.toUpperCase()}</Text>
        <Pressable onPress={() => setScorer(s => !s)} style={[st.toggle, scorer && st.toggleOn]}>
          <Text style={[st.toggleT, scorer && { color: '#fff' }]}>{scorer ? '✎ Scorer' : '👁 Player'}</Text>
        </Pressable>
      </View>
      {data.competition.isDraft ? (
        <Text style={st.draft}>{'⚠️'} Draft draw — doubles auto-paired; pairings need confirming.</Text>
      ) : null}
      {groups.length > 1 ? (
        <View style={st.tabs}>
          {groups.map((gr: any, i: number) => (
            <Pressable key={gr.id} onPress={() => setTab(i)} style={[st.tab, i === tab && st.tabOn]}>
              <Text style={[st.tabT, i === tab && { color: '#fff' }]}>Group {gr.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <BracketView matches={groupMatches} entrants={data.entrants} scorer={scorer} onPick={onPick} onClear={onClear} />
    </ScrollView>
  );
}
const st = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  h1: { color: T.ink, fontFamily: T.head, fontSize: 20, fontWeight: '800' },
  toggle: { borderColor: T.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  toggleOn: { backgroundColor: T.blue, borderColor: T.blue },
  toggleT: { color: T.muted, fontWeight: '600', fontSize: 12 },
  draft: { color: T.gold, backgroundColor: 'rgba(255,183,3,0.08)', borderColor: 'rgba(255,183,3,0.3)', borderWidth: 1, borderRadius: 9, padding: 11, fontSize: 12.5, marginBottom: 16 },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  tab: { backgroundColor: T.glass, borderColor: T.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 7 },
  tabOn: { backgroundColor: T.blue, borderColor: T.blue },
  tabT: { color: T.muted, fontWeight: '600', fontSize: 12.5 },
});
