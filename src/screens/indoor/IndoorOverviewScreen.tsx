import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { indoorApi, IndoorCompetition } from '../../api/indoor.api';
import { INDOOR_EVENT_ID } from '../../config/appMode';
import { IndoorHeader } from './components/IndoorHeader';
import { T } from './indoorTheme';

export default function IndoorOverviewScreen({ navigation }: any) {
  const [data, setData] = useState<{ event: any; competitions: IndoorCompetition[] } | null>(null);
  useEffect(() => { indoorApi.overview(INDOOR_EVENT_ID).then(setData); }, []);
  if (!data) return <View style={{ flex: 1, backgroundColor: T.bg }}><IndoorHeader /><View style={s.center}><ActivityIndicator color={T.blue} /></View></View>;
  const games = [...new Set(data.competitions.map(c => c.game))];
  const entries = data.competitions.reduce((a, c) => a + c.entrantCount, 0);
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <IndoorHeader />
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <Text style={s.h1}>{data.event.name}</Text>
        <Text style={s.subtitle}>Single-elimination · {games.length} games · {data.competitions.length} events</Text>
        <View style={s.stats}>
          <Stat n={String(games.length)} l="Games" />
          <Stat n={String(data.competitions.length)} l="Events" />
          <Stat n={String(entries)} l="Entries" />
        </View>
        {games.map(g => (
          <View key={g} style={{ marginBottom: 20 }}>
            <Text style={s.gh}>{g.toUpperCase()}</Text>
            {data.competitions.filter(c => c.game === g).map(c => (
              <Pressable key={c.id} style={s.card} onPress={() => navigation.navigate('IndoorEvent', { competitionId: c.id })}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cn}>{c.eventName}</Text>
                  <Text style={s.cm}>{c.entrantCount} {c.type === 'doubles' ? 'pairs' : 'players'}</Text>
                </View>
                {c.isDraft ? <Text style={s.draftPill}>DRAFT</Text> : null}
                <Text style={s.chev}>{'›'}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
const Stat = ({ n, l }: { n: string; l: string }) => (
  <View style={s.stat}><Text style={s.statN}>{n}</Text><Text style={s.statL}>{l}</Text></View>
);
const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  h1: { color: T.navy, fontFamily: T.head, fontSize: 22, fontWeight: '800', letterSpacing: 0.2 },
  subtitle: { color: T.muted, fontSize: 13, marginTop: 3, marginBottom: 18 },
  stats: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  stat: { flex: 1, backgroundColor: T.card, borderColor: T.line, borderWidth: 1, borderRadius: 14, padding: 16, shadowColor: '#001E40', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  statN: { color: T.blue, fontFamily: T.head, fontSize: 26, fontWeight: '800' },
  statL: { color: T.muted, fontSize: 12, marginTop: 2 },
  gh: { color: T.navy, fontFamily: T.head, fontSize: 13, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.card, borderColor: T.line, borderWidth: 1, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10, shadowColor: '#001E40', shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  cn: { color: T.ink, fontFamily: T.head, fontWeight: '700', fontSize: 14.5 },
  cm: { color: T.muted, fontSize: 12, marginTop: 2 },
  draftPill: { color: T.gold, backgroundColor: '#FFF7E6', fontSize: 10, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  chev: { color: T.faint, fontSize: 22, fontWeight: '300' },
});
