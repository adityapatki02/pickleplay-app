import apiClient from './client';

export interface IndoorEntrant { id: string; name: string; dept: string; isDraft: boolean; }
export interface IndoorMatch {
  id: string; groupId: string; round: number; idx: number; board: number | null;
  entrantAId: string | null; entrantBId: string | null; winnerEntrantId: string | null; status: string;
  scoreA: number | null; scoreB: number | null;
}
export interface IndoorGroup { id: string; label: string; size: number; entrantCount: number; }
export interface IndoorCompetition {
  id: string; game: string; eventName: string; type: string; gender: string;
  entrantCount: number; isDraft: boolean; displayOrder: number;
}

export const indoorApi = {
  overview: (eventId: string) =>
    apiClient.get(`/indoor/events/${eventId}`).then(r => r.data.data),
  competition: (competitionId: string) =>
    apiClient.get(`/indoor/competitions/${competitionId}`).then(r => r.data.data) as Promise<{
      competition: IndoorCompetition; groups: IndoorGroup[]; entrants: IndoorEntrant[]; matches: IndoorMatch[];
    }>,
  submit: (matchId: string, winnerEntrantId: string, passcode: string, scoreA?: number, scoreB?: number) =>
    apiClient.post(`/indoor/matches/${matchId}/result`, { winnerEntrantId, scoreA, scoreB, passcode },
      { headers: { 'x-scorer-pass': passcode } }).then(r => r.data.data),
  clear: (matchId: string, passcode: string) =>
    apiClient.post(`/indoor/matches/${matchId}/clear`, { passcode },
      { headers: { 'x-scorer-pass': passcode } }).then(r => r.data.data),
};
