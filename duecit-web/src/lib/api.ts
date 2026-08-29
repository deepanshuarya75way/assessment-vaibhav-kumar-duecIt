const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Mirrors internal/models.ParamType / InputVar / FuncSignature on the backend.
// Keep these in sync with judge/wrapper.go + judge/starter.go's supported types.
export type ParamType = 'int' | 'float' | 'bool' | 'string' | 'int[]' | 'float[]' | 'string[]';

export const PARAM_TYPES: ParamType[] = ['int', 'float', 'bool', 'string', 'int[]', 'float[]', 'string[]'];

export interface InputVar {
  name: string;
  type: ParamType;
  lengthVar?: string;
  passToFunc: boolean;
}

export interface FuncSignature {
  funcName: string;
  params: string[];
  returnType: ParamType;
}

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

export interface AdminUserRow {
  id: string;
  username: string;
  email: string;
  role: string;
  ratingDSA: number;
  ratingDB: number;
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string | null;
  isOnline: boolean;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface UsageStats {
  days: number;
  registrationsDaily: DailyCount[];
  matchesDaily: DailyCount[];
  submissionsDaily: DailyCount[];
  usersByRole: Record<string, number>;
  matchesByStatus: Record<string, number>;
  problemsByDifficulty: Record<string, number>;
}

export interface QueueDifficultyStats {
  difficulty: string;
  totalQueued: number;
  competitiveQueued: number;
  practiceQueued: number;
  estimatedWaitSec: number;
  practiceBotTimeoutSec: number;
}

export interface QueueStats {
  category: string;
  totalQueued: number;
  byDifficulty: QueueDifficultyStats[];
}

export interface ProblemImportItemResult {
  problemId: string;
  title: string;
  status: 'created' | 'overwritten' | 'skipped' | 'failed';
  testCases: number;
  error?: string;
}

export interface ProblemImportResult {
  created: number;
  overwritten: number;
  skipped: number;
  failed: number;
  items: ProblemImportItemResult[];
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

  // A truly empty body (backend crashed mid-request, gateway timeout, proxy
  // cut the connection, etc.) makes res.json() throw a cryptic "Unexpected
  // end of JSON input" with no indication of what actually happened. Read as
  // text first so we can surface something a person can act on instead.
  const raw = await res.text();
  let json: APIResponse<T> | null = null;
  if (raw) {
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error(
        `Server returned an unreadable response (status ${res.status}). This usually means the backend crashed or timed out - check server logs.`
      );
    }
  }
  if (!json) {
    throw new Error(
      `Server returned an empty response (status ${res.status}). This usually means the backend crashed or timed out - check server logs.`
    );
  }
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

  forgotPassword: (email: string) =>
    request<void>('/api/auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<void>('/api/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
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

  getActiveMatch: () =>
    request<Record<string, unknown> | null>('/api/match/active'),

  getQueueStatus: () =>
    request<{ entry: Record<string, unknown>; position: number }>('/api/match/queue/status'),

  getQueueStats: (category = 'dsa') =>
    request<QueueStats>(`/api/match/queue/stats?category=${encodeURIComponent(category)}`),

  getMatchDetails: (id: string) =>
    request<Record<string, unknown>>(`/api/match/${id}/details`),

  getMatchResult: (id: string) =>
    request<Record<string, unknown>>(`/api/match/${id}/result`),

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

  importProblems: (mode: 'skip' | 'overwrite', problems: Record<string, unknown>[]) =>
    request<ProblemImportResult>('/api/admin/problems/import', {
      method: 'POST',
      body: JSON.stringify({ mode, problems }),
    }),

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

  adminUsers: (limit = 100) => request<AdminUserRow[]>(`/api/admin/users?limit=${limit}`),

  adminUsageStats: (days = 14) => request<UsageStats>(`/api/admin/usage-stats?days=${days}`),
};

export { API_URL };

export function oauthLoginUrl(provider: string) {
  return `${API_URL}/api/auth/oauth/${provider}`;
}
