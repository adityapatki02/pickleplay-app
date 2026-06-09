# Yoiden — Publishable App Relaunch (v1) — Design

**Date:** 2026-05-15
**Status:** Draft for review
**Scope:** Full restructure of the Yoiden React Native (Expo) app for App Store / Play Store launch, adopting a new visual system based on the "DinkMaster" design built in Lovable.

---

## 1. Overview

The Yoiden mobile app is being rebuilt around a new navigation structure and a new visual
design system, so it can be published to the iOS App Store and Google Play as a polished,
credible product. The app serves **both players and self-serve organizers** in one binary.

The visual design comes from a Lovable project the team built and approved
(`github.com/adityapatki02/pickleball-rally-ready` — internal codename "DinkMaster"). That
project is a **design and layout reference only** — it is React web (Vite + Tailwind +
shadcn/ui) and cannot be ported as-is into React Native. Its visual system, screen layouts,
and component structure are adopted; its code is not.

This document is the north-star design. Implementation is **phased** (Section 10); Phase 1
is planned and built first.

## 2. Goals & Non-Goals

**Goals**
- A publishable, store-ready consumer + organizer app on iOS and Android.
- Adopt the Lovable visual system as Yoiden's design language.
- A 5-tab navigation that covers discovery, live following, organizing, and profile.
- OTP-based authentication with a persistent session.
- A rich onboarding that captures a usable player profile.

**Non-Goals (this spec)**
- DUPR API integration (separate later milestone).
- GPR display (separate later milestone).
- In-app payments / paid registration (roadmap, post-launch).
- Dark mode (tokens exist in the reference; not built for v1).
- Standalone Fantasy product (Fantasy stays inside league mode).

## 3. Key Decisions

| # | Decision |
|---|----------|
| 1 | The published app serves **players + self-serve organizers** in one app. |
| 2 | "Organize" is a **full hub**: self-serve tournament creation + a concierge "we'll build your league" contact path. |
| 3 | Discovery matters **both** ways — via shared registration links *and* in-app browsing. Registration links must deep-link into the app. |
| 4 | Bottom nav has **5 tabs**: Home · Discover · Organize (center FAB) · Live Matches · Profile. |
| 5 | The existing league mode is **reworked into the new nav** (not parked, not a separate tab). |
| 6 | Auth is **OTP once**, then a persistent session. The phone+PIN system is retired. |
| 7 | Signup captures a **fuller profile up front**: Name, Phone, City, Gender, Date of birth, Photo, Skill level, Sport preference. |
| 8 | Build is **phased**; launch happens only when **all four phases are done**, including the league rework. |
| 9 | The app **adopts the Lovable visual system**; the prior cream/Anton editorial system is retired. |

## 4. Visual Design System

Replaces the current `src/config/yoiden.ts` (`YColors`/`YFonts`) with a new theme module.

**Palette** (source of truth: Lovable `src/styles.css`; oklch values, hex approximations for
implementation — exact values should be sampled from the reference build):

| Token | oklch | ~hex | Use |
|-------|-------|------|-----|
| `background` | `0.985 0.003 247` | `#FAFAFB` | App background (off-white) |
| `surface` | `1 0 0` | `#FFFFFF` | Card surface |
| `ink` / `foreground` | `0.18 0.06 265` | `#1B1E2E` | Primary text |
| `court-navy` | `0.25 0.09 265` | `#2A2E4D` | Dark hero cards |
| `court-blue` | `0.65 0.18 255` | `#5471F0` | Accent / links |
| `court-green` (lime) | `0.92 0.18 130` | `#C7F03A` | Pop accent, winning score, FAB |
| `court-amber` | `0.84 0.16 85` | `#E8B43F` | Secondary accent |
| `muted-foreground` | `0.5 0.04 257` | `#6C7186` | Secondary text |
| `border` | `0.92 0.012 255` | `#E6E8EE` | Hairline borders / rings |
| `destructive` | `0.62 0.22 27` | `#DC4838` | Live / danger |

**Typography**
- Display / headings: **Space Grotesk** (`@expo-google-fonts/space-grotesk`)
- Body: **DM Sans** (`@expo-google-fonts/dm-sans`)
- Numbers / scores: **JetBrains Mono** (already installed)

**Components & motion**
- Cards: white surface, `borderRadius` 16 (rounded-2xl), 1px hairline border/ring.
- Bento grids (mixed-size tile layouts).
- Navy live-match hero card; winning score in lime.
- Floating pill bottom nav with a **raised lime ＋ FAB** in the center.
- Entrance animation: subtle rise+fade on sections.

## 5. Information Architecture

```
Splash (animation)
  → Auth (OTP)
      → [new user] Onboarding (7 steps)
      → [returning] Main App
Main App — bottom tab navigator (5 tabs):
  Home · Discover · [Organize ＋] · Live Matches · Profile
  + deep stacks per tab for detail/management screens
  + registration links deep-link to a tournament/league detail screen
```

The center FAB **is** the Organize tab — the prominent ＋ doubles as "create."

## 6. Screens

### 6.1 Splash
Short (~1.5–2s) animation: Yoiden logo + wordmark draw in, then transition. Routes to Auth
if no valid session, else straight to Home. Replaces the placeholder "DinkMaster"/"PB"
branding from the reference.

### 6.2 Auth (OTP)
Single phone-entry screen → 6-digit OTP. OTP delivery via **MSG91** (the existing
`openMsg91Widget` integration). On success: new user → Onboarding; existing user → Home.
Session token persisted (existing `authStore` + AsyncStorage). No re-OTP except on logout
or long inactivity. The phone+PIN screens (`PhoneInputScreen` PIN logic, `ForgotPinScreen`)
are retired.

### 6.3 Onboarding (new users, after OTP)
Seven steps in the new visual style:
1. Name
2. City — Google Places autocomplete (existing `GOOGLE_PLACES_API_KEY` + backend
   `/places` proxy)
3. Gender
4. Date of birth
5. Photo / selfie — `expo-image-picker`, uploaded to backend storage
6. Skill level
7. Sport preference (pickleball / badminton)

All required. Completion → Home.

### 6.4 Home
- App header: logo + **location bar** (auto-detected city via GPS, with a "change location"
  control) + notification bell.
- Live-match hero (navy card, lime winning score).
- Bento grid: "Find a Tournament", player status, quick tiles.
- "Your next match" section — shown when the user is registered/scheduled.
- Upcoming tournaments list.
- Content is curated by the user's current/selected location.

### 6.5 Discover
Search field + horizontal filter chips + a scrollable list of cards. Cards cover **both
tournaments and leagues**. Location-curated. Reuses logic from the current discovery screen,
re-skinned.

### 6.6 Organize (center FAB)
A hub with two parts:
- **Top — "Create a tournament"**: launches the self-serve creation flow (reuses the
  existing create / schedule / score / registration-management screens, re-skinned).
- **Bottom — "We'll build your league"**: concierge path — a short pitch + a contact form
  for fully custom franchise leagues.
- Also surfaces "your tournaments" (events the user has created).

### 6.7 Live Matches
- Top: matches live now (cards with mono scores).
- Bottom: recently finished.
- Covers both tournament matches and league ties.

### 6.8 Profile
- Avatar + name + key identity line.
- **Ratings panel**: Yoiden internal rating now; DUPR / GPR slots reserved for a later
  milestone.
- Stats (tournaments, win rate, medals).
- Match history, "your tournaments", settings, sign out.

### 6.9 League detail (Phase 4)
Leagues surface inside Discover (a card type), Live Matches (their ties), and Home (a
followed league). Tapping a league opens its detail screens — standings, fixtures, captain
portal, fantasy — which are the existing league screens **re-skinned to the new design
system**.

## 7. Technical Architecture

- **Navigation**: React Navigation — a 5-tab bottom navigator with a custom tab bar (raised
  center FAB) + native stack per tab. Keep the existing shared deep-route registration
  pattern (`registerDetailAndManageScreens`).
- **Theme module**: new design-token file (colors, fonts, radius, spacing) replacing
  `config/yoiden.ts`. All screens consume it.
- **Fonts**: add `@expo-google-fonts/space-grotesk` and `@expo-google-fonts/dm-sans`;
  JetBrains Mono already present.
- **Auth**: MSG91 OTP; `authStore` + AsyncStorage for the persistent session. Remove PIN.
- **Location**: `expo-location` for GPS; Google Places for city. Home/Discover curate by
  current location; a manual "change location" override is stored and takes precedence.
- **Photo**: `expo-image-picker`; backend upload endpoint + storage.
- **Backend**: tournament/league APIs largely unchanged. New work: profile fields + photo
  upload (Section 8).

## 8. Data Model Changes

The user/profile entity gains:
- `gender`
- `dateOfBirth`
- `photoUrl`
- `skillLevel`
- `sportPreference` (pickleball / badminton)
- `city` / location (if not already stored)

New/updated backend endpoints: set profile fields during onboarding; photo upload.

## 9. Reuse Map (existing → new)

| New surface | Reuses |
|-------------|--------|
| Discover | current `PlayScreen` / `DiscoverScreen` logic, re-skinned |
| Organize → create flow | existing `CreateTournament`, `Schedule`, `ScoreEntry`, `RegistrationManagement` screens, re-skinned |
| League detail | existing `screens/league/*`, re-skinned |
| Auth | existing `authStore`, MSG91 integration; PIN logic removed |
| Backend | tournament/league APIs unchanged |

Net-new: splash animation, OTP-only auth, 7-step onboarding, 5-tab nav shell + center FAB,
new Home, Live Matches tab, Organize hub shell, location services, new theme module.

## 10. Phased Build Plan

Launch occurs only after **all four phases** are complete (Decision 8).

- **Phase 1 — Foundation**: new theme module + fonts, splash animation, OTP auth (PIN
  removed), 7-step onboarding, profile data model + photo upload.
- **Phase 2 — Core shell**: 5-tab navigator + center FAB, Home screen, Discover screen
  (re-skin).
- **Phase 3 — Live + Organize**: Live Matches tab; Organize hub (re-skinned self-serve
  create/schedule/score flow + concierge contact).
- **Phase 4 — League rework**: league mode reworked into the new nav and new design system.

Each phase leaves the app runnable.

## 11. Pre-Publish Punch List

Folded in before store submission:
- Verify the scheduling flow end-to-end on real devices.
- Lock down / proxy the Google Places API key.
- Make the scorer a real, working tool (self-serve organizing requires real scoring).
- Privacy policy URL + Apple privacy labels.
- A working reviewer demo account.
- QA pass on iOS and Android (small screens, poor network).
- Strip remaining demo/placeholder data paths.

## 12. Out of Scope

DUPR integration, GPR display, in-app payments, dark mode, standalone Fantasy. See
Section 2.

## 13. Risks & Open Questions

- **Scope**: a full rebuild is realistically 4–8 weeks; the launch date follows the build,
  not the reverse.
- **Schedule tab**: the Lovable reference had a Schedule tab; here "your matches" lives as a
  Home section + Profile history. Confirm this is acceptable in practice.
- **oklch → RN colors**: exact color values should be sampled from the Lovable build during
  Phase 1 rather than trusting the hex approximations above.
- **Scorer**: must be made real before launch — currently a demo mock.
