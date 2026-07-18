import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { Tournament } from '../../types/tournament.types';
import { resizeUrl } from '../../utils/img';

// ─── Constants ────────────────────────────────────────────────────────────────

const NAVY = '#001E40';
const WHITE = '#FFFFFF';
const GREEN = '#06D6A0';
const ORANGE = '#FFB703';
const RED = '#BA1A1A';
const BLUE = '#2196F3';
const GRAY = '#737780';

// ─── Gradient Palette ─────────────────────────────────────────────────────────

// Card background images (tournament banners)
const CARD_IMAGES = [
  require('../../../assets/banners/1.jpg'),
  require('../../../assets/banners/2.jpg'),
  require('../../../assets/banners/3.jpg'),
];

// Branded gradient palette — fallback when no image
const GRADIENTS: [string, string][] = [
  ['#001E40', '#003366'],
  ['#0F2027', '#2C5364'],
  ['#001E40', '#2196F3'],
  ['#1A2980', '#26D0CE'],
];

// Hash string to pick a consistent gradient for each tournament
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getGradient(seed: string): [string, string] {
  return GRADIENTS[hashString(seed) % GRADIENTS.length];
}

export function getCardImage(seed: string) {
  return CARD_IMAGES[hashString(seed) % CARD_IMAGES.length];
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string; textColor: string }> = {
  draft:               { label: 'DRAFT',       color: '#9CA3AF', textColor: '#FFFFFF' },
  published:           { label: 'PUBLISHED',   color: BLUE,      textColor: '#FFFFFF' },
  registration_open:   { label: 'REG OPEN',    color: GREEN,     textColor: '#FFFFFF' },
  registration_closed: { label: 'REG CLOSED',  color: ORANGE,    textColor: '#FFFFFF' },
  in_progress:         { label: '● LIVE',      color: RED,       textColor: '#FFFFFF' },
  completed:           { label: 'COMPLETED',   color: '#6B7280', textColor: '#FFFFFF' },
  cancelled:           { label: 'CANCELLED',   color: '#991B1B', textColor: '#FFFFFF' },
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const MapPinIcon = ({ color = GRAY, size = 12 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={color} />
    <Circle cx="12" cy="9" r="2.5" fill="rgba(0,0,0,0.3)" />
  </Svg>
);

const CalIcon = ({ color = GRAY, size = 12 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke={color} strokeWidth={2.2} />
    <Path d="M8 2v4M16 2v4" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
  </Svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const sameDay = sameMonth && s.getDate() === e.getDate();

  const sMonth = s.toLocaleDateString('en-IN', { month: 'short' });
  const eMonth = e.toLocaleDateString('en-IN', { month: 'short' });

  if (sameDay) return `${s.getDate()} ${sMonth}`;
  if (sameMonth) return `${s.getDate()}–${e.getDate()} ${sMonth}`;
  return `${s.getDate()} ${sMonth} – ${e.getDate()} ${eMonth}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

type Variant = 'feature' | 'card' | 'compact' | 'wide';

interface Props {
  tournament: Tournament | any;
  variant?: Variant;
  onPress?: () => void;
  showStatus?: boolean;
  trailing?: React.ReactNode;
  badge?: string; // custom override badge (e.g. "REGISTERED")
  badgeColor?: string;
}

export default function TournamentTile({
  tournament,
  variant = 'card',
  onPress,
  showStatus = true,
  trailing,
  badge,
  badgeColor,
}: Props) {
  const status = tournament?.status ?? 'draft';
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.draft;
  const seed = tournament.id ?? tournament.name ?? 'default';
  const gradient = getGradient(seed);
  const localImage = getCardImage(seed);
  const bannerUrl = tournament.bannerUrl;

  const name = tournament.name ?? 'Untitled';
  const city = tournament.city ?? '';
  const state = tournament.state ?? '';
  const location = state ? `${city}, ${state}` : city;
  const dateRange = tournament.startDate && tournament.endDate
    ? fmtDateRange(tournament.startDate, tournament.endDate) : '';
  const isLive = status === 'in_progress';

  const styles = variantStyles[variant];

  const content = (
    <>
      {/* Image section — top part of card */}
      <View style={s.imageSection}>
        {bannerUrl ? (
          <Image
            source={{ uri: resizeUrl(bannerUrl, { w: 800, h: 500 }) ?? bannerUrl }}
            style={s.imageFill as any}
            resizeMode="cover"
          />
        ) : (
          <Image source={localImage} style={s.imageFill as any} resizeMode="cover" />
        )}
        {/* Status badge overlaid on image */}
        <View style={s.topRow}>
          {showStatus && (
            <View style={[s.statusPill, { backgroundColor: badgeColor ?? cfg.color }]}>
              {isLive && <View style={s.liveDot} />}
              <Text style={[s.statusText, { color: cfg.textColor }]}>
                {badge ?? cfg.label}
              </Text>
            </View>
          )}
          {trailing ? <View style={s.trailing}>{trailing}</View> : <View />}
        </View>
      </View>

      {/* Text section — below image on white bg */}
      <View style={styles.bottom}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {!!dateRange && (
          <Text style={s.metaLine} numberOfLines={1}>📅 {dateRange}</Text>
        )}
        <Text style={s.metaLine} numberOfLines={1}>
          📍 {[tournament.venueName, city].filter(Boolean).join(', ') || 'Venue TBD'}
        </Text>
        {!!(tournament as any).prizePool && (
          <Text style={s.prizeText}>🏆 Prize: {(tournament as any).prizePool}</Text>
        )}
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.container}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.container}>{content}</View>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  imageSection: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  imageFill: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  topRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 10,
    zIndex: 1,
  },
  trailing: { alignItems: 'flex-end' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: WHITE,
  },
  statusText: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1.2,
  },
  metaLine: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.2,
    marginTop: 3,
  },
  prizeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F59E0B',
    marginTop: 3,
  },
});

// Portrait tiles — matches flyer/poster format (3:4 ratio)
// Canva size: 450 x 600 px

const cardBase = {
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderColor: '#E2E8F0',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 6,
  elevation: 3,
};

const variantStyles: Record<Variant, { container: any; bottom: any; name: any }> = {
  // Large featured card — Home carousel
  feature: {
    container: {
      ...cardBase,
      width: 220, aspectRatio: 3 / 4.5,
      borderRadius: 14, overflow: 'hidden',
      marginRight: 14,
    },
    bottom: { padding: 10, backgroundColor: '#FFFFFF' },
    name: {
      fontSize: 14, fontWeight: '800', color: '#1A1D21',
      letterSpacing: -0.2, lineHeight: 18,
    },
  },
  // Standard tournament card — Discover, My Events
  card: {
    container: {
      ...cardBase,
      width: '100%', aspectRatio: 3 / 4.5,
      borderRadius: 14, overflow: 'hidden',
      marginBottom: 14,
    },
    bottom: { padding: 12, backgroundColor: '#FFFFFF' },
    name: {
      fontSize: 16, fontWeight: '800', color: '#1A1D21',
      letterSpacing: -0.2, lineHeight: 20,
    },
  },
  // Horizontal scroll — Home live now
  wide: {
    container: {
      ...cardBase,
      width: 180, aspectRatio: 3 / 4.5,
      borderRadius: 12, overflow: 'hidden',
      marginRight: 12,
    },
    bottom: { padding: 8, backgroundColor: '#FFFFFF' },
    name: {
      fontSize: 13, fontWeight: '800', color: '#1A1D21',
      letterSpacing: -0.2, lineHeight: 16,
    },
  },
  // Compact tile
  compact: {
    container: {
      ...cardBase,
      width: '100%', aspectRatio: 3 / 4,
      borderRadius: 12, overflow: 'hidden',
      marginBottom: 10,
    },
    bottom: { padding: 10, backgroundColor: '#FFFFFF' },
    name: {
      fontSize: 14, fontWeight: '800', color: '#1A1D21',
      letterSpacing: -0.2, lineHeight: 18,
    },
  },
};
