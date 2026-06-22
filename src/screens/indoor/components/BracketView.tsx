import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { MatchCard } from './MatchCard';
import { T } from '../indoorTheme';
import { IndoorMatch, IndoorEntrant } from '../../../api/indoor.api';

const label = (round: number, total: number) => {
  const left = total - 1 - round;
  return left === 0 ? 'FINAL' : left === 1 ? 'SEMIFINAL' : left === 2 ? 'QUARTERFINAL' : `ROUND ${round + 1}`;
};
export function BracketView({ matches, entrants, mode, pendingSwap, onScore, onClear, onPlayerTap }: {
  matches: IndoorMatch[]; entrants: IndoorEntrant[]; mode: 'view' | 'score' | 'edit';
  pendingSwap: { matchId: string; slot: 'A' | 'B' } | null;
  onScore: (m: IndoorMatch) => void; onClear: (matchId: string) => void;
  onPlayerTap: (matchId: string, slot: 'A' | 'B', entrantId: string | null) => void;
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
          {rd.map(m => <MatchCard key={m.id} m={m} by={by} mode={mode} pendingSwap={pendingSwap} onScore={onScore} onClear={onClear} onPlayerTap={onPlayerTap} />)}
        </View>
      ))}
    </ScrollView>
  );
}
const st = StyleSheet.create({
  col: { minWidth: 248, justifyContent: 'space-around' },
  rh: { color: T.blue, fontFamily: T.head, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, textAlign: 'center', marginBottom: 8 },
});
