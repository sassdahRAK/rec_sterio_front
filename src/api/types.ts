/**
 * TypeScript mirrors of recsterio's frozen API contract (docs/API_CONTRACT.md).
 * Field names are snake_case exactly as they appear on the wire.
 */

/* ------------------------------------------------------------------ errors */

export interface ErrorDetail {
  field?: string;
  issue?: string;
  [k: string]: unknown;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[] | Record<string, unknown> | null;
  };
}

/* ------------------------------------------------------------------ domain */

export type VideoPlatform = 'youtube' | 'tiktok' | 'facebook' | 'instagram' | 'direct' | 'unknown';

export type VideoStatus =
  | 'pending'
  | 'downloading'
  | 'downloaded'
  | 'transcribing'
  | 'transcribed'
  | 'failed'
  | 'quarantined';

export type TranscriptSource = 'whisper' | 'gemini' | 'manual' | 'merged';

export type TranscriptStatus = 'pending' | 'running' | 'ready' | 'failed';

export type MergeStatus = 'pending' | 'running' | 'ready' | 'failed';

export type JobKind = 'download' | 'transcribe' | 'gemini_transcribe' | 'merge' | 'extract_audio';

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'dead';

export interface Video {
  id: string;
  source_url: string;
  platform: VideoPlatform | string;
  title: string | null;
  notes: string | null;
  folder_id: string | null;
  /** Set when this row is a fork of another video; null for an ingested one. */
  copied_from_id: string | null;
  position: number;
  status: VideoStatus | string;
  progress: number;
  error: string | null;
  local_path: string | null;
  file_size: number | null;
  duration_seconds: number | null;
  mime_type: string | null;
  checksum_sha256: string | null;
  thumbnail_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  /**
   * Whether this caller could open the row's detail page (server-computed per
   * row on the listings: the library tiers see rows of private folders they
   * hold no role on). Optional so demo/mock payloads — which carry no such
   * flag — keep reading as openable.
   */
  can_open?: boolean;
}

/** `GET /videos/{id}` returns the video plus its transcripts and jobs. */
export interface VideoDetail extends Video {
  transcripts: Transcript[];
  jobs: Job[];
  /** "Name (email)" for the linked Telegram user that collected this video; null when unresolvable. */
  created_by_display?: string | null;
  /** Same resolution for whoever last forked/moved the unit into its folder. */
  collected_by_display?: string | null;
}

export interface Segment {
  start: number;
  end: number;
  text: string;
  language: string | null;
}

export interface Transcript {
  id: string;
  video_id: string;
  version: number;
  source: TranscriptSource | string;
  language: string | null;
  content: string;
  segments: Segment[] | null;
  status: TranscriptStatus | string;
  /** Human-corrected version → the card shows a "Cleaned" badge. */
  cleaned: boolean;
  error: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Provenance of an aligned region in a merge diff. */
export type DiffSource = 'whisper' | 'gemini' | 'both';

export interface DiffSegment {
  start?: number | null;
  end?: number | null;
  source: DiffSource | string;
  /** Text proposed by each engine for this region. */
  whisper_text?: string | null;
  gemini_text?: string | null;
  /** Text selected by the reconciler. */
  merged_text?: string | null;
  reason?: string | null;
  /** The contract does not pin the exact key names inside a diff segment, so unknown keys are tolerated. */
  [k: string]: unknown;
}

export interface MergeStats {
  segments_total?: number;
  whisper_only?: number;
  gemini_only?: number;
  both?: number;
  [k: string]: unknown;
}

export interface MergeDiff {
  segments: DiffSegment[];
  summary: string;
  stats: MergeStats;
}

export interface Merge {
  id: string;
  video_id: string;
  base_transcript_id: string;
  gemini_transcript_id: string | null;
  merged_transcript_id: string | null;
  status: MergeStatus | string;
  diff: MergeDiff | null;
  model: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  kind: JobKind | string;
  video_id: string | null;
  status: JobStatus | string;
  payload: Record<string, unknown> | null;
  attempts: number;
  max_attempts: number;
  priority: number;
  last_error: string | null;
  scheduled_at: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

/* ---------------------------------------------------------------- payloads */

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ListResponse<T> {
  items: T[];
}

export interface Stats {
  videos_total: number;
  videos_by_status: Record<string, number>;
  transcripts_total: number;
  transcripts_by_source: Record<string, number>;
  merges_total: number;
  jobs_queued: number;
  jobs_failed: number;
  total_media_bytes: number;
}

export interface LoginResponse {
  token: string;
  email: string;
  expires_at: string;
  role?: Role;
  name?: string | null;
}

export type Role =
  | 'super_admin'
  | 'admin'
  | 'developer'
  | 'reviewer'
  | 'user'
  | 'guest'
  | 'telegram';

/** The five roles a real console account can hold. */
export const CONSOLE_ROLES: Role[] = ['super_admin', 'admin', 'developer', 'reviewer', 'user'];

/** Roles that may run ingestion and job operations (everything but reviewer/user). */
export const OPERATOR_ROLES: Role[] = ['super_admin', 'admin', 'developer'];

/** The two tiers that manage the platform, its content and its folders. */
export const ADMIN_TIER: Role[] = ['super_admin', 'admin'];

/**
 * Roles that may correct any video's transcript (the server's
 * `require_transcript_editor` widening of the folder-editor rule).
 */
export const TRANSCRIPT_EDIT_ROLES: Role[] = ['super_admin', 'admin', 'reviewer'];

/** The one role that manages console accounts (the Users page and its route). */
export const SUPER_ADMIN_ONLY: Role[] = ['super_admin'];

/** Who the bearer token belongs to (GET /auth/me). */
export interface Me {
  actor: string;
  role: Role | string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  folder_ids: string[];
}

/** POST /auth/guest — an anonymous session that may read public folders. */
export interface GuestSession {
  token: string;
  role: Role;
  email: string | null;
  folder_ids: string[];
  expires_at: string;
}

/** POST /auth/telegram-link — a one-time code the bot redeems to bind a Telegram account. */
export interface TelegramLink {
  code: string;
  /** `https://t.me/<bot>?start=link-<code>`; null until the operator sets TELEGRAM_BOT_USERNAME. */
  deep_link: string | null;
  expires_at: string;
}

/** GET /auth/telegram-link — whether the console account already has a Telegram bound. */
export interface TelegramLinkState {
  telegram_user_id: number | null;
}

export interface PublicConfig {
  google_client_id: string;
  google_enabled: boolean;
  guest_enabled: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface VideoListQuery {
  page?: number;
  page_size?: number;
  status?: string;
  platform?: string;
  q?: string;
  sort?: string;
}

export interface JobListQuery {
  page?: number;
  page_size?: number;
  status?: string;
  kind?: string;
  video_id?: string;
  sort?: string;
}

export interface UpdateTranscriptRequest {
  content: string;
  segments?: Segment[] | null;
  language?: string | null;
  /** Defaults to true on the server: a manual edit is a human correction. */
  cleaned?: boolean;
}

/* ------------------------------------------------------------- dataset (sharing) */

export type FolderVisibility = 'public' | 'private';
export type FolderRole = 'viewer' | 'commenter' | 'editor';

export interface Folder {
  id: string;
  name: string;
  description: string | null;
  visibility: FolderVisibility | string;
  owner_id: string;
  owner_email: string | null;
  parent_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  video_count: number;
  my_role: FolderRole | string | null;
  children: Folder[];
}

export interface FolderList {
  items: Folder[];
  total: number;
}

export interface FolderCreateRequest {
  name: string;
  description?: string | null;
  visibility?: FolderVisibility;
  parent_id?: string | null;
}

export interface FolderUpdateRequest {
  name?: string;
  description?: string | null;
  visibility?: FolderVisibility;
  parent_id?: string | null;
  position?: number;
}

/** One video as the dataset cards show it (GET /dataset/cards). */
export interface DataCard {
  video_id: string;
  title: string | null;
  source_url: string | null;
  status: string;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  folder_id: string | null;
  folder_name: string | null;
  /** A fork of another unit, or null for an independently collected one. */
  copied_from_id: string | null;
  badge: 'raw' | 'cleaned';
  transcript_id: string | null;
  transcript_preview: string | null;
  audio_available: boolean;
  media_url: string;
  audio_url: string;
  transcript_url: string;
  /** Where the bytes live: null = server disk, else 'google' | 'onedrive'. */
  storage_backend?: 'google' | 'onedrive' | null;
  /** False when the contributor's drive is disconnected — listed but unplayable. */
  storage_available?: boolean;
  /**
   * Whether this caller could open the card's video (the card dialog loads its
   * transcript via GET /videos/{id}). Server-computed per card; optional so
   * demo/mock payloads keep reading as openable.
   */
  can_open?: boolean;
}

export interface DatasetCardPage {
  items: DataCard[];
  total: number;
  page: number;
  page_size: number;
}

export interface FolderMember {
  user_id: string;
  email: string;
  name: string | null;
  role: FolderRole | string;
  created_at: string;
}

export interface ShareLink {
  id: string;
  folder_id: string;
  token: string;
  role: FolderRole | string;
  expires_at: string | null;
  revoked_at: string | null;
  created_by: string;
  created_at: string;
  /** Present only in the create response. */
  url?: string;
}

export interface Passcode {
  id: string;
  folder_id: string;
  label: string | null;
  expires_at: string | null;
  max_uses: number | null;
  max_devices: number | null;
  one_time: boolean;
  use_count: number;
  device_count: number;
  revoked_at: string | null;
  created_by: string;
  created_at: string;
  /** Returned exactly once when the server generated the code. */
  code?: string | null;
}

export interface GuestTokenResponse {
  token: string;
  expires_at: string;
  folder_id: string;
  role: string;
  access: 'passcode' | 'share' | 'public';
}

/** A folder as the guest portal renders it. */
export interface PublicFolder {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  cards: DataCard[];
  children: PublicFolder[];
}

export type TranscriptEngine = 'whisper' | 'gemini' | 'both';

export interface GenerateTranscriptRequest {
  engine: TranscriptEngine;
}

export interface GenerateTranscriptResponse {
  jobs: Job[];
}

export interface CreateMergeRequest {
  base_transcript_id: string;
  gemini_transcript_id?: string | null;
  model?: string | null;
}

/* -------------------------------------------------------- users (super_admin) */

/** One console account as the Users page lists it (GET /users). */
export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
  telegram_user_id?: number | null;
}

export interface CreateUserRequest {
  email: string;
  name?: string | null;
  role: Role;
  password: string;
}

/** PATCH /users/{id} — everything except id/email/created_at/telegram binding. */
export type UserPatch = Partial<Pick<AdminUser, 'role' | 'is_active' | 'name'> & { password: string }>;

export interface UserListQuery {
  q?: string;
  role?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}

/* ------------------------------------------------------------- status sets */

export const VIDEO_STATUSES: VideoStatus[] = [
  'pending',
  'downloading',
  'downloaded',
  'transcribing',
  'transcribed',
  'failed',
  'quarantined',
];

export const PLATFORMS: VideoPlatform[] = [
  'youtube',
  'tiktok',
  'facebook',
  'instagram',
  'direct',
  'unknown',
];

export const JOB_STATUSES: JobStatus[] = ['queued', 'running', 'succeeded', 'failed', 'dead'];

export const JOB_KINDS: JobKind[] = [
  'download',
  'extract_audio',
  'transcribe',
  'gemini_transcribe',
  'merge',
];
