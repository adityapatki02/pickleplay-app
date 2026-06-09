import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';

/**
 * Uniform admin "Download CSV" button used on standings, knockout, stats,
 * and fantasy leaderboard. Keeping a single component means future style
 * tweaks land in one place and every export point stays visually consistent.
 */
type Props = {
  onPress: () => void;
  label?: string;
  loading?: boolean;
  disabled?: boolean;
  /** Optional override for compact placements (e.g. inside a header row). */
  compact?: boolean;
};

const NAVY = '#001E40';
const NAVY_DISABLED = '#4A5568';
const WHITE = '#FFFFFF';

const DownloadButton: React.FC<Props> = ({
  onPress,
  label = 'DOWNLOAD CSV',
  loading = false,
  disabled = false,
  compact = false,
}) => {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        styles.btn,
        compact && styles.btnCompact,
        { backgroundColor: isDisabled ? NAVY_DISABLED : NAVY, opacity: isDisabled ? 0.7 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={WHITE} />
      ) : (
        <>
          <Text style={[styles.icon, compact && styles.iconCompact]}>⬇</Text>
          <Text style={[styles.label, compact && styles.labelCompact]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  btnCompact: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  icon: { color: WHITE, fontSize: 14, fontWeight: '700' },
  iconCompact: { fontSize: 12 },
  label: { color: WHITE, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  labelCompact: { fontSize: 11, letterSpacing: 0.3 },
});

export default DownloadButton;
