import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { T } from '../indoorTheme';
import { IndoorMatch, IndoorEntrant } from '../../../api/indoor.api';

export function MatchCard({ m, by, scorer, onScore, onClear }: {
  m: IndoorMatch; by: Map<string, IndoorEntrant>; scorer: boolean;
  onScore: (m: IndoorMatch) => void; onClear: (matchId: string) => void;
}) {
  const completed = m.status === 'completed';
  const bothPresent = !!m.entrantAId && !!m.entrantBId;
  const tappable = scorer && bothPresent && !completed;
  const slot = (id: string | null, side: 'A' | 'B', score: number | null) => {
    const e = id ? by.get(id) : null;
    const win = !!m.winnerEntrantId && m.winnerEntrantId === id;
    return (
      <View style={[s.slot, win && s.win, side === 'A' && s.border]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.nm, win && s.nmWin, !e && s.faint]} numberOfLines={1}>{e ? e.name : '—'}</Text>
          {e?.dept ? <Text style={s.dp} numberOfLines={1}>{e.dept}</Text> : null}
        </View>
        {score != null ? <Text style={[s.score, win && s.scoreWin]}>{score}</Text> : null}
        {win ? <Text style={s.tick}>{'✓'}</Text> : null}
      </View>
    );
  };
  return (
    <Pressable disabled={!tappable} onPress={() => tappable && onScore(m)} style={[s.match, tappable && s.tappable]}>
      {m.round === 0 && m.board ? <Text style={s.board}>B{m.board}</Text> : null}
      {slot(m.entrantAId, 'A', m.scoreA)}
      {slot(m.entrantBId, 'B', m.scoreB)}
      {scorer && completed ? (
        <Pressable onPress={() => onClear(m.id)} style={s.undo}><Text style={s.undoT}>{'↺ Undo'}</Text></Pressable>
      ) : null}
      {tappable ? <Text style={s.tapHint}>Tap to enter score</Text> : null}
    </Pressable>
  );
}
const s = StyleSheet.create({
  match: { backgroundColor: T.card, borderColor: T.line, borderWidth: 1, borderRadius: 12, marginBottom: 12, position: 'relative', shadowColor: '#001E40', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  tappable: { borderColor: T.blue },
  board: { position: 'absolute', top: -8, left: 10, backgroundColor: T.navy, color: '#fff', fontSize: 9, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5, zIndex: 1, overflow: 'hidden' },
  slot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 11, paddingVertical: 9 },
  border: { borderBottomColor: T.line, borderBottomWidth: 1 },
  win: { backgroundColor: T.winBg },
  nm: { color: T.ink, fontSize: 13, fontWeight: '600' },
  nmWin: { color: T.navy, fontWeight: '800' },
  faint: { color: T.faint, fontStyle: 'italic', fontWeight: '500' },
  dp: { color: T.faint, fontSize: 10 },
  score: { color: T.muted, fontWeight: '800', fontSize: 14, marginLeft: 8, minWidth: 18, textAlign: 'right' },
  scoreWin: { color: T.win },
  tick: { color: T.win, fontWeight: '800', fontSize: 13, marginLeft: 6 },
  undo: { borderTopColor: T.line, borderTopWidth: 1, alignItems: 'center', paddingVertical: 6 },
  undoT: { color: T.faint, fontSize: 11, fontWeight: '600' },
  tapHint: { color: T.blue, fontSize: 10, textAlign: 'center', paddingBottom: 6, fontWeight: '600' },
});
