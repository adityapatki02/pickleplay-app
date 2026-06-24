// Court-booking types — mirror the Yoiden API bookings module (RallyHive parity:
// 30-min chunks, range bookings, 1-or-2 court selection, per-chunk pricing).

export interface VenueCourt {
  id: string;
  venueId: string;
  name: string;
  sport?: string | null;
  surfaceType?: string | null;
  slotDurationMin: number;
  openTime: string;
  closeTime: string;
  openDays?: number[] | null;
  basePrice: number | string; // off-peak price per 30-min chunk
  peakPrice?: number | string | null; // peak price per 30-min chunk
  peakWindows?: { start: string; end: string }[] | null;
  isActive: boolean;
  displayOrder: number;
}

export interface Venue {
  id: string;
  ownerId?: string;
  name: string;
  slug: string;
  description?: string | null;
  address: string;
  lat?: number | null;
  lng?: number | null;
  city: string;
  state?: string | null;
  neighbourhood?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  photos?: { url: string; caption?: string }[] | string[] | null;
  amenities?: string[] | null;
  sports?: string[];
  rating?: number | null;
  reviewCount?: number | null;
  distanceKm?: number | null;
  openTime: string;
  closeTime: string;
  timezone: string;
  status: string;
  isFeatured: boolean;
  isSponsored?: boolean;
  courts?: VenueCourt[];
}

// One 30-min chunk on a court.
export interface ChunkView {
  startTime: string;
  endTime: string;
  isPeak: boolean;
  price: number; // price for this single 30-min chunk
  available: boolean;
}

export interface CourtAvailability {
  court: VenueCourt;
  chunks: ChunkView[];
}

export interface AvailabilityResponse {
  date: string;
  slotDurationMin: number;
  courts: CourtAvailability[];
}

export interface QuoteResponse {
  amount: number;
  courtCount: number;
  chunks: number;
  isPeak: boolean;
}

export type BookingChannel = 'online' | 'offline';
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export interface BookingUser {
  id: string;
  displayName?: string | null;
  fullName?: string | null;
  phone?: string | null;
}

export interface Booking {
  id: string;
  venueId: string;
  courtId?: string | null;
  courtCount: number;
  courtLabel?: string | null;
  userId?: string | null;
  user?: BookingUser | null;
  guestName?: string | null;
  guestPhone?: string | null;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  paymentStatus: 'unpaid' | 'pending' | 'paid' | 'refunded' | 'failed';
  channel: BookingChannel;
  isPeak: boolean;
  amount: number | string;
  currency: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  invoiceNumber?: string | null;
  venue?: Venue;
  court?: VenueCourt;
}

export interface BookingCell {
  courtId: string;
  startTime: string; // 'HH:MM' start of a 30-min chunk
}

export interface CreateBookingInput {
  venueId: string;
  date: string;
  // Any mix of courts/times — sequential, overlapping, or different per court.
  cells: BookingCell[];
  channel?: BookingChannel;
  guestName?: string;
  guestPhone?: string;
  promoCode?: string;
  notes?: string;
}

export interface CreateBookingResult {
  success: boolean;
  booking: Booking;
  payment?: {
    orderId: string;
    amount: number;
    currency: string;
    key: string;
  };
}
