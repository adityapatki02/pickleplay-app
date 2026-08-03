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
