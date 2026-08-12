import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tiny wrapper for persisting an in-progress form so a user never loses what
 * they typed when they navigate away (e.g. to connect DUPR), reload, or close
 * the app. Backed by AsyncStorage (localStorage on web). All calls are
 * best-effort — a storage failure must never break the form.
 */
export async function saveDraft(key: string, data: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    /* ignore — draft is a convenience, not a guarantee */
  }
}

export async function loadDraft<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed?.data ?? null) as T | null;
  } catch {
    return null;
  }
}

export async function clearDraft(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
