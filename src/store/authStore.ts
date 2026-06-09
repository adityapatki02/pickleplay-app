import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOnboarded: boolean;

  setUser: (user: User) => void;
  setToken: (token: string) => void;
  setLoading: (loading: boolean) => void;
  setOnboarded: (onboarded: boolean) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

/**
 * Auth store backed by AsyncStorage so the user stays signed in across
 * page reloads (web) and app restarts (native). On web, AsyncStorage maps
 * to localStorage under the hood.
 *
 * Persistence is hand-rolled here (rather than using `zustand/middleware`)
 * because zustand v5's ESM `middleware.mjs` uses `import.meta.env`, which
 * Metro/Hermes can't parse and crashes the web bundle with "Cannot use
 * 'import.meta' outside a module".
 *
 * What's persisted: `user`, `token`, `isOnboarded`. Transient flags
 * (`isAuthenticated`, `isLoading`) are derived on rehydrate from the
 * presence of `token` so they always match the persisted state.
 *
 * If the persisted token is expired, the first authenticated API call
 * returns 401 and the response interceptor in `client.ts` calls logout()
 * — which clears storage via the subscription below. So a stale token
 * shows a brief "logged in" flicker before kicking the user back to login,
 * which is acceptable for now.
 */
const STORAGE_KEY = 'pickleplay-auth-v1';

interface PersistedShape {
  user: User | null;
  token: string | null;
  isOnboarded: boolean;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  // Start in loading state so the navigator can show a splash while the
  // persisted state hydrates. Flipped to false once rehydration finishes.
  isLoading: true,
  isOnboarded: false,

  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setLoading: (isLoading) => set({ isLoading }),
  setOnboarded: (isOnboarded) => set({ isOnboarded }),

  login: (user, token) =>
    set({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    }),

  logout: () =>
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isOnboarded: false,
    }),

  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),
}));

// --- Hydration: read persisted state once on module load, then mark ready.
(async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedShape>;
      useAuthStore.setState({
        user: parsed.user ?? null,
        token: parsed.token ?? null,
        isOnboarded: !!parsed.isOnboarded,
        isAuthenticated: !!parsed.token,
        isLoading: false,
      });
      return;
    }
  } catch {
    // Storage read failed (corrupt JSON, quota, etc.) — fall through to a
    // clean unauthenticated state so the app still loads.
  }
  useAuthStore.setState({ isLoading: false });
})();

// --- Persistence: write the durable subset whenever it changes. We compare
// the slice rather than the whole state so unrelated updates (e.g. isLoading
// toggles) don't trigger redundant writes.
let lastPersisted = '';
useAuthStore.subscribe((state) => {
  const slice: PersistedShape = {
    user: state.user,
    token: state.token,
    isOnboarded: state.isOnboarded,
  };
  const serialized = JSON.stringify(slice);
  if (serialized === lastPersisted) return;
  lastPersisted = serialized;
  // Fire-and-forget; AsyncStorage is async on native and sync-ish on web.
  AsyncStorage.setItem(STORAGE_KEY, serialized).catch(() => {
    // Ignore write failures — the in-memory state is still correct.
  });
});
