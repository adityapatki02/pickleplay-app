/**
 * MSG91 OTP — native (device) flow.
 *
 * MSG91's documented model: the OTP send + verify runs on the CLIENT (here,
 * the device), and the backend only verifies the resulting access token.
 * This is the same shape as the web widget — the difference is web uses
 * MSG91's browser widget while native calls MSG91's mobile widget endpoints
 * directly. These are the exact HTTP calls the official
 * `@msg91comm/sendotp-react-native` SDK makes internally (sendOtpMobile /
 * verifyOtp / retryOtp), so we don't need the native module — just fetch,
 * running on-device where MSG91 expects it.
 *
 * Dedicated MOBILE widget (separate from the web widget so its throttle /
 * captcha config is independent). Configured in the MSG91 dashboard:
 *   - Widget Integration: Mobile
 *   - Captcha: off (server/device call can't solve an H-Captcha)
 *   - OTP length: 6
 * These values are public frontend config (same as the web widget's), exactly
 * like src/config/msg91.ts.
 *
 * On success, verifyOtp returns an access token which we post to
 * POST /auth/forgot-pin/reset — the backend verifies it via MSG91's
 * verifyAccessToken (already live, MSG91_AUTH_KEY set on yoiden-api) and
 * rotates the PIN. No backend changes needed.
 */

export const MSG91_MOBILE_WIDGET_ID = '366676663557333236373131';
export const MSG91_MOBILE_TOKEN_AUTH = '490820TZa5ZJv76a38e307P1';

const BASE = 'https://control.msg91.com/api/v5/widget';

/** Retry channel codes per MSG91 docs: SMS=11, VOICE=4, EMAIL=3, WHATSAPP=12. */
export const MSG91_RETRY_SMS = 11;

interface Msg91Response {
  type?: string;
  message?: string;
  code?: string;
  hasError?: boolean;
}

async function post(path: string, body: Record<string, unknown>): Promise<Msg91Response> {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json().catch(() => ({}))) as Msg91Response;
}

/**
 * Send an OTP to a phone number. `phone` is the 10-digit national number;
 * MSG91 wants the identifier with country code and no '+'.
 * Returns the `reqId` needed to verify/retry.
 */
export async function sendMobileOtp(phone: string): Promise<string> {
  const identifier = `91${phone}`;
  const body = await post('sendOtpMobile', {
    widgetId: MSG91_MOBILE_WIDGET_ID,
    tokenAuth: MSG91_MOBILE_TOKEN_AUTH,
    identifier,
  });
  if (body?.type === 'success' && typeof body.message === 'string') {
    return body.message; // reqId
  }
  throw new Error(body?.message || 'Could not send the OTP. Please try again.');
}

/**
 * Verify the OTP the user entered. Returns the MSG91 access token, which the
 * backend then verifies via /auth/forgot-pin/reset.
 */
export async function verifyMobileOtp(reqId: string, otp: string): Promise<string> {
  const body = await post('verifyOtp', {
    widgetId: MSG91_MOBILE_WIDGET_ID,
    tokenAuth: MSG91_MOBILE_TOKEN_AUTH,
    reqId,
    otp,
  });
  const token =
    body?.type === 'success' ? body.message : undefined;
  if (typeof token === 'string' && token.length > 0) {
    return token; // access token
  }
  throw new Error(body?.message || 'Invalid OTP. Please try again.');
}

/** Resend the OTP over SMS for an existing request. */
export async function retryMobileOtp(reqId: string): Promise<void> {
  await post('retryOtp', {
    widgetId: MSG91_MOBILE_WIDGET_ID,
    tokenAuth: MSG91_MOBILE_TOKEN_AUTH,
    reqId,
    retryChannel: MSG91_RETRY_SMS,
  });
}
