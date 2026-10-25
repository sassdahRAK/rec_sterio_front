/**
 * Typed fetch wrapper for the recsterio API.
 *
 * - Adds `Authorization: Bearer <token>` to every request that carries one.
 * - Unwraps the frozen error envelope `{ error: { code, message, details } }`
 *   into an `ApiError` so no raw payload or stack trace ever reaches the UI.
 * - A 401 clears the session and sends the operator back to the login screen.
 */
import { mockRequest } from './mock';
import type {
  CreateMergeRequest,
  ErrorDetail,
  GenerateTranscriptRequest,
  GenerateTranscriptResponse,
  Job,
  JobListQuery,
  ListResponse,
  LoginRequest,
  LoginResponse,
  Merge,
  Paginated,
  Segment,
  Stats,
  Transcript,
  UpdateTranscriptRequest,
  Video,
  VideoDetail,
  VideoListQuery,
} from './types';

export const API_BASE: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ||
  'http://localhost:8000/api/v1';

export const TOKEN_STORAGE_KEY = 'recsterio.admin.token';
export const EMAIL_STORAGE_KEY = 'recsterio.admin.email';
export const EXPIRES_STORAGE_KEY = 'recsterio.admin.expires';
export const MOCK_STORAGE_KEY = 'recsterio.admin.mock';

/** Emitted when the API rejects our token so the app can drop the session. */
export const UNAUTHORIZED_EVENT = 'recsterio:unauthorized';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: ErrorDetail[] | Record<string, unknown> | null;

  constructor(code: string, message: string, status: number, details: ApiError['details'] = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/* ------------------------------------------------------------- mock toggle */

export function isMockEnabled(): boolean {
  const fromEnv = String(import.meta.env.VITE_USE_MOCK ?? '') === '1';
  if (fromEnv) return true;
  try {
    return localStorage.getItem(MOCK_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMockEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(MOCK_STORAGE_KEY, '1');
    else localStorage.removeItem(MOCK_STORAGE_KEY);
  } catch {
    /* storage unavailable — ignore */
  }
}

/* ----------------------------------------------------------------- tokens */

export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const s = search.toString();
  return s ? `?${s}` : '';
}

/* --------------------------------------------------------------- request */

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const query = options.query ? buildQuery(options.query) : '';
  const fullPath = `${path}${query}`;

  if (isMockEnabled()) {
    const result = mockRequest(method, fullPath, options.body);
    if (result.status >= 400) throw toApiError(result.status, result.data);
    return result.data as T;
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false) {
    const token = readToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${fullPath}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(
      'network_error',
      'Could not reach the recsterio API. Check that the backend is running.',
      0,
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    throw toApiError(response.status, payload);
  }

  return payload as T;
}

function toApiError(status: number, payload: unknown): ApiError {
  const envelope = payload as { error?: { code?: string; message?: string; details?: unknown } } | null;
  const code = envelope?.error?.code ?? `http_${status}`;
  const message =
    envelope?.error?.message ??
    (status === 404 ? 'The requested resource was not found.' : 'The request failed.');
  const details = (envelope?.error?.details as ApiError['details']) ?? null;
  return new ApiError(code, message, status, details);
}

/* ------------------------------------------------------------------- auth */

export const authApi = {
  login: (credentials: LoginRequest): Promise<LoginResponse> =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: credentials, auth: false }),
};

/* ------------------------------------------------------------------ stats */

export const statsApi = {
  get: (): Promise<Stats> => request<Stats>('/stats'),
};

/* ----------------------------------------------------------------- videos */

export const videosApi = {
  list: (query: VideoListQuery = {}): Promise<Paginated<Video>> =>
    request<Paginated<Video>>('/videos', { query: { ...query } }),

  get: (id: string): Promise<VideoDetail> => request<VideoDetail>(`/videos/${id}`),

  remove: (id: string): Promise<void> => request<void>(`/videos/${id}`, { method: 'DELETE' }),

  retry: (id: string): Promise<Job> => request<Job>(`/videos/${id}/retry`, { method: 'POST' }),

  patch: (id: string, body: Partial<Pick<Video, 'title' | 'notes' | 'status'>>): Promise<Video> =>
    request<Video>(`/videos/${id}`, { method: 'PATCH', body }),

  /** Downloads the media as a blob so the auth header is carried (plain <video src> cannot). */
  media: async (id: string): Promise<Blob> => {
    if (isMockEnabled()) {
      throw new ApiError('not_found', 'Media is not available in demo data.', 404);
    }
    const token = readToken();
    const response = await fetch(`${API_BASE}/videos/${id}/media`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const text = await response.text();
      let payload: unknown = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      }
      throw toApiError(response.status, payload);
    }
    return response.blob();
  },
};

/* ------------------------------------------------------------ transcripts */

export const transcriptsApi = {
  current: (videoId: string): Promise<Transcript> =>
    request<Transcript>(`/videos/${videoId}/transcript`),

  versions: (videoId: string): Promise<ListResponse<Transcript>> =>
    request<ListResponse<Transcript>>(`/videos/${videoId}/transcripts`),

  save: (videoId: string, body: UpdateTranscriptRequest): Promise<Transcript> =>
    request<Transcript>(`/videos/${videoId}/transcript`, { method: 'PUT', body }),

  generate: async (videoId: string, body: GenerateTranscriptRequest): Promise<GenerateTranscriptResponse> => {
    // The contract says `{"jobs":[...]}`, but tolerate a bare job object too.
    const raw = await request<GenerateTranscriptResponse | Job>(`/videos/${videoId}/transcript/generate`, {
      method: 'POST',
      body,
    });
    if (Array.isArray((raw as GenerateTranscriptResponse).jobs)) {
      return raw as GenerateTranscriptResponse;
    }
    return { jobs: [raw as Job] };
  },

  segments: (videoId: string): Promise<{ segments: Segment[] }> =>
    request<{ segments: Segment[] }>(`/videos/${videoId}/transcript/segments`),
};

/* ----------------------------------------------------------------- merges */

export const mergesApi = {
  listForVideo: (videoId: string): Promise<ListResponse<Merge>> =>
    request<ListResponse<Merge>>(`/videos/${videoId}/merges`),

  get: (id: string): Promise<Merge> => request<Merge>(`/merges/${id}`),

  apply: (id: string): Promise<Transcript> =>
    request<Transcript>(`/merges/${id}/apply`, { method: 'POST' }),

  create: (videoId: string, body: CreateMergeRequest): Promise<Merge> =>
    request<Merge>(`/videos/${videoId}/transcript/merge`, { method: 'POST', body }),
};

/* ------------------------------------------------------------------- jobs */

export const jobsApi = {
  list: (query: JobListQuery = {}): Promise<Paginated<Job>> =>
    request<Paginated<Job>>('/jobs', { query: { ...query } }),

  get: (id: string): Promise<Job> => request<Job>(`/jobs/${id}`),

  retry: (id: string): Promise<Job> => request<Job>(`/jobs/${id}/retry`, { method: 'POST' }),

  cancel: (id: string): Promise<Job> => request<Job>(`/jobs/${id}/cancel`, { method: 'POST' }),
};
