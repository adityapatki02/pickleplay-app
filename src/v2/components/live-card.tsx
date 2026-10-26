// The big live card at the top of Home ("Your front row"). Broadcast look: a navy
// gradient, the website's blue + lime stripes on the right edge, a soft lime glow and
// the sport name as a watermark. It carries the match on right now (or the latest
// result between matches), refreshed every 20 seconds.
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { EventLogo, TeamBadge } from './ui';
import { ChevronRight } from './icons';
import { formatWhen, type YoidenEvent } from '../data/events';
import type { LiveSnapshot, SnapSide } from '../store/live';
import { C, F, body, head, label } from '../theme';

function PulseDot({ color }: { color: string }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color, opacity: v }} />;
}

function SideRow({ side, lead }: { side: SnapSide; lead: boolean }) {
  return (
    <View style={s.side}>
      <TeamBadge team={side} size={24} />
      <Text style={[head(17, lead ? C.white : 'rgba(255,255,255,0.72)'), { flex: 1 }]} numberOfLines={1}>
        {side.name}
      </Text>
      <View style={[s.score, lead && { backgroundColor: C.hl }]}>
        <Text style={head(22, lead ? C.bar : C.white)}>{side.score}</Text>
      </View>
    </View>
  );
}

export function LiveEventCard({
  e,
  width,
  snap,
  onPress,
}: {
  e: YoidenEvent;
  width: number;
  snap?: LiveSnapshot;
  onPress: () => void;
}) {
  const m = snap?.match;
  const liveNow = !!snap?.liveCount;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${e.name}`}
      style={({ pressed }) => [s.card, { width, opacity: pressed ? 0.92 : 1 }]}
    >
      <LinearGradient
        colors={['#0A3470', '#001E40', '#000F24']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* decoration: corner glow, sport watermark, broadcast stripes */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={['rgba(215,242,5,0.16)', 'rgba(215,242,5,0)']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.35, y: 0.55 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={s.watermark}>{e.sport}</Text>
        <View style={[s.stripe, { right: 58, width: 8, backgroundColor: 'rgba(41,82,227,0.9)' }]} />
        <View style={[s.stripe, { right: 22, width: 20, backgroundColor: C.hl }]} />
      </View>

      <View style={s.top}>
        {liveNow ? (
          <View style={s.livePill}>
            <PulseDot color={C.white} />
            <Text style={label(12, C.white)}>
              Live{snap!.liveCount > 1 ? ` · ${snap!.liveCount} matches` : ''}
            </Text>
          </View>
        ) : (
          <View style={s.dayPill}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.hl }} />
            <Text style={label(12, C.hl)}>Event day</Text>
          </View>
        )}
        <Text style={[body(12, 'rgba(255,255,255,0.75)'), { marginRight: 76 }]}>{e.sport}</Text>
      </View>

      <View style={s.title}>
        <EventLogo e={e} size={46} />
        <View style={{ flex: 1, paddingRight: 70 }}>
          <Text style={head(23, C.white)} numberOfLines={2}>
            {e.name}
          </Text>
          <Text style={[body(12, 'rgba(255,255,255,0.75)'), { marginTop: 4 }]}>
            {e.city} · {formatWhen(e)}
          </Text>
        </View>
      </View>

      {m ? (
        <View style={s.panel}>
          <View style={s.panelHead}>
            <Text style={label(11.5, m.live ? C.hl : 'rgba(255,255,255,0.6)')}>{m.live ? 'On now' : 'Latest result'}</Text>
            <Text style={body(11.5, 'rgba(255,255,255,0.6)')} numberOfLines={1}>
              {m.label}
            </Text>
          </View>
          <SideRow side={m.home} lead={m.home.score > m.away.score} />
          <SideRow side={m.away} lead={m.away.score > m.home.score} />
          {m.detail ? <Text style={[body(11.5, C.hl, 'semi'), { marginTop: 6 }]}>{m.detail}</Text> : null}
        </View>
      ) : (
        <View style={[s.panel, s.panelEmpty]}>
          <Text style={label(11.5, 'rgba(255,255,255,0.6)')}>Scores</Text>
          <Text style={body(12.5, 'rgba(255,255,255,0.8)')}>Live scores show here as matches start.</Text>
        </View>
      )}

      <View style={s.foot}>
        <Text style={body(12, 'rgba(255,255,255,0.75)')}>Matches, teams & standings</Text>
        <View style={s.go}>
          <ChevronRight color={C.bar} size={17} />
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { minHeight: 236, borderRadius: 18, padding: 18, overflow: 'hidden', backgroundColor: C.bar },
  watermark: {
    position: 'absolute',
    bottom: 34,
    left: 12,
    width: 600,
    fontFamily: F.cond,
    fontSize: 78,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.045)',
  },
  stripe: { position: 'absolute', top: -40, bottom: -40, transform: [{ skewX: '-20deg' }] },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.live, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  dayPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(215,242,5,0.5)', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 },
  title: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  panel: {
    marginTop: 16,
    marginRight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    padding: 12,
    gap: 7,
  },
  panelEmpty: { flexGrow: 1, justifyContent: 'center', borderStyle: 'dashed' },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 2 },
  side: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  score: { minWidth: 34, alignItems: 'center', borderRadius: 5, paddingHorizontal: 6 },
  foot: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.16)',
    paddingTop: 13,
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: 56,
  },
  go: { width: 32, height: 32, backgroundColor: C.hl, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
