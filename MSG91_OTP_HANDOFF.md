# MSG91 Native OTP (Forgot PIN) — Handoff

Status as of 2026-06-22. Continue on the other PC from "Next step" below.

## The problem
Forgot-PIN SMS worked on the **web portal** but **not in the native APK**.

## Root cause
- `ForgotPinScreen` used MSG91's **browser widget** (`openMsg91Widget`, in `src/config/msg91.ts`), which is **web-only** (needs a DOM). On native it rejects → no SMS.
- The backend's other path (`/api/v5/otp` with a `template_id`) needs a **DLT-approved template** we don't have, so it returns `type:success` but never delivers.

## What MSG91 actually wants (their docs)
Client (device) does **send + verify** → returns an **access token** → backend only **verifies the token**. Same shape as the working web flow.

## What we set up in the MSG91 dashboard (account `crescendo3`)
Created a **dedicated MOBILE widget** (web widget left untouched):
- **Mobile widgetId:** `366676663557333236373131`
- **Mobile token (`yoidenmobile`):** `490820TZa5ZJv76a38e307P1`
- Widget Integration = **Mobile**, Captcha = **OFF**, OTP length = **6**, SMS channel = default config
- Token **throttle raised to 1000 hits / 300s**, block duration 300s (default was 3/300s → 24h block, which kept blocking our test IP)
- Web widget (unchanged): `36647a666e76303436353733`, token `yoiden` = `490820TQQzDyoB1w5f69edad97P1`

Backend is already correct: `MSG91_AUTH_KEY` + `MSG91_WIDGET_ID` are set on Cloud Run **`yoiden-api`** (project `yoiden`, URL `https://yoiden-api-lonnxhto7a-el.a.run.app`), so `verifyAccessToken` / `POST /api/v1/auth/forgot-pin/reset` is live. **No backend changes needed.**

## What we built (app-side only, no native module)
The MSG91 React Native SDK's OTP methods are just `fetch` calls, so we replicate them on-device:

- **`src/config/msg91mobile.ts`** (new) — `sendMobileOtp(phone)` → `POST /api/v5/widget/sendOtpMobile` → returns `reqId`; `verifyMobileOtp(reqId, otp)` → `POST /api/v5/widget/verifyOtp` → returns **access token**; `retryMobileOtp(reqId)` → `POST /api/v5/widget/retryOtp` (SMS channel 11).
- **`src/screens/auth/ForgotPinScreen.tsx`** (modified) — branches on `Platform.OS`:
  - **Web:** unchanged browser-widget flow.
  - **Native:** phone → send OTP → enter OTP → verify → access token → `authApi.resetPin({ accessToken, newPin })` → `/auth/forgot-pin/reset` → login.

Typechecks clean. (Other modified files in the repo are unrelated league-UI work — not part of this change.)

## Build
```bash
cd pickleplay-app
npx eas-cli build --profile preview --platform android
```

## Next step
**Test on a real device.** A server-side call to `/sendOtpMobile` returns `type:success` but no SMS — MSG91 expects the call from the **device** (client context), so it MUST be validated via a real APK on a phone.

- If OTP **arrives on device** → done.
- If it **still doesn't deliver on-device** (default template delivers via the web widget but not the mobile widget): the architecture is now correct, so escalate to **MSG91 support** ("default OTP template delivers via our web widget `36647a...` but not the mobile widget `366676...`") or switch to their native SDK `@msg91comm/sendotp-react-native` (adds a native module + `expo prebuild` + EAS rebuild).

## Key facts to remember
- Real backend = **`yoiden-api`** (project `yoiden`), NOT `sbpl-backend` (that's a different/old project). App API base is hardcoded in `src/config/constants.ts`.
- This is **Expo managed** (no `ios`/`android` dirs); native modules require an EAS build, not Expo Go.
