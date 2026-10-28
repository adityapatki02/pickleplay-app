import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../../api/client';
import { EVENTS, type YoidenEvent } from '../data/events';

/**
 * The event list. It starts as the copy bundled with the app (data/events.ts), then the
 * last list saved on the device, then the server's (`GET /app/events`), so a new event
 * appears without an app update. The bundled `EVENTS` array is refreshed in place, so code
 * that reads it outside React (search, bell, eventById) sees the same list.
 */
const KEY = 'yoiden-event-list';

type ListState = { version: number };
export const useEventListState = create<ListState>()(() => ({ version: 0 }));

function apply(list: unknown) {
  if (!Array.isArray(list) || !list.length) return;
  const valid = list.filter((e): e is YoidenEvent => !!e && typeof e.id === 'string' && typeof e.name === 'string');
  if (!valid.length) return;
  EVENTS.splice(0, EVENTS.length, ...valid);
  useEventListState.setState((s) => ({ version: s.version + 1 }));
}

/** Every event; re-renders when a newer list arrives. */
export function useEvents(): YoidenEvent[] {
  useEventListState((s) => s.version);
  return EVENTS;
}

export async function refreshEvents() {
  try {
    const res = await apiClient.get('/app/events');
    const list = res.data?.data;
    if (Array.isArray(list) && list.length) {
      apply(list);
      AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {});
    }
  } catch {
    // Offline or an older server: keep the list we have.
  }
}

// Start-up: saved list first, then the server's.
AsyncStorage.getItem(KEY)
  .then((raw) => raw && apply(JSON.parse(raw)))
  .catch(() => {})
  .finally(() => refreshEvents());
