import { Alert, Platform } from 'react-native';

/**
 * Cross-platform alert that works on both native and web.
 * On web, Alert.alert with buttons doesn't work — falls back to window.alert/confirm.
 */
export function xAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-restricted-globals
    alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

/**
 * Cross-platform confirm dialog. Returns true if user confirmed.
 * On native, uses Alert.alert with callbacks. On web, uses window.confirm.
 */
export function xConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onCancel?: () => void,
) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-restricted-globals
    if (confirm(`${title}\n\n${message}`)) {
      onConfirm();
    } else {
      onCancel?.();
    }
  } else {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: onCancel },
      { text: confirmText, onPress: onConfirm },
    ]);
  }
}

/**
 * Cross-platform prompt for a single text value. Returns entered string (or null if cancelled).
 * On web: window.prompt. On iOS: Alert.prompt. On Android: falls back to Alert with "OK" (Android
 * has no native prompt — caller should use a full <TextInput> modal for real Android prompts).
 */
export function xPrompt(
  title: string,
  message: string,
  onSubmit: (value: string) => void,
  opts?: { placeholder?: string; defaultValue?: string; keyboardType?: 'default' | 'number-pad' },
) {
  const { defaultValue = '' } = opts || {};
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-restricted-globals
    const result = prompt(`${title}\n\n${message}`, defaultValue);
    if (result !== null) onSubmit(result);
    return;
  }
  if (Platform.OS === 'ios' && (Alert as any).prompt) {
    (Alert as any).prompt(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OK', onPress: (text: string) => onSubmit(text ?? '') },
      ],
      'plain-text',
      defaultValue,
      opts?.keyboardType === 'number-pad' ? 'number-pad' : undefined,
    );
    return;
  }
  // Android fallback — just warn, caller should build a full modal
  Alert.alert(title, message + '\n\n(Not supported on Android — use modal form.)');
}
