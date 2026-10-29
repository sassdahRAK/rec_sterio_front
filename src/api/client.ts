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
  AdminUser,
  CreateMergeRequest,
  CreateUserRequest,
  DatasetCardPage,
  ErrorDetail,
  Folder,
  FolderCreateRequest,
  FolderList,
  FolderMember,
  FolderRole,
  FolderUpdateRequest,
  GenerateTranscriptRequest,
  GenerateTranscriptResponse,
  GuestSession,
  GuestTokenResponse,
  Job,
  JobListQuery,
  ListResponse,
  LoginRequest,
  LoginResponse,
  Me,
  Merge,
  Paginated,
  Passcode,
  PublicConfig,
  PublicFolder,
  Segment,
  ShareLink,
  Stats,
  TelegramLink,
  TelegramLinkState,
  Transcript,
  UpdateTranscriptRequest,
  UserListQuery,
  UserPatch,
  Video,
  VideoDetail,
  VideoListQuery,
} from './types';

// Relative by default: the dev server proxies `/api` (vite.config.ts) and the
// deployed dashboard is served from the same origin as the API. Set
// VITE_API_BASE_URL to an absolute URL only when the two are on different hosts.
export const API_BASE: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ||
  '/api/v1';

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
  // A 5xx with no error envelope is almost always the dev proxy failing to
  // reach the API, so name that instead of "The request failed." — it is the
  // difference between a puzzle and a fix.
  const message =
    envelope?.error?.message ??
    (status === 404
      ? 'The requested resource was not found.'
      : status >= 500
        ? 'The API is not responding. Check that the backend is running.'
        : 'The request failed.');
  const details = (envelope?.error?.details as ApiError['details']) ?? null;
  return new ApiError(code, message, status, details);
}

/* ------------------------------------------------------------------- auth */

export const authApi = {
  login: (credentials: LoginRequest): Promise<LoginResponse> =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: credentials, auth: false }),

  /** Anonymous session: public datasets are readable without an account (#3). */
  guest: (): Promise<GuestSession> =>
    request<GuestSession>('/auth/guest', { method: 'POST', auth: false }),

  /** Google Identity Services hands the browser an ID token; the API verifies it. */
  google: (credential: string): Promise<LoginResponse> =>
    request<LoginResponse>('/auth/google', {
      method: 'POST',
      body: { credential },
      auth: false,
    }),

  me: (): Promise<Me> => request<Me>('/auth/me'),
};

/* ---------------------------------------------------------------- settings */

/**
 * Console-account settings. Today that is just the Telegram link: the console
 * mints a one-time code and the bot redeems it, so the bot can attribute
 * downloads to this account and follow its admin role.
 */
export const settingsApi = {
  /** Mint a fresh one-time code (any previous pending code is superseded). */
  createTelegramLink: (): Promise<TelegramLink> =>
    request<TelegramLink>('/auth/telegram-link', { method: 'POST' }),

  getTelegramLink: (): Promise<TelegramLinkState> =>
    request<TelegramLinkState>('/auth/telegram-link'),

  /** Drop the binding; a new code can be generated right after. */
  unlinkTelegram: (): Promise<void> =>
    request<void>('/auth/telegram-link', { method: 'DELETE' }),
};

/* ------------------------------------------------------------------- users */

/**
 * Console-account administration. Super_admin only — the API answers 403 for
 * every other role. Roles are DB-authoritative: a patch applies to the
 * target's next request, no re-login needed.
 */
export const usersApi = {
  list: (query: UserListQuery = {}): Promise<Paginated<AdminUser>> =>
    request<Paginated<AdminUser>>('/users', {
      query: {
        ...query,
        // buildQuery only takes string | number values; booleans travel as text.
        is_active: query.is_active === undefined ? undefined : String(query.is_active),
      },
    }),

  create: (body: CreateUserRequest): Promise<AdminUser> =>
    request<AdminUser>('/users', { method: 'POST', body }),

  patch: (id: string, body: UserPatch): Promise<AdminUser> =>
    request<AdminUser>(`/users/${id}`, { method: 'PATCH', body }),
};

/* ------------------------------------------------------------------ stats */

export const statsApi = {
  get: (): Promise<Stats> => request<Stats>('/stats'),
};

/* ----------------------------------------------------------------- videos */

export interface CreateVideoRequest {
  source_url: string;
  title?: string | null;
  notes?: string | null;
  start_transcription?: boolean;
}

export interface UploadVideoRequest {
  file: File;
  title?: string | null;
  notes?: string | null;
  start_transcription?: boolean;
}

export const videosApi = {
  list: (query: VideoListQuery = {}): Promise<Paginated<Video>> =>
    request<Paginated<Video>>('/videos', { query: { ...query } }),

  get: (id: string): Promise<VideoDetail> => request<VideoDetail>(`/videos/${id}`),

  /** Ingest from a link — the backend downloads it with yt-dlp. */
  create: (body: CreateVideoRequest): Promise<Video> =>
    request<Video>('/videos', { method: 'POST', body }),

  /**
   * Ingest a file the operator already has.
   *
   * This is the path that does not depend on a platform serving a download —
   * TikTok and YouTube refuse most server-side requests. Multipart, so it
   * cannot go through `request()`.
   */
  upload: async (input: UploadVideoRequest): Promise<Video> => {
    if (isMockEnabled()) {
      throw new ApiError('not_supported', 'File upload is not available in demo data.', 400);
    }
    const form = new FormData();
    form.append('file', input.file, input.file.name);
    form.append('start_transcription', String(input.start_transcription ?? true));
    if (input.title) form.append('title', input.title);
    if (input.notes) form.append('notes', input.notes);

    const token = readToken();
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/videos/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
    } catch {
      throw new ApiError(
        'network_error',
        'Could not reach the recsterio API. Check that the backend is running.',
        0,
      );
    }

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
      // A duplicate answers 409 with the existing video; surface that record
      // so the operator lands on what they already have instead of an error.
      const duplicate = (payload as { video?: Video } | null)?.video;
      if (response.status === 409 && duplicate) return duplicate;
      throw toApiError(response.status, payload);
    }
    return payload as Video;
  },

  remove: (id: string): Promise<void> => request<void>(`/videos/${id}`, { method: 'DELETE' }),

  retry: (id: string): Promise<Job> => request<Job>(`/videos/${id}/retry`, { method: 'POST' }),

  /**
   * Fork a video into a folder the caller manages. The original is untouched.
   *
   * `foldersApi.placeVideo` is the other half: that one *moves* the unit, needs
   * edit rights where it currently lives, and takes it away from its audience.
   */
  copy: (id: string, folderId: string, position?: number): Promise<Video> =>
    request<Video>(`/videos/${id}/copy`, {
      method: 'POST',
      body: { folder_id: folderId, position },
    }),

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

  /** Toggle the Raw/Cleaned badge without creating a new version (#8). */
  setCleaned: (videoId: string, cleaned: boolean): Promise<Transcript> =>
    request<Transcript>(`/videos/${videoId}/transcript`, {
      method: 'PATCH',
      body: { cleaned },
    }),

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

/* --------------------------------------------------------------- blobs */

/**
 * Fetch a binary endpoint (media, audio, ZIP) with the bearer token, which a
 * plain <video src> or <a href> cannot carry for a protected resource.
 */
async function requestBlob(path: string): Promise<Blob> {
  if (isMockEnabled()) {
    throw new ApiError('not_found', 'This file is not available in demo data.', 404);
  }
  const token = readToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError(
      'network_error',
      'Could not reach the recsterio API. Check that the backend is running.',
      0,
    );
  }
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
}

/** Save a blob under a filename (used for ZIP exports and audio downloads). */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a tick to start the download before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

/* ------------------------------------------------------------- folders */

export interface FolderListQuery {
  parent_id?: string;
  visibility?: string;
}

export const foldersApi = {
  list: (query: FolderListQuery = {}): Promise<FolderList> =>
    request<FolderList>('/folders', { query: { ...query } }),

  get: (id: string): Promise<Folder> => request<Folder>(`/folders/${id}`),

  create: (body: FolderCreateRequest): Promise<Folder> =>
    request<Folder>('/folders', { method: 'POST', body }),

  update: (id: string, body: FolderUpdateRequest): Promise<Folder> =>
    request<Folder>(`/folders/${id}`, { method: 'PATCH', body }),

  remove: (id: string): Promise<void> => request<void>(`/folders/${id}`, { method: 'DELETE' }),

  videos: (id: string): Promise<Video[]> => request<Video[]>(`/folders/${id}/videos`),

  placeVideo: (videoId: string, folderId: string | null): Promise<Video> =>
    request<Video>(`/videos/${videoId}/folder`, {
      method: 'PUT',
      body: { folder_id: folderId },
    }),

  transcriptIndex: (id: string): Promise<Record<string, unknown>> =>
    request<Record<string, unknown>>(`/folders/${id}/transcripts`),

  /** One ZIP of video + audio + transcript for the folder and its subtree (#5, #6). */
  zip: async (id: string): Promise<Blob> => requestBlob(`/folders/${id}/download`),

  members: (id: string): Promise<ListResponse<FolderMember>> =>
    request<ListResponse<FolderMember>>(`/folders/${id}/members`),

  invite: (id: string, email: string, role: FolderRole): Promise<FolderMember> =>
    request<FolderMember>(`/folders/${id}/members`, {
      method: 'POST',
      body: { email, role },
    }),

  setMemberRole: (id: string, userId: string, role: FolderRole): Promise<FolderMember> =>
    request<FolderMember>(`/folders/${id}/members/${userId}`, {
      method: 'PATCH',
      body: { role },
    }),

  removeMember: (id: string, userId: string): Promise<void> =>
    request<void>(`/folders/${id}/members/${userId}`, { method: 'DELETE' }),
};

/* -------------------------------------------------------------- dataset */

export interface DatasetCardQuery {
  folder_id?: string;
  cleaned?: boolean;
  q?: string;
  page?: number;
  page_size?: number;
}

export const datasetApi = {
  cards: (query: DatasetCardQuery = {}): Promise<DatasetCardPage> =>
    request<DatasetCardPage>('/dataset/cards', {
      query: {
        folder_id: query.folder_id,
        cleaned: query.cleaned === undefined ? undefined : String(query.cleaned),
        q: query.q,
        page: query.page,
        page_size: query.page_size,
      },
    }),
};

/* -------------------------------------------------------- share links */

export const sharesApi = {
  list: (folderId: string): Promise<ShareLink[]> =>
    request<ShareLink[]>(`/folders/${folderId}/shares`),

  create: (folderId: string, role: FolderRole, expiresAt?: string | null): Promise<ShareLink> =>
    request<ShareLink>(`/folders/${folderId}/shares`, {
      method: 'POST',
      body: { role, expires_at: expiresAt ?? null },
    }),

  revoke: (id: string): Promise<void> =>
    request<void>(`/shares/${id}`, { method: 'DELETE' }),
};

/* ----------------------------------------------------------- passcodes */

export interface PasscodeCreateRequest {
  code?: string | null;
  label?: string | null;
  expires_at?: string | null;
  max_uses?: number | null;
  max_devices?: number | null;
  one_time?: boolean;
}

export const passcodesApi = {
  list: (folderId: string): Promise<Passcode[]> =>
    request<Passcode[]>(`/folders/${folderId}/passcodes`),

  create: (folderId: string, body: PasscodeCreateRequest): Promise<Passcode> =>
    request<Passcode>(`/folders/${folderId}/passcodes`, { method: 'POST', body }),

  revoke: (id: string): Promise<void> =>
    request<void>(`/passcodes/${id}`, { method: 'DELETE' }),
};

/* --------------------------------------------------------- public portal */

export const publicApi = {
  config: (): Promise<PublicConfig> =>
    request<PublicConfig>('/public/config', { auth: false }),

  folders: (): Promise<ListResponse<PublicFolder>> =>
    request<ListResponse<PublicFolder>>('/public/folders'),

  folder: (id: string): Promise<PublicFolder> => request<PublicFolder>(`/public/folders/${id}`),

  zip: async (id: string): Promise<Blob> => requestBlob(`/public/folders/${id}/zip`),

  redeemPasscode: (
    folderId: string,
    code: string,
    deviceKey: string,
  ): Promise<GuestTokenResponse> =>
    request<GuestTokenResponse>('/public/passcodes/redeem', {
      method: 'POST',
      auth: false,
      body: { folder_id: folderId, code, device_key: deviceKey },
    }),

  redeemShare: (token: string, deviceKey: string): Promise<GuestTokenResponse> =>
    request<GuestTokenResponse>(`/public/shares/${token}/redeem`, {
      method: 'POST',
      auth: false,
      body: { device_key: deviceKey },
    }),
};

/* ---------------------------------------------------------------- media */

export const mediaApi = {
  video: (videoId: string): Promise<Blob> => requestBlob(`/videos/${videoId}/media`),
  audio: (videoId: string): Promise<Blob> => requestBlob(`/videos/${videoId}/audio`),
};
