import apiClient from './client';
import { User, ApiResponse } from '../types';

export interface VerifyOtpRequest {
  firebaseIdToken: string;
}

export interface VerifyOtpResponse {
  user: User;
  accessToken: string;
  isNewUser: boolean;
}

export interface UpdateProfileRequest {
  fullName?: string;
  displayName?: string;
  city?: string;
  state?: string;
  dateOfBirth?: string;
  gender?: string;
  bio?: string;
  selfReportedSkill?: string;
  avatarUrl?: string;
  whatsappOptedIn?: boolean;
}

export const authApi = {
  devLogin: (data: { email: string; password: string }) =>
    apiClient.post<ApiResponse<{ user: User; accessToken: string }>>('/auth/dev/login', data),

  devRegister: (data: { email: string; password: string; name: string; phone?: string; role?: string }) =>
    apiClient.post<ApiResponse<{ user: User; accessToken: string }>>('/auth/dev/register', data),

  phoneLogin: (data: { phone: string; pin: string }) =>
    apiClient.post<ApiResponse<{ user: User; accessToken: string }>>('/auth/phone/login', data),

  phoneRegister: (data: { phone: string; pin: string; name: string; role?: string }) =>
    apiClient.post<ApiResponse<{ user: User; accessToken: string }>>('/auth/phone/register', data),

  verifyOtp: (data: VerifyOtpRequest) =>
    apiClient.post<ApiResponse<VerifyOtpResponse>>('/auth/verify-otp', data),

  // Legacy widget-based reset (kept for backward compat, web-only)
  resetPin: (data: { accessToken: string; newPin: string }) =>
    apiClient.post<ApiResponse<{ user: User; accessToken: string }>>(
      '/auth/forgot-pin/reset',
      data,
    ),

  // Native OTP flow — step 1: send SMS OTP via MSG91
  sendForgotPinOtp: (data: { phone: string }) =>
    apiClient.post<ApiResponse<void>>('/auth/forgot-pin/send-otp', data),

  // Native OTP flow — step 2 NEXT: verify OTP early, receive short-lived reset token
  checkForgotPinOtp: (data: { phone: string; otp: string }) =>
    apiClient.post<ApiResponse<{ resetToken: string }>>(
      '/auth/forgot-pin/check-otp',
      data,
    ),

  // Native OTP flow — step 3: reset PIN using the reset token
  resetPinWithToken: (data: { resetToken: string; newPin: string }) =>
    apiClient.post<ApiResponse<{ user: User; accessToken: string }>>(
      '/auth/forgot-pin/reset-with-token',
      data,
    ),

  // Legacy: single-shot verify+reset (kept, no longer used by native screen)
  verifyAndResetPin: (data: { phone: string; otp: string; newPin: string }) =>
    apiClient.post<ApiResponse<{ user: User; accessToken: string }>>(
      '/auth/forgot-pin/verify-and-reset',
      data,
    ),

  getMe: () => apiClient.get<ApiResponse<User>>('/auth/me'),

  updateProfile: (data: UpdateProfileRequest) =>
    apiClient.put<ApiResponse<User>>('/auth/me', data),

  updateFcmToken: (fcmToken: string) =>
    apiClient.post('/auth/fcm-token', { fcmToken }),

  deleteAccount: () => apiClient.delete('/auth/me'),
};
