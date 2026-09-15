import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

import { YColors } from '../components/yoiden';

/**
 * Venue facilities catalogue.
 *
 * Keys are what we persist in `venues.amenities` (text[]). Anything not listed
 * here still renders — with a title-cased label and the generic tick — so a
 * venue is never blocked from listing something we haven't catalogued yet.
 *
 * Icons are hand-drawn stroke paths on a 24x24 grid to match the rest of the
 * Yoiden icon set (no icon-font dependency).
 */

export type AmenityKey = string;

type Glyph = (c: string) => React.ReactNode;

const S = { strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

const GLYPHS: Record<string, Glyph> = {
  floodlights: (c) => (
    <>
      <Path d="M4.6 3h14.8v5.4H4.6z" stroke={c} {...S} />
      <Path d="M8.3 3v5.4M12 3v5.4M15.7 3v5.4" stroke={c} {...S} />
      <Path d="M12 8.4v12.2" stroke={c} {...S} />
      <Path d="M8.8 20.8h6.4" stroke={c} {...S} />
    </>
  ),
  parking: (c) => (
    <>
      <Path d="M4.2 3.2h15.6a1 1 0 0 1 1 1v15.6a1 1 0 0 1-1 1H4.2a1 1 0 0 1-1-1V4.2a1 1 0 0 1 1-1z" stroke={c} {...S} />
      <Path d="M9.6 17.2V6.8h3.1a3.2 3.2 0 0 1 0 6.4H9.6" stroke={c} {...S} />
    </>
  ),
  washroom: (c) => (
    <>
      <Path d="M7.2 3.2h3.6v5.4H7.2z" stroke={c} {...S} />
      <Path d="M4.8 8.8h14.4v1.5a5.9 5.9 0 0 1-5.9 5.9h-2.6a5.9 5.9 0 0 1-5.9-5.9z" stroke={c} {...S} />
      <Path d="M11 16.2v4.4" stroke={c} {...S} />
      <Path d="M8 20.6h6.2" stroke={c} {...S} />
    </>
  ),
  paid_beverages: (c) => (
    <>
      <Path d="M4.2 4.4h15.6v3H4.2z" stroke={c} {...S} />
      <Path d="M5.8 7.4h12.4l-1.5 11.9a2 2 0 0 1-2 1.7H9.3a2 2 0 0 1-2-1.7z" stroke={c} {...S} />
      <Path d="M13.4 4.4l2.1-2.9" stroke={c} {...S} />
    </>
  ),
  paddles: (c) => (
    <>
      <Path d="M7.6 2.8h8.8a1.7 1.7 0 0 1 1.7 1.7v7.1a6.1 6.1 0 0 1-12.2 0V4.5a1.7 1.7 0 0 1 1.7-1.7z" stroke={c} {...S} />
      <Path d="M10.6 17.8v2.4a1.4 1.4 0 0 0 2.8 0v-2.4" stroke={c} {...S} />
    </>
  ),
  balls: (c) => (
    <>
      <Circle cx={12} cy={12} r={8.8} stroke={c} {...S} />
      <Circle cx={9.1} cy={9.4} r={1.1} fill={c} />
      <Circle cx={15} cy={10} r={1.1} fill={c} />
      <Circle cx={10.4} cy={15.1} r={1.1} fill={c} />
      <Circle cx={15.5} cy={14.6} r={1.1} fill={c} />
    </>
  ),
  drinking_water: (c) => (
    <Path d="M12 2.8c3.2 4 6 6.9 6 10a6 6 0 0 1-12 0c0-3.1 2.8-6 6-10z" stroke={c} {...S} />
  ),
  rental_equipment: (c) => (
    <>
      <Path d="M3.4 3.4h7.6l9.6 9.6-7.6 7.6-9.6-9.6z" stroke={c} {...S} />
      <Circle cx={8} cy={8} r={1.5} stroke={c} {...S} />
    </>
  ),
  seating: (c) => (
    <>
      <Path d="M5.2 11V6.2a2 2 0 0 1 2-2h9.6a2 2 0 0 1 2 2V11" stroke={c} {...S} />
      <Path d="M3.4 11h17.2v4.2H3.4z" stroke={c} {...S} />
      <Path d="M6 15.2v4.6M18 15.2v4.6" stroke={c} {...S} />
    </>
  ),
  cafe: (c) => (
    <>
      <Path d="M4 5.2h13v7.6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" stroke={c} {...S} />
      <Path d="M17 7.6h2.2a2.6 2.6 0 0 1 0 5.2H17" stroke={c} {...S} />
      <Path d="M4 20.8h13" stroke={c} {...S} />
    </>
  ),
  first_aid: (c) => (
    <>
      <Path d="M3.2 7.4h17.6v13H3.2z" stroke={c} {...S} />
      <Path d="M9 7.4V5.6a1.6 1.6 0 0 1 1.6-1.6h2.8A1.6 1.6 0 0 1 15 5.6v1.8" stroke={c} {...S} />
      <Path d="M12 10.8v6M9 13.8h6" stroke={c} {...S} />
    </>
  ),
  changing_room: (c) => (
    <Path d="M8.6 3.6L4 6.2l2 4 2-1v11.2h8V9.2l2 1 2-4-4.6-2.6a3.5 3.5 0 0 1-6.8 0z" stroke={c} {...S} />
  ),
  shower: (c) => (
    <>
      <Path d="M12 3v3.2" stroke={c} {...S} />
      <Path d="M5.8 10.2a6.2 6.2 0 0 1 12.4 0z" stroke={c} {...S} />
      <Path d="M8.4 13.6v1.8M12 13.2v2.4M15.6 13.6v1.8M10.2 18v1.8M13.8 18v1.8" stroke={c} {...S} />
    </>
  ),
  lockers: (c) => (
    <>
      <Path d="M4 3.2h16v17.6H4z" stroke={c} {...S} />
      <Path d="M12 3.2v17.6" stroke={c} {...S} />
      <Path d="M8.6 10v2.4M15.4 10v2.4" stroke={c} {...S} />
    </>
  ),
  wifi: (c) => (
    <>
      <Path d="M2.8 8.6a14.5 14.5 0 0 1 18.4 0" stroke={c} {...S} />
      <Path d="M6.2 12.3a9.5 9.5 0 0 1 11.6 0" stroke={c} {...S} />
      <Path d="M9.6 15.9a4.6 4.6 0 0 1 4.8 0" stroke={c} {...S} />
      <Circle cx={12} cy={19.4} r={1.3} fill={c} />
    </>
  ),
  cctv: (c) => (
    <>
      <Path d="M3.4 7.4h10.4v5.6H3.4z" stroke={c} {...S} />
      <Path d="M13.8 8.6l5-1.9v7.6l-5-1.9z" stroke={c} {...S} />
      <Path d="M8.4 13v3.6" stroke={c} {...S} />
      <Path d="M5.4 16.8h6" stroke={c} {...S} />
    </>
  ),
  air_conditioned: (c) => (
    <>
      <Path d="M3.2 4.4h17.6v7.2H3.2z" stroke={c} {...S} />
      <Path d="M6.2 8.6h11.6" stroke={c} {...S} />
      <Path d="M7.4 14.6c0 1.6 1.1 2.1 1.1 3.6M12 14.6c0 1.6 1.1 2.1 1.1 3.6M16.6 14.6c0 1.6 1.1 2.1 1.1 3.6" stroke={c} {...S} />
    </>
  ),
};

const TICK: Glyph = (c) => (
  <Path d="M20 6L9 17l-5-5" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
);

/** Ordered catalogue — this is the list the owner picks from. */
export const AMENITY_CATALOGUE: { key: string; label: string }[] = [
  { key: 'washroom', label: 'Washrooms' },
  { key: 'parking', label: 'Parking' },
  { key: 'floodlights', label: 'Flood Lights' },
  { key: 'paid_beverages', label: 'Paid Beverages' },
  { key: 'paddles', label: 'Paddles' },
  { key: 'balls', label: 'Balls' },
  { key: 'drinking_water', label: 'Drinking Water' },
  { key: 'changing_room', label: 'Changing Room' },
  { key: 'shower', label: 'Showers' },
  { key: 'lockers', label: 'Lockers' },
  { key: 'seating', label: 'Seating' },
  { key: 'cafe', label: 'Café' },
  { key: 'rental_equipment', label: 'Rental Equipment' },
  { key: 'first_aid', label: 'First Aid' },
  { key: 'wifi', label: 'Wi-Fi' },
  { key: 'cctv', label: 'CCTV' },
  { key: 'air_conditioned', label: 'Air Conditioned' },
];

const LABELS: Record<string, string> = Object.fromEntries(
  AMENITY_CATALOGUE.map((a) => [a.key, a.label]),
);

const titleCase = (s: string) =>
  s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

export const amenityLabel = (key: string) => LABELS[key] ?? titleCase(key);

export function AmenityIcon({
  name,
  size = 18,
  color = YColors.accent,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const glyph = GLYPHS[name] ?? TICK;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {glyph(color)}
    </Svg>
  );
}
