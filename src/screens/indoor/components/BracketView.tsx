import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MatchCard } from './MatchCard';
import { T } from '../indoorTheme';
import { IndoorMatch, IndoorEntrant } from '../../../api/indoor.api';

const COL_W = 240, COL_GAP = 52, ROW_H = 74, V_GAP = 20, LABEL_H = 34;
const UNIT = ROW_H + V_GAP;

export function BracketView({ matches, entrants, mode, labelMap, onScore, onClear, onPlayerTap }: {
  matches: IndoorMatch[]; entrants: IndoorEntrant[]; mode: 'view' | 'score' | 'edit';
  labelMap: Record<number, string>;
  onScore: (m: IndoorMatch) => void; onClear: (matchId: string) => void;
  onPlayerTap: (matchId: string, slot: 'A' | 'B', entrantId: string | null) => void;
}) {
  const by = new Map(entrants.map(e => [e.id, e]));
  const present = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b);
  const byRound = present.map(r => matches.filter(m => m.round === r).sort((a, b) => a.idx - b.idx));
  const byKey = new Map(matches.map(m => [`${m.round}-${m.idx}`, m]));
  const baseCount = byRound[0]?.length || 1;
  const height = LABEL_H + UNIT * baseCount;
  const width = present.length * (COL_W + COL_GAP);
  const centerY = (lr: number, p: number) => LABEL_H + UNIT * Math.pow(2, lr) * (p + 0.5);

  const paths: string[] = [];
  present.forEach((r, lr) => {
    byRound[lr].forEach((m, p) => {
      const parent = byKey.get(`${r + 1}-${Math.floor(m.idx / 2)}`);
      if (!parent) return;
      const plr = present.indexOf(r + 1); if (plr < 0) return;
      const pp = byRound[plr].indexOf(parent); if (pp < 0) return;
      const rx = lr * (COL_W + COL_GAP) + COL_W, cy = centerY(lr, p);
      const plx = plr * (COL_W + COL_GAP), pcy = centerY(plr, pp);
      const midx = (rx + plx) / 2;
      paths.push(`M ${rx} ${cy} H ${midx} V ${pcy} H ${plx}`);
    });
  });

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ width, height }}>
        <Svg style={{ position: 'absolute', left: 0, top: 0 }} width={width} height={height} pointerEvents="none">
          {paths.map((d, i) => <Path key={i} d={d} stroke={T.line} strokeWidth={2} fill="none" />)}
        </Svg>
        {present.map((r, lr) => (
          <View key={r}>
            <View style={{ position: 'absolute', top: 0, left: lr * (COL_W + COL_GAP), width: COL_W, alignItems: 'center' }}>
              <Text style={st.rh}>{labelMap[r] || ''}</Text>
            </View>
            {byRound[lr].map((m, p) => (
              <View key={m.id} style={{ position: 'absolute', left: lr * (COL_W + COL_GAP), top: centerY(lr, p) - ROW_H / 2, width: COL_W }}>
                <MatchCard m={m} by={by} mode={mode} onScore={onScore} onClear={onClear} onPlayerTap={onPlayerTap} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
const st = StyleSheet.create({
  rh: { color: '#fff', backgroundColor: T.navy, fontFamily: T.head, fontSize: 10, fontWeight: '800', letterSpacing: 1, textAlign: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, overflow: 'hidden' },
});
