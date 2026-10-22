// Me tab. Guests see what logging in gives them and a phone login button.
// Signed-in players see their profile banner with headline stats, the events
// where they hold a role, their records across events (from the career API),
// the saved profile that fills registration forms, and settings.
import React, { useMemo } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { C, body, card, head, label } from '../theme';
import { Button, Empty, Panel, SectionLabel as UiSectionLabel, Stripes, EventLogo } from '../components/ui';
import { AppHeader, Page } from '../components/chrome';
import { ChevronRight } from '../components/icons';
import { useLoad } from '../hooks';
import { useMyRoles, type EventRole } from '../store/roles';
import { EVENTS, type YoidenEvent } from '../data/events';
import { useAuthStore } from '../../store/authStore';
import { getPlayerCareer } from '../../api/leagues.api';
import { authApi } from '../../api/auth.api';
import { xAlert, xConfirm } from '../../utils/alert';

const PRIVACY = 'https://yoiden.com/privacy';
const TERMS = 'https://yoiden.com/terms';

// ── Career API shape (GET /players/:id/career) ───────────────────────
type FormatRow = { format: string; played: number; won: number; lost: number; winPct: number };
type LeagueRow = { seasonId: string; leagueName: string; seasonName: string; team: string; auctionPrice: number | null; byFormat: FormatRow[] };
type SportBlock = { sport: string; headline: { played: number; won: number; winPct: number }; leagues: LeagueRow[] };
type Career = { player: { id: string; fullName: string; avatarUrl: string | null; city: string | null }; sports: SportBlock[] };

/** Section label aligned with the cards (Page already pads 16 on each side). */
export function SectionLabel(p: React.ComponentProps<typeof UiSectionLabel>) {
  return (
    <View style={{ marginHorizontal: -16 }}>
      <UiSectionLabel {...p} />
    </View>
  );
}

const ROLE_TEXT: Record<EventRole['role'], string> = { admin: 'Admin', scorer: 'Scorer', captain: 'Captain' };

const initialsOf = (name: string) => {
  const p = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return (p.length === 1 ? p[0][0] : p[0][0] + p[p.length - 1][0]).toUpperCase();
};

const maskPhone = (phone?: string) => {
  const d = (phone || '').replace(/\D/g, '');
  if (d.length < 4) return phone || '—';
  return `•••••• ${d.slice(-4)}`;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Best-effort match of a career league name to an event in EVENTS (the API returns names, not slugs). */
function eventForLeague(leagueName: string, seasonName: string): YoidenEvent | undefined {
  const l = norm(leagueName);
  const ls = norm(`${leagueName} ${seasonName}`);
  if (!l) return undefined;
  let best: YoidenEvent | undefined;
  for (const e of EVENTS) {
    if (e.kind === 'auction') continue;
    const n = norm(e.name);
    const main = norm(e.name.split('·')[0]);
    const slugs = (e.leagues ?? []).map((d) => norm(d.slug.replace(/-/g, ' ')));
    if (n === l || n === ls || main === l || slugs.includes(l)) return e;
    if (!best && (n.includes(l) || l.includes(main))) best = e;
  }
  return best;
}

/** Rows for the events where the player is admin / scorer / captain. Also used by My events. */
export function RoleRows({ roles, compact }: { roles: EventRole[]; compact?: boolean }) {
  const nav = useNavigation<any>();
  return (
    <View>
      {roles.map((r, i) => (
        <Pressable
          key={`${r.event.id}-${r.slug}-${r.role}`}
          onPress={() => nav.navigate('Event', { id: r.event.id })}
          style={({ pressed }) => [s.row, compact && { paddingVertical: 9 }, i === roles.length - 1 && { borderBottomWidth: 0 }, pressed && { backgroundColor: C.page }]}
        >
          <EventLogo e={r.event} size={compact ? 34 : 42} />
          <View style={{ flex: 1 }}>
            <Text style={body(14.5, C.ink, 'semi')} numberOfLines={1}>
              {r.event.name}
            </Text>
            {r.label && (r.event.leagues?.length ?? 0) > 1 ? <Text style={body(12.5, C.soft)}>{r.label}</Text> : null}
          </View>
          <View style={s.badge}>
            <Text style={label(11.5, C.bar)}>{ROLE_TEXT[r.role]}</Text>
          </View>
          <ChevronRight size={16} color={C.mute} />
        </Pressable>
      ))}
    </View>
  );
}

function Guest() {
  const nav = useNavigation<any>();
  const points = [
    ['Your records', 'Every match you have played on Yoiden, across every league and event.'],
    ['Your roles', 'Events where you are an admin, scorer or captain, one tap away.'],
    ['Follows saved', 'The events you follow stay with your phone number.'],
    ['Faster registration', 'Your saved profile fills every registration form.'],
  ];
  return (
    <Page>
      <View style={{ paddingTop: 16 }}>
        <Panel title="Log in to Yoiden">
          <View style={{ padding: 16, gap: 14 }}>
            <Text style={body(14, C.soft)}>Your phone number is your Yoiden identity. Log in once and everything ties to it.</Text>
            {points.map(([t, d]) => (
              <View key={t} style={{ flexDirection: 'row', gap: 10 }}>
                <View style={s.dot} />
                <View style={{ flex: 1 }}>
                  <Text style={body(14.5, C.ink, 'semi')}>{t}</Text>
                  <Text style={[body(13, C.soft), { marginTop: 2 }]}>{d}</Text>
                </View>
              </View>
            ))}
            <View style={{ marginTop: 4 }}>
              <Button title="Log in with your phone" onPress={() => nav.navigate('Auth')} />
            </View>
            <Text style={[body(12, C.mute), { textAlign: 'center' }]}>Browsing events, scores and players needs no login.</Text>
          </View>
        </Panel>
      </View>
      <SettingsPanel signedIn={false} />
    </Page>
  );
}

function SettingsPanel({ signedIn }: { signedIn: boolean }) {
  const nav = useNavigation<any>();
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  const doDelete = async () => {
    try {
      await authApi.deleteAccount();
      useAuthStore.getState().logout();
    } catch (e: any) {
      xAlert('Error', e?.response?.data?.message ?? 'Could not delete your account. Please try again.');
    }
  };
  const items: { t: string; onPress: () => void; danger?: boolean }[] = [
    { t: 'Help & support', onPress: () => nav.navigate('Support') },
    { t: 'Privacy policy', onPress: () => open(PRIVACY) },
    { t: 'Terms of use', onPress: () => open(TERMS) },
  ];
  if (signedIn) {
    items.push({ t: 'Log out', onPress: () => useAuthStore.getState().logout() });
    items.push({
      t: 'Delete account',
      danger: true,
      onPress: () => xConfirm('Delete account', 'This permanently deletes your account and all your data. This cannot be undone.', doDelete),
    });
  }
  return (
    <>
      <SectionLabel>Settings</SectionLabel>
      <View style={[card, { overflow: 'hidden' }]}>
        {items.map((it, i) => (
          <Pressable
            key={it.t}
            onPress={it.onPress}
            style={({ pressed }) => [s.row, i === items.length - 1 && { borderBottomWidth: 0 }, pressed && { backgroundColor: C.page }]}
          >
            <Text style={[body(14.5, it.danger ? C.live : C.ink, 'medium'), { flex: 1 }]}>{it.t}</Text>
            <ChevronRight size={16} color={C.mute} />
          </Pressable>
        ))}
      </View>
    </>
  );
}

function SignedIn() {
  const nav = useNavigation<any>();
  const user = useAuthStore((st) => st.user)!;
  const { roles, loading: rolesLoading } = useMyRoles();
  const { state, reload } = useLoad<Career>(`career-${user.id}`, () => getPlayerCareer(user.id, 'private'));
  const career = state.status === 'ready' ? state.data : null;

  const name = user.displayName || user.fullName || career?.player.fullName || 'Yoiden player';
  const city = user.city || career?.player.city || '';
  const avatar = user.avatarUrl || career?.player.avatarUrl || null;

  const { records, events, matches, winPct } = useMemo(() => {
    const recs: { key: string; sport: string; l: LeagueRow; played: number; won: number; event?: YoidenEvent }[] = [];
    let played = 0;
    let won = 0;
    for (const sp of career?.sports ?? []) {
      played += sp.headline?.played ?? 0;
      won += sp.headline?.won ?? 0;
      for (const l of sp.leagues ?? []) {
        const p = (l.byFormat ?? []).reduce((a, f) => a + (f.played || 0), 0);
        const w = (l.byFormat ?? []).reduce((a, f) => a + (f.won || 0), 0);
        recs.push({ key: `${sp.sport}-${l.seasonId}`, sport: sp.sport, l, played: p, won: w, event: eventForLeague(l.leagueName, l.seasonName) });
      }
    }
    return {
      records: recs,
      events: new Set(recs.map((r) => r.l.seasonId)).size,
      matches: played,
      winPct: played ? Math.round((won / played) * 100) : 0,
    };
  }, [career]);

  const stats: [string, string][] = [
    ['Events', career ? String(events) : '—'],
    ['Win rate', career ? (matches ? `${winPct}%` : '—') : '—'],
    ['Matches', career ? String(matches) : '—'],
  ];

  return (
    <Page onRefresh={reload}>
      {/* Profile banner */}
      <View style={s.banner}>
        <Stripes height={150} wide />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, { backgroundColor: C.hl, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={head(24, C.bar)}>{initialsOf(name)}</Text>
            </View>
          )}
          <View style={{ flex: 1, paddingRight: 70 }}>
            <Text style={head(26, C.white)} numberOfLines={2}>
              {name}
            </Text>
            {city ? <Text style={[body(13, 'rgba(255,255,255,0.75)'), { marginTop: 2 }]}>{city}</Text> : null}
          </View>
        </View>
        <View style={s.stats}>
          {stats.map(([k, v], i) => (
            <View key={k} style={[s.stat, i > 0 && { borderLeftWidth: 1, borderLeftColor: C.barSoft }]}>
              <Text style={head(24, C.hl)}>{v}</Text>
              <Text style={label(11, 'rgba(255,255,255,0.7)')}>{k}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Roles */}
      {(rolesLoading || roles.length > 0) && (
        <>
          <SectionLabel>Your roles</SectionLabel>
          {rolesLoading && !roles.length ? (
            <View style={[card, { padding: 18 }]}>
              <ActivityIndicator color={C.accent} />
            </View>
          ) : (
            <View style={[card, { overflow: 'hidden' }]}>
              <RoleRows roles={roles} />
            </View>
          )}
        </>
      )}

      {/* Records */}
      <SectionLabel>Your records</SectionLabel>
      {state.status === 'loading' ? (
        <View style={[card, { padding: 18 }]}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : state.status === 'error' ? (
        <Empty>Could not load your records. Pull down to try again.</Empty>
      ) : !records.length ? (
        <Empty>No matches yet. Play in an event run on Yoiden and your record shows up here.</Empty>
      ) : (
        <View style={[card, { overflow: 'hidden' }]}>
          {records.map((r, i) => {
            const pct = r.played ? Math.round((r.won / r.played) * 100) : 0;
            const ev = r.event;
            return (
              <Pressable
                key={r.key}
                disabled={!ev}
                onPress={() => ev && nav.navigate('Event', { id: ev.id })}
                style={({ pressed }) => [s.row, i === records.length - 1 && { borderBottomWidth: 0 }, pressed && ev && { backgroundColor: C.page }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={label(11, C.accent)}>{r.sport}</Text>
                  <Text style={[body(14.5, C.ink, 'semi'), { marginTop: 1 }]} numberOfLines={1}>
                    {r.l.leagueName}
                    {r.l.seasonName ? ` · ${r.l.seasonName}` : ''}
                  </Text>
                  {r.l.team ? (
                    <Text style={body(12.5, C.soft)} numberOfLines={1}>
                      {r.l.team}
                    </Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={head(18, C.ink)}>
                    {r.won}–{r.played - r.won}
                  </Text>
                  <Text style={body(11.5, C.mute, 'medium')}>{r.played ? `${pct}% won` : 'No matches'}</Text>
                </View>
                {ev ? <ChevronRight size={16} color={C.mute} /> : <View style={{ width: 16 }} />}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Saved profile */}
      <SectionLabel
        right={
          <Pressable onPress={() => nav.navigate('EditProfile')} hitSlop={8}>
            <Text style={label(13, C.accent)}>Edit</Text>
          </Pressable>
        }
      >
        Saved profile
      </SectionLabel>
      <View style={[card, { overflow: 'hidden' }]}>
        {(
          [
            ['Name', name],
            ['Phone', maskPhone(user.phone)],
            ['City', city || 'Not set'],
          ] as [string, string][]
        ).map(([k, v]) => (
          <View key={k} style={s.detail}>
            <Text style={body(12, C.mute, 'medium')}>{k}</Text>
            <Text style={[body(14, C.ink, 'semi'), { marginTop: 2 }]}>{v}</Text>
          </View>
        ))}
        <Text style={[body(12.5, C.soft), { padding: 14 }]}>This fills every registration form on Yoiden, so you only type it once.</Text>
      </View>

      <SettingsPanel signedIn />
    </Page>
  );
}

export default function MeScreen() {
  const signedIn = useAuthStore((st) => st.isAuthenticated && !!st.user);
  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <AppHeader title="Me" />
      {signedIn ? <SignedIn /> : <Guest />}
    </View>
  );
}

const s = StyleSheet.create({
  banner: { backgroundColor: C.bar, borderRadius: 10, marginTop: 16, padding: 16, overflow: 'hidden' },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: C.hl },
  stats: { flexDirection: 'row', marginTop: 16, borderTopWidth: 1, borderTopColor: C.barSoft, paddingTop: 12 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  badge: { backgroundColor: C.hl, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  dot: { width: 8, height: 8, borderRadius: 2, backgroundColor: C.hl, marginTop: 6, borderWidth: 1, borderColor: C.hlInk },
  detail: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
});
