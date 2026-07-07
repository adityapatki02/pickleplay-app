// Override with EXPO_PUBLIC_API_URL for local dev (e.g. http://localhost:3000/api/v1).
// Prod builds leave it unset and use the deployed API.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://yoiden-api-lonnxhto7a-el.a.run.app/api/v1';

/** Razorpay publishable key — safe to expose in the app bundle.
 *  Use rzp_test_... for development, rzp_live_... for production. */
export const RAZORPAY_KEY = 'rzp_live_T1smxtRwzaVgcA';

export const DEFAULT_RATING = 1200;
export const DEFAULT_GROUP_SIZE = 4;
export const DEFAULT_MATCH_DURATION_MIN = 30;
export const DEFAULT_REST_BUFFER_MIN = 15;
export const DEFAULT_CHANGEOVER_BUFFER_MIN = 5;
export const DEFAULT_GEOFENCE_RADIUS_M = 200;
export const CHECK_IN_WINDOW_MIN = 30;

export const SKILL_LEVEL_RATINGS = {
  beginner: 900,
  intermediate: 1200,
  advanced: 1500,
  pro: 1800,
} as const;

export const ELO = {
  K_NEW_PLAYER: 48,
  K_BASE: 32,
  K_ESTABLISHED: 24,
  NEW_PLAYER_THRESHOLD: 20,
  ESTABLISHED_THRESHOLD: 50,
  MARGIN_WEIGHT: 0.1,
  FLOOR: 100,
  DECAY_FLOOR: 800,
  DECAY_INACTIVE_DAYS: 90,
  DECAY_PER_MONTH: 10,
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;
