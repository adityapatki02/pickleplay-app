import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Events the player follows. Followed events sit at the top of Home.
 *
 * Kept on the device for now; a server-side follows table (tied to the phone
 * number) replaces this so follows move with the account. The store's shape
 * stays the same when that lands: ids of events, newest first.
 *
 * Persistence is hand-rolled like authStore: zustand v5's `middleware.mjs`
 * uses `import.meta.env`, which breaks the web bundle.
 */
const KEY = 'yoiden-follows';

type FollowState = {
  ids: string[];
  toggle: (id: string) => void;
};

export const useFollows = create<FollowState>()((set) => ({
  ids: [],
  toggle: (id) =>
    set((s) => {
      const ids = s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [id, ...s.ids];
      AsyncStorage.setItem(KEY, JSON.stringify(ids)).catch(() => {});
      return { ids };
    }),
}));

// Load saved follows once at start-up.
AsyncStorage.getItem(KEY)
  .then((raw) => {
    const ids = raw ? JSON.parse(raw) : [];
    if (Array.isArray(ids)) useFollows.setState({ ids });
  })
  .catch(() => {});
