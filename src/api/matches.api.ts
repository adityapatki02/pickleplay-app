import apiClient from './client';

export const matchesApi = {
  generateDraw: (tournamentId: string, categoryId: string, teamOrder?: string[]) =>
    apiClient.post(`/tournaments/${tournamentId}/categories/${categoryId}/generate-draw`, { teamOrder }),

  getBracket: (tournamentId: string, categoryId: string) =>
    apiClient.get(`/tournaments/${tournamentId}/categories/${categoryId}/bracket`),

  getStandings: (tournamentId: string, categoryId: string) =>
    apiClient.get(`/tournaments/${tournamentId}/categories/${categoryId}/standings`),

  startMatch: (matchId: string) =>
    apiClient.patch(`/matches/${matchId}/start`),

  enterScore: (matchId: string, scores: { gameNumber: number; teamAScore: number; teamBScore: number }[]) =>
    apiClient.patch(`/matches/${matchId}/score`, { scores }),

  setWalkover: (matchId: string, winnerId: string, notes?: string) =>
    apiClient.patch(`/matches/${matchId}/status`, { status: 'walkover', winnerId, notes }),

  getMyMatches: (tournamentId: string) =>
    apiClient.get(`/tournaments/${tournamentId}/my-matches`),

  updateStatus: (matchId: string, dto: { status: string; winnerId?: string; notes?: string }) =>
    apiClient.patch(`/matches/${matchId}/status`, dto),

  getMatch: (matchId: string) =>
    apiClient.get(`/matches/${matchId}`),

  getAdvancingTeams: (tournamentId: string, categoryId: string) =>
    apiClient.get(`/tournaments/${tournamentId}/categories/${categoryId}/advancing-teams`),

  confirmAdvancing: (tournamentId: string, categoryId: string, teamIds: string[]) =>
    apiClient.post(`/tournaments/${tournamentId}/categories/${categoryId}/confirm-advancing`, { teamIds }),

  resetKnockout: (tournamentId: string, categoryId: string) =>
    apiClient.delete(`/tournaments/${tournamentId}/categories/${categoryId}/knockout`),

  startTournament: (
    tournamentId: string,
    settings: {
      matchDurationMin?: number;
      restBetweenMin?: number;
      pointsPerGame?: number;
      setsPerMatch?: number;
    },
  ) => apiClient.post(`/tournaments/${tournamentId}/start`, settings),

  regenerateDraw: (
    tournamentId: string,
    categoryId: string,
    assignments?: Record<string, number>,
  ) =>
    apiClient.post(
      `/tournaments/${tournamentId}/categories/${categoryId}/regenerate-draw`,
      { assignments },
    ),
};
