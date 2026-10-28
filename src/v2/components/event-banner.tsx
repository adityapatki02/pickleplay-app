// The navy banner at the top of every event page: logo, name, status line,
// headline numbers, the actions (Follow, Share, Site), and an entry into each role
// mode the signed-in phone has in the event (admin, scorer, captain).
import React from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { C, MAX_W, body, head, label } from '../theme';
import { EventLogo, Stripes } from './ui';
import { ExternalIcon, GearIcon, ShareIcon, StarIcon } from './icons';
import { formatWhen, statusOf, type YoidenEvent } from '../data/events';
import { useFollows } from '../store/follows';
import { useMyRoles } from '../store/roles';
import { MODE_NAME } from './mode-bar';
import { useNow } from '../hooks';

export function EventBanner({
  event,
  line,
  stats,
  children,
}: {
  event: YoidenEvent;
  /** Under the name, e.g. "Masters League · Navi Mumbai · 11 Oct 2026". */
  line?: string;
  /** Up to three headline numbers. */
  stats?: [string, number | string][];
  /** Division switch etc. */
  children?: React.ReactNode;
}) {
  const nav = useNavigation<any>();
  const now = useNow();
  const status = statusOf(event, now);
  const following = useFollows((s) => s.ids.includes(event.id));
  const toggle = useFollows((s) => s.toggle);
  const { roles } = useMyRoles();
  // Admin outranks scorer for the same league or football event; a captain keeps their own entry.
  const all = roles.filter((r) => r.event.id === event.id);
  const mine = all.filter((r) => !(r.role === 'scorer' && all.some((x) => x.role === 'admin' && x.slug === r.slug)));

  const share = async () => {
    const url = `https://yoiden.com/events/${event.id}`;
    if (Platform.OS === 'web') {
      try {
        await (navigator as any).clipboard?.writeText(url);
      } catch {
        /* nothing to do */
      }
      return;
    }
    Share.share({ message: `${event.name} on Yoiden: ${url}` });
  };

  return (
    <View style={s.wrap}>
      <View style={{ position: 'absolute', right: -45, top: 0, bottom: 0, width: 125, opacity: 0.35 }}><Stripes height={220} wide /></View>
      <View style={s.inner}>
        <Text style={label(13, C.hl)}>
          {status === 'live' ? '● Live now' : status === 'past' ? 'Completed' : 'Upcoming'} · {event.sport}
        </Text>
        <View style={s.row}>
          <EventLogo e={event} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={head(27, C.white)} numberOfLines={3}>
              {event.name}
            </Text>
            <Text style={[body(13, 'rgba(255,255,255,0.75)'), { marginTop: 4 }]}>
              {line ?? [event.venue ?? event.city, formatWhen(event)].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>

        {stats && stats.length > 0 && (
          <View style={s.stats}>
            {stats.map(([k, v], i) => (
              <View key={k} style={[s.stat, i === stats.length - 1 && { borderRightWidth: 0 }]}>
                <Text style={head(26, C.white)}>{v}</Text>
                <Text style={body(11, 'rgba(255,255,255,0.6)')}>{k}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.actions}>
          <Pressable onPress={() => toggle(event.id)} style={[s.act, following ? s.actOn : s.actOff]}>
            <StarIcon size={15} color={following ? C.bar : C.white} fill={following ? C.bar : 'none'} />
            <Text style={label(14, following ? C.bar : C.white)}>{following ? 'Following' : 'Follow'}</Text>
          </Pressable>
          <Pressable onPress={share} style={[s.act, s.actOff]}>
            <ShareIcon size={15} />
            <Text style={label(14, C.white)}>Share</Text>
          </Pressable>
          {event.url ? (
            <Pressable onPress={() => Linking.openURL(event.url!)} style={[s.act, s.actOff]}>
              <Text style={label(14, C.white)}>Site</Text>
              <ExternalIcon size={13} color={C.white} />
            </Pressable>
          ) : null}
        </View>

        {mine.length > 0 && (
          <View style={s.roleRow}>
            {mine.map((r) => {
              const division = (event.leagues?.length ?? 0) > 1 && r.label ? ` · ${r.label}` : '';
              const text = r.role === 'captain' ? `Captain · ${r.team?.name ?? 'your team'}` : `${MODE_NAME[r.role]}${division}`;
              return (
                <Pressable
                  key={`${r.slug}-${r.role}-${r.team?.id ?? ''}`}
                  onPress={() =>
                    nav.navigate('Mode', { eventId: event.id, role: r.role, kind: r.kind, slug: r.slug, leagueId: r.leagueId, teamId: r.team?.id })
                  }
                  style={s.role}
                  accessibilityRole="button"
                >
                  <GearIcon size={15} color={C.bar} />
                  <Text style={label(14, C.bar)}>{text}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: C.bar, overflow: 'hidden' },
  inner: { width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, paddingRight: 0 },
  stats: { flexDirection: 'row', marginTop: 16, overflow: 'hidden', alignSelf: 'flex-start' },
  stat: { paddingHorizontal: 18, paddingVertical: 2, borderRightWidth: 1, borderRightColor: C.barSoft, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  act: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 7, paddingHorizontal: 13, minHeight: 44, justifyContent: 'center', paddingVertical: 10 },
  actOn: { backgroundColor: C.hl },
  actOff: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  roleRow: { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  role: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.hl, borderRadius: 7, paddingHorizontal: 13, minHeight: 44, justifyContent: 'center', paddingVertical: 10 },
});
