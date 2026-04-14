import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { downloadAsJpg } from '../../utils/downloadAsJpg';

const NAVY = '#001E40';
const BORDER = '#E2E8F0';

interface Props {
  /** A ref whose `.current` holds the element to capture. On web this resolves
   * to an HTMLDivElement via React Native Web. */
  targetRef: React.MutableRefObject<any>;
  /** Callback returning the filename (called when button tapped). */
  getFilename: () => string;
  /** Optional label override. */
  label?: string;
}

export default function DownloadJpgButton({ targetRef, getFilename, label }: Props) {
  const [loading, setLoading] = useState(false);

  // Only show on web — on native we'd need react-native-view-shot.
  if (Platform.OS !== 'web') return null;

  const handlePress = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const node = targetRef.current;
      await downloadAsJpg(node, getFilename());
    } catch (err) {
      console.error('[DownloadJpgButton]', err);
      // eslint-disable-next-line no-alert
      if (typeof window !== 'undefined' && (window as any).alert) {
        (window as any).alert('Download failed. Check console for details.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={s.btn}
      onPress={handlePress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={NAVY} />
      ) : (
        <>
          <Text style={s.icon}>⬇</Text>
          <Text style={s.label}>{label ?? 'DOWNLOAD JPG'}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  icon: {
    fontSize: 13,
    color: NAVY,
    fontWeight: '800',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: NAVY,
    letterSpacing: 1,
  },
});
