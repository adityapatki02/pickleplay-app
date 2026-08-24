import apiClient from './client';
import { ApiResponse } from '../types';
import { Venue, AvailabilityResponse, QuoteResponse } from '../types/booking.types';

export const venuesApi = {
  // Public discovery
  list: (params?: { city?: string; sport?: string; q?: string; lat?: number; lng?: number; page?: number; limit?: number }) =>
    apiClient.get<{ success: boolean; data: Venue[]; total: number; page: number; limit: number }>(
      '/venues',
      { params },
    ),

  getById: (id: string) => apiClient.get<ApiResponse<Venue>>(`/venues/${id}`),

  getAvailability: (id: string, date: string, courtId?: string) =>
    apiClient.get<ApiResponse<AvailabilityResponse>>(`/venues/${id}/availability`, {
      params: { date, ...(courtId ? { courtId } : {}) },
    }),

  quote: (id: string, startTime: string, durationMin: number, courtCount = 1) =>
    apiClient.get<ApiResponse<QuoteResponse>>(`/venues/${id}/quote`, {
      params: { startTime, durationMin, courtCount },
    }),

  getMyVenue: () => apiClient.get<ApiResponse<Venue | null>>('/venues/my-venue'),

  getMyVenues: () => apiClient.get<{ success: boolean; data: Venue[] }>('/venues/my-venues'),

  getVenueBookings: (venueId: string, limit = 50, offset = 0) =>
    apiClient.get<{ success: boolean; data: any[]; total: number }>(`/venues/${venueId}/owner-bookings`, {
      params: { limit, offset },
    }),

  getAnalytics: (venueId: string, params?: { month?: string; days?: number; daypart?: string }) =>
    apiClient.get<{ success: boolean; data: any }>(`/venues/${venueId}/analytics`, {
      params: params || {},
    }),

  getHeatmap: (venueId: string, params?: { courtId?: string; weeks?: number; dayType?: string; daypart?: string }) =>
    apiClient.get<{ success: boolean; data: any }>(`/venues/${venueId}/analytics/heatmap`, {
      params: params || {},
    }),

  markBookingPaid: (venueId: string, bookingId: string, amount?: number) =>
    apiClient.patch<{ success: boolean }>(`/venues/${venueId}/bookings/${bookingId}/pay`, { amount }),

  createManualBooking: (
    venueId: string,
    data: { courtId: string; bookingDate: string; startTime: string; endTime: string; guestName: string; guestPhone?: string; amount: number; paymentStatus: 'paid' | 'pending' },
  ) => apiClient.post<{ success: boolean; data: any }>(`/venues/${venueId}/admin-bookings`, data),

  cancelBooking: (venueId: string, bookingId: string, reason: string) =>
    apiClient.patch<{ success: boolean }>(`/venues/${venueId}/bookings/${bookingId}/cancel`, { reason }),

  markNoShow: (venueId: string, bookingId: string, noShow = true) =>
    apiClient.patch<{ success: boolean }>(`/venues/${venueId}/bookings/${bookingId}/no-show`, { noShow }),

  // Check a player in (or undo) — marks the slot as *played* + optional head-count.
  checkInBooking: (venueId: string, bookingId: string, opts?: { checkedIn?: boolean; playersCount?: number }) =>
    apiClient.patch<{ success: boolean }>(`/venues/${venueId}/bookings/${bookingId}/check-in`, {
      checkedIn: opts?.checkedIn ?? true,
      ...(opts?.playersCount != null ? { playersCount: opts.playersCount } : {}),
    }),

  rescheduleBooking: (venueId: string, bookingId: string, date: string, startTime: string, endTime: string, courtId?: string) =>
    apiClient.patch<{ success: boolean }>(`/venues/${venueId}/bookings/${bookingId}/reschedule`, {
      date, startTime, endTime, courtId,
    }),

  // Owner management
  create: (data: Partial<Venue>) => apiClient.post<ApiResponse<Venue>>('/venues', data),

  update: (id: string, data: Partial<Venue>) =>
    apiClient.patch<ApiResponse<Venue>>(`/venues/${id}`, data),

  addCourt: (venueId: string, data: Record<string, any>) =>
    apiClient.post<ApiResponse<any>>(`/venues/${venueId}/courts`, data),
};
