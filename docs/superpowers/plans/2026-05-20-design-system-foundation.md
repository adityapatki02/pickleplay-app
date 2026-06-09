# Design System Foundation (Plan 1A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the new Yoiden visual foundation — the Lovable-based design-token module, the Space Grotesk + DM Sans fonts, and a branded splash animation — so every later screen can be built against it.

**Architecture:** Additive, non-breaking. A new theme module (`src/theme/index.ts`) is created *alongside* the legacy `src/config/yoiden.ts`; nothing that imports the old tokens breaks. New fonts are appended to the existing `useFonts` map. The existing `auth/SplashScreen.tsx` is rebuilt visually only — its navigation role is unchanged (auth rework is Plan 1B).

**Tech Stack:** React Native (Expo SDK 55), TypeScript, expo-font, `@expo-google-fonts/*`, React Native `Animated`.

**Testing note:** This codebase has no jest/test harness, and Plan 1A's deliverables are a constants module and an animation — neither is unit-test-shaped. Per the writing-plans guidance to follow established patterns and not unilaterally restructure, verification here is: `npx tsc --noEmit` (type safety) + a manual run for visual QA. A test harness is out of scope for the design foundation.

**Worktree note:** This plan was not created in a dedicated worktree. Recommend creating a feature branch (`git checkout -b feat/design-foundation`) before starting.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/theme/index.ts` | **Create.** The new design system — `Colors`, `Fonts`, `Radius`, `Spacing`, `Shadow`. Single source of truth for all v1 styling. |
| `src/config/yoiden-fonts.ts` | **Modify.** Append Space Grotesk + DM Sans entries to `YoidenFontMap`. |
| `src/screens/auth/SplashScreen.tsx` | **Modify.** Rebuild visuals: branded logo + wordmark animation in the new theme. Navigation behaviour unchanged. |
| `package.json` | **Modify** (via `expo install`). Adds the two `@expo-google-fonts` packages. |

The legacy `src/config/yoiden.ts` is left untouched — later phases migrate screens off it.

---

## Task 1: Add Space Grotesk + DM Sans fonts

**Files:**
- Modify: `package.json` (via `expo install`)
- Modify: `src/config/yoiden-fonts.ts`

- [ ] **Step 1: Install the font packages**

Run:
```bash
npx expo install @expo-google-fonts/space-grotesk @expo-google-fonts/dm-sans
```
Expected: both packages added to `package.json` `dependencies` at Expo-compatible versions; no errors.

- [ ] **Step 2: Verify the packages resolved**

Run:
```bash
node -e "require('@expo-google-fonts/space-grotesk'); require('@expo-google-fonts/dm-sans'); console.log('ok')"
```
Expected: prints `ok`.

- [ ] **Step 3: Append the new fonts to the font map**

Edit `src/config/yoiden-fonts.ts`. Add these imports after the existing JetBrains Mono import block:

```ts
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
```

Then add these keys inside the `YoidenFontMap` object, after the JetBrains Mono entries (keep the existing entries — this is additive):

```ts
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
```

- [ ] **Step 4: Type-check**

Run:
```bash
npx tsc --noEmit -p tsconfig.json
```
Expected: PASS (no errors). `App.tsx` already passes `YoidenFontMap` to `useFonts` — the new fonts now load with the rest.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/config/yoiden-fonts.ts
git commit -m "feat(theme): add Space Grotesk and DM Sans fonts"
```

---

## Task 2: Create the new theme module

**Files:**
- Create: `src/theme/index.ts`

- [ ] **Step 1: Create the theme module**

Create `src/theme/index.ts` with this exact content:

```ts
// Yoiden v1 design system.
// Adopted from the approved Lovable design (codename "DinkMaster").
// This is the single source of truth for v1 styling. The legacy
// src/config/yoiden.ts is retired screen-by-screen in later phases.

export const Colors = {
  background: '#FAFAFB', // app background (off-white)
  surface:    '#FFFFFF', // card surface
  ink:        '#1B1E2E', // primary text
  navy:       '#2A2E4D', // dark hero cards
  blue:       '#5471F0', // accent / links
  lime:       '#C7F03A', // pop accent, winning score, FAB
  amber:      '#E8B43F', // secondary accent
  muted:      '#6C7186', // secondary text
  border:     '#E6E8EE', // hairline borders / rings
  danger:     '#DC4838', // live / danger
  white:      '#FFFFFF',
} as const;

export const Fonts = {
  display:      'SpaceGrotesk_600SemiBold', // headings
  displayBold:  'SpaceGrotesk_700Bold',     // emphatic headings
  displayMedium:'SpaceGrotesk_500Medium',
  body:         'DMSans_400Regular',
  bodyMedium:   'DMSans_500Medium',
  bodySemibold: 'DMSans_600SemiBold',
  bodyBold:     'DMSans_700Bold',
  mono:         'JetBrainsMono_500Medium',  // scores / numbers
  monoBold:     'JetBrainsMono_700Bold',
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,   // rounded-2xl cards
  xl: 20,
  pill: 999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const Shadow = {
  // Subtle card lift used across surfaces.
  card: {
    shadowColor: '#1B1E2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  // Stronger lift for the floating bottom nav / FAB.
  raised: {
    shadowColor: '#1B1E2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;
```

- [ ] **Step 2: Type-check**

Run:
```bash
npx tsc --noEmit -p tsconfig.json
```
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/theme/index.ts
git commit -m "feat(theme): add v1 design token module"
```

---

## Task 3: Rebuild the Splash screen with the branded animation

**Files:**
- Modify: `src/screens/auth/SplashScreen.tsx`

The screen keeps its current role — first screen in the auth stack, runs a brief delay, then `navigation.replace('PhoneInput')`. Only the visuals change: an off-white branded splash with a logo + wordmark draw-in animation, built on the new theme.

- [ ] **Step 1: Replace the SplashScreen contents**

Overwrite `src/screens/auth/SplashScreen.tsx` with this exact content:

```tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { Colors, Fonts } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const { setLoading } = useAuthStore();

  // Animation drivers
  const glyphOpacity = useRef(new Animated.Value(0)).current;
  const glyphScale = useRef(new Animated.Value(0.85)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordShift = useRef(new Animated.Value(14)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Glyph fades + scales in
      Animated.parallel([
        Animated.timing(glyphOpacity, {
          toValue: 1, duration: 500, useNativeDriver: true,
        }),
        Animated.spring(glyphScale, {
          toValue: 1, friction: 7, tension: 60, useNativeDriver: true,
        }),
      ]),
      // 2. Wordmark fades up
      Animated.parallel([
        Animated.timing(wordOpacity, {
          toValue: 1, duration: 450, useNativeDriver: true,
        }),
        Animated.timing(wordShift, {
          toValue: 0, duration: 450, useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 3. Lime accent line draws (width is not native-driver compatible)
    Animated.timing(lineWidth, {
      toValue: 1, duration: 600, delay: 650, useNativeDriver: false,
    }).start();

    // Hold on the brand, then move on. Auth-state restore + routing is
    // handled in Plan 1B; for now this preserves the existing behaviour.
    const timer = setTimeout(() => {
      setLoading(false);
      navigation.replace('PhoneInput');
    }, 2100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Animated.Image
          source={require('../../../assets/Logo.png')}
          style={[
            styles.glyph,
            { opacity: glyphOpacity, transform: [{ scale: glyphScale }] },
          ]}
          resizeMode="contain"
        />
        <Animated.Image
          source={require('../../../assets/name_logo.png')}
          style={[
            styles.wordmark,
            { opacity: wordOpacity, transform: [{ translateY: wordShift }] },
          ]}
          resizeMode="contain"
        />
        <Animated.View
          style={[
            styles.accentLine,
            {
              width: lineWidth.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 48],
              }),
            },
          ]}
        />
      </View>
      <Text style={styles.tagline}>RACKET SPORTS, ORGANIZED</Text>
    </View>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
  },
  glyph: {
    width: 96,
    height: 96,
  },
  wordmark: {
    width: 200,
    height: 56,
    marginTop: 12,
  },
  accentLine: {
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.lime,
    marginTop: 20,
  },
  tagline: {
    position: 'absolute',
    bottom: 56,
    fontFamily: Fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.muted,
  },
});
```

- [ ] **Step 2: Type-check**

Run:
```bash
npx tsc --noEmit -p tsconfig.json
```
Expected: PASS. (`AuthStackParamList`, `useAuthStore`, and the `Splash`/`PhoneInput` routes already exist and are unchanged.)

- [ ] **Step 3: Run the app and visually verify**

Run:
```bash
npx expo start
```
Open the app (web, `w`, is fastest). Expected: an off-white splash — the Yoiden glyph scales/fades in, the wordmark fades up beneath it, a short lime line draws in, "RACKET SPORTS, ORGANIZED" sits near the bottom — then after ~2s it advances to the phone-input screen. No red error overlay, no missing-font fallback.

- [ ] **Step 4: Commit**

```bash
git add src/screens/auth/SplashScreen.tsx
git commit -m "feat(theme): branded splash animation on the new design system"
```

---

## Self-Review

**1. Spec coverage (Plan 1A scope = the design-foundation slice of spec Section 10, Phase 1):**
- New theme module + fonts → Tasks 1 & 2. ✓
- Splash animation → Task 3. ✓
- OTP auth, onboarding, profile data model → deliberately **not** in 1A; they are Plans 1B and 1C. ✓

**2. Placeholder scan:** No "TBD"/"TODO"/vague steps. Every code step contains complete code; every command has expected output. ✓

**3. Type consistency:** The font keys in `Fonts` (`SpaceGrotesk_600SemiBold`, `SpaceGrotesk_700Bold`, `SpaceGrotesk_500Medium`, `DMSans_400Regular`, `DMSans_500Medium`, `DMSans_600SemiBold`, `DMSans_700Bold`, `JetBrainsMono_500Medium`, `JetBrainsMono_700Bold`) all correspond to entries registered in `YoidenFontMap` — the Space Grotesk and DM Sans keys are added in Task 1 Step 3; the JetBrains Mono keys already exist in the legacy map. ✓ `Colors`, `Fonts` used by `SplashScreen.tsx` are exported by `src/theme/index.ts` from Task 2. ✓

No issues found.
