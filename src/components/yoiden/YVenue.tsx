import React from 'react';
import { View, Image, Pressable, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Ellipse, Line } from 'react-native-svg';
import { YColors } from '../../config/yoiden';
import { YUiText } from './YText';

// Sports a venue can offer. Drives the sport-icon chips on each card.
export type Sport = 'tennis' | 'padel' | 'pickleball' | 'football' | 'basketball' | 'swimming';

// Venue shape rendered by both the editorial (sponsored) card and the compact row.
export type Venue = {
  id: string;
  name: string;
  area: string; // locality / neighbourhood, e.g. "Dockside"
  distanceKm: number; // e.g. 1.2
  rating: number; // e.g. 4.9
  reviews: number; // e.g. 168
  sports?: Sport[]; // sport-icon chips; first one is highlighted as the primary
  imageUrl?: string;
  sponsored?: boolean; // shows the "SPONSORED" badge on the editorial card
  topRated?: boolean; // shows the "TOP RATED" badge on the compact row
};

const GREY = YColors.ink2;
const PLACEHOLDER = '#DFE3EA';

// ── Inline icons ────────────────────────────────────────────────
const Star = ({ size = 14, color = YColors.accent }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
  </Svg>
);
const Pin = ({ size = 14, color = GREY }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 21s7-5.686 7-11a7 7 0 1 0-14 0c0 5.314 7 11 7 11z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    <Path d="M12 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" stroke={color} strokeWidth={1.8} />
  </Svg>
);
const Heart = ({ size = 16, color = YColors.ink }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12.1 18.55l-.1.1-.11-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5 18.5 5 20 6.5 20 8.5c0 2.89-3.14 5.74-7.9 10.05z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
  </Svg>
);
const ShareIcon = ({ size = 16, color = YColors.ink }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 8a3 3 0 1 0-2.83-4M6 12a3 3 0 1 0 0 .01M18 16a3 3 0 1 0-2.83 4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    <Path d="M8.6 10.5l6.8-3.8M8.6 13.5l6.8 3.8" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);
const Arrow = ({ size = 16, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12h13M13 6l6 6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ── Sport icons + chips row ─────────────────────────────────────
type IconProps = { size?: number; color?: string };

const SportFootball = ({ size = 18, color = YColors.ink }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.6} />
    <Path d="M12 8.2l3.2 2.3-1.2 3.8h-4l-1.2-3.8z" fill={color} />
    <Path d="M12 3.2v2M5 8.9l1.7 1.1M19 8.9l-1.7 1.1M8.1 20l1.1-2.2M15.9 20l-1.1-2.2" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
  </Svg>
);
const SportBasketball = ({ size = 18, color = YColors.ink }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.6} />
    <Path d="M3 12h18M12 3v18M6 5.4c2.6 2.3 2.6 11 0 13.2M18 5.4c-2.6 2.3-2.6 11 0 13.2" stroke={color} strokeWidth={1.4} />
  </Svg>
);
const SportRacket = ({ size = 18, color = YColors.ink }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Ellipse cx={12} cy={8.5} rx={5.2} ry={6} stroke={color} strokeWidth={1.6} />
    <Line x1={6.8} y1={8.5} x2={17.2} y2={8.5} stroke={color} strokeWidth={1} opacity={0.55} />
    <Line x1={12} y1={2.6} x2={12} y2={14.4} stroke={color} strokeWidth={1} opacity={0.55} />
    <Path d="M12 14.5V21" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
  </Svg>
);
const SportSwimming = ({ size = 18, color = YColors.ink }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={7.4} cy={7} r={1.7} fill={color} />
    <Path d="M4 11.6c1.3-1 2.4-.2 4.2.3l5-2.8 3 2.1" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M3.4 16.2c1.7-1.4 2.9 1 4.6 0s3.1-1.4 4.8 0 3.1 1 4.8 0" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

const SPORT_ICONS: Record<Sport, (p: IconProps) => React.JSX.Element> = {
  tennis: SportRacket,
  padel: SportRacket,
  pickleball: SportRacket,
  football: SportFootball,
  basketball: SportBasketball,
  swimming: SportSwimming,
};

type SportsRowProps = { sports: Sport[]; size?: number; iconSize?: number; gap?: number; style?: ViewStyle };
const SportsRow: React.FC<SportsRowProps> = ({ sports, size = 34, iconSize = 18, gap = 8, style }) => (
  <View style={[{ flexDirection: 'row', gap }, style]}>
    {sports.map((s, i) => {
      const Icon = SPORT_ICONS[s];
      const primary = i === 0;
      return (
        <View
          key={`${s}-${i}`}
          style={[styles.sportChip, { width: size, height: size }, styles.sportChipNeutral]}
        >
          {Icon ? <Icon size={iconSize} color={YColors.ink} /> : null}
        </View>
      );
    })}
  </View>
);

// ── Editorial (sponsored) card — tall, image-led ────────────────
type EditorialProps = { venue: Venue; onPress?: () => void; style?: ViewStyle };
export const YVenueEditorial: React.FC<EditorialProps> = ({ venue, onPress, style }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.eCard, pressed && { opacity: 0.96 }, style]}>
    <View style={styles.eImageWrap}>
      {venue.imageUrl ? (
        <Image source={{ uri: venue.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: PLACEHOLDER }]} />
      )}
      <View style={styles.eImgBtns}>
        <View style={styles.circBtn}><Heart size={16} color={YColors.ink} /></View>
        <View style={styles.circBtn}><ShareIcon size={15} color={YColors.ink} /></View>
      </View>
      {venue.sponsored ? (
        <View style={styles.sponsoredBadge}>
          <YUiText size={10} weight={900} color={YColors.ink} style={{ letterSpacing: 1.4 }}>SPONSORED</YUiText>
        </View>
      ) : null}
    </View>

    <View style={styles.eBody}>
      <View style={styles.ratingRow}>
        <Star size={15} color={YColors.accent} />
        <YUiText size={14} weight={800} color={YColors.accent} style={{ marginLeft: 4 }}>
          {venue.rating.toFixed(1)}
        </YUiText>
        <YUiText size={13} weight={600} color={GREY} style={{ marginLeft: 6 }}>
          · {venue.reviews} reviews
        </YUiText>
      </View>

      <YUiText size={24} weight={900} color={YColors.ink} numberOfLines={1} style={{ marginTop: 6, letterSpacing: -0.4 }}>
        {venue.name}
      </YUiText>

      <View style={styles.locRow}>
        <Pin size={13} color={GREY} />
        <YUiText size={13} weight={600} color={GREY} style={{ marginLeft: 5 }}>
          {venue.area} · {venue.distanceKm} km away
        </YUiText>
      </View>

      {venue.sports && venue.sports.length > 0 ? (
        <SportsRow sports={venue.sports} size={34} iconSize={18} gap={8} style={{ marginTop: 12 }} />
      ) : null}

      <View style={styles.divider} />

      <View style={styles.actionRow}>
        <View style={styles.sqBtn}><Heart size={18} color={YColors.ink} /></View>
        <View style={styles.sqBtn}><ShareIcon size={17} color={YColors.ink} /></View>
        <Pressable style={styles.bookBtn} onPress={onPress}>
          <YUiText size={14} weight={800} color="#fff" style={{ letterSpacing: 0.3 }}>BOOK</YUiText>
          <Arrow size={16} />
        </Pressable>
      </View>
    </View>
  </Pressable>
);

// ── Compact list row — normal listing ───────────────────────────
type RowProps = { venue: Venue; onPress?: () => void; style?: ViewStyle };
export const YVenueRow: React.FC<RowProps> = ({ venue, onPress, style }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.cRow, pressed && { opacity: 0.96 }, style]}>
    <View style={styles.cThumb}>
      {venue.imageUrl ? (
        <Image source={{ uri: venue.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: PLACEHOLDER }]} />
      )}
      {venue.topRated ? (
        <View style={styles.topBadge}>
          <YUiText size={9} weight={800} color={YColors.ink} style={{ letterSpacing: 0.4 }}>TOP RATED</YUiText>
        </View>
      ) : null}
    </View>

    <View style={styles.cBody}>
      <View style={styles.cTopRow}>
        <YUiText size={16} weight={800} color={YColors.ink} numberOfLines={1} style={{ flex: 1, letterSpacing: -0.2 }}>
          {venue.name}
        </YUiText>
        <View style={styles.ratingChip}>
          <Star size={12} color={YColors.accent} />
          <YUiText size={12.5} weight={700} color={YColors.ink} style={{ marginLeft: 3 }}>
            {venue.rating.toFixed(1)}
          </YUiText>
        </View>
      </View>

      <View style={styles.locRow}>
        <Pin size={12} color={GREY} />
        <YUiText size={12.5} weight={600} color={GREY} style={{ marginLeft: 4 }} numberOfLines={1}>
          {venue.area} · {venue.distanceKm} km
        </YUiText>
      </View>

      {venue.sports && venue.sports.length > 0 ? (
        <SportsRow sports={venue.sports} size={28} iconSize={15} gap={6} style={{ marginTop: 8 }} />
      ) : null}

      <View style={styles.cActions}>
        <View style={styles.sqBtnSm}><Heart size={15} color={YColors.ink} /></View>
        <View style={styles.sqBtnSm}><ShareIcon size={14} color={YColors.ink} /></View>
        <Pressable style={styles.bookBtnSm} onPress={onPress}>
          <YUiText size={12} weight={800} color="#fff" style={{ letterSpacing: 0.3 }}>BOOK</YUiText>
        </Pressable>
      </View>
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  // Editorial
  eCard: {
    backgroundColor: YColors.bg2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: YColors.line2,
    padding: 12,
  },
  eImageWrap: {
    height: 190,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: PLACEHOLDER,
  },
  eImgBtns: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  circBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sponsoredBadge: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    backgroundColor: YColors.lime,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  eBody: { paddingHorizontal: 4, paddingTop: 14 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  locRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  divider: { height: 1, backgroundColor: YColors.line, marginVertical: 14 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sqBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: YColors.bg3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: YColors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  // Compact
  cRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: YColors.bg2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: YColors.line2,
    padding: 10,
  },
  cThumb: {
    width: 104,
    minHeight: 104,
    alignSelf: 'stretch',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: PLACEHOLDER,
  },
  topBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: YColors.lime,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  cBody: { flex: 1, justifyContent: 'center' },
  cTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: YColors.bg3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  cActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  sqBtnSm: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: YColors.bg3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookBtnSm: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    backgroundColor: YColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sport chips
  sportChip: {
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportChipPrimary: {
    backgroundColor: YColors.lime,
    borderColor: YColors.ink,
  },
  sportChipNeutral: {
    backgroundColor: YColors.bg2,
    borderColor: YColors.line2,
  },
});
