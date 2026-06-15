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

  // Owner management
  create: (data: Partial<Venue>) => apiClient.post<ApiResponse<Venue>>('/venues', data),

  update: (id: string, data: Partial<Venue>) =>
    apiClient.patch<ApiResponse<Venue>>(`/venues/${id}`, data),

  addCourt: (venueId: string, data: Record<string, any>) =>
    apiClient.post<ApiResponse<any>>(`/venues/${venueId}/courts`, data),
};
