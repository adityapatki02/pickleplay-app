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
