/**
 * useTickr — connects Tickr BLE clickers to a scoring screen.
 *
 * Tickr is a collar-worn button. One per team. Press it, that team scores.
 * Firmware + BLE contract: Documents/pickleplay/tickr/TICKR-SPEC.md
 *
 * WEB ONLY, and Chrome/Edge only — this uses the Web Bluetooth API, which
 * Safari and iOS do not implement. `supported` is false everywhere else and
 * callers should hide their Tickr UI rather than let it fail on tap.
 *
 * This is the mockup path, chosen because it needs no native build. The
 * production mobile path is react-native-ble-plx behind a custom EAS dev
 * build. The BLE contract below is identical for both, so the press-counter
 * and resync logic here transfers unchanged.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// Contract with the firmware. Must match TICKR-SPEC.md exactly.
// Web Bluetooth requires these lowercase — it rejects uppercase UUIDs.
const TICKR_SERVICE_UUID = 'b4a7f1c0-9d2e-4f3a-8c15-2e6b7a0d5f10';
const PRESS_CHAR_UUID = 'b4a7f1c1-9d2e-4f3a-8c15-2e6b7a0d5f10';

/**
 * A jump larger than this is treated as a fault, not as points.
 *
 * The firmware sends a monotonic press counter rather than a bare "pressed!"
 * event, so a gap means notifications were dropped and we can recover the
 * lost presses. But an unbounded gap is indistinguishable from a bug, and
 * silently dumping 40 points on a team mid-match is far worse than dropping
 * a few. Above this we resync to the new value and score nothing.
 */
const MAX_CATCHUP = 3;

export type TickrSlot = 'home' | 'away';

export type TickrConnection = {
  slot: TickrSlot;
  name: string;
  connected: boolean;
};

type Params = {
  /** Called once per detected press. `points` is ≥1 (dropped-packet catch-up). */
  onPress: (slot: TickrSlot, points: number) => void;
};

export function useTickr({ onPress }: Params) {
  const supported =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    !!(navigator as any).bluetooth;

  const [connections, setConnections] = useState<TickrConnection[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Last press counter seen per slot. null = not yet baselined.
  const lastCount = useRef<Record<string, number | null>>({ home: null, away: null });
  const devices = useRef<Record<string, any>>({});

  // onPress is called from a BLE event listener that outlives this render, so
  // read it through a ref — otherwise the listener closes over a stale
  // addPoint and points land on an out-of-date score.
  const onPressRef = useRef(onPress);
  useEffect(() => {
    onPressRef.current = onPress;
  }, [onPress]);

  const setConnected = useCallback((slot: TickrSlot, name: string, connected: boolean) => {
    setConnections((prev) => {
      const rest = prev.filter((c) => c.slot !== slot);
      return connected ? [...rest, { slot, name, connected }] : rest;
    });
  }, []);

  const handleNotification = useCallback((slot: TickrSlot, value: DataView) => {
    // uint32 little-endian, matching the firmware's memcpy of pressCount.
    const count = value.getUint32(0, true);
    const prev = lastCount.current[slot];
    lastCount.current[slot] = count;

    // First notification after connecting is a baseline, not a point. The
    // counter has been running since the device booted and those presses
    // happened before this match existed.
    if (prev === null) return;

    const delta = count - prev;

    // Counter went backwards or stalled: the Tickr rebooted (it resets to 0)
    // or re-sent a value. Resync silently rather than scoring nonsense.
    if (delta <= 0) return;

    if (delta > MAX_CATCHUP) {
      // Deliberately not scored. Logged so a real gap is visible rather than
      // silently swallowed — see the "no silent caps" rule in the spec.
      console.warn(
        `[tickr] ${slot}: counter jumped ${prev}→${count} (${delta}). ` +
          `Above catch-up limit of ${MAX_CATCHUP}, resyncing without scoring.`,
      );
      return;
    }

    onPressRef.current(slot, delta);
  }, []);

  const connect = useCallback(
    async (slot: TickrSlot) => {
      if (!supported) {
        setError('Web Bluetooth needs Chrome or Edge. Safari and iOS cannot do this.');
        return;
      }
      setError(null);

      try {
        // Filtering on the service UUID is what makes the chooser show only
        // Tickrs instead of every BLE device in the venue.
        const device = await (navigator as any).bluetooth.requestDevice({
          filters: [{ services: [TICKR_SERVICE_UUID] }],
        });

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(TICKR_SERVICE_UUID);
        const characteristic = await service.getCharacteristic(PRESS_CHAR_UUID);

        await characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', (e: any) => {
          handleNotification(slot, e.target.value as DataView);
        });

        device.addEventListener('gattserverdisconnected', () => {
          // Force a fresh baseline on reconnect — the counter may have moved
          // or reset while we were away, and neither is worth points.
          lastCount.current[slot] = null;
          setConnected(slot, device.name ?? 'Tickr', false);
        });

        devices.current[slot] = device;
        lastCount.current[slot] = null;
        setConnected(slot, device.name ?? 'Tickr', true);
      } catch (e: any) {
        // Cancelling the browser's device chooser throws; that's not an error
        // worth showing.
        if (e?.name === 'NotFoundError') return;
        setError(e?.message ?? 'Could not connect to the Tickr.');
      }
    },
    [supported, handleNotification, setConnected],
  );

  const disconnect = useCallback(
    (slot: TickrSlot) => {
      const device = devices.current[slot];
      if (device?.gatt?.connected) device.gatt.disconnect();
      delete devices.current[slot];
      lastCount.current[slot] = null;
      setConnected(slot, '', false);
    },
    [setConnected],
  );

  // Drop the radio links when the scorer unmounts, otherwise the browser
  // holds them open and the next connect attempt sees a busy device.
  useEffect(() => {
    return () => {
      Object.values(devices.current).forEach((d: any) => {
        if (d?.gatt?.connected) d.gatt.disconnect();
      });
    };
  }, []);

  const connectionFor = useCallback(
    (slot: TickrSlot) => connections.find((c) => c.slot === slot) ?? null,
    [connections],
  );

  return { supported, connections, connectionFor, connect, disconnect, error };
}
