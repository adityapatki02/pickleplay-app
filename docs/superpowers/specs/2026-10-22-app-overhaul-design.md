# Yoiden app overhaul: events-first, roles inside events

Date: 2026-10-22 · Branch: `app-overhaul` (worktree `pickleplay-app-overhaul`, from `main` 23d957c)

## Intent

The Yoiden app stops being a court-booking app with events on the side and becomes the home of
every event Yoiden runs. It should look and behave like the event sites and the new yoiden.com
(navy / lime broadcast theme, Barlow Condensed headings), so a player who followed a league on
the web feels at home in the app. Everyone gets the same public app; admins, scorers and captains
get extra controls *inside the events they belong to*, and can step out of them to see the public
view.

## Decided with Aditya

- **Four tabs:** Home · Events · My events · Me (approved mockup, 2026-10-22).
- **Home** = search bar, then the events you **follow** pinned first, then Live now, Registrations
  open, Starting soon, Recent results, in the website's tile style.
- **Events** = every event, the same lists as yoiden.com/events (live, upcoming, registrations,
  past events, past auctions), searchable, filterable by sport.
- **Event page** = the event-site screens (matches, standings/tables, players, teams, about,
  match pages, player pages, streams) for every event type: leagues, tournaments, football,
  indoor games, auctions. A **Follow** button pins the event to the top of Home.
- **Roles live inside events.** If the logged-in phone is admin / scorer / captain of an event,
  that event shows a role button; entering it shows a lime "Managing · <event>" bar with
  **View as public**. "Your roles" is listed on Me.
- **Identity is the phone number.** Every record (registrations, rosters, auction pools, results)
  ties to a phone; a player's records appear on Me automatically. Roles also attach to phones;
  organiser PINs are retired as events move over.
- **Register in the app** with a saved profile (name, photo, DOB, gender, city, T-shirt, sports and
  levels, CricHeroes/DUPR) that prefills every form; only event-specific questions are asked.
- **Court booking** leaves the player app (switched off, not deleted); the court-owner dashboard
  moves to the web console.
- **Match-day admin in the app; setup on the web console** (spreadsheet imports, building
  fixtures, running an auction floor).

## Non-goals (this round)

- No change to the league-kiosk / indoor / tournament web builds (they branch before the new shell).
- No deletion of booking, wallet or owner code.
- Push notifications (needs a native module, so a store release of its own).

## Build order

1. **Public app (this local build):** new shell, theme, Home, Events, search, follow, event pages
   for leagues + football + auctions (feeds the website already uses), match and player pages,
   Me with existing career records, My events, role entry points.
2. Scorer mode and captain mode restyled into the new shell.
3. Admin mode for match day.
4. In-app registration with the saved profile.

## Backend work this needs (not in the local build)

- **Events registry** with a public switch (one list for app + yoiden.com). Until it exists, the
  app bundles the same list as yoiden.com (`src/v2/data/events.ts`, copied from yoiden-next).
- **Roles by phone** (event, phone, role). Until then, admin access uses the existing check
  (league owner / co-admin via `GET /leagues?organizerId=me`) and opens the existing
  LeagueDashboard; scorer mode opens the existing scorer screens.
- **Follows** stored server-side. Until then, follows are kept on the device (AsyncStorage).
- **Phone-keyed records** + saved profile + generic registration builder.

## Builder's calls (mine)

- New screens live in `src/v2/` so the old app stays intact; `RootNavigator` swaps in the v2 shell
  for the normal build only. Guests can browse; login is asked for on Me / follow sync / register.
- Fonts: add `@expo-google-fonts/barlow-condensed` + `@expo-google-fonts/inter`.
- Event data comes from the same public feeds as yoiden.com: `/l/:slug/data`, `/fb/:slug/data`,
  `auction.yoiden.com/api/v1/auctions/portal/:token/data`, registration `options` endpoints.
- Indoor games and tournaments open their existing screens until v2 versions are built.
