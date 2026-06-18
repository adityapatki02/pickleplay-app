// ─── App build mode ──────────────────────────────────────────────
//
// League "kiosk" build. When EXPO_PUBLIC_LEAGUE_ID is set at build time, the
// web export is a single-tournament deployment (e.g. mumbaiopen.yoiden.com):
//   • boots straight into that league's dashboard (no Home feed)
//   • shows a Home-only bottom nav (no Play / Book / Fantasy / Me)
//   • hides destructive controls (reset-the-game)
//
// When the var is unset — the normal `console.yoiden.com` build — none of the
// above applies and the app behaves as the full product.
//
// Expo inlines EXPO_PUBLIC_* into the web bundle at build time, so this is a
// compile-time constant (dead code for the other mode is tree-shaken).
export const LEAGUE_KIOSK_ID: string = process.env.EXPO_PUBLIC_LEAGUE_ID || '';
export const IS_LEAGUE_KIOSK: boolean = LEAGUE_KIOSK_ID.length > 0;
