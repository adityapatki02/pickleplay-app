import { Tournament, TournamentStatus, BracketData } from '../types/tournament.types';

// ─── Finders ─────────────────────────────────────────────────────────────────

/**
 * Returns the start of "today" in IST (UTC+5:30) as a UTC timestamp.
 * Used to filter out past tournaments that haven't been marked complete.
 */
function todayStartIST(): Date {
  const now = new Date();
  // Convert to IST
  const istOffset = 5.5 * 60 * 60 * 1000;
  const nowIst = new Date(now.getTime() + istOffset);
  // Start of today in IST → back to UTC
  const startOfDayIst = new Date(nowIst.toISOString().slice(0, 10) + 'T00:00:00.000Z');
  return new Date(startOfDayIst.getTime() - istOffset);
}

/**
 * Returns the first live tournament owned by the organizer.
 * If multiple are live, picks the one closest to today (not old stale ones).
 */
export function findActiveLive(tournaments: Tournament[]): Tournament | null {
  const todayStart = todayStartIST();
  const live = tournaments.filter((t) => {
    if (t.status !== 'in_progress') return false;
    // Exclude tournaments whose start date is more than 1 day in the past
    // (they're stale — organizer forgot to mark complete)
    const start = new Date(t.startDate);
    const oneDayAgo = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    return start >= oneDayAgo;
  });
  if (live.length === 0) return null;
  // Pick the one closest to now
  const now = Date.now();
  live.sort((a, b) =>
    Math.abs(new Date(a.startDate).getTime() - now) -
    Math.abs(new Date(b.startDate).getTime() - now),
  );
  return live[0];
}

/**
 * Returns the next upcoming tournament (not yet started).
 * Only includes tournaments whose start date is today or in the future (IST).
 */
export function findUpcoming(tournaments: Tournament[]): Tournament | null {
  const upcomingStatuses: TournamentStatus[] = [
    'registration_open',
    'registration_closed',
    'published',
  ];
  const todayStart = todayStartIST();
  const upcoming = tournaments.filter((t) => {
    if (!upcomingStatuses.includes(t.status)) return false;
    // Only show if start date is today or future
    return new Date(t.startDate) >= todayStart;
  });
  if (upcoming.length === 0) return null;
  // Nearest first
  upcoming.sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );
  return upcoming[0];
}

// ─── Live progress ───────────────────────────────────────────────────────────

export interface LiveProgress {
  done: number;
  total: number;
  pct: number;
}

/**
 * Computes match progress across one or more category brackets.
 * A match is "done" if its status is 'completed' or 'walkover'.
 */
export function computeLiveProgress(bracketDataList: BracketData[]): LiveProgress {
  let done = 0;
  let total = 0;
  for (const bracket of bracketDataList) {
    // Pool matches
    for (const pool of bracket.pools ?? []) {
      for (const match of pool.matches ?? []) {
        total++;
        if (match.status === 'completed' || match.status === 'walkover') done++;
      }
    }
    // Knockout matches
    for (const match of bracket.knockout ?? []) {
      total++;
      if (match.status === 'completed' || match.status === 'walkover') done++;
    }
  }
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, pct };
}

// ─── Action items ────────────────────────────────────────────────────────────

export type ActionItemType = 'draft' | 'closing_soon' | 'pending_partner';

export interface ActionItem {
  id: string;
  type: ActionItemType;
  label: string;
  tournamentId: string;
  count?: number;
}

/**
 * Builds action items for the organizer dashboard.
 * - Drafts not yet published
 * - Registration closing within 3 days
 * - Pending partner registrations (only for the given "top" tournament, if any)
 *
 * @param tournaments all tournaments owned by the organizer
 * @param topTournamentId the id of the live OR next upcoming tournament (to scope pending_partner check)
 * @param pendingPartnerCount number of pending_partner registrations in that top tournament
 */
export function buildActionItems(
  tournaments: Tournament[],
  topTournamentId?: string | null,
  pendingPartnerCount?: number,
): ActionItem[] {
  const items: ActionItem[] = [];
  const now = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  const todayStart = todayStartIST();

  for (const t of tournaments) {
    const startDate = new Date(t.startDate);
    const isPast = startDate < todayStart;

    // Skip past tournaments entirely — they shouldn't clutter the attention list
    if (isPast && t.status !== 'in_progress') continue;

    if (t.status === 'draft') {
      items.push({
        id: `draft-${t.id}`,
        type: 'draft',
        label: `Draft not published: ${t.name}`,
        tournamentId: t.id,
      });
    }

    if (t.status === 'registration_open' && t.registrationDeadline) {
      const deadline = new Date(t.registrationDeadline).getTime();
      const diff = deadline - now;
      if (diff > 0 && diff <= threeDaysMs) {
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const label = days > 0
          ? `Reg closes in ${days}d ${hours}h: ${t.name}`
          : `Reg closes in ${hours}h: ${t.name}`;
        items.push({
          id: `closing-${t.id}`,
          type: 'closing_soon',
          label,
          tournamentId: t.id,
        });
      }
    }
  }

  if (topTournamentId && pendingPartnerCount && pendingPartnerCount > 0) {
    const t = tournaments.find((x) => x.id === topTournamentId);
    if (t) {
      items.push({
        id: `pending-${topTournamentId}`,
        type: 'pending_partner',
        label: `${pendingPartnerCount} pending partner${pendingPartnerCount === 1 ? '' : 's'}: ${t.name}`,
        tournamentId: topTournamentId,
        count: pendingPartnerCount,
      });
    }
  }

  return items;
}

// ─── Quick stats ─────────────────────────────────────────────────────────────

export interface QuickStats {
  liveCount: number;
  registrationsThisMonth: number;
  tournamentsThisMonth: number;
  completionRate: number | null; // null when denominator is 0
}

function sumRegisteredTeams(t: Tournament): number {
  if (!t.categories) return 0;
  return t.categories.reduce((s, c) => s + (c.registeredTeams ?? 0), 0);
}

function isThisMonth(date: string | Date): boolean {
  const d = new Date(date);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function computeQuickStats(tournaments: Tournament[]): QuickStats {
  let liveCount = 0;
  let registrationsThisMonth = 0;
  let tournamentsThisMonth = 0;
  let completed = 0;
  let pastDenominator = 0;

  const now = Date.now();

  for (const t of tournaments) {
    if (t.status === 'in_progress') liveCount++;

    if (t.startDate && isThisMonth(t.startDate)) {
      tournamentsThisMonth++;
      registrationsThisMonth += sumRegisteredTeams(t);
    }

    const endDateTime = t.endDate ? new Date(t.endDate).getTime() : 0;
    const isPast = endDateTime > 0 && endDateTime < now;

    if (isPast || t.status === 'completed' || t.status === 'cancelled') {
      pastDenominator++;
      if (t.status === 'completed') completed++;
    }
  }

  const completionRate =
    pastDenominator === 0 ? null : Math.round((completed / pastDenominator) * 100);

  return {
    liveCount,
    registrationsThisMonth,
    tournamentsThisMonth,
    completionRate,
  };
}

// ─── Recent tournaments ──────────────────────────────────────────────────────

export function recentTournaments(
  tournaments: Tournament[],
  limit = 3,
): Tournament[] {
  const copy = [...tournaments];
  copy.sort((a, b) => {
    const ua = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
    const ub = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
    return ub - ua;
  });
  return copy.slice(0, limit);
}

// ─── Formatters ──────────────────────────────────────────────────────────────

export function formatCountdown(targetDate: string | Date): string {
  const diff = new Date(targetDate).getTime() - Date.now();
  if (diff <= 0) return 'Started';
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${minutes}m`;
}

export function formatRegProgress(tournament: Tournament): { registered: number; max: number } {
  let registered = 0;
  let max = 0;
  for (const c of tournament.categories ?? []) {
    registered += c.registeredTeams ?? 0;
    max += c.maxTeams ?? 0;
  }
  return { registered, max };
}
