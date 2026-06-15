/**
 * Frontend-only demo venue — Cidco Padel Arena.
 * Prices are kept at ₹1/₹2 for testing. Orders go through razorpay-mock (localhost:4000).
 */

import type { Venue, CourtAvailability } from '../types/booking.types';

export const DEMO_VENUE_ID = 'demo-cidco-padel';

// Mock server court IDs (razorpay-mock/db.js courts 6 & 7)
export const DEMO_MOCK_COURT: Record<string, number> = {
  'demo-court-1': 6,
  'demo-court-2': 7,
};

// ── Venue detail shape (used by VenueDetailScreen) ───────────────────────────
export const DEMO_VENUE: Venue = {
  id: DEMO_VENUE_ID,
  name: 'Cidco Padel Arena',
  slug: 'cidco-padel-arena',
  address: 'Plot 14, N-6, Cidco Colony',
  city: 'Chhatrapati Sambhaji Nagar',
  state: 'Maharashtra',
  neighbourhood: 'Cidco N-6',
  openTime: '06:00',
  closeTime: '22:00',
  timezone: 'Asia/Kolkata',
  sports: ['padel'],
  status: 'active',
  isFeatured: true,
  contactPhone: '+91 98765 43210',
  photos: [{ url: 'https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?w=640&fit=crop&q=80' }],
  courts: [
    {
      id: 'demo-court-1',
      venueId: DEMO_VENUE_ID,
      name: 'Court 1',
      sport: 'padel',
      slotDurationMin: 60,
      basePrice: 1,
      peakPrice: 2,
      peakWindows: [{ start: '17:00', end: '21:00' }],
      isActive: true,
      displayOrder: 0,
    },
    {
      id: 'demo-court-2',
      venueId: DEMO_VENUE_ID,
      name: 'Court 2',
      sport: 'padel',
      slotDurationMin: 60,
      basePrice: 1,
      peakPrice: 2,
      peakWindows: [{ start: '17:00', end: '21:00' }],
      isActive: true,
      displayOrder: 1,
    },
  ],
};

// ── Slot helpers ─────────────────────────────────────────────────────────────
const slot = (
  startH: number,
  available: boolean,
): { startTime: string; endTime: string; isPeak: boolean; price: number; available: boolean } => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const isPeak = startH >= 17 && startH < 21;
  return {
    startTime: `${pad(startH)}:00`,
    endTime: `${pad(startH + 1)}:00`,
    isPeak,
    price: isPeak ? 2 : 1,
    available,
  };
};

// ── Availability (used by VenueDetailScreen) — realistic pattern ──────────────
// Court 1: 11 AM and 5 PM already booked
// Court 2: 9 AM, 1 PM, and 6 PM already booked
export const DEMO_AVAILABILITY: CourtAvailability[] = [
  {
    court: DEMO_VENUE.courts![0] as any,
    chunks: [
      slot(6,  true),
      slot(7,  true),
      slot(8,  true),
      slot(9,  true),
      slot(10, true),
      slot(11, false),
      slot(12, true),
      slot(13, true),
      slot(14, true),
      slot(15, true),
      slot(16, true),
      slot(17, false),
      slot(18, true),
      slot(19, true),
      slot(20, true),
      slot(21, true),
    ],
  },
  {
    court: DEMO_VENUE.courts![1] as any,
    chunks: [
      slot(6,  true),
      slot(7,  true),
      slot(8,  true),
      slot(9,  false),
      slot(10, true),
      slot(11, true),
      slot(12, true),
      slot(13, false),
      slot(14, true),
      slot(15, true),
      slot(16, true),
      slot(17, true),
      slot(18, false),
      slot(19, true),
      slot(20, true),
      slot(21, true),
    ],
  },
];
