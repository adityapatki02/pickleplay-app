import apiClient from './client';

export type CasualSide = 'a' | 'b';

export interface CasualPlayerInput {
  userId?: string;
  name?: string;
  phone?: string;
  side: CasualSide;
}

export interface CasualGame {
  game: number;
  a: number;
  b: number;
}

export interface CasualMatchPlayer {
  id: string;
  userId: string | null;
  guestName: string | null;
  guestPhone: string | null;
  side: CasualSide;
  user?: { id: string; fullName?: string; displayName?: string; phone?: string } | null;
}

export interface CasualMatch {
  id: string;
  venueId: string | null;
  venueBookingId: string | null;
  sport: string;
  format: 'singles' | 'doubles';
  playedAt: string;
  durationMin: number | null;
  scores: CasualGame[];
  winnerSide: CasualSide | null;
  players: CasualMatchPlayer[];
  venue?: { id: string; name: string } | null;
  mySide?: CasualSide | null;
}

export interface LogCasualMatchBody {
  venueBookingId?: string;
  venueId?: string;
  sport?: string;
  format?: 'singles' | 'doubles';
  playedAt?: string;
  durationMin?: number;
  players: CasualPlayerInput[];
  scores?: CasualGame[];
}

export const casualMatchesApi = {
  log: (data: LogCasualMatchBody) =>
    apiClient.post<{ success: boolean; data: CasualMatch }>('/casual-matches', data),

  amend: (id: string, data: LogCasualMatchBody) =>
    apiClient.patch<{ success: boolean; data: CasualMatch }>(`/casual-matches/${id}`, data),

  mine: (limit = 50) =>
    apiClient.get<{
      success: boolean;
      data: {
        matches: CasualMatch[];
        summary: { played: number; won: number; lost: number; winPct: number };
      };
    }>(`/casual-matches/mine?limit=${limit}`),

  byBooking: (bookingId: string) =>
    apiClient.get<{ success: boolean; data: CasualMatch | null }>(
      `/casual-matches/by-booking/${bookingId}`,
    ),
};
