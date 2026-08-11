// Cross-platform notifications + confirmation.
//
// Why this exists: React Native's `Alert.alert` is effectively a no-op on
// react-native-web, so every `Alert.alert('Error', msg)` silently swallows the
// message on the web console (this bit us on the register screen). This module
// gives one API that works on native AND web:
//   notify.success / notify.error / notify.info  → a toast (via NotifyHost)
//   confirmAction(...)                           → a yes/no promise
//
// On native, toasts render through the mounted <NotifyHost/>; if the host isn't
// mounted yet we fall back to Alert (native) / window.alert (web) so a message
// is never lost. Confirmation uses the native Alert on native and window.confirm
// on web (reliable + already the pattern used in the app).

import { Alert, Platform } from 'react-native';

export type ToastType = 'success' | 'error' | 'info';

export type ToastPayload = {
  id: number;
  type: ToastType;
  message: string;
  title?: string;
};

type HostListener = (t: ToastPayload) => void;

let hostListener: HostListener | null = null;
let seq = 1;

/** Called by <NotifyHost/> on mount/unmount. Not for app code. */
export const _registerNotifyHost = (fn: HostListener | null) => {
  hostListener = fn;
};

function push(type: ToastType, message: string, title?: string) {
  const payload: ToastPayload = { id: seq++, type, message, title };
  if (hostListener) {
    hostListener(payload);
    return;
  }
  // Fallback before the host mounts — never drop the message.
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(title ? `${title}\n\n${message}` : message);
  } else {
    Alert.alert(title ?? '', message);
  }
}

export const notify = {
  success: (message: string, title?: string) => push('success', message, title),
  error: (message: string, title?: string) => push('error', message, title),
  info: (message: string, title?: string) => push('info', message, title),
};

// ── Multi-option choice (e.g. "which team won?") ────────────────────────────
export type ChoiceOption = { label: string; value: string; destructive?: boolean };
export type ChoicePayload = {
  id: number;
  title?: string;
  message?: string;
  options: ChoiceOption[];
  cancelLabel?: string;
  resolve: (value: string | null) => void;
};
type ChoiceListener = (c: ChoicePayload) => void;
let choiceListener: ChoiceListener | null = null;

/** Called by <NotifyHost/> on mount/unmount. Not for app code. */
export const _registerChoiceHost = (fn: ChoiceListener | null) => {
  choiceListener = fn;
};

/** Ask the user to pick one of N options. Resolves the chosen value, or null if cancelled. */
export function chooseAction(opts: {
  title?: string;
  message?: string;
  options: ChoiceOption[];
  cancelLabel?: string;
}): Promise<string | null> {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web') {
      Alert.alert(opts.title ?? '', opts.message, [
        ...opts.options.map((o) => ({
          text: o.label,
          style: (o.destructive ? 'destructive' : 'default') as 'destructive' | 'default',
          onPress: () => resolve(o.value),
        })),
        { text: opts.cancelLabel ?? 'Cancel', style: 'cancel' as const, onPress: () => resolve(null) },
      ]);
      return;
    }
    if (choiceListener) choiceListener({ id: seq++, ...opts, resolve });
    else resolve(null);
  });
}

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

/** Resolves true if the user confirms, false otherwise. Works on web + native. */
export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      // Alert.alert's buttons don't work on web; window.confirm is reliable.
      const text = opts.title ? `${opts.title}\n\n${opts.message}` : opts.message;
      // eslint-disable-next-line no-alert
      resolve(typeof window !== 'undefined' ? window.confirm(text) : false);
      return;
    }
    Alert.alert(opts.title ?? '', opts.message, [
      { text: opts.cancelLabel ?? 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: opts.confirmLabel ?? 'Confirm',
        style: opts.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
