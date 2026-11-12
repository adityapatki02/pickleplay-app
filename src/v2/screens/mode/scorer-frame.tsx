// The web scorer portal inside the app, so admins and scorers score on the exact screen
// courtside scorers use (serve, swap sides, change of ends). Its own back and
// "tie finished" send a close message through the WebView bridge.
import React from 'react';
import { WebView } from 'react-native-webview';

export function ScorerFrame({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <WebView
      source={{ uri: src }}
      style={{ flex: 1 }}
      onMessage={(e) => {
        if (e.nativeEvent.data === 'yoiden-scorer-close') onClose();
      }}
    />
  );
}
