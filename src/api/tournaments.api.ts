import apiClient from './client';
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

  list: (params?: {
    city?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => apiClient.get<PaginatedResponse<Tournament>>('/tournaments', { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Tournament>>(`/tournaments/${id}`),

  getBySlug: (slug: string) =>
    apiClient.get<ApiResponse<Tournament>>(`/tournaments/${slug}`),

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
