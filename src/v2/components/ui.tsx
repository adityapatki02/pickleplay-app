// Shared v2 pieces: the navy title bar with stripes, segmented tabs, chips,
// team badges, score boxes and the plain panel. Same shapes as the website's
// components/sport.tsx and components/event/parts.tsx.
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { C, F, body, card, head, isLight, label } from '../theme';
import type { FeedTeam } from '../data/league-feed';
import { teamInitials } from '../data/league-feed';
import { logoUrl, type YoidenEvent, type EventStatus } from '../data/events';

/** Slanted blue + lime stripes on the right edge of navy bars. */
export function Stripes({ height = 44, wide = false }: { height?: number; wide?: boolean }) {
  const w = wide ? 1.6 : 1;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <View style={[s.stripe, { right: 54 * w, width: 12 * w, height: height * 2, backgroundColor: 'rgba(41,82,227,0.85)' }]} />
      <View style={[s.stripe, { right: 14 * w, width: 30 * w, height: height * 2, backgroundColor: C.hl }]} />
    </View>
  );
}

/** Navy header strip with a condensed title (every panel uses it). */
export function BarTitle({
  title,
  right,
  large,
  icon,
}: {
  title: string;
  right?: React.ReactNode;
  large?: boolean;
  icon?: React.ReactNode;
}) {
  const h = large ? 60 : 42;
  return (
    <View style={[s.bar, { minHeight: h }]}>
      <Stripes height={h} />
      {icon && <View style={s.barIcon}>{icon}</View>}
      <Text style={[head(large ? 22 : 15, C.white), { flexShrink: 1 }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ flex: 1 }} />
      {right ? <View style={{ marginRight: 70 }}>{right}</View> : null}
    </View>
  );
}

export function Panel({
  title,
  right,
  children,
  style,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[card, { overflow: 'hidden' }, style]}>
      {title ? <BarTitle title={title} right={right} /> : null}
      {children}
    </View>
  );
}

/** NMFC-style segmented tabs: white cells, the active one navy with lime text. Scrolls on narrow screens. */
export function SegTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={s.segWrap} accessibilityRole="tablist">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.seg}>
        {tabs.map((t) => {
          const on = t.key === value;
          return (
            <Pressable key={t.key} onPress={() => onChange(t.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
              style={[s.segCell, on && { backgroundColor: C.bar }]}>
              <Text style={body(12, on ? C.hl : C.soft, 'semi')}>{t.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function Chip({
  on,
  onPress,
  children,
  dark,
}: {
  on: boolean;
  onPress: () => void;
  children: string;
  dark?: boolean;
}) {
  const bg = dark ? (on ? C.hl : 'transparent') : on ? C.bar : C.white;
  const fg = dark ? (on ? C.bar : 'rgba(255,255,255,0.85)') : on ? C.white : C.soft;
  const border = dark ? (on ? C.hl : 'rgba(255,255,255,0.3)') : on ? C.bar : C.lineStrong;
  return (
    <Pressable onPress={onPress} style={[s.chip, { backgroundColor: bg, borderColor: border }]}>
      <Text style={label(13, fg)}>{children}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
      {children}
    </ScrollView>
  );
}

/** Small square badge in the team's colour with its initials. */
export function TeamBadge({ team, size = 24 }: { team: Pick<FeedTeam, 'name' | 'shortName' | 'color'>; size?: number }) {
  const bg = team.color ?? '#64748B';
  const light = isLight(bg);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: light ? 1 : 0,
        borderColor: 'rgba(11,15,26,0.15)',
      }}
    >
      <Text style={{ fontFamily: F.heavy, fontSize: size * 0.32, color: light ? C.ink : C.white }}>
        {teamInitials(team as FeedTeam)}
      </Text>
    </View>
  );
}

/** Scoreboard-style score: the winner sits in a navy box with lime digits. */
export function ScoreBox({ score, won, lost, big }: { score: number | string; won?: boolean; lost?: boolean; big?: boolean }) {
  return (
    <View
      style={{
        minWidth: big ? 60 : 40,
        paddingHorizontal: big ? 10 : 6,
        paddingVertical: big ? 2 : 0,
        borderRadius: 5,
        alignItems: 'center',
        backgroundColor: won ? C.bar : 'transparent',
      }}
    >
      <Text style={head(big ? 40 : 24, won ? C.hl : lost ? C.mute : C.ink)}>{score}</Text>
    </View>
  );
}

/** An event's logo on a white tile (navy for white logos), or its initials. */
export function EventLogo({ e, size = 52 }: { e: YoidenEvent; size?: number }) {
  const url = logoUrl(e.logo);
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <View style={[s.logo, { width: size, height: size }, e.logoOnDark ? { backgroundColor: C.bar, borderWidth: 0 } : null]}>
        <Image onError={() => setFailed(true)} source={{ uri: url }} style={{ width: size * 0.88, height: size * 0.88 }} resizeMode="contain" />
      </View>
    );
  }
  return (
    <View style={[s.logo, { width: size, height: size, backgroundColor: '#EEF0F3', borderWidth: 0 }]}>
      <Text style={{ fontFamily: F.heavy, fontSize: e.initials.length > 3 ? size * 0.24 : size * 0.3, color: C.ink }}>
        {e.initials}
      </Text>
    </View>
  );
}

const STATUS: Record<EventStatus, { text: string; color: string }> = {
  live: { text: 'Live', color: C.live },
  upcoming: { text: 'Upcoming', color: C.hlInk },
  past: { text: 'Completed', color: C.mute },
};

export function StatusLabel({ status, auction }: { status: EventStatus; auction?: boolean }) {
  const st = STATUS[status];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {status === 'live' && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.live }} />}
      <Text style={label(11.5, st.color)}>{auction && status === 'past' ? 'Auction held' : st.text}</Text>
    </View>
  );
}

/** Big white button with navy text, or the lime one. */
export function Button({
  title,
  onPress,
  tone = 'lime',
  icon,
  small,
}: {
  title: string;
  onPress: () => void;
  tone?: 'lime' | 'ghost' | 'navy' | 'white';
  icon?: React.ReactNode;
  small?: boolean;
}) {
  const bg = tone === 'lime' ? C.hl : tone === 'navy' ? C.bar : tone === 'white' ? C.white : 'transparent';
  const fg = tone === 'lime' || tone === 'white' ? C.bar : C.white;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        small && { paddingVertical: 10, paddingHorizontal: 14 },
        { backgroundColor: bg, opacity: pressed ? 0.85 : 1 },
        tone === 'ghost' && { borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
        tone === 'white' && { borderWidth: 1, borderColor: C.line },
      ]}
    >
      {icon}
      <Text style={label(small ? 13 : 15, fg)}>{title}</Text>
    </Pressable>
  );
}

export function Empty({ children }: { children: string }) {
  return (
    <View style={[card, { padding: 22, alignItems: 'center' }]}>
      <Text style={[body(14, C.soft), { textAlign: 'center' }]}>{children}</Text>
    </View>
  );
}

export function SectionLabel({ children, color = C.bar, right }: { children: string; color?: string; right?: React.ReactNode }) {
  return (
    <View style={s.sectionLabel}>
      <Text style={head(19, color)}>{children}</Text>
      {right}
    </View>
  );
}

/** Key / value rows ("Event details"). */
export function DetailRows({ rows }: { rows: [string, string][] }) {
  return (
    <View>
      {rows.map(([k, v], i) => (
        <View key={k} style={[s.detail, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
          <Text style={body(12, C.mute, 'medium')}>{k}</Text>
          <Text style={[body(14, C.ink, 'semi'), { marginTop: 2 }]}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  stripe: { position: 'absolute', top: -20, transform: [{ skewX: '-20deg' }] },
  bar: {
    backgroundColor: C.bar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    overflow: 'hidden',
    gap: 10,
  },
  barIcon: { width: 32, height: 32, borderRadius: 6, backgroundColor: C.hl, alignItems: 'center', justifyContent: 'center' },
  segWrap: { flexGrow: 0, borderBottomWidth: 1, borderColor: C.line, backgroundColor: C.page },
  seg: { flexGrow: 1, gap: 6, paddingBottom: 10 },
  segCell: { flexGrow: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  chip: { borderWidth: 1, borderRadius: 9, minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  logo: { borderRadius: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16 },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 26, marginBottom: 12 },
  detail: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
});
