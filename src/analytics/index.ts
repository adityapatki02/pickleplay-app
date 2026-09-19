/**
 * Product analytics (PostHog). Everything is a no-op until
 * EXPO_PUBLIC_POSTHOG_KEY is set at build time, so builds without a key send
 * nothing at all.
 *
 * What is sent: app open + screen views (automatic), and the named events the
 * screens call — logins are identified with the user id + name only. Phone
 * numbers, emails and typed text are never sent. Session recording is off.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as client from './client';
import { LEAGUE_KIOSK_ID } from '../config/appMode';

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY || '';
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';

let ready = false;

/**
 * Route name → the business event it represents. Screen views are also sent
 * raw as `$screen`; these named events are the ones to build reports on
 * (event page viewed, fixtures viewed, standings viewed …).
 */
export const SCREEN_EVENTS: Record<string, string> = {
  LeagueDashboard: 'event_page_viewed',
  TournamentDetail: 'event_page_viewed',
  TournamentPublic: 'event_page_viewed',
  IndoorEvent: 'event_page_viewed',
  IndoorOverview: 'event_page_viewed',
  MatchHub: 'event_page_viewed',
  Schedule: 'schedule_viewed',
  Bracket: 'fixtures_viewed',
  Standings: 'standings_viewed',
  TournamentStandings: 'standings_viewed',
  TournamentRankings: 'standings_viewed',
  LeagueStats: 'stats_viewed',
  Fantasy: 'fantasy_viewed',
  LeagueFantasy: 'fantasy_viewed',
  PlayerProfile: 'player_viewed',
  PublicPlayerRecap: 'player_viewed',
  Profile: 'player_viewed',
  FranchiseManagement: 'team_viewed',
  RosterManagement: 'team_viewed',
  VenueDetail: 'venue_viewed',
  // TieDetail fires match_viewed / result_viewed itself once it knows the tie's status.
};

const SEEN_KEY = 'yoiden.analytics.visits';
/** Increments the per-device visit counter; visit 1 = first visit, >1 = return visit. */
async function bumpVisit(): Promise<number> {
  try {
    const n = parseInt((await AsyncStorage.getItem(SEEN_KEY)) || '0', 10) + 1;
    await AsyncStorage.setItem(SEEN_KEY, String(n));
    return n;
  } catch { return 0; }
}
const safe = (fn: () => void) => { try { fn(); } catch { /* analytics must never break the app */ } };

export const analytics = {
  enabled: !!KEY,
  init(): void {
    if (!KEY || ready) return;
    safe(() => {
      client.init(KEY, HOST);
      ready = true;
      void bumpVisit().then((visit) => {
        const props = {
          platform: Platform.OS,
          kiosk_league_id: LEAGUE_KIOSK_ID || null,
          surface: LEAGUE_KIOSK_ID ? 'league_kiosk' : 'app',
          visit_number: visit || undefined,
          return_visit: visit > 1,
        };
        client.capture('app_opened', props);
        if (visit > 1) client.capture('return_visit', props);
      });
    });
  },
  identify(user: { id: string; fullName?: string | null; name?: string | null; role?: string | null } | null | undefined): void {
    if (!ready || !user?.id) return;
    safe(() => client.identify(user.id, { name: user.fullName || user.name || undefined, role: user.role || undefined }));
  },
  reset(): void { if (ready) safe(() => client.reset()); },
  capture(event: string, props?: Record<string, any>): void { if (ready) safe(() => client.capture(event, props)); },
  screen(name: string, props?: Record<string, any>): void { if (ready) safe(() => client.screen(name, props)); },
};
