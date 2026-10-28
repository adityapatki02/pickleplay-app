import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../../api/client';
import { useAuthStore } from '../../store/authStore';

/**
 * Events the player follows. Followed events sit at the top of Home, and their results
 * come as pushes.
 *
 * Signed out, follows live on the device. On sign-in the device's follows are merged into
 * the account (`POST /app/me/follows`), which is keyed by phone, so they follow the
 * player to a new phone. After that every toggle goes to the server too. The device copy
 * stays as the offline cache.
 *
 * Persistence is hand-rolled like authStore: zustand v5's `middleware.mjs`
 * uses `import.meta.env`, which breaks the web bundle.
 */
const KEY = 'yoiden-follows';

type FollowState = {
  ids: string[];
  toggle: (id: string) => void;
};

const save = (ids: string[]) => AsyncStorage.setItem(KEY, JSON.stringify(ids)).catch(() => {});
const signedIn = () => !!useAuthStore.getState().token;

export const useFollows = create<FollowState>()((set, get) => ({
  ids: [],
  toggle: (id) => {
    const on = !get().ids.includes(id);
    const ids = on ? [id, ...get().ids] : get().ids.filter((x) => x !== id);
    set({ ids });
    save(ids);
    if (signedIn()) {
      (on ? apiClient.put(`/app/me/follows/${encodeURIComponent(id)}`) : apiClient.delete(`/app/me/follows/${encodeURIComponent(id)}`)).catch(() => {});
    }
  },
}));

/** Merges the device's follows into the account and takes the account's list. */
export async function syncFollows() {
  if (!signedIn()) return;
  try {
    const res = await apiClient.post('/app/me/follows', { eventIds: useFollows.getState().ids });
    const ids = res.data?.data;
    if (Array.isArray(ids)) {
      useFollows.setState({ ids });
      save(ids);
    }
  } catch {
    // Older server or offline: keep the device's list.
  }
}

// Load saved follows once at start-up, then sync if signed in; sync again on every sign-in.
AsyncStorage.getItem(KEY)
  .then((raw) => {
    const ids = raw ? JSON.parse(raw) : [];
    if (Array.isArray(ids)) useFollows.setState({ ids });
  })
  .catch(() => {})
  .finally(() => {
    syncFollows();
    useAuthStore.subscribe((s, prev) => {
      if (s.token && s.token !== prev.token) syncFollows();
    });
  });
