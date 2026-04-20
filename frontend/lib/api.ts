/**
 * API client for backend communication
 */
import { showToast } from '../components/Toast';
import { fetchCapabilities, type ApiCapabilities } from './capabilities';
import { getApiUrl } from './config';

function apiBaseUrl(): string {
  return getApiUrl();
}

// Type definitions
/** Full profile row from `PUT /api/user` and `GET /api/user` (when a DB profile exists). */
export interface User {
  clerk_user_id: string;
  display_name?: string | null;
  years_until_retirement?: number | null;
  target_retirement_income?: number | string | null;
  asset_class_targets?: Record<string, number> | null;
  region_targets?: Record<string, number> | null;
}

/** Matches `GET /api/accounts` — account rows from DB. */
export interface Account {
  id: string;
  clerk_user_id: string;
  account_name: string;
  account_purpose?: string | null;
  cash_balance: number | string;
  cash_interest?: number | string;
}

export interface Position {
  id: string;
  account_id: string;
  symbol: string;
  quantity: number;
}

/** Row from `GET /api/jobs` / `GET /api/jobs/{id}` (snake_case from Postgres). */
export interface Job {
  id: string;
  clerk_user_id: string;
  job_type: string;
  status: string;
  request_payload?: Record<string, unknown>;
  report_payload?: Record<string, unknown>;
  charts_payload?: unknown;
  retirement_payload?: unknown;
  summary_payload?: Record<string, unknown>;
  error_message?: string | null;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
}

/** `POST /api/analyze` response. */
export interface AnalyzeQueuedResponse {
  job_id: string;
  message: string;
}

export interface ApiError {
  detail: string;
}

/**
 * Make an authenticated API request (for use with token)
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const base = apiBaseUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  // Handle JWT expiry (401 Unauthorized)
  if (response.status === 401) {
    showToast('error', 'Session expired. Please sign in again.');
    // Redirect to home page for re-authentication
    setTimeout(() => {
      window.location.href = '/';
    }, 2000);
    throw new Error('Session expired');
  }

  // Handle rate limiting (429 Too Many Requests)
  if (response.status === 429) {
    showToast('error', 'Too many requests. Please slow down.');
    throw new Error('Rate limited');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * API client factory - creates client with token
 */
export type { ApiCapabilities };

export function createApiClient(token: string) {
  return {
    capabilities: () => fetchCapabilities(),
    // User: GET returns `{ user_id, user? }`; PUT returns `{ user, created }`.
    user: {
      get: async () => {
        const r = await apiRequest<{ user?: User | null; created?: boolean; user_id?: string }>(
          '/api/user',
          token
        );
        if (r.user) return r.user;
        if (r.user_id) return { clerk_user_id: r.user_id } as User;
        throw new Error('Invalid user response');
      },
      update: async (data: Partial<User>) => {
        const r = await apiRequest<{ user: User; created: boolean }>('/api/user', token, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        return r.user;
      },
    },

    // Account endpoints
    accounts: {
      list: () => apiRequest<Account[]>('/api/accounts', token),
      create: (data: Partial<Account>) => apiRequest<Account>('/api/accounts', token, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
      update: (id: string, data: Partial<Account>) => apiRequest<Account>(`/api/accounts/${id}`, token, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
      positions: async (id: string) => {
        const r = await apiRequest<{ positions: Position[] }>(
          `/api/accounts/${id}/positions`,
          token
        );
        return r.positions;
      },
    },

    // Position endpoints
    positions: {
      create: (data: Partial<Position>) => apiRequest<Position>('/api/positions', token, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
      update: (id: string, data: Partial<Position>) => apiRequest<Position>(`/api/positions/${id}`, token, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
      delete: (id: string) => apiRequest<void>(`/api/positions/${id}`, token, {
        method: 'DELETE',
      }),
    },

    // Analysis endpoints
    analysis: {
      trigger: (data: Record<string, unknown> = {}) =>
        apiRequest<AnalyzeQueuedResponse>('/api/analyze', token, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
    },

    // Job endpoints
    jobs: {
      get: (id: string) => apiRequest<Job>(`/api/jobs/${id}`, token),
      list: async () => {
        const r = await apiRequest<{ jobs: Job[] }>('/api/jobs', token);
        return r.jobs;
      },
    },
  };
}

/**
 * Hook for making API calls from components
 */
export function useApiClient() {
  // This hook can be used in components with useAuth
  return {
    createClient: (token: string) => createApiClient(token),
  };
}