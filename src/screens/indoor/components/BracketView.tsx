import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { MatchCard } from './MatchCard';
import { T } from '../indoorTheme';
import { IndoorMatch, IndoorEntrant } from '../../../api/indoor.api';

const label = (round: number, total: number) => {
  const left = total - 1 - round;
  return left === 0 ? 'FINAL' : left === 1 ? 'SEMIFINAL' : left === 2 ? 'QUARTERFINAL' : `ROUND ${round + 1}`;
};
export function BracketView({ matches, entrants, scorer, onScore, onClear }: {
  matches: IndoorMatch[]; entrants: IndoorEntrant[]; scorer: boolean;
  onScore: (m: IndoorMatch) => void; onClear: (matchId: string) => void;
}) {
  const by = new Map(entrants.map(e => [e.id, e]));
  const total = matches.reduce((mx, m) => Math.max(mx, m.round), 0) + 1;
  const rounds = Array.from({ length: total }, (_, r) =>
    matches.filter(m => m.round === r).sort((a, b) => a.idx - b.idx));
  return (
    <ScrollView horizontal contentContainerStyle={{ gap: 40, paddingBottom: 20 }}>
      {rounds.map((rd, r) => (
        <View key={r} style={st.col}>
          <Text style={st.rh}>{label(r, total)}</Text>
          {rd.map(m => <MatchCard key={m.id} m={m} by={by} scorer={scorer} onScore={onScore} onClear={onClear} />)}
        </View>
      ))}
    </ScrollView>
  );
}
const st = StyleSheet.create({
  col: { minWidth: 248, justifyContent: 'space-around' },
  rh: { color: T.blue, fontFamily: T.head, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, textAlign: 'center', marginBottom: 8 },
});
