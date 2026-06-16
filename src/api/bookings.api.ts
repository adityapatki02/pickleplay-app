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
};
