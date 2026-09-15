import apiClient from './client';
import type { ApiResponse } from '../types/api.types';

export type WalletTxnType = 'promo_credit' | 'redemption' | 'reversal' | 'expiry';

export interface WalletTxn {
  id: string;
  amount: string;
  type: WalletTxnType;
  reason: string | null;
  bookingId: string | null;
  createdAt: string;
}

export interface WalletQuote {
  balance: number;
  venueCap: number;
  /** What this player can actually apply to this booking, already clamped. */
  redeemable: number;
  /** False when the venue does not accept wallet credit at all. */
  accepted: boolean;
}

export const walletApi = {
  mine: () =>
    apiClient.get<ApiResponse<{ balance: number; history: WalletTxn[] }>>('/wallet'),

  quote: (venueId: string, amount: number) =>
    apiClient.get<ApiResponse<WalletQuote>>('/wallet/quote', {
      params: { venueId, amount },
    }),

  venueSettlements: (venueId: string) =>
    apiClient.get<
      ApiResponse<{
        outstanding: number;
        outstandingBookings: number;
        settlements: {
          id: string;
          amount: string;
          bookingCount: number;
          status: 'pending' | 'paid';
          reference: string | null;
          paidAt: string | null;
          createdAt: string;
        }[];
      }>
    >(`/venues/${venueId}/wallet-settlements`),
};
