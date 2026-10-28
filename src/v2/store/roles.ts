import { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import { getLeagues } from '../../api/leagues.api';
import { useAuthStore } from '../../store/authStore';
import { EVENTS, type YoidenEvent } from '../data/events';
import { useEventListState } from './event-list';

export type Role = 'admin' | 'scorer' | 'captain';

export type EventRole = {
  event: YoidenEvent;
  role: Role;
  /** league: a league role; football: a football event; event: given straight to the phone. */
  kind: 'league' | 'football' | 'event';
  /** The league this role is for (an event can have divisions). Leagues only. */
  leagueId?: string;
  slug: string | null;
  label: string | null;
  /** The team a captain leads. */
  team?: { id: string; name: string };
};

type ServerRole = Omit<EventRole, 'event'> & { eventId: string | null };

/**
 * The signed-in player's roles, per event, from `GET /app/me/roles`: league owner,
 * co-admin, scorer and captain, football scorer and admin, and roles given straight to
 * the phone, across every account on the same phone number. Roles for events that
 * aren't in the app's list are left out.
 *
 * Until the server has that endpoint, falls back to the old check: leagues the account
 * owns or co-admins (`GET /leagues?organizerId=me`) make it admin of the matching event.
 */
export function useMyRoles(): { roles: EventRole[]; loading: boolean } {
  const user = useAuthStore((s) => s.user);
  const listVersion = useEventListState((s) => s.version);
  const [roles, setRoles] = useState<EventRole[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setRoles([]);
      return;
    }
    let alive = true;
    setLoading(true);
    load(user.id)
      .then((r) => alive && setRoles(r))
      .catch(() => alive && setRoles([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [user?.id, listVersion]);

  return { roles, loading };
}

async function load(userId: string): Promise<EventRole[]> {
  try {
    const res = await apiClient.get('/app/me/roles');
    const list: ServerRole[] = Array.isArray(res.data?.data) ? res.data.data : [];
    return list.flatMap((r) => {
      const event = r.eventId ? EVENTS.find((e) => e.id === r.eventId) : undefined;
      if (!event) return [];
      const division = r.slug ? event.leagues?.find((l) => l.slug === r.slug)?.label : undefined;
      return [{ ...r, event, label: division ?? r.label ?? null }];
    });
  } catch (err: any) {
    if (err?.response?.status !== 404) throw err;
  }
  const leagues: any[] = await getLeagues({ organizerId: userId });
  const bySlug = new Map((Array.isArray(leagues) ? leagues : []).map((l) => [l.slug, l]));
  const out: EventRole[] = [];
  for (const event of EVENTS) {
    for (const div of event.leagues ?? []) {
      const l = bySlug.get(div.slug);
      if (l) out.push({ event, role: 'admin', kind: 'league', leagueId: l.id, slug: div.slug, label: div.label });
    }
  }
  return out;
}
