import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { YColors, YUiText } from './yoiden';

/**
 * Lightweight, web-safe toast. `Alert.alert` does not render reliably on
 * react-native-web, so use this for transient messages instead.
 *
 *   const { show, node } = useToast();
 *   ...call show('Saved') anywhere...
 *   return <SafeAreaView>{...}{node}</SafeAreaView>;   // render node once
 */
export function useToast() {
  const [msg, setMsg] = useState('');
  const show = useCallback((m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 3200);
  }, []);
  const node = msg ? (
    <View style={styles.toast} pointerEvents="none">
      <YUiText size={13} weight={600} color="#fff" style={{ textAlign: 'center' }}>{msg}</YUiText>
    </View>
  ) : null;
  return { show, node };
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', bottom: 40, left: 20, right: 20,
    backgroundColor: YColors.ink, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
    zIndex: 999,
  },
});
