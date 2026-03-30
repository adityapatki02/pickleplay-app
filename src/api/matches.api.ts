import apiClient from './client';

export const matchesApi = {
  generateDraw: (tournamentId: string, categoryId: string) =>
    apiClient.post(`/tournaments/${tournamentId}/categories/${categoryId}/generate-draw`),

  getBracket: (tournamentId: string, categoryId: string) =>
    apiClient.get(`/tournaments/${tournamentId}/categories/${categoryId}/bracket`),

  getStandings: (tournamentId: string, categoryId: string) =>
    apiClient.get(`/tournaments/${tournamentId}/categories/${categoryId}/standings`),

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
};
