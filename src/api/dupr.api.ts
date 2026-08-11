import apiClient from './client';
import type { DuprSsoResult } from '../utils/dupr-host-bridge';

export type DuprLinkResponse = {
  duprId: string;
  fullName: string;
};

export type DuprRatings = {
  singles?: string | number | null;
  doubles?: string | number | null;
  singlesReliability?: number | null;
  doublesReliability?: number | null;
};

export type DuprSnapshot = {
  fullName?: string;
  ratings?: DuprRatings;
  [key: string]: any;
};

export type DuprMeResponse = {
  linked: boolean;
  duprId?: string | null;
  snapshot?: DuprSnapshot | null;
  entitlements?: string[] | null;
};

export const linkDupr = (payload: DuprSsoResult) =>
  apiClient.post<DuprLinkResponse>('/dupr/link', payload);

export const getDuprMe = () => apiClient.get<DuprMeResponse>('/dupr/me');

export const unlinkDupr = () => apiClient.post<{ ok: true }>('/dupr/unlink');

export type DuprAdminClub = {
  clubId: number;
  clubName: string;
  role: 'DIRECTOR' | 'ORGANIZER';
};

export type DuprAdminClubsResponse = {
  /** false → the user hasn't connected DUPR yet (prompt them to connect). */
  connected: boolean;
  /** DUPR clubs where the user is a DIRECTOR/ORGANIZER — empty ⇒ show apply CTA. */
  clubs: DuprAdminClub[];
};

/** Live list of clubs the current user can submit results under (never cached). */
export const getMyDuprAdminClubs = () =>
  apiClient.get<DuprAdminClubsResponse>('/dupr/my-admin-clubs');

/** Attach a DUPR club to a tournament (server re-verifies the role live). */
export const enableTournamentDupr = (tournamentId: string, clubId: number) =>
  apiClient.post<{ ok: true; duprClubId: number }>(
    `/dupr/tournaments/${tournamentId}/enable`,
    { clubId },
  );

/** Detach DUPR from a tournament. */
export const disableTournamentDupr = (tournamentId: string) =>
  apiClient.post<{ ok: true }>(`/dupr/tournaments/${tournamentId}/disable`);

// ── Co-owner invites (Option B) ──────────────────────────────────────

export type DuprInvite = {
  id: string;
  tournamentId: string;
  tournamentName: string | null;
  createdAt: string;
};

export type DuprTournamentInvite = {
  id: string;
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  clubId: number | null;
  invitee: { name: string | null; duprLinked: boolean };
  createdAt: string;
  respondedAt: string | null;
};

/** Organizer invites a co-owner (existing Yoiden user) by email or phone. */
export const inviteDuprCoOwner = (
  tournamentId: string,
  who: { email?: string; phone?: string },
) => apiClient.post<{ ok: true; inviteId: string }>(`/dupr/tournaments/${tournamentId}/invite`, who);

/** Pending co-owner invites addressed to the current user. */
export const getMyDuprInvites = () => apiClient.get<DuprInvite[]>('/dupr/invites');

/** Accept an invite under one of your DUPR clubs (server re-verifies the role live). */
export const acceptDuprInvite = (inviteId: string, clubId: number) =>
  apiClient.post<{ ok: true; tournamentId: string; duprClubId: number }>(
    `/dupr/invites/${inviteId}/accept`,
    { clubId },
  );

/** Decline a co-owner invite. */
export const declineDuprInvite = (inviteId: string) =>
  apiClient.post<{ ok: true }>(`/dupr/invites/${inviteId}/decline`);

/** Organizer/authorizer view of all invites + statuses for a tournament. */
export const getTournamentDuprInvites = (tournamentId: string) =>
  apiClient.get<DuprTournamentInvite[]>(`/dupr/tournaments/${tournamentId}/invites`);

/** Inviting organizer revokes a pending invite. */
export const revokeDuprInvite = (inviteId: string) =>
  apiClient.post<{ ok: true }>(`/dupr/invites/${inviteId}/revoke`);
