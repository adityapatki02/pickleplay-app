import apiClient from './client';

export const registrationsApi = {
  register: (tournamentId: string, data: {
    categoryId: string;
    partnerId?: string;
    lookingForPartner?: boolean;
    paymentMethod?: 'online' | 'venue';
  }) => apiClient.post(`/tournaments/${tournamentId}/categories/${data.categoryId}/register`, data),

  cancel: (registrationId: string) =>
    apiClient.delete(`/registrations/${registrationId}`),

  getByTournament: (tournamentId: string) =>
    apiClient.get(`/tournaments/${tournamentId}/registrations`),

  updateStatus: (registrationId: string, status: string) =>
    apiClient.patch(`/registrations/${registrationId}/status`, { status }),

  getMyRegistrations: () =>
    apiClient.get('/my/registrations'),
};
