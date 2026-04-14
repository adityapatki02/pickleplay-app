# Yoiden - Pickleball Tournament App (Frontend)

A React Native (Expo) mobile app for organizing and managing pickleball tournaments. Built for organizers to run full tournaments end-to-end — from player registration, seeding, draw generation, court scheduling, live scoring, to final results.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.83 + Expo SDK 55 |
| Navigation | React Navigation 7 (native-stack + bottom-tabs) |
| State | Zustand |
| HTTP Client | Axios |
| Build | EAS Build (Expo Application Services) |
| Web Export | html2canvas (JPG download for brackets/schedules) |

## Project Structure

```
src/
├── api/                    # API client & endpoint modules
│   ├── client.ts           # Axios instance with auth interceptor
│   ├── auth.api.ts         # Login, register, OTP, delete account
│   ├── tournaments.api.ts  # CRUD, categories, courts
│   ├── matches.api.ts      # Draw generation, scoring, start match
│   ├── registrations.api.ts# Player registration, CSV import
│   ├── ratings.api.ts      # ELO ratings, leaderboard
│   └── payments.api.ts     # Razorpay integration
│
├── config/
│   └── constants.ts        # API_BASE_URL, ELO config, defaults
│
├── store/                  # Zustand state stores
│   ├── authStore.ts        # Auth token, user, login/logout
│   ├── tournamentStore.ts  # Tournament list, selected tournament
│   ├── registrationStore.ts# Registration state
│   └── uiStore.ts          # UI state (modals, loading)
│
├── navigation/             # React Navigation setup
│   ├── RootNavigator.tsx   # Auth vs App routing
│   ├── AppTabNavigator.tsx # Main tab navigator
│   ├── OrganizerTabNavigator.tsx
│   ├── PlayerTabNavigator.tsx
│   ├── FloatingTabBar.tsx  # Custom bottom tab bar
│   └── TabIcons.tsx
│
├── screens/
│   ├── auth/               # Login, Register, OTP screens
│   ├── organizer/          # ** Core organizer screens **
│   │   ├── OrganizerHomeScreen.tsx        # Dashboard with FAB, hero tiles
│   │   ├── CreateTournamentScreen.tsx     # Tournament + category creation
│   │   ├── RegistrationManagementScreen.tsx # Player list, CSV import
│   │   ├── MatchHubScreen.tsx             # ** MAIN SCREEN ** (4500+ lines)
│   │   │   └── 3 tabs: TEAMS / DRAWS / SCHEDULE
│   │   │       - Seeding with drag-to-reorder + auto-save
│   │   │       - Pool draw generation (snake seeding)
│   │   │       - Pool standings with seed tags
│   │   │       - Match scheduling with court assignment
│   │   │       - InlineScore component (winner select + score entry)
│   │   │       - Start Match / LIVE badge / Edit Score
│   │   │       - Court TBD system (2 upcoming per court)
│   │   │       - JPG download for brackets/schedules
│   │   └── TournamentDashboardScreen.tsx
│   ├── player/             # Player-facing screens
│   ├── HomeScreen.tsx      # Player home / discover
│   ├── ProfileScreen.tsx   # Profile + delete account
│   ├── StatsScreen.tsx     # Player stats & ratings
│   └── TournamentDetailScreen.tsx
│
├── components/
│   ├── ui/                 # Reusable UI components
│   │   ├── Button.tsx, Card.tsx, Input.tsx, Badge.tsx
│   │   ├── Avatar.tsx, EmptyState.tsx, FilterChips.tsx
│   │   ├── DatePickerModal.tsx, PlacesAutocomplete.tsx
│   │   ├── DownloadJpgButton.tsx  # html2canvas export
│   │   └── TournamentTile.tsx, TournamentCarousel.tsx
│   ├── tournament/         # Tournament-specific components
│   │   ├── BracketTree.tsx, PoolTable.tsx
│   │   ├── MatchCard.tsx, CategoryCard.tsx
│   │   └── TournamentCard.tsx
│   └── common/
│
├── utils/
│   ├── organizerDashboard.ts  # IST date helpers, dashboard data
│   ├── downloadAsJpg.ts       # html2canvas wrapper
│   └── alert.ts
│
└── types/                  # TypeScript types
    └── tournament.types.ts
```

## Key Features

### Organizer Flow
1. **Create Tournament** — name, venue (Google Places), dates, entry fee
2. **Add Categories** — format (Pool+Knockout / Knockout Only), match format (Best of 1/3/5), group size, courts
3. **Manage Registrations** — add players manually, CSV import, WhatsApp notifications
4. **Seeding** — drag-to-reorder, auto-seed by rating, auto-seed random, auto-saves on every change
5. **Draw Generation** — snake seeding into pools, locked after tournament starts
6. **Scheduling** — auto-schedule with rest buffers, court locking (first 2 per court locked), Court TBD for remaining
7. **Live Scoring** — select winner > enter scores (dynamic for best_of_1/3/5) > save
8. **Start Match / Edit Score** — mark matches as in_progress (LIVE badge), edit completed match scores

### Player Flow
1. **Discover** — browse upcoming tournaments
2. **Register** — solo or doubles (with partner phone lookup)
3. **Check-in** — phone-based check-in page (IST date filtered)
4. **View Results** — brackets, pool standings, match history

## Design System

| Token | Value |
|---|---|
| Navy (Primary) | `#001E40` |
| Blue (Accent) | `#2196F3` |
| Green (Success) | `#06D6A0` |
| Surface | `#F5F7FA` |
| Text Primary | `#0A1929` |
| Text Muted | `#64748B` |

## Setup & Running

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)
- Expo account (logged in via `eas login`)

### Install & Run
```bash
npm install
npx expo start
```
- Press `w` for web, `a` for Android emulator, scan QR for Expo Go

### API Configuration
The API base URL is configured in `src/config/constants.ts`:
```
Production: https://yoiden-api-460478077750.asia-south1.run.app/api/v1
```

### Build APK (Android)
```bash
# Preview APK (for testing / sideloading)
npx eas build --platform android --profile preview

# Production AAB (for Play Store)
npx eas build --platform android --profile production
```

### Build iOS
```bash
# Requires Apple Developer account
npx eas build --platform ios --profile production
```

### EAS Project
- **Project ID:** `3cf2fc6b-b1df-4c61-b1b1-a1520267de2e`
- **Slug:** `yoiden`
- **Bundle ID (iOS):** `com.yoiden.app`
- **Package (Android):** `com.yoiden.app`

## Environment

| Variable | Description |
|---|---|
| `API_BASE_URL` | Backend API endpoint (hardcoded in constants.ts) |
| `GOOGLE_PLACES_API_KEY` | Google Places autocomplete for venue search |

## Current Status

### Working
- Full organizer flow (create > register > seed > draw > schedule > score)
- Player registration with partner (doubles)
- WhatsApp notifications (registration confirmation to both partners)
- CSV player import
- Check-in page with IST date filtering
- Dynamic scoring (best of 1/3/5)
- Court TBD system with court locking
- Auto-save seeds
- Start match / LIVE badge / Edit Score
- Tournament format picker (Pool+Knockout vs Knockout Only)
- JPG download (brackets, schedules)
- Delete account with full cascade

### Pending
- Play Store listing (Google Play Console identity verification pending)
- Apple TestFlight (Apple Developer account needed)
- Push notifications (Firebase Cloud Messaging — wired but not tested)
- Payment flow (Razorpay — module exists, not activated)
- Player discovery / public tournament listing
