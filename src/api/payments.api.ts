import apiClient from './client';

export const paymentsApi = {
  createOrder: (registrationId: string) =>
    apiClient.post('/payments/create-order', { registrationId }),

  refund: (paymentId: string, reason?: string) =>
    apiClient.post(`/payments/${paymentId}/refund`, { reason }),
};
