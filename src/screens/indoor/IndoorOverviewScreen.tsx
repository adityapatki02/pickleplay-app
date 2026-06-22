import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { indoorApi, IndoorCompetition } from '../../api/indoor.api';
import { INDOOR_EVENT_ID } from '../../config/appMode';
import { T } from './indoorTheme';

export default function IndoorOverviewScreen({ navigation }: any) {
  const [data, setData] = useState<{ event: any; competitions: IndoorCompetition[] } | null>(null);
  useEffect(() => { indoorApi.overview(INDOOR_EVENT_ID).then(setData); }, []);
  if (!data) return <View style={s.center}><ActivityIndicator color={T.blue} /></View>;
  const games = [...new Set(data.competitions.map(c => c.game))];
  const entries = data.competitions.reduce((a, c) => a + c.entrantCount, 0);
  return (
    <ScrollView style={{ backgroundColor: T.bg }} contentContainerStyle={{ padding: 20 }}>
      <Text style={s.h1}>{data.event.name.toUpperCase()}</Text>
      <View style={s.stats}>
        <Stat n={String(games.length)} l="Games" />
        <Stat n={String(data.competitions.length)} l="Events" />
        <Stat n={String(entries)} l="Entries" />
      </View>
      {games.map(g => (
        <View key={g} style={{ marginBottom: 22 }}>
          <Text style={s.gh}>{g.toUpperCase()}</Text>
          {data.competitions.filter(c => c.game === g).map(c => (
            <Pressable key={c.id} style={s.card} onPress={() => navigation.navigate('IndoorEvent', { competitionId: c.id })}>
              <Text style={s.cn}>{c.eventName}{c.isDraft ? '  • DRAFT' : ''}</Text>
              <Text style={s.cm}>{c.entrantCount} {c.type === 'doubles' ? 'pairs' : 'players'}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
const Stat = ({ n, l }: { n: string; l: string }) => (
  <View style={s.stat}><Text style={s.statN}>{n}</Text><Text style={s.statL}>{l}</Text></View>
);
const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },
  h1: { color: T.ink, fontFamily: T.head, fontSize: 22, fontWeight: '800', marginBottom: 14 },
  stats: { flexDirection: 'row', gap: 12, marginBottom: 22 },
  stat: { flex: 1, backgroundColor: T.glass, borderColor: T.line, borderWidth: 1, borderRadius: 14, padding: 14 },
  statN: { color: T.blue, fontFamily: T.head, fontSize: 26, fontWeight: '800' },
  statL: { color: T.muted, fontSize: 12 },
  gh: { color: T.blue2, fontFamily: T.head, fontSize: 13, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  card: { backgroundColor: T.glass, borderColor: T.line, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  cn: { color: T.ink, fontFamily: T.head, fontWeight: '700', fontSize: 14, marginBottom: 4 },
  cm: { color: T.muted, fontSize: 12 },
});
