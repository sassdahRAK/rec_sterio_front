/**
 * A small in-memory mock of the recsterio API, used when the dashboard is
 * started with `?mock=1` (or VITE_USE_MOCK=1) so every screen can be exercised
 * without the real backend. Shapes mirror docs/API_CONTRACT.md exactly.
 */
import type {
  AdminUser,
  CloudBackend,
  CloudProviders,
  DataCard as MockDataCard,
  DiffSegment,
  DriveLink,
  Folder,
  FolderMember,
  FolderRole,
  Job,
  LoginResponse,
  Merge,
  Paginated,
  Segment,
  Stats,
  Transcript,
  Video,
  VideoDetail,
} from './types';
import { CONSOLE_ROLES } from './types';

const now = Date.now();
const iso = (offsetMs: number): string => new Date(now - offsetMs).toISOString();

const uid = (seed: number): string => {
  const hex = seed.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
};

/* ------------------------------------------------------------------ videos */

const videoSeed: Array<Partial<Video> & { seed: number }> = [
  {
    seed: 1,
    source_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    platform: 'youtube',
    title: 'Cambodia Digital Economy Briefing 2024',
    status: 'transcribed',
    progress: 100,
    duration_seconds: 1043.5,
    file_size: 187_442_112,
    mime_type: 'video/mp4',
    checksum_sha256: '9f2c8b1d4e6a7b0c3d5e8f1a2b4c6d8e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6',
    created_by: 'telegram:12345678',
    created_at: iso(9_200_000),
    updated_at: iso(700_000),
  },
  {
    seed: 2,
    source_url: 'https://www.tiktok.com/@angkor.daily/video/7312049888',
    platform: 'tiktok',
    title: 'Angkor market walk — morning edition',
    status: 'downloading',
    progress: 64,
    duration_seconds: 92.4,
    file_size: 24_117_248,
    mime_type: 'video/mp4',
    created_by: 'telegram:12345678',
    created_at: iso(1_100_000),
    updated_at: iso(60_000),
  },
  {
    seed: 3,
    source_url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    platform: 'youtube',
    title: 'កម្ពុជា សេដ្ឋវិទ្យា ទូទៅ ២០២៤',
    status: 'failed',
    progress: 12,
    error: 'Download failed: video is private or unavailable in this region.',
    created_by: 'telegram:99887766',
    created_at: iso(26_000_000),
    updated_at: iso(25_000_000),
  },
  {
    seed: 4,
    source_url: 'https://www.facebook.com/watch/?v=8823410299',
    platform: 'facebook',
    title: 'Community radio interview — Khmer teachers union',
    status: 'transcribed',
    progress: 100,
    duration_seconds: 2411.9,
    file_size: 402_653_184,
    mime_type: 'video/mp4',
    created_by: 'admin:advisor@recsterio.local',
    created_at: iso(52_000_000),
    updated_at: iso(30_000_000),
  },
  {
    seed: 5,
    source_url: 'https://www.instagram.com/reel/C3ab12D/',
    platform: 'instagram',
    title: 'Street food reel — sambo kroeung',
    status: 'downloaded',
    progress: 100,
    duration_seconds: 47.2,
    file_size: 8_912_896,
    mime_type: 'video/mp4',
    created_by: 'telegram:12345678',
    created_at: iso(90_000_000),
    updated_at: iso(80_000_000),
  },
  {
    seed: 6,
    source_url: 'https://example.org/media/panel-recording.mp4',
    platform: 'direct',
    title: 'Panel recording — capstone demo (raw)',
    status: 'pending',
    progress: 0,
    created_by: 'admin:advisor@recsterio.local',
    created_at: iso(120_000),
    updated_at: iso(120_000),
  },
  {
    seed: 7,
    source_url: 'https://www.youtube.com/watch?v=ZZtopTrain',
    platform: 'youtube',
    title: 'Coach load explanation',
    status: 'quarantined',
    progress: 0,
    error: 'Quarantined: checksum matched an existing media asset.',
    created_by: 'system',
    created_at: iso(180_000_000),
    updated_at: iso(179_000_000),
  },
  {
    seed: 8,
    source_url: 'https://www.youtube.com/watch?v=monoRail',
    platform: 'youtube',
    title: 'Monorail launch — official statement',
    status: 'transcribing',
    progress: 100,
    duration_seconds: 316.8,
    file_size: 51_380_224,
    mime_type: 'video/mp4',
    created_by: 'telegram:44556677',
    created_at: iso(400_000),
    updated_at: iso(200_000),
  },
];

export const mockVideos: Video[] = videoSeed.map((v) => ({
  id: uid(v.seed),
  source_url: v.source_url ?? '',
  platform: v.platform ?? 'unknown',
  title: v.title ?? null,
  notes: v.notes ?? null,
  folder_id: v.folder_id ?? null,
  copied_from_id: v.copied_from_id ?? null,
  position: v.position ?? 0,
  status: v.status ?? 'pending',
  progress: v.progress ?? 0,
  error: v.error ?? null,
  local_path: v.local_path ?? null,
  file_size: v.file_size ?? null,
  duration_seconds: v.duration_seconds ?? null,
  mime_type: v.mime_type ?? null,
  checksum_sha256: v.checksum_sha256 ?? null,
  thumbnail_url: v.thumbnail_url ?? null,
  created_by: v.created_by ?? 'system',
  created_at: v.created_at ?? iso(0),
  updated_at: v.updated_at ?? iso(0),
}));

/* ------------------------------------------------------------- transcripts */

const seg = (start: number, end: number, text: string, language: string | null = 'km'): Segment => ({
  start,
  end,
  text,
  language,
});

const transcriptSeed: Array<Partial<Transcript> & { seed: number; videoSeed: number }> = [
  {
    seed: 1,
    videoSeed: 1,
    version: 1,
    source: 'whisper',
    language: 'km-en',
    status: 'ready',
    created_by: 'whisper',
    content: [
      'Good morning everyone, and welcome to the digital economy briefing.',
      'ជម្រើសមាគឺវ្លើង់ សូមស្វាគមន៍ចូលនៅកម្មវិធីសេដ្ឋវិទ្យាឌីជីតគិរយ៉ាក។',
      'Today we look at e-payments, ride hailing and the digital skills gap.',
      'ការទូទាត់ថ្លៃ តាមការិយាបាលប្រព័ន្ធបានកើនឡើងដល់ ២៨ ភាគរដូវឆ្នាំនេះ។',
      'Let us start with the payment numbers.',
    ].join('\n'),
    segments: [
      seg(0, 4.2, 'Good morning everyone, and welcome to the digital economy briefing.'),
      seg(4.2, 9.8, 'ជម្រើសមាគឺវ្លើង់ សូមស្វាគមន៍ចូលនៅកម្មវិធីសេដ្ឋវិទ្យាឌីជីតគិរយ៉ាក។'),
      seg(9.8, 14.1, 'Today we look at e-payments, ride hailing and the digital skills gap.'),
      seg(14.1, 20.4, 'ការទូទាត់ថ្លៃ តាមការិយាបាលប្រព័ន្ធបានកើនឡើងដល់ ២៨ ភាគរដូវឆ្នាំនេះ។'),
      seg(20.4, 23.0, 'Let us start with the payment numbers.'),
    ],
    created_at: iso(8_000_000),
    updated_at: iso(8_000_000),
  },
  {
    seed: 2,
    videoSeed: 1,
    version: 2,
    source: 'gemini',
    language: 'km-en',
    status: 'ready',
    created_by: 'gemini',
    content: [
      'Good morning everyone, and welcome to the digital economy briefing.',
      'សូមស្វាគមន៍ចូលនៅកម្មវិធីសេដ្ឋវិទ្យាឌីជីតគិរយ៉ាក។',
      'Today we examine e-payments, ride-hailing, and the digital skills gap.',
      'ប្រព័ន្ធបារាងឌីជីតបានកើនឡើងដល់ ២៨ ភាគរដូវឆ្នាំនេះ។',
    ].join('\n'),
    segments: [
      seg(0, 4.4, 'Good morning everyone, and welcome to the digital economy briefing.'),
      seg(4.4, 9.9, 'សូមស្វាគមន៍ចូលនៅកម្មវិធីសេដ្ឋវិទ្យាឌីជីតគិរយ៉ាក។'),
      seg(9.9, 14.6, 'Today we examine e-payments, ride-hailing, and the digital skills gap.'),
      seg(14.6, 20.9, 'ប្រព័ន្ធបារាងឌីជីតបានកើនឡើងដល់ ២៨ ភាគរដូវឆ្នាំនេះ។'),
    ],
    created_at: iso(7_000_000),
    updated_at: iso(7_000_000),
  },
  {
    seed: 3,
    videoSeed: 1,
    version: 3,
    source: 'manual',
    language: 'km-en',
    status: 'ready',
    created_by: 'admin:advisor@recsterio.local',
    content: [
      'Good morning everyone, and welcome to the digital economy briefing.',
      'សូមស្វាគមន៍ចូលនៅកម្មវិធីសេដ្ឋវិទ្យាឌីជីតគិរយ៉ាក។',
      'Today we examine e-payments, ride-hailing, and the digital skills gap.',
      'ប្រព័ន្ធបារាងឌីជីតបានកើនឡើងដល់ ២៨ ភាគរដូវឆ្នាំនេះ។',
      'Let us start with the payment numbers.',
    ].join('\n'),
    segments: null,
    created_at: iso(3_000_000),
    updated_at: iso(3_000_000),
  },
  {
    seed: 4,
    videoSeed: 4,
    version: 1,
    source: 'whisper',
    language: 'km',
    status: 'ready',
    created_by: 'whisper',
    content:
      'ស្រីគាត់ជាប្រធានីនៃសហគមន៍គ្រូបសាធិក។\nយើងស្នើសុំការចង់និយមទៅរកៃអន្តរជាតិ។',
    segments: [
      seg(0, 3.1, 'ស្រីគាត់ជាប្រធានីនៃសហគមន៍គ្រូបសាធិក។'),
      seg(3.1, 7.4, 'យើងស្នើសុំការចង់និយមទៅរកៃអន្តរជាតិ។'),
    ],
    created_at: iso(40_000_000),
    updated_at: iso(40_000_000),
  },
  {
    seed: 5,
    videoSeed: 8,
    version: 1,
    source: 'whisper',
    language: 'km',
    status: 'running',
    created_by: 'whisper',
    content: '',
    segments: null,
    created_at: iso(300_000),
    updated_at: iso(300_000),
  },
];

export const mockTranscripts: Transcript[] = transcriptSeed.map((t) => ({
  id: uid(100 + t.seed),
  video_id: uid(t.videoSeed),
  version: t.version ?? 1,
  source: t.source ?? 'whisper',
  language: t.language ?? null,
  content: t.content ?? '',
  segments: t.segments ?? null,
  status: t.status ?? 'ready',
  cleaned: t.cleaned ?? t.videoSeed === 1,
  error: t.error ?? null,
  created_by: t.created_by ?? 'whisper',
  created_at: t.created_at ?? iso(0),
  updated_at: t.updated_at ?? iso(0),
}));

/* ------------------------------------------------------------------ merges */

const diffSegments: DiffSegment[] = [
  {
    start: 0,
    end: 4.4,
    source: 'both',
    whisper_text: 'Good morning everyone, and welcome to the digital economy briefing.',
    gemini_text: 'Good morning everyone, and welcome to the digital economy briefing.',
    merged_text: 'Good morning everyone, and welcome to the digital economy briefing.',
    reason: 'Both engines agree.',
  },
  {
    start: 4.4,
    end: 9.9,
    source: 'gemini',
    whisper_text: 'ជម្រើសមាគឺវ្លើង់ សូមស្វាគមន៍ចូលនៅកម្មវិធីសេដ្ឋវិទ្យាឌីជីតគិរយ៉ាក។',
    gemini_text: 'សូមស្វាគមន៍ចូលនៅកម្មវិធីសេដ្ឋវិទ្យាឌីជីតគិរយ៉ាក។',
    merged_text: 'សូមស្វាគមន៍ចូលនៅកម្មវិធីសេដ្ឋវិទ្យាឌីជីតគិរយ៉ាក។',
    reason: 'Whisper output was garbled; Gemini transcription kept.',
  },
  {
    start: 9.9,
    end: 14.6,
    source: 'whisper',
    whisper_text: 'Today we look at e-payments, ride hailing and the digital skills gap.',
    gemini_text: 'Today we examine e-payments, ride-hailing, and the digital skills gap.',
    merged_text: 'Today we look at e-payments, ride hailing and the digital skills gap.',
    reason: 'Whisper retained; Gemini dropped the trailing clause.',
  },
  {
    start: 14.6,
    end: 20.9,
    source: 'gemini',
    whisper_text: 'ការទូទាត់ថ្លៃ តាមការិយាបាលប្រព័ន្ធបានកើនឡើងដល់ ២៨ ភាគរដូវឆ្នាំនេះ។',
    gemini_text: 'ប្រព័ន្ធបារាងឌីជីតបានកើនឡើងដល់ ២៨ ភាគរដូវឆ្នាំនេះ។',
    merged_text: 'ប្រព័ន្ធបារាងឌីជីតបានកើនឡើងដល់ ២៨ ភាគរដូវឆ្នាំនេះ។',
    reason: 'Gemini diacritics are more accurate for the currency figure.',
  },
  {
    start: 20.9,
    end: 24.3,
    source: 'whisper',
    whisper_text: 'Let us start with the payment numbers.',
    gemini_text: '',
    merged_text: 'Let us start with the payment numbers.',
    reason: 'Segment missing from the Gemini transcript; kept from base.',
  },
];

export const mockMerges: Merge[] = [
  {
    id: uid(201),
    video_id: uid(1),
    base_transcript_id: uid(101),
    gemini_transcript_id: uid(102),
    merged_transcript_id: null,
    status: 'ready',
    model: 'gemini-2.5-pro',
    error: null,
    diff: {
      segments: diffSegments,
      summary:
        '5 aligned regions across a 24s clip. 3 regions kept from Whisper, 2 replaced by Gemini, 1 region confirmed by both engines.',
      stats: {
        segments_total: diffSegments.length,
        whisper_only: diffSegments.filter((s) => s.source === 'whisper').length,
        gemini_only: diffSegments.filter((s) => s.source === 'gemini').length,
        both: diffSegments.filter((s) => s.source === 'both').length,
      },
    },
    created_at: iso(2_000_000),
    updated_at: iso(1_900_000),
  },
  {
    id: uid(202),
    video_id: uid(1),
    base_transcript_id: uid(101),
    gemini_transcript_id: uid(102),
    merged_transcript_id: null,
    status: 'running',
    model: 'gemini-2.5-pro',
    error: null,
    diff: null,
    created_at: iso(600_000),
    updated_at: iso(600_000),
  },
  {
    id: uid(203),
    video_id: uid(4),
    base_transcript_id: uid(104),
    gemini_transcript_id: null,
    merged_transcript_id: null,
    status: 'failed',
    model: 'gemini-2.5-pro',
    error: 'gemini_transcribe failed: upstream returned 429 (quota exceeded).',
    diff: null,
    created_at: iso(12_000_000),
    updated_at: iso(11_500_000),
  },
];

/* -------------------------------------------------------------------- jobs */

const jobSeed: Array<Partial<Job> & { seed: number; videoSeed: number | null }> = [
  {
    seed: 1,
    videoSeed: 1,
    kind: 'download',
    status: 'succeeded',
    attempts: 1,
    max_attempts: 3,
    priority: 10,
    started_at: iso(9_000_000),
    finished_at: iso(8_990_000),
    scheduled_at: iso(9_100_000),
    created_at: iso(9_100_000),
  },
  {
    seed: 2,
    videoSeed: 1,
    kind: 'extract_audio',
    status: 'succeeded',
    attempts: 1,
    max_attempts: 3,
    priority: 5,
    started_at: iso(8_800_000),
    finished_at: iso(8_780_000),
    scheduled_at: iso(8_850_000),
    created_at: iso(8_850_000),
  },
  {
    seed: 3,
    videoSeed: 1,
    kind: 'transcribe',
    status: 'succeeded',
    attempts: 1,
    max_attempts: 3,
    priority: 5,
    started_at: iso(8_200_000),
    finished_at: iso(8_050_000),
    scheduled_at: iso(8_300_000),
    created_at: iso(8_300_000),
  },
  {
    seed: 4,
    videoSeed: 1,
    kind: 'gemini_transcribe',
    status: 'succeeded',
    attempts: 1,
    max_attempts: 3,
    priority: 5,
    started_at: iso(6_800_000),
    finished_at: iso(6_300_000),
    scheduled_at: iso(6_900_000),
    created_at: iso(6_900_000),
  },
  {
    seed: 5,
    videoSeed: 1,
    kind: 'merge',
    status: 'succeeded',
    attempts: 1,
    max_attempts: 3,
    priority: 1,
    last_error: null,
    scheduled_at: iso(600_000),
    created_at: iso(700_000),
  },
  {
    seed: 6,
    videoSeed: 2,
    kind: 'download',
    status: 'running',
    attempts: 1,
    max_attempts: 3,
    priority: 10,
    started_at: iso(90_000),
    finished_at: null,
    scheduled_at: iso(120_000),
    created_at: iso(120_000),
  },
  {
    seed: 7,
    videoSeed: 3,
    kind: 'download',
    status: 'dead',
    attempts: 3,
    max_attempts: 3,
    priority: 10,
    last_error:
      'HTTPError 403: This video is private. Sign in to confirm your age or that you are not a bot.',
    started_at: iso(25_500_000),
    finished_at: iso(25_000_000),
    scheduled_at: iso(26_000_000),
    created_at: iso(26_000_000),
  },
  {
    seed: 8,
    videoSeed: 3,
    kind: 'transcribe',
    status: 'failed',
    attempts: 1,
    max_attempts: 3,
    priority: 5,
    last_error: 'faster-whisper: CUDA out of memory while decoding segment 412.',
    started_at: iso(24_500_000),
    finished_at: iso(24_000_000),
    scheduled_at: iso(25_000_000),
    created_at: iso(25_000_000),
  },
  {
    seed: 9,
    videoSeed: 4,
    kind: 'gemini_transcribe',
    status: 'failed',
    attempts: 3,
    max_attempts: 3,
    priority: 5,
    last_error: 'gemini_transcribe failed: upstream returned 429 (quota exceeded).',
    started_at: iso(12_000_000),
    finished_at: iso(11_500_000),
    scheduled_at: iso(12_500_000),
    created_at: iso(12_500_000),
  },
  {
    seed: 10,
    videoSeed: 4,
    kind: 'merge',
    status: 'queued',
    attempts: 0,
    max_attempts: 3,
    priority: 1,
    scheduled_at: iso(60_000),
    created_at: iso(60_000),
  },
  {
    seed: 11,
    videoSeed: 6,
    kind: 'download',
    status: 'queued',
    attempts: 0,
    max_attempts: 3,
    priority: 10,
    scheduled_at: iso(120_000),
    created_at: iso(120_000),
  },
  {
    seed: 12,
    videoSeed: 8,
    kind: 'transcribe',
    status: 'running',
    attempts: 1,
    max_attempts: 3,
    priority: 5,
    started_at: iso(200_000),
    finished_at: null,
    scheduled_at: iso(250_000),
    created_at: iso(250_000),
  },
];

export const mockJobs: Job[] = jobSeed.map((j) => ({
  id: uid(300 + j.seed),
  kind: j.kind ?? 'download',
  video_id: j.videoSeed ? uid(j.videoSeed) : null,
  status: j.status ?? 'queued',
  payload: j.payload ?? { video_id: j.videoSeed ? uid(j.videoSeed) : null },
  attempts: j.attempts ?? 0,
  max_attempts: j.max_attempts ?? 3,
  priority: j.priority ?? 10,
  last_error: j.last_error ?? null,
  scheduled_at: j.scheduled_at ?? iso(0),
  started_at: j.started_at ?? null,
  finished_at: j.finished_at ?? null,
  created_at: j.created_at ?? iso(0),
}));

/* ------------------------------------------------------------------- stats */

export const mockStats: Stats = {
  videos_total: mockVideos.length,
  videos_by_status: {
    pending: 1,
    downloading: 1,
    downloaded: 1,
    transcribing: 1,
    transcribed: 2,
    failed: 1,
    quarantined: 1,
  },
  transcripts_total: mockTranscripts.length,
  transcripts_by_source: { whisper: 3, gemini: 1, manual: 1 },
  merges_total: mockMerges.length,
  jobs_queued: 2,
  jobs_failed: 3,
  total_media_bytes: mockVideos.reduce((sum, v) => sum + (v.file_size ?? 0), 0),
};

/* ------------------------------------------------------------------ router */

export interface MockResponse {
  status: number;
  data: unknown;
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const notFound = (message: string): MockResponse => ({
  status: 404,
  data: { error: { code: 'not_found', message } },
});

const paginate = <T,>(items: T[], page: number, pageSize: number): Paginated<T> => {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    page_size: pageSize,
  };
};

const matches = (haystack: string | null | undefined, needle: string): boolean =>
  !needle || (haystack ?? '').toLowerCase().includes(needle.toLowerCase());


/* ------------------------------------------------------------- dataset mock */

let mockFolders: Folder[] = [
  {
    id: uid(2001),
    name: 'Phnom Penh voices',
    description: 'Public street interviews with Khmer–English code switching.',
    visibility: 'public',
    owner_id: uid(1),
    owner_email: 'demo@recsterio.local',
    parent_id: null,
    position: 0,
    created_at: iso(9_000_000),
    updated_at: iso(200_000),
    video_count: 0,
    my_role: 'editor',
    children: [],
  },
  {
    id: uid(2002),
    name: 'Unit A — markets',
    description: 'Subset recorded around Orussey and Kandal markets.',
    visibility: 'public',
    owner_id: uid(1),
    owner_email: 'demo@recsterio.local',
    parent_id: uid(2001),
    position: 0,
    created_at: iso(8_000_000),
    updated_at: iso(300_000),
    video_count: 0,
    my_role: 'editor',
    children: [],
  },
  {
    id: uid(2003),
    name: 'Reviewer set',
    description: 'Private review copies before publication.',
    visibility: 'private',
    owner_id: uid(1),
    owner_email: 'demo@recsterio.local',
    parent_id: null,
    position: 1,
    created_at: iso(7_000_000),
    updated_at: iso(400_000),
    video_count: 0,
    my_role: 'editor',
    children: [],
  },
];

// File the seeded videos into the demo folders so the cards have a home.
mockVideos.forEach((video, index) => {
  if (index < 3) video.folder_id = uid(2001);
  else if (index < 5) video.folder_id = uid(2003);
  else video.folder_id = null;
  video.position = index;
});

interface MockFolderMember extends FolderMember {
  folder_id: string;
}

let mockFolderMembers: MockFolderMember[] = [
  {
    folder_id: uid(2001),
    user_id: uid(3001),
    email: 'reviewer@example.com',
    name: 'Sokha',
    role: 'commenter',
    created_at: iso(6_000_000),
  },
];

interface MockShare {
  id: string;
  folder_id: string;
  token: string;
  role: FolderRole | string;
  expires_at: string | null;
  revoked_at: string | null;
  created_by: string;
  created_at: string;
  url: string;
}

interface MockPasscode {
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
  code?: string | null;
}

let mockShares: MockShare[] = [];
let mockPasscodes: MockPasscode[] = [
  {
    id: uid(5001),
    folder_id: uid(2003),
    label: 'Reviewers',
    expires_at: null,
    max_uses: null,
    max_devices: 3,
    one_time: false,
    use_count: 2,
    device_count: 1,
    revoked_at: null,
    created_by: 'admin:demo@recsterio.local',
    created_at: iso(5_000_000),
  },
];

/** Whether the demo console account has a Telegram bound. Linking completes in the bot, never here. */
let mockTelegramLink: { telegram_user_id: number | null } = { telegram_user_id: null };

/** Drive links connected via the cloud storage section (mock state, resets on page reload). */
const mockDriveLinks: DriveLink[] = [];

/* ------------------------------------------------------------------- users */

/** One demo console account. `password` never leaves the mock. */
interface MockUser extends AdminUser {
  password: string;
}

/** The five demo accounts — one per role, so the login form can show every gated view. */
let mockUsers: MockUser[] = [
  {
    id: uid(6001),
    email: 'demo@recsterio.local',
    name: 'Demo owner',
    role: 'super_admin',
    is_active: true,
    created_at: iso(90_000_000),
    telegram_user_id: 12345678,
    password: 'demo1234',
  },
  {
    id: uid(6002),
    email: 'admin@recsterio.local',
    name: 'Platform admin',
    role: 'admin',
    is_active: true,
    created_at: iso(80_000_000),
    telegram_user_id: null,
    password: 'demo1234',
  },
  {
    id: uid(6003),
    email: 'dev@recsterio.local',
    name: 'Pipeline developer',
    role: 'developer',
    is_active: true,
    created_at: iso(70_000_000),
    telegram_user_id: null,
    password: 'demo1234',
  },
  {
    id: uid(6004),
    email: 'reviewer@recsterio.local',
    name: 'Transcript reviewer',
    role: 'reviewer',
    is_active: true,
    created_at: iso(60_000_000),
    telegram_user_id: null,
    password: 'demo1234',
  },
  {
    id: uid(6005),
    email: 'user@recsterio.local',
    name: 'Scoped member',
    role: 'user',
    is_active: true,
    created_at: iso(50_000_000),
    telegram_user_id: null,
    password: 'demo1234',
  },
];

/** Email of whoever last logged in — the mock's stand-in for the bearer token. */
let mockSessionEmail: string | null = null;

/** The wire shape of a user: everything except the stored password. */
const publicUser = (user: MockUser): AdminUser => {
  const { password: _password, ...safe } = user;
  return clone(safe);
};

function mockFolderTree(): Folder[] {
  const nodes = new Map<string, Folder>();
  mockFolders.forEach((folder) => {
    nodes.set(folder.id, {
      ...folder,
      video_count: mockVideos.filter((video) => video.folder_id === folder.id).length,
      children: [],
    });
  });
  const roots: Folder[] = [];
  mockFolders.forEach((folder) => {
    const node = nodes.get(folder.id);
    if (!node) return;
    if (folder.parent_id && nodes.has(folder.parent_id)) {
      nodes.get(folder.parent_id)?.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function mockCard(video: Video): MockDataCard {
  const transcripts = mockTranscripts
    .filter((transcript) => transcript.video_id === video.id)
    .sort((a, b) => b.version - a.version);
  const transcript = transcripts[0] ?? null;
  const folder = mockFolders.find((item) => item.id === video.folder_id) ?? null;
  return {
    video_id: video.id,
    title: video.title,
    source_url: video.source_url,
    status: video.status,
    duration_seconds: video.duration_seconds,
    thumbnail_url: video.thumbnail_url,
    folder_id: video.folder_id,
    folder_name: folder?.name ?? null,
    copied_from_id: video.copied_from_id,
    badge: transcript?.cleaned ? 'cleaned' : 'raw',
    transcript_id: transcript?.id ?? null,
    transcript_preview: transcript?.content ? transcript.content.slice(0, 240) : null,
    audio_available: video.status === 'transcribed',
    media_url: `/api/v1/videos/${video.id}/media`,
    audio_url: `/api/v1/videos/${video.id}/audio`,
    transcript_url: `/api/v1/videos/${video.id}/transcript`,
  };
}

function mockMembers(folderId: string): FolderMember[] {
  return mockFolderMembers
    .filter((member) => member.folder_id === folderId)
    .map(({ folder_id: _folderId, ...member }) => member);
}

const unauthorized = (message: string): MockResponse => ({
  status: 401,
  data: { error: { code: 'unauthorized', message } },
});

/** Routes a mock request. `path` is relative to the API base, e.g. "/videos?page=1". */
export function mockRequest(method: string, path: string, body: unknown): MockResponse {
  const [rawPath, rawQuery = ''] = path.split('?');
  const query = new URLSearchParams(rawQuery);
  const p = (k: string, fallback: number): number => {
    const v = query.get(k);
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const segments = rawPath.split('/').filter(Boolean);

  if (rawPath === '/auth/login' && method === 'POST') {
    const creds = body as { email?: string; password?: string };
    if (!creds?.email || !creds.password) {
      return {
        status: 422,
        data: {
          error: {
            code: 'validation_failed',
            message: 'email and password are required.',
            details: [{ field: 'email', issue: 'required' }],
          },
        },
      };
    }
    if (!creds.email.includes('@') || creds.password.length < 4) {
      return {
        status: 401,
        data: {
          error: {
            code: 'invalid_credentials',
            message: 'That email and password combination was not recognised.',
          },
        },
      };
    }
    // A seeded email signs in as that account's role; anything else gets the
    // plain 'user' role so the demo can show every gated view. The password
    // rule stays the demo one (≥4 chars, any value).
    const known = mockUsers.find((u) => u.email === creds.email);
    if (known && !known.is_active) {
      return {
        status: 403,
        data: {
          error: {
            code: 'account_deactivated',
            message: 'This account has been deactivated. Ask a super admin to reactivate it.',
          },
        },
      };
    }
    mockSessionEmail = known?.email ?? creds.email;
    const res: LoginResponse = {
      token: 'mock.admin.token.' + Date.now().toString(36),
      email: mockSessionEmail,
      role: known?.role ?? 'user',
      name: known?.name ?? null,
      expires_at: new Date(Date.now() + 12 * 3600_000).toISOString(),
    };
    return { status: 200, data: res };
  }

  if (rawPath === '/stats' && method === 'GET') {
    return { status: 200, data: clone(mockStats) };
  }

  if (rawPath === '/videos' && method === 'GET') {
    const status = query.get('status') ?? '';
    const platform = query.get('platform') ?? '';
    const q = query.get('q') ?? '';
    let items = mockVideos.filter(
      (v) =>
        (!status || v.status === status) &&
        (!platform || v.platform === platform) &&
        matches(v.title, q) &&
        matches(v.source_url, q),
    );
    const sort = query.get('sort') ?? '-created_at';
    items = [...items].sort((a, b) => {
      if (sort === 'title') return (a.title ?? '').localeCompare(b.title ?? '');
      const av = Date.parse(a.created_at);
      const bv = Date.parse(b.created_at);
      return sort === 'created_at' ? av - bv : bv - av;
    });
    return { status: 200, data: paginate(items, p('page', 1), p('page_size', 20)) };
  }

  if (rawPath === '/videos' && method === 'POST') {
    const payload = body as { source_url?: string; title?: string | null };
    const video: Video = {
      id: uid(900 + mockVideos.length),
      source_url: payload.source_url ?? 'https://example.org/new.mp4',
      platform: 'unknown',
      title: payload.title ?? null,
      notes: null,
      folder_id: null,
      position: 0,
      copied_from_id: null,
      status: 'pending',
      progress: 0,
      error: null,
      local_path: null,
      file_size: null,
      duration_seconds: null,
      mime_type: null,
      checksum_sha256: null,
      thumbnail_url: null,
      created_by: 'admin:demo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockVideos.unshift(video);
    return { status: 201, data: clone(video) };
  }

  if (segments[0] === 'videos' && segments.length >= 2) {
    const videoId = segments[1];
    const video = mockVideos.find((v) => v.id === videoId);
    if (!video) return notFound('Video not found.');

    if (segments.length === 2) {
      if (method === 'GET') {
        const detail: VideoDetail = {
          ...clone(video),
          transcripts: mockTranscripts
            .filter((t) => t.video_id === videoId)
            .sort((a, b) => b.version - a.version),
          jobs: mockJobs
            .filter((j) => j.video_id === videoId)
            .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
        };
        return { status: 200, data: detail };
      }
      if (method === 'DELETE') {
        const idx = mockVideos.findIndex((v) => v.id === videoId);
        if (idx >= 0) mockVideos.splice(idx, 1);
        return { status: 204, data: null };
      }
      if (method === 'PATCH') {
        const patch = body as Partial<Video>;
        Object.assign(video, patch, { updated_at: new Date().toISOString() });
        return { status: 200, data: clone(video) };
      }
    }

    if (segments[2] === 'retry' && method === 'POST') {
      const job: Job = {
        id: uid(900 + mockJobs.length),
        kind: 'download',
        video_id: videoId,
        status: 'queued',
        payload: { video_id: videoId },
        attempts: 0,
        max_attempts: 3,
        priority: 10,
        last_error: null,
        scheduled_at: new Date().toISOString(),
        started_at: null,
        finished_at: null,
        created_at: new Date().toISOString(),
      };
      mockJobs.unshift(job);
      video.status = 'pending';
      video.error = null;
      return { status: 202, data: clone(job) };
    }

    if (segments[2] === 'transcript' && segments.length === 3 && method === 'GET') {
      const list = mockTranscripts
        .filter((t) => t.video_id === videoId)
        .sort((a, b) => b.version - a.version);
      const current = list.find((t) => t.status === 'ready') ?? list[0];
      if (!current) return notFound('No transcript exists for this video yet.');
      return { status: 200, data: clone(current) };
    }

    if (segments[2] === 'transcripts' && method === 'GET') {
      const list = mockTranscripts
        .filter((t) => t.video_id === videoId)
        .sort((a, b) => b.version - a.version);
      return { status: 200, data: { items: clone(list) } };
    }

    if (segments[2] === 'transcript' && segments.length === 3 && method === 'PUT') {
      const payload = body as { content?: string; language?: string | null; cleaned?: boolean };
      const existing = mockTranscripts.filter((t) => t.video_id === videoId);
      const nextVersion = existing.reduce((max, t) => Math.max(max, t.version), 0) + 1;
      const created: Transcript = {
        id: uid(1000 + existing.length),
        video_id: videoId,
        version: nextVersion,
        source: 'manual',
        language: payload.language ?? existing[0]?.language ?? null,
        content: payload.content ?? '',
        segments: null,
        status: 'ready',
        cleaned: payload.cleaned ?? true,
        error: null,
        created_by: 'admin:demo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockTranscripts.push(created);
      return { status: 201, data: clone(created) };
    }

    if (segments[2] === 'transcript' && segments[3] === 'generate' && method === 'POST') {
      const payload = body as { engine?: string };
      const kinds =
        payload.engine === 'gemini'
          ? ['gemini_transcribe']
          : payload.engine === 'both'
            ? ['transcribe', 'gemini_transcribe']
            : ['extract_audio', 'transcribe'];
      const jobs = kinds.map((kind, i) => {
        const job: Job = {
          id: uid(1100 + mockJobs.length + i),
          kind,
          video_id: videoId,
          status: 'queued',
          payload: { video_id: videoId, engine: payload.engine },
          attempts: 0,
          max_attempts: 3,
          priority: 5,
          last_error: null,
          scheduled_at: new Date().toISOString(),
          started_at: null,
          finished_at: null,
          created_at: new Date().toISOString(),
        };
        mockJobs.unshift(job);
        return job;
      });
      return { status: 202, data: { jobs: clone(jobs) } };
    }

    if (segments[2] === 'transcript' && segments[3] === 'segments' && method === 'GET') {
      const current = mockTranscripts
        .filter((t) => t.video_id === videoId)
        .sort((a, b) => b.version - a.version)[0];
      return { status: 200, data: { segments: current?.segments ?? [] } };
    }

    if (segments[2] === 'merges' && method === 'GET') {
      const items = mockMerges
        .filter((m) => m.video_id === videoId)
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      return { status: 200, data: { items: clone(items) } };
    }

    if (segments[2] === 'media' && method === 'GET') {
      return notFound('Media is not available in demo data.');
    }

    if (segments[2] === 'folder' && method === 'PUT') {
      const payload = body as { folder_id?: string | null };
      video.folder_id = payload.folder_id ?? null;
      video.position = payload.folder_id
        ? mockVideos.filter((v) => v.folder_id === payload.folder_id).length
        : 0;
      video.updated_at = new Date().toISOString();
      return { status: 200, data: clone(video) };
    }

    if (segments[2] === 'copy' && method === 'POST') {
      const payload = body as { folder_id?: string };
      const dest = mockFolders.find((f) => f.id === payload.folder_id);
      if (!dest) return notFound('Folder not found.');
      if (video.folder_id === dest.id) {
        return {
          status: 422,
          data: {
            error: {
              code: 'validation_failed',
              message: 'That video is already in this folder.',
              details: [{ field: 'folder_id', issue: 'same_folder' }],
            },
          },
        };
      }
      const fork: Video = {
        ...clone(video),
        id: uid(900 + mockVideos.length),
        folder_id: dest.id,
        position: mockVideos.filter((v) => v.folder_id === dest.id).length,
        copied_from_id: video.id,
        created_by: 'admin:demo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockVideos.unshift(fork);
      const current = mockTranscripts
        .filter((t) => t.video_id === video.id)
        .sort((a, b) => b.version - a.version)[0];
      if (current) {
        mockTranscripts.push({
          ...clone(current),
          id: uid(1000 + mockTranscripts.length),
          video_id: fork.id,
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      return { status: 201, data: clone(fork) };
    }
  }

  if (segments[0] === 'merges' && segments.length >= 2) {
    const merge = mockMerges.find((m) => m.id === segments[1]);
    if (!merge) return notFound('Merge not found.');
    if (segments[2] === 'apply' && method === 'POST') {
      const transcript: Transcript = {
        id: uid(1200 + mockTranscripts.length),
        video_id: merge.video_id,
        version:
          mockTranscripts.filter((t) => t.video_id === merge.video_id).reduce((m, t) => Math.max(m, t.version), 0) +
          1,
        source: 'merged',
        language: null,
        cleaned: false,
        content: (merge.diff?.segments ?? [])
          .map((s) => s.merged_text ?? s.whisper_text ?? s.gemini_text ?? '')
          .join('\n'),
        segments: null,
        status: 'ready',
        error: null,
        created_by: 'admin:demo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockTranscripts.push(transcript);
      merge.merged_transcript_id = transcript.id;
      merge.status = 'ready';
      return { status: 200, data: clone(transcript) };
    }
    if (method === 'GET') {
      return { status: 200, data: clone(merge) };
    }
  }


  /* ------------------------------------------------ dataset (folders, cards) */

  if (rawPath === '/auth/guest' && method === 'POST') {
    return {
      status: 200,
      data: {
        token: 'mock.guest.token',
        role: 'guest',
        email: null,
        folder_ids: [],
        expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
      },
    };
  }

  if (rawPath === '/auth/me' && method === 'GET') {
    const current = mockUsers.find((u) => u.email === mockSessionEmail) ?? mockUsers[0];
    return {
      status: 200,
      data: {
        actor: `admin:${current.email}`,
        role: current.role,
        email: current.email,
        name: current.name,
        avatar_url: null,
        folder_ids: [],
      },
    };
  }

  if (rawPath === '/auth/telegram-link') {
    if (method === 'POST') {
      // Linking completes in the bot, never in the console — the mock keeps the
      // binding null and only hands out the one-time code.
      return {
        status: 200,
        data: {
          code: 'DEMO1234',
          deep_link: 'https://t.me/recsteriobot?start=link-DEMO1234',
          expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        },
      };
    }
    if (method === 'GET') return { status: 200, data: { ...mockTelegramLink } };
    if (method === 'DELETE') {
      mockTelegramLink.telegram_user_id = null;
      return { status: 204, data: null };
    }
  }

  /* -------------------------------------------------- users (super_admin demo) */

  if (rawPath === '/users' && method === 'GET') {
    const q = query.get('q') ?? '';
    const role = query.get('role') ?? '';
    const active = query.get('is_active');
    const items = mockUsers
      .filter(
        (u) =>
          (!role || u.role === role) &&
          (active === null ? true : String(u.is_active) === active) &&
          (matches(u.email, q) || matches(u.name, q)),
      )
      .map(publicUser);
    return { status: 200, data: paginate(items, p('page', 1), p('page_size', 20)) };
  }

  if (rawPath === '/users' && method === 'POST') {
    const payload = body as { email?: string; name?: string | null; role?: string; password?: string };
    const role = payload.role as AdminUser['role'] | undefined;
    if (
      !payload.email ||
      !payload.email.includes('@') ||
      !role ||
      !CONSOLE_ROLES.includes(role) ||
      !payload.password ||
      payload.password.length < 8
    ) {
      return {
        status: 422,
        data: {
          error: {
            code: 'validation_failed',
            message: 'An email, a console role and a password of at least 8 characters are required.',
            details: [{ field: 'password', issue: 'min_length' }],
          },
        },
      };
    }
    if (mockUsers.some((u) => u.email === payload.email)) {
      return {
        status: 409,
        data: {
          error: { code: 'duplicate_email', message: 'That email already has an account.' },
        },
      };
    }
    const user: MockUser = {
      id: uid(6010 + mockUsers.length),
      email: payload.email,
      name: payload.name ?? null,
      role,
      is_active: true,
      created_at: new Date().toISOString(),
      telegram_user_id: null,
      password: payload.password,
    };
    mockUsers.push(user);
    return { status: 201, data: publicUser(user) };
  }

  if (segments[0] === 'users' && segments.length === 2 && method === 'PATCH') {
    const user = mockUsers.find((u) => u.id === segments[1]);
    if (!user) return notFound('User not found.');
    const patch = body as { role?: string; is_active?: boolean; name?: string | null; password?: string };
    // The demo mirrors the server: you cannot change your own role or state.
    if ((patch.role !== undefined || patch.is_active !== undefined) && user.email === mockSessionEmail) {
      return {
        status: 422,
        data: {
          error: {
            code: 'self_modification_forbidden',
            message: 'You cannot change your own role or active state.',
          },
        },
      };
    }
    if (patch.role !== undefined && !CONSOLE_ROLES.includes(patch.role as AdminUser['role'])) {
      return {
        status: 422,
        data: {
          error: {
            code: 'validation_failed',
            message: 'That is not a console role.',
            details: [{ field: 'role', issue: 'invalid' }],
          },
        },
      };
    }
    if (patch.password !== undefined && patch.password.length < 8) {
      return {
        status: 422,
        data: {
          error: {
            code: 'validation_failed',
            message: 'The password must be at least 8 characters.',
            details: [{ field: 'password', issue: 'min_length' }],
          },
        },
      };
    }
    if (patch.role !== undefined) user.role = patch.role as AdminUser['role'];
    if (patch.is_active !== undefined) user.is_active = Boolean(patch.is_active);
    if (patch.name !== undefined) user.name = patch.name;
    if (patch.password !== undefined) user.password = patch.password;
    return { status: 200, data: publicUser(user) };
  }

  if (rawPath === '/public/config' && method === 'GET') {
    return {
      status: 200,
      data: { google_client_id: '', google_enabled: false, guest_enabled: true },
    };
  }

  if (rawPath === '/folders' && method === 'GET') {
    return { status: 200, data: { items: mockFolderTree(), total: mockFolders.length } };
  }

  if (rawPath === '/folders' && method === 'POST') {
    const payload = body as {
      name?: string;
      description?: string | null;
      visibility?: 'public' | 'private';
      parent_id?: string | null;
    };
    const folder: Folder = {
      id: uid(2000 + mockFolders.length),
      name: payload.name ?? 'New folder',
      description: payload.description ?? null,
      visibility: payload.visibility ?? 'private',
      owner_id: uid(1),
      owner_email: 'demo@recsterio.local',
      parent_id: payload.parent_id ?? null,
      position: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      video_count: 0,
      my_role: 'editor',
      children: [],
    };
    mockFolders.push(folder);
    return { status: 201, data: clone(folder) };
  }

  if (rawPath === '/dataset/cards' && method === 'GET') {
    const folderId = query.get('folder_id') ?? '';
    const cleaned = query.get('cleaned');
    const q = query.get('q') ?? '';
    let items = mockVideos
      .filter((v) => (!folderId || v.folder_id === folderId))
      .map((v) => mockCard(v))
      .filter((c) => (cleaned === null ? true : c.badge === 'cleaned') && (!q || matches(c.title, q) || matches(c.transcript_preview, q)));
    return { status: 200, data: paginate(items, p('page', 1), p('page_size', 20)) };
  }

  if (segments[0] === 'folders' && segments.length >= 2) {
    const folder = mockFolders.find((f) => f.id === segments[1]);
    if (!folder) return notFound('Folder not found.');
    if (segments.length === 2 && method === 'GET') return { status: 200, data: clone(folder) };
    if (segments.length === 2 && method === 'PATCH') {
      Object.assign(folder, body as Partial<Folder>);
      return { status: 200, data: clone(folder) };
    }
    if (segments.length === 2 && method === 'DELETE') {
      mockFolders = mockFolders.filter((f) => f.id !== folder.id);
      return { status: 204, data: null };
    }
    if (segments[2] === 'members' && method === 'GET') {
      return { status: 200, data: { items: mockMembers(folder.id) } };
    }
    if (segments[2] === 'members' && method === 'POST') {
      const payload = body as { email?: string; role?: FolderRole };
      const member = {
        user_id: uid(3000 + mockMembers(folder.id).length),
        email: payload.email ?? 'person@example.com',
        name: null,
        role: payload.role ?? 'viewer',
        created_at: new Date().toISOString(),
      };
      mockFolderMembers.push({ folder_id: folder.id, ...member });
      return { status: 201, data: member };
    }
    if (segments[2] === 'shares' && method === 'GET') {
      return { status: 200, data: mockShares.filter((s) => s.folder_id === folder.id) };
    }
    if (segments[2] === 'shares' && method === 'POST') {
      const payload = body as { role?: FolderRole; expires_at?: string | null };
      const share = {
        id: uid(4000 + mockShares.length),
        folder_id: folder.id,
        token: `mock-${Math.random().toString(36).slice(2, 12)}`,
        role: payload.role ?? 'viewer',
        expires_at: payload.expires_at ?? null,
        revoked_at: null,
        created_by: 'admin:demo@recsterio.local',
        created_at: new Date().toISOString(),
        url: '',
      };
      share.url = `${window.location.origin}/share/${share.token}`;
      mockShares.push(share);
      return { status: 201, data: share };
    }
    if (segments[2] === 'passcodes' && method === 'GET') {
      return { status: 200, data: mockPasscodes.filter((c) => c.folder_id === folder.id) };
    }
    if (segments[2] === 'passcodes' && method === 'POST') {
      const payload = body as { code?: string | null; label?: string | null; one_time?: boolean; max_uses?: number | null; max_devices?: number | null; expires_at?: string | null };
      const generated = !payload.code;
      const passcode = {
        id: uid(5000 + mockPasscodes.length),
        folder_id: folder.id,
        label: payload.label ?? null,
        expires_at: payload.expires_at ?? null,
        max_uses: payload.max_uses ?? null,
        max_devices: payload.max_devices ?? null,
        one_time: Boolean(payload.one_time),
        use_count: 0,
        device_count: 0,
        revoked_at: null,
        created_by: 'admin:demo@recsterio.local',
        created_at: new Date().toISOString(),
        code: generated ? 'DEMO-PASS' : null,
      };
      mockPasscodes.push(passcode);
      return { status: 201, data: clone(passcode) };
    }
    if (segments[2] === 'download' && method === 'GET') {
      return notFound('ZIP export is not available in demo data.');
    }
  }

  if (segments[0] === 'shares' && segments.length === 2 && method === 'DELETE') {
    mockShares = mockShares.filter((s) => s.id !== segments[1]);
    return { status: 204, data: null };
  }

  if (segments[0] === 'passcodes' && segments.length === 2 && method === 'DELETE') {
    mockPasscodes = mockPasscodes.filter((c) => c.id !== segments[1]);
    return { status: 204, data: null };
  }

  if (rawPath === '/public/folders' && method === 'GET') {
    const roots = mockFolderTree().filter((f) => f.visibility === 'public');
    return { status: 200, data: { items: roots, total: roots.length } };
  }

  if (segments[0] === 'public' && segments[1] === 'folders' && segments.length === 3 && method === 'GET') {
    const folder = mockFolders.find((f) => f.id === segments[2]);
    if (!folder) return notFound('Folder not found.');
    return {
      status: 200,
      data: {
        id: folder.id,
        name: folder.name,
        description: folder.description,
        visibility: folder.visibility,
        cards: mockVideos.filter((v) => v.folder_id === folder.id).map(mockCard),
        children: [],
      },
    };
  }

  if (rawPath === '/public/passcodes/redeem' && method === 'POST') {
    const payload = body as { folder_id?: string; code?: string };
    const passcode = mockPasscodes.find(
      (c) => c.folder_id === payload.folder_id && (c.code === payload.code || payload.code === 'DEMO-PASS'),
    );
    if (!passcode) return unauthorized('That passcode is not valid.');
    return {
      status: 200,
      data: {
        token: 'mock.guest.token',
        expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
        folder_id: payload.folder_id,
        role: 'guest',
        access: 'passcode',
      },
    };
  }

  if (segments[0] === 'public' && segments[1] === 'shares' && segments[3] === 'redeem' && method === 'POST') {
    const share = mockShares.find((s) => s.token === segments[2] && !s.revoked_at);
    if (!share) return notFound('This share link is not valid.');
    return {
      status: 200,
      data: {
        token: 'mock.guest.token',
        expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
        folder_id: share.folder_id,
        role: 'guest',
        access: 'share',
      },
    };
  }

  if (rawPath === '/jobs' && method === 'GET') {
    const status = query.get('status') ?? '';
    const kind = query.get('kind') ?? '';
    const videoId = query.get('video_id') ?? '';
    const items = mockJobs.filter(
      (j) =>
        (!status || j.status === status) &&
        (!kind || j.kind === kind) &&
        (!videoId || j.video_id === videoId),
    );
    return { status: 200, data: paginate(items, p('page', 1), p('page_size', 20)) };
  }

  if (segments[0] === 'jobs' && segments.length >= 2) {
    const job = mockJobs.find((j) => j.id === segments[1]);
    if (!job) return notFound('Job not found.');
    if (segments[2] === 'retry' && method === 'POST') {
      job.status = 'queued';
      job.attempts = 0;
      job.last_error = null;
      job.scheduled_at = new Date().toISOString();
      job.finished_at = null;
      return { status: 202, data: clone(job) };
    }
    if (segments[2] === 'cancel' && method === 'POST') {
      job.status = 'failed';
      job.last_error = 'cancelled';
      job.finished_at = new Date().toISOString();
      return { status: 200, data: clone(job) };
    }
    if (method === 'GET') {
      return { status: 200, data: clone(job) };
    }
  }

  /* ------------------------------------------------------------------ cloud */
  if (rawPath === '/cloud/providers' && method === 'GET') {
    return { status: 200, data: { google: true, onedrive: false } as CloudProviders };
  }
  if (rawPath === '/cloud/links' && method === 'GET') {
    return { status: 200, data: clone(mockDriveLinks) };
  }
  if (rawPath === '/cloud/links' && method === 'POST') {
    const providerName = (body as { provider?: string })?.provider ?? 'google';
    const link: DriveLink = {
      id: `mock-drive-${mockDriveLinks.length + 1}`,
      provider: providerName as CloudBackend,
      account_email: 'demo@example.com',
      connected_at: new Date().toISOString(),
    };
    mockDriveLinks.push(link);
    return { status: 201, data: clone(link) };
  }
  if (segments[0] === 'cloud' && segments[1] === 'links' && segments[2] && method === 'DELETE') {
    const idx = mockDriveLinks.findIndex((l) => l.provider === segments[2]);
    if (idx >= 0) mockDriveLinks.splice(idx, 1);
    return { status: 204, data: undefined };
  }

  return notFound(`No mock route for ${method} ${rawPath}.`);
}
