// Web build of <ScorerFrame/>: the web scorer portal in an <iframe>. Its own
// back and "tie finished" post a close message, which only counts from the API origin.
import React, { useEffect } from 'react';
import { API_BASE_URL } from '../../../config/constants';

const apiOrigin = () => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return '';
  }
};

export function ScorerFrame({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin === apiOrigin() && e.data?.type === 'yoiden-scorer-close') onClose();
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [onClose]);
  return React.createElement('iframe', { src, title: 'Scorer', style: { flex: 1, width: '100%', height: '100%', border: 0 } });
}
