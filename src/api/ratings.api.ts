import apiClient from './client';

export const ratingsApi = {
  getMyRatings: () =>
    apiClient.get('/my/ratings'),

  getMyRatingHistory: (format?: 'singles' | 'doubles', limit = 50) =>
    apiClient.get('/my/rating-history', { params: { format, limit } }),

  getPlayerRatings: (userId: string) =>
    apiClient.get(`/players/${userId}/ratings`),

  getLeaderboard: (format: 'singles' | 'doubles' = 'doubles', limit = 50) =>
    apiClient.get('/leaderboard', { params: { format, limit } }),
};
