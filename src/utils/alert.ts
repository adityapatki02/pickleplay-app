// Compatibility wrappers over the unified `notify` service.
//
// `xAlert` / `xConfirm` predate the toast host; they used window.alert/confirm on
// web (reliable but blocking + unstyled). They now route through `notify` so every
// existing caller gets the nicer cross-platform toast / confirm automatically.
// New code should call `notify` / `confirmAction` directly.
import { Alert, Platform } from 'react-native';
import { notify, confirmAction } from './notify';

const looksLikeError = (title: string) =>
  /error|fail|invalid|required|unable|couldn'?t|could not|not ready|denied|wrong|no /i.test(title);

/** Cross-platform message. Errors/warnings render red, everything else neutral. */
export function xAlert(title: string, message?: string) {
  const body = message ?? title;
  const heading = message ? title : undefined;
  if (looksLikeError(title)) notify.error(body, heading);
  else notify.info(body, heading);
}

/** Cross-platform confirm. Calls `onConfirm` if accepted, else `onCancel`. */
export function xConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onCancel?: () => void,
) {
  void confirmAction({
    title,
    message,
    confirmLabel: confirmText,
    cancelLabel: cancelText,
    destructive: /cancel|delete|remove|reset/i.test(title),
  }).then((ok) => {
    if (ok) onConfirm();
    else onCancel?.();
  });
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
    // eslint-disable-next-line no-alert
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
