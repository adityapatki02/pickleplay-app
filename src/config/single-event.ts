/**
 * Single-tournament mode. When enabled, the app shows ONLY this league/season
 * everywhere and hides all other tournaments/leagues. Flip `enabled` to false
 * to restore the normal multi-tournament app with no other changes.
 */
export const SINGLE_EVENT = {
  enabled: true,
  leagueId: '69776e9d-62b7-43a9-95a1-cecb24647b7b',
  seasonId: '4ad2b657-de6c-4db2-ae00-e8ab392c37ae',
  name: 'Mumbai Open',
} as const;

export function isSingleEvent(): boolean {
  return SINGLE_EVENT.enabled;
}
