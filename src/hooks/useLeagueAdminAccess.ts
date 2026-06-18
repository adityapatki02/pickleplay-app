import { useEffect, useState } from 'react';
import { getLeagues } from '../api/leagues.api';

/**
 * Resolves whether the current user has management access to a league —
 * i.e. is the **owner** OR a **co-admin** (a row in league_admins).
 *
 * The frontend historically treated only the organizer as admin. This hook
 * adds co-admin recognition without leaking any data or needing a new backend
 * route: `GET /leagues?organizerId=<me>` already returns exactly the leagues
 * the caller owns or admins, so "is this league in my list?" === has-access.
 *
 * The owner case short-circuits (no network call). Pure spectators get an
 * empty/unrelated list → false, so they stay view-only.
 */
export function useLeagueAdminAccess(
  leagueId?: string,
  userId?: string,
  isOwner?: boolean,
): boolean {
  const [isCoAdmin, setIsCoAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    if (isOwner) {
      setIsCoAdmin(false); // owner already covered by the return below
      return;
    }
    if (!leagueId || !userId) {
      setIsCoAdmin(false);
      return;
    }
    getLeagues({ organizerId: userId })
      .then((leagues) => {
        if (!alive) return;
        setIsCoAdmin(Array.isArray(leagues) && leagues.some((l: any) => l?.id === leagueId));
      })
      .catch(() => {
        if (alive) setIsCoAdmin(false);
      });
    return () => {
      alive = false;
    };
  }, [leagueId, userId, isOwner]);

  return !!isOwner || isCoAdmin;
}
