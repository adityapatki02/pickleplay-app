import apiClient from './client';
import { ApiResponse } from '../types';
import { Booking, CreateBookingInput, CreateBookingResult } from '../types/booking.types';

export const bookingsApi = {
  create: (data: CreateBookingInput) =>
    apiClient.post<CreateBookingResult>('/bookings', data),

  confirmPayment: (
    bookingId: string,
    data: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
  ) => apiClient.post<ApiResponse<Booking>>(`/bookings/${bookingId}/confirm-payment`, data),

  myBookings: () => apiClient.get<ApiResponse<Booking[]>>('/my/bookings'),

  getById: (bookingId: string) =>
    apiClient.get<ApiResponse<Booking>>(`/my/bookings/${bookingId}`),

  cancel: (bookingId: string) =>
    apiClient.post<ApiResponse<Booking>>(`/bookings/${bookingId}/cancel`),

  // Online payment failed/cancelled → keep the booking as confirmed pay-at-venue.
  switchToOffline: (bookingId: string) =>
    apiClient.post<ApiResponse<Booking>>(`/bookings/${bookingId}/switch-to-offline`),

  // Deliberate cancellation of a PAID booking with refund (only within the refund window —
  // before the held venue transfer releases). Backend returns 400 REFUND_WINDOW_CLOSED otherwise.
  refund: (bookingId: string) =>
    apiClient.post<ApiResponse<Booking>>(`/bookings/${bookingId}/refund`),
};
