import { useEffect, useState } from 'react';
import { getLeagues } from '../../api/leagues.api';
import { useAuthStore } from '../../store/authStore';
import { EVENTS, type YoidenEvent } from '../data/events';

export type Role = 'admin' | 'scorer' | 'captain';

export type EventRole = {
  event: YoidenEvent;
  role: Role;
  /** The league this role is for (an event can have divisions). */
  leagueId: string;
  slug: string;
  label: string;
};

/**
 * The signed-in player's roles, per event.
 *
 * Today this reuses the existing access check: `GET /leagues?organizerId=me`
 * returns every league the account owns or co-admins, and that makes them
 * admin of the matching event (admins can also score). When roles-by-phone
 * lands on the server (admin / scorer / captain per event), only this hook
 * changes; the screens already take a list of roles.
 */
export function useMyRoles(): { roles: EventRole[]; loading: boolean } {
  const user = useAuthStore((s) => s.user);
  const [roles, setRoles] = useState<EventRole[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setRoles([]);
      return;
    }
    let alive = true;
    setLoading(true);
    getLeagues({ organizerId: user.id })
      .then((leagues: any[]) => {
        if (!alive) return;
        const bySlug = new Map((Array.isArray(leagues) ? leagues : []).map((l) => [l.slug, l]));
        const out: EventRole[] = [];
        for (const event of EVENTS) {
          for (const div of event.leagues ?? []) {
            const l = bySlug.get(div.slug);
            if (l) out.push({ event, role: 'admin', leagueId: l.id, slug: div.slug, label: div.label });
          }
        }
        setRoles(out);
      })
      .catch(() => alive && setRoles([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [user?.id]);

  return { roles, loading };
}
