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

  getMe: () => apiClient.get<ApiResponse<User>>('/auth/me'),

  updateProfile: (data: UpdateProfileRequest) =>
    apiClient.put<ApiResponse<User>>('/auth/me', data),

  updateFcmToken: (fcmToken: string) =>
    apiClient.post('/auth/fcm-token', { fcmToken }),

  deleteAccount: () => apiClient.delete('/auth/me'),
};
