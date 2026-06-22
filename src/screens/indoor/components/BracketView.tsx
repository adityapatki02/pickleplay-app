import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, LayoutRectangle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cols, setCols] = useState<Record<number, { x: number; w: number }>>({});
  const [boxes, setBoxes] = useState<Record<string, { y: number; h: number }>>({});

  // Build connector paths once we have measurements. A match (round r, idx i) connects
  // to its parent (round r+1, idx floor(i/2)).
  const idAt = (r: number, i: number) => rounds[r] && rounds[r][i] ? rounds[r][i].id : null;
  const paths: string[] = [];
  for (const m of matches) {
    if (m.round >= total - 1) continue;             // final has no parent
    const parentId = idAt(m.round + 1, Math.floor(m.idx / 2));
    if (!parentId) continue;
    const col = cols[m.round], pcol = cols[m.round + 1];
    const box = boxes[m.id], pbox = boxes[parentId];
    if (!col || !pcol || !box || !pbox) continue;
    const rx = col.x + col.w;                        // child right edge
    const cy = box.y + box.h / 2;                    // child center y
    const plx = pcol.x;                              // parent left edge
    const pcy = pbox.y + pbox.h / 2;                 // parent center y
    const midx = (rx + plx) / 2;
    paths.push(`M ${rx} ${cy} H ${midx} V ${pcy} H ${plx}`);
  }

  const setCol = (r: number, l: LayoutRectangle) => setCols(p => (p[r] && p[r].x === l.x && p[r].w === l.width ? p : { ...p, [r]: { x: l.x, w: l.width } }));
  const setBox = (id: string, l: LayoutRectangle) => setBoxes(p => (p[id] && p[id].y === l.y && p[id].h === l.height ? p : { ...p, [id]: { y: l.y, h: l.height } }));

  return (
    <ScrollView horizontal contentContainerStyle={{ paddingBottom: 20 }} showsHorizontalScrollIndicator={false}>
      <View style={{ position: 'relative' }} onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {size.w > 0 ? (
          <Svg style={{ position: 'absolute', left: 0, top: 0 }} width={size.w} height={size.h} pointerEvents="none">
            {paths.map((d, i) => <Path key={i} d={d} stroke={T.line} strokeWidth={2} fill="none" />)}
          </Svg>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 40 }}>
          {rounds.map((rd, r) => (
            <View key={r} style={st.col} onLayout={e => setCol(r, e.nativeEvent.layout)}>
              <Text style={st.rh}>{label(r, total)}</Text>
              {rd.map(m => (
                <View key={m.id} onLayout={e => setBox(m.id, e.nativeEvent.layout)}>
                  <MatchCard m={m} by={by} mode={mode} pendingSwap={pendingSwap} onScore={onScore} onClear={onClear} onPlayerTap={onPlayerTap} />
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
const st = StyleSheet.create({
  col: { minWidth: 248, justifyContent: 'space-around' },
  rh: { color: T.blue, fontFamily: T.head, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, textAlign: 'center', marginBottom: 8 },
});
