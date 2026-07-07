import { Platform } from 'react-native';
import apiClient from './client';
import { API_BASE_URL } from '../config/constants';
import { useAuthStore } from '../store/authStore';
import {
  Tournament,
  TournamentCategory,
  Court,
  CreateTournamentInput,
  CreateCategoryInput,
  ApiResponse,
  PaginatedResponse,
} from '../types';

export const tournamentsApi = {
  // Tournaments
  create: (data: CreateTournamentInput) =>
    apiClient.post<ApiResponse<Tournament>>('/tournaments', data),

  getMyTournaments: () =>
    apiClient.get<ApiResponse<Tournament[]>>('/my/tournaments'),

  list: (params?: {
    city?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => apiClient.get<PaginatedResponse<Tournament>>('/tournaments', { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Tournament>>(`/tournaments/${id}`),

  // Public tournament page (kiosk + /t/:slug). Drafts 404.
  getPublicBySlug: (slug: string) =>
    apiClient.get<ApiResponse<Tournament>>(`/public/tournaments/${slug}`),

  // Public entrants list for one category (omit categoryId → first category).
  getPublicEntrants: (slug: string, categoryId?: string) =>
    apiClient.get<ApiResponse<{
      entrants: { name: string; seed: number | null; status: string; registeredAt: string }[];
      confirmedCount: number;
      pendingCount: number;
    }>>(`/public/events/${slug}/entrants`, {
      params: categoryId ? { categoryId } : undefined,
    }),

  /**
   * Multipart banner upload. Uses fetch (not the axios instance) so the
   * runtime sets the multipart boundary itself — axios's instance-level
   * `Content-Type: application/json` default would corrupt FormData posts.
   */
  uploadBanner: async (
    tournamentId: string,
    file: { uri: string; name: string; type: string },
  ): Promise<string> => {
    const form = new FormData();
    if (Platform.OS === 'web') {
      const blob = await (await fetch(file.uri)).blob();
      form.append('file', new File([blob], file.name, { type: file.type }));
    } else {
      form.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
    }
    const token = useAuthStore.getState().token;
    const res = await fetch(`${API_BASE_URL}/tournaments/${tournamentId}/banner`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      throw new Error(json?.message || `Banner upload failed (${res.status})`);
    }
    return json.data.bannerUrl as string;
  },

  removeBanner: (tournamentId: string) =>
    apiClient.delete(`/tournaments/${tournamentId}/banner`),

  update: (id: string, data: Partial<CreateTournamentInput>) =>
    apiClient.put<ApiResponse<Tournament>>(`/tournaments/${id}`, data),

  delete: (id: string) => apiClient.delete(`/tournaments/${id}`),

  clone: (id: string) =>
    apiClient.post<ApiResponse<Tournament>>(`/tournaments/${id}/clone`),

  publish: (id: string) =>
    apiClient.post<ApiResponse<Tournament>>(`/tournaments/${id}/publish`),

  getDashboard: (id: string) =>
    apiClient.get(`/tournaments/${id}/dashboard`),

  getRevenue: (id: string) =>
    apiClient.get(`/tournaments/${id}/revenue`),

  // Categories
  addCategory: (tournamentId: string, data: CreateCategoryInput) =>
    apiClient.post<ApiResponse<TournamentCategory>>(
      `/tournaments/${tournamentId}/categories`,
      data
    ),

  listCategories: (tournamentId: string) =>
    apiClient.get<ApiResponse<TournamentCategory[]>>(
      `/tournaments/${tournamentId}/categories`
    ),

  updateCategory: (id: string, data: Partial<CreateCategoryInput>) =>
    apiClient.put<ApiResponse<TournamentCategory>>(`/categories/${id}`, data),

  deleteCategory: (id: string) => apiClient.delete(`/categories/${id}`),

  // Courts
  addCourt: (tournamentId: string, data: { name: string; surfaceType?: string }) =>
    apiClient.post<ApiResponse<Court>>(
      `/tournaments/${tournamentId}/courts`,
      data
    ),

  listCourts: (tournamentId: string) =>
    apiClient.get<ApiResponse<Court[]>>(`/tournaments/${tournamentId}/courts`),

  updateCourt: (id: string, data: Partial<Court>) =>
    apiClient.put<ApiResponse<Court>>(`/courts/${id}`, data),

  deleteCourt: (id: string) => apiClient.delete(`/courts/${id}`),

  // Discovery
  discover: (params?: {
    city?: string;
    startDate?: string;
    endDate?: string;
    minFee?: number;
    maxFee?: number;
    page?: number;
    limit?: number;
  }) => apiClient.get<PaginatedResponse<Tournament>>('/discover/tournaments', { params }),

  discoverNearby: (params: {
    lat: number;
    lng: number;
    radiusKm?: number;
  }) => apiClient.get<PaginatedResponse<Tournament>>('/discover/nearby', { params }),

  changeStatus: (id: string, status: string) =>
    apiClient.patch<ApiResponse<Tournament>>(`/tournaments/${id}/status`, { status }),
};
