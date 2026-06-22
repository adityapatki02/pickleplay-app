import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { T } from '../indoorTheme';
import { IndoorMatch, IndoorEntrant } from '../../../api/indoor.api';

export function MatchCard({ m, by, scorer, onPick }: {
  m: IndoorMatch; by: Map<string, IndoorEntrant>; scorer: boolean;
  onPick: (matchId: string, entrantId: string) => void;
}) {
  const slot = (id: string | null, side: 'A' | 'B') => {
    const e = id ? by.get(id) : null;
    const win = !!m.winnerEntrantId && m.winnerEntrantId === id;
    return (
      <Pressable
        disabled={!scorer || !id}
        onPress={() => id && onPick(m.id, id)}
        style={[st.slot, win && st.win, side === 'A' && st.border]}>
        <View style={{ flex: 1 }}>
          <Text style={[st.nm, win && st.nmWin, !e && st.faint]} numberOfLines={1}>{e ? e.name : '—'}</Text>
          {e?.dept ? <Text style={st.dp} numberOfLines={1}>{e.dept}</Text> : null}
        </View>
        {win ? <Text style={st.tick}>{'✓'}</Text> : null}
      </Pressable>
    );
  };
  return (
    <View style={st.match}>
      {m.round === 0 && m.board ? <Text style={st.board}>B{m.board}</Text> : null}
      {slot(m.entrantAId, 'A')}
      {slot(m.entrantBId, 'B')}
    </View>
  );
}
const st = StyleSheet.create({
  match: { backgroundColor: T.glass, borderColor: T.line, borderWidth: 1, borderRadius: 11, marginBottom: 12, position: 'relative' },
  board: { position: 'absolute', top: -8, left: 9, backgroundColor: '#16202e', color: T.blue2, fontSize: 9, fontWeight: '700', paddingHorizontal: 6, borderRadius: 5, zIndex: 1, overflow: 'hidden' },
  slot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8 },
  border: { borderBottomColor: T.line, borderBottomWidth: 1 },
  win: { backgroundColor: 'rgba(6,214,160,0.13)' },
  nm: { color: T.ink, fontSize: 12.5, fontWeight: '600' },
  nmWin: { color: '#5eead4' }, faint: { color: T.faint, fontStyle: 'italic' },
  dp: { color: T.faint, fontSize: 10 },
  tick: { color: T.win, fontWeight: '800', fontSize: 12, marginLeft: 6 },
});
