const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface User {
  id: string;
  username: string;
  email: string;
  ratingDSA: number;
  ratingDB: number;
  matchesPlayed: number;
  wins?: number;
  role: string;
  avatarUrl?: string;
  oauthProvider?: string;
}

export interface MatchHistoryEntry {
  matchId: string;
  problemId: string;
  category: string;
  difficulty: string;
  mode: string;
  status: string;
  phase: string;
  won?: boolean;
  isDraw: boolean;
  startTime: string;
  endTime?: string;
}

export interface AdminStats {
  totalUsers: number;
  activeMatches: number;
  totalProblems: number;
}

export interface ActiveMatch {
  matchId: string;
  problemId: string;
  category: string;
  difficulty: string;
  mode: string;
  phase: string;
  startTime: string;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  status: number;
  message: string;
  data?: T;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const json: APIResponse<T> = await res.json();
  if (!res.ok) throw new Error(json.message || 'Request failed');
  return json.data as T;
}

export const api = {
  register: (username: string, email: string, password: string) =>
    request<User>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    }),

  login: (login: string, password: string) =>
    request<{ user: User; accessToken: string; refreshToken: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    }),

  me: () => request<User>('/api/user/me'),

  getProfile: (username: string) =>
    request<{ user: User; matches: MatchHistoryEntry[] }>(`/api/user/profile/${username}`),

  getMyMatches: () => request<MatchHistoryEntry[]>('/api/user/me/matches'),

  getOAuthProviders: () =>
    request<{ google: boolean; github: boolean }>('/api/auth/oauth/providers'),

  joinQueue: (body: { category: string; difficulty: string; mode: string }) =>
    request<{ queue?: unknown; match?: Record<string, unknown>; inQueue: boolean }>(
      '/api/match/queue/join',
      { method: 'POST', body: JSON.stringify(body) }
    ),

  leaveQueue: () => request('/api/match/queue/leave', { method: 'POST' }),

  getPendingMatch: () =>
    request<Record<string, unknown> | null>('/api/match/pending'),

  getMatchDetails: (id: string) =>
    request<Record<string, unknown>>(`/api/match/${id}/details`),

  getMatch: (id: string) => request(`/api/match/${id}`),

  runCode: (matchId: string, code: string, language: string) =>
    request(`/api/submission/${matchId}/run`, {
      method: 'POST',
      body: JSON.stringify({ code, language }),
    }),

  submitCode: (matchId: string, code: string, language: string, prevCodeLen: number) =>
    request(`/api/submission/${matchId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ code, language, prevCodeLen }),
    }),

  listProblems: (category?: string) =>
    request(`/api/admin/problems${category ? `?category=${category}` : ''}`),

  createProblem: (problem: Record<string, unknown>) =>
    request('/api/admin/problems', { method: 'POST', body: JSON.stringify(problem) }),

  updateProblem: (id: string, problem: Record<string, unknown>) =>
    request(`/api/admin/problems/${id}`, { method: 'PUT', body: JSON.stringify(problem) }),

  deleteProblem: (id: string) =>
    request(`/api/admin/problems/${id}`, { method: 'DELETE' }),

  getTestCases: (problemId: string) =>
    request(`/api/admin/problems/${problemId}/testcases`),

  addTestCase: (problemId: string, tc: Record<string, unknown>) =>
    request(`/api/admin/problems/${problemId}/testcases`, {
      method: 'POST',
      body: JSON.stringify(tc),
    }),

  deleteTestCase: (problemId: string, tcId: string) =>
    request(`/api/admin/problems/${problemId}/testcases/${tcId}`, { method: 'DELETE' }),

  adminStats: () => request<AdminStats>('/api/admin/stats'),

  adminActiveMatches: () => request<ActiveMatch[]>('/api/admin/matches/active'),
};

export { API_URL };

export function oauthLoginUrl(provider: string) {
  return `${API_URL}/api/auth/oauth/${provider}`;
}
