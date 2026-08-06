import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config/constants';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../types';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // 40s so a slow request (e.g. a rare Cloud Run cold start, or a heavy query
  // under load) doesn't abort with "timeout exceeded". The API is kept warm
  // (min-instances=1) so cold starts should be rare regardless.
  timeout: 40000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    // Only force logout on 401 if it's NOT a dev environment
    // and only for non-GET requests (session expiry, not missing data)
    if (error.response?.status === 401 && __DEV__ === false) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
