import React, { useMemo } from 'react';
import { View, Image, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { YColors } from '../../config/yoiden';
import { YDisplay, YEyebrow, YMono, YUiText } from './YText';
import { YBadge } from './YTags';
import { thumbUrl } from '../../utils/img';

type TournamentLike = {
  id: string;
  name: string;
  venueName?: string;
  city?: string;
  startDate?: string;       // ISO date
  status?: string;          // 'registration_open' | 'in_progress' | etc.
  isFeatured?: boolean;
  bannerUrl?: string;
  categories?: {
    entryFee: number;
    maxTeams: number;
    registeredTeams?: number;
  }[];
};

type YTournamentRowProps = {
  tournament: TournamentLike;
  onPress?: () => void;
  hosting?: boolean;     // shows HOSTING lime badge inline, hides city
  style?: ViewStyle;
};

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

const parseDateParts = (iso?: string) => {
  if (!iso) return { day: '—', month: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: '—', month: '' };
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: MONTHS[d.getMonth()],
  };
};

const statusLabel = (status?: string, isFeatured?: boolean) => {
  if (isFeatured) return 'FEATURED';
  switch (status) {
    case 'registration_open':  return 'OPEN';
    case 'registration_closed':return 'CLOSED';
    case 'in_progress':        return 'LIVE';
    case 'completed':          return 'FINISHED';
    case 'cancelled':          return 'CANCELLED';
    case 'published':          return 'UPCOMING';
    default:                   return 'DRAFT';
  }
};

const statusColor = (status?: string, isFeatured?: boolean) => {
  if (isFeatured) return YColors.accent;
  if (status === 'in_progress') return YColors.live;
  if (status === 'registration_open') return YColors.accent;
  if (status === 'registration_closed' || status === 'cancelled') return YColors.ink3;
  return YColors.accent;
};

export const YTournamentRow: React.FC<YTournamentRowProps> = ({
  tournament,
  onPress,
  hosting = false,
  style,
}) => {
  const { day, month } = useMemo(() => parseDateParts(tournament.startDate), [tournament.startDate]);

  // Aggregate registered / max across categories
  const { taken, total, minFee } = useMemo(() => {
    const cats = tournament.categories ?? [];
    let taken = 0, total = 0, minFee = Infinity;
    for (const c of cats) {
      taken += c.registeredTeams ?? 0;
      total += c.maxTeams ?? 0;
      if (typeof c.entryFee === 'number') minFee = Math.min(minFee, c.entryFee);
    }
    return {
      taken,
      total,
      minFee: minFee === Infinity ? null : minFee,
    };
  }, [tournament.categories]);

  const pct = total > 0 ? Math.min(100, Math.round((taken / total) * 100)) : 0;
  const tag = statusLabel(tournament.status, tournament.isFeatured);
  const tagBg = statusColor(tournament.status, tournament.isFeatured);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.92 : 1 }, style]}
    >
      {/* Date block — banner-backed when the tournament has one */}
      <View style={styles.dateBlock}>
        {tournament.bannerUrl ? (
          <>
            <Image
              source={{
                uri: thumbUrl(tournament.bannerUrl, 220) ?? tournament.bannerUrl,
              }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,10,11,0.45)' }]} />
          </>
        ) : null}
        <YDisplay size={28} italic={false} color="#fff">
          {day}
        </YDisplay>
        <YUiText
          size={10}
          weight={800}
          color="rgba(255,255,255,0.85)"
          style={{ letterSpacing: 1.4, marginTop: 4 }}
        >
          {month}
        </YUiText>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <YBadge color={tagBg}>
            {tag}
          </YBadge>
          {hosting ? (
            <YBadge color={YColors.accentDeep} bg="rgba(24,88,214,0.12)">HOSTING</YBadge>
          ) : tournament.city ? (
            <YMono
              size={10}
              color={YColors.ink3}
              style={{ letterSpacing: 0.5, flex: 1 }}
              numberOfLines={1}
            >
              {tournament.city.toUpperCase()}
            </YMono>
          ) : null}
        </View>

        <YDisplay size={19} color={YColors.accent} style={styles.name} numberOfLines={1}>
          {tournament.name}
        </YDisplay>
        {tournament.venueName ? (
          <YUiText size={12} color={YColors.ink2} style={{ marginTop: 4 }} numberOfLines={1}>
            {tournament.venueName}
          </YUiText>
        ) : null}

        <View style={styles.footerRow}>
          <View style={{ flex: 1 }}>
            <YEyebrow color={YColors.ink3} size={9}>
              {total > 0 ? `${taken}/${total} REGISTERED` : 'OPENING SOON'}
            </YEyebrow>
            {/* Progress bar */}
            {total > 0 ? (
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${pct}%` }]} />
              </View>
            ) : null}
          </View>
          {minFee != null ? (
            <View style={styles.feeBlock}>
              <YDisplay size={18} italic={false} color={YColors.ink}>
                {minFee === 0 ? 'FREE' : `₹${minFee}`}
              </YDisplay>
              <YEyebrow color={YColors.ink3} size={8} style={{ marginTop: 2 }}>
                ENTRY
              </YEyebrow>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    backgroundColor: YColors.bg2,
    borderWidth: 1,
    borderColor: YColors.line,
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  dateBlock: {
    backgroundColor: YColors.accent,
    paddingVertical: 22,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: YColors.line,
    minWidth: 78,
    position: 'relative',
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  name: {
    marginTop: 0,
    letterSpacing: 0.5,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  feeBlock: {
    alignItems: 'flex-end',
  },
  progressBg: {
    height: 3,
    marginTop: 8,
    backgroundColor: YColors.bg4,
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: YColors.accent,
    borderRadius: 2,
  },
});
