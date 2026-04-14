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

  manualRegister: (tournamentId: string, categoryId: string, data: {
    name: string;
    phone?: string;
    partnerName?: string;
    partnerPhone?: string;
    paymentMethod?: string;
  }) => apiClient.post(`/tournaments/${tournamentId}/categories/${categoryId}/manual-register`, data),

  removeRegistration: (tournamentId: string, registrationId: string) =>
    apiClient.delete(`/tournaments/${tournamentId}/registrations/${registrationId}`),

  mergeRegistrations: (tournamentId: string, categoryId: string, registrationId1: string, registrationId2: string) =>
    apiClient.post(`/tournaments/${tournamentId}/categories/${categoryId}/merge-registrations`, {
      registrationId1,
      registrationId2,
    }),

  editRegistration: (tournamentId: string, registrationId: string, data: {
    playerName?: string;
    playerPhone?: string;
    partnerName?: string;
    partnerPhone?: string;
  }) => apiClient.patch(`/tournaments/${tournamentId}/registrations/${registrationId}`, data),

  // Check-in
  checkIn: (tournamentId: string) =>
    apiClient.post(`/tournaments/${tournamentId}/check-in`),

  getCheckInStatus: (tournamentId: string) =>
    apiClient.get(`/tournaments/${tournamentId}/check-in-status`),

  checkInTeam: (tournamentId: string, teamOrRegId: string) =>
    apiClient.post(`/tournaments/${tournamentId}/check-in/${teamOrRegId}`),

  generateCheckInTokens: (tournamentId: string) =>
    apiClient.post(`/tournaments/${tournamentId}/generate-check-in-tokens`),
};
