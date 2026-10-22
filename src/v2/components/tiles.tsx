// Event and registration tiles: the same cards as yoiden.com's strip and grids.
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F, TILE_W, body, card, head, label } from '../theme';
import { EventLogo, StatusLabel } from './ui';
import { ExternalIcon, StarIcon } from './icons';
import { formatWhen, hasPage, type EventStatus, type YoidenEvent } from '../data/events';
import { REGISTRATIONS, fetchSeats, isOpen, type Registration, type SeatLine } from '../data/registrations';
import { useFollows } from '../store/follows';
import { logoUrl } from '../data/events';

/** Event tile. Tapping opens the event inside the app; the event's own site stays one tap away. */
export function EventTile({
  e,
  status,
  onPress,
  width = TILE_W,
}: {
  e: YoidenEvent;
  status: EventStatus;
  onPress: () => void;
  width?: number | '100%';
}) {
  const auction = e.kind === 'auction';
  const followed = useFollows((s) => s.ids.includes(e.id));
  const inApp = hasPage(e);
  const pageLabel =
    status === 'live'
      ? 'Live scores'
      : auction
        ? status === 'upcoming' ? 'Teams & players' : 'Teams & top buys'
        : status === 'upcoming'
          ? 'Fixtures & teams'
          : 'Results & standings';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        card,
        s.tile,
        { width, borderTopColor: status === 'live' ? C.live : auction ? C.hl : C.accent, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={s.top}>
        <StatusLabel status={status} auction={auction} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
          {followed && <StarIcon size={12} color={C.bar} fill={C.hl} />}
          <Text style={body(11.5, C.mute, 'medium')} numberOfLines={1}>
            {e.sport} · {e.city}
          </Text>
        </View>
      </View>
      <View style={s.mid}>
        <EventLogo e={e} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={head(17, C.ink)} numberOfLines={2}>
            {e.name}
          </Text>
          <Text style={[body(12.5, C.soft), { marginTop: 2 }]}>{formatWhen(e)}</Text>
        </View>
      </View>
      <Text style={[body(12.5, C.soft), { marginTop: 10 }]} numberOfLines={1}>
        {e.facts.join(' · ')}
      </Text>
      <View style={{ flex: 1 }} />
      <View style={s.foot}>
        <Text style={body(13, inApp ? C.ink : C.mute, 'semi')}>{inApp ? pageLabel : `${auction ? 'Auction' : 'Event'} on Yoiden`}</Text>
        {e.url ? (
          <Pressable onPress={() => Linking.openURL(e.url!)} hitSlop={8} style={s.site}>
            <Text style={body(12.5, C.soft, 'semi')}>{inApp ? 'Event site' : 'Open site'}</Text>
            <ExternalIcon size={12} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

// ── Registrations ────────────────────────────────────────────────────

export type OpenRegistration = { r: Registration; seats: SeatLine[] | undefined; closed?: boolean };

/** Forms open now, with their live Open / Waitlist / Full state. */
export function useOpenRegistrations(now: number): OpenRegistration[] {
  const open = useMemo(() => REGISTRATIONS.filter((r) => isOpen(r, now)), [now]);
  const [seats, setSeats] = useState<Record<string, SeatLine[] | null>>({});
  useEffect(() => {
    let alive = true;
    open.forEach((r) =>
      fetchSeats(r)
        .catch(() => [] as SeatLine[])
        .then((x) => alive && setSeats((m) => ({ ...m, [r.id]: x }))),
    );
    return () => {
      alive = false;
    };
  }, [open]);
  return open.filter((r) => seats[r.id] !== null).map((r) => ({ r, seats: seats[r.id] ?? undefined }));
}

/** Open forms first, then closed ones (most recent first). */
export function useAllRegistrations(now: number): OpenRegistration[] {
  const open = useOpenRegistrations(now);
  const closed = useMemo(
    () =>
      REGISTRATIONS.filter((r) => !isOpen(r, now))
        .sort((a, b) => b.closes.localeCompare(a.closes))
        .map((r) => ({ r, seats: [] as SeatLine[], closed: true })),
    [now],
  );
  return [...open, ...closed];
}

const STATE: Record<SeatLine['state'], { text: string; bg: string; fg: string }> = {
  open: { text: 'Open', bg: C.greenSoft, fg: '#15803D' },
  waitlist: { text: 'Waitlist', bg: C.amberSoft, fg: C.amber },
  closed: { text: 'Full', bg: C.page, fg: C.mute },
};

export function RegistrationTile({ r, seats, closed, width = TILE_W }: OpenRegistration & { width?: number | '100%' }) {
  const states = seats?.map((x) => x.state) ?? [];
  const overall = closed ? 'ended' : !states.length || states.includes('open') ? 'open' : states.includes('waitlist') ? 'waitlist' : 'full';
  const tag = {
    open: { text: 'Registrations open', color: C.green },
    waitlist: { text: 'Waitlist open', color: C.amber },
    full: { text: 'Registrations full', color: C.mute },
    ended: { text: 'Registration closed', color: C.mute },
  }[overall];
  const url = logoUrl(r.logo);
  return (
    <Pressable onPress={() => Linking.openURL(r.url)} style={({ pressed }) => [card, s.tile, { width, borderTopColor: C.green, opacity: pressed ? 0.92 : 1 }]}>
      <View style={s.top}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tag.color }} />
          <Text style={label(11.5, tag.color)}>{tag.text}</Text>
        </View>
        <Text style={body(11.5, C.mute, 'medium')} numberOfLines={1}>
          {r.sport} · {r.city}
        </Text>
      </View>
      <View style={s.mid}>
        <View style={[s.regLogo, r.logoOnDark ? { backgroundColor: C.bar, borderWidth: 0 } : !url ? { backgroundColor: '#EEF0F3', borderWidth: 0 } : null]}>
          {url ? (
            <Image source={{ uri: url }} style={{ width: 46, height: 46 }} resizeMode="contain" />
          ) : (
            <Text style={{ fontFamily: F.heavy, fontSize: 15, color: C.ink }}>{r.initials}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={head(17, C.ink)} numberOfLines={2}>
            {r.name}
          </Text>
          <Text style={[body(12.5, C.soft), { marginTop: 2 }]}>{closed && r.ran ? r.ran : r.eventWhen}</Text>
        </View>
      </View>
      <Text style={[body(12.5, C.soft), { marginTop: 10 }]}>{r.kind}</Text>
      {!closed && seats && seats.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {seats.map((x) => (
            <View key={x.label} style={{ backgroundColor: STATE[x.state].bg, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 }}>
              <Text style={label(11, STATE[x.state].fg)}>
                {x.label === 'Players' ? STATE[x.state].text : `${x.label} · ${STATE[x.state].text}`}
              </Text>
            </View>
          ))}
        </View>
      )}
      <View style={{ flex: 1 }} />
      {closed ? (
        <View style={[s.foot, { marginTop: 12 }]}>
          <Text style={body(13, C.ink, 'semi')}>See the form</Text>
        </View>
      ) : (
        <View style={s.regBtn}>
          <Text style={label(13, C.bar)}>
            {overall === 'full' ? 'View form' : overall === 'waitlist' ? 'Join waitlist' : 'Register now'} →
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  tile: { borderTopWidth: 3, padding: 14, minHeight: 190 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  mid: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 11, marginTop: 12 },
  site: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  regLogo: { width: 52, height: 52, borderRadius: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  regBtn: { alignSelf: 'flex-start', backgroundColor: C.hl, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, marginTop: 12 },
});
