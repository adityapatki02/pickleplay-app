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
import * as client from './client';
import { LEAGUE_KIOSK_ID } from '../config/appMode';

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY || '';
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';

let ready = false;
const safe = (fn: () => void) => { try { fn(); } catch { /* analytics must never break the app */ } };

export const analytics = {
  enabled: !!KEY,
  init(): void {
    if (!KEY || ready) return;
    safe(() => {
      client.init(KEY, HOST);
      ready = true;
      client.capture('app_opened', {
        platform: Platform.OS,
        kiosk_league_id: LEAGUE_KIOSK_ID || null,
        surface: LEAGUE_KIOSK_ID ? 'league_kiosk' : 'app',
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
