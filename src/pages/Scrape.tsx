/**
 * Auto scrape (instruction.txt #10): paste a video link — a direct file or an
 * app domain — and the worker downloads, extracts audio and transcribes it.
 * The finished unit is shown as a card, ready to be filed into a folder.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, foldersApi, videosApi } from '../api/client';
import type { DataCard as DataCardModel, Video, VideoDetail } from '../api/types';
import CardEditDialog from '../components/CardEditDialog';
import DataCard from '../components/DataCard';
import { btnNeutral, btnPrimary, inputCls } from '../components/ui';
import { ArrowUpRightIcon, FolderIcon, UploadIcon } from '../components/icons';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/toast';

interface RecentItem {
  id: string;
  url: string;
  status: string;
  progress: number;
  error: string | null;
  card: DataCardModel | null;
}

function cardFrom(detail: VideoDetail): DataCardModel | null {
  if (detail.status !== 'transcribed' && detail.status !== 'downloaded') return null;
  const transcript =
    detail.transcripts.find((item) => item.status === 'ready') ?? detail.transcripts[0] ?? null;
  return {
    video_id: detail.id,
    title: detail.title,
    source_url: detail.source_url,
    status: detail.status,
    duration_seconds: detail.duration_seconds,
    thumbnail_url: detail.thumbnail_url,
    folder_id: detail.folder_id,
    folder_name: null,
    badge: transcript?.cleaned ? 'cleaned' : 'raw',
    transcript_id: transcript?.id ?? null,
    transcript_preview: transcript?.content ? transcript.content.slice(0, 240) : null,
    audio_available: Boolean(detail.status === 'transcribed'),
    media_url: `/api/v1/videos/${detail.id}/media`,
    audio_url: `/api/v1/videos/${detail.id}/audio`,
    transcript_url: `/api/v1/videos/${detail.id}/transcript`,
  };
}

export default function Scrape() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editCard, setEditCard] = useState<DataCardModel | null>(null);
  const [folders, setFolders] = useState<import('../api/types').Folder[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pollRef = useRef<number | null>(null);

  const stopPolling = useCallback((): void => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  /** Watch one video until it is transcribed (or fails), then show its card. */
  const watch = useCallback(
    (videoId: string): void => {
      stopPolling();
      setActiveId(videoId);
      let ticks = 0;
      const tick = async (): Promise<void> => {
        ticks += 1;
        try {
          const detail = await videosApi.get(videoId);
          setRecent((items) =>
            items.map((item) =>
              item.id === videoId
                ? {
                    ...item,
                    status: detail.status,
                    progress: detail.progress,
                    error: detail.error,
                    card: cardFrom(detail),
                  }
                : item,
            ),
          );
          const settled = ['transcribed', 'failed', 'quarantined'].includes(detail.status);
          if (settled || ticks > 90) {
            stopPolling();
            setActiveId(null);
            if (detail.status === 'transcribed') {
              toast.success('Transcription ready — the unit is on the right.');
            }
          }
        } catch {
          if (ticks > 5) {
            stopPolling();
            setActiveId(null);
          }
        }
      };
      void tick();
      pollRef.current = window.setInterval(() => void tick(), 2000);
    },
    [stopPolling],
  );

  const addItem = (video: Video, sourceLabel: string): void => {
    setRecent((items) => [
      {
        id: video.id,
        url: sourceLabel,
        status: video.status,
        progress: video.progress,
        error: video.error,
        card: null,
      },
      ...items.filter((item) => item.id !== video.id),
    ]);
    watch(video.id);
  };

  const submit = async (): Promise<void> => {
    if (!url.trim()) {
      setError({ code: 'validation_failed', message: 'Paste a video link first.' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const video = await videosApi.create({ source_url: url.trim(), start_transcription: true });
      addItem(video, url.trim());
      setUrl('');
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError instanceof ApiError && apiError.code === 'conflict') {
        // The URL is already in the library; show that unit instead of an error.
        try {
          const existing = await videosApi.list({ q: url.trim(), page_size: 1 });
          const found = existing.items[0];
          if (found) {
            addItem(found, found.source_url);
            setUrl('');
            toast.info('That link is already in the library — tracking the existing unit.');
            return;
          }
        } catch {
          /* fall through to the error below */
        }
      }
      setError(
        apiError instanceof ApiError
          ? {
              code: apiError.code,
              message:
                apiError.message.includes('TikTok') || apiError.message.includes('unavailable')
                  ? `${apiError.message} Tip: upload the file from this device instead.`
                  : apiError.message,
            }
          : { code: 'unexpected_error', message: 'Could not queue that link.' },
      );
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const video = await videosApi.upload({ file, start_transcription: true });
      addItem(video, file.name);
      toast.success(`Uploaded “${file.name}” — extracting audio now.`);
    } catch (err) {
      const apiError = err as ApiError;
      setError({
        code: apiError instanceof ApiError ? apiError.code : 'upload_failed',
        message:
          apiError instanceof ApiError
            ? apiError.message
            : 'Could not upload that file.',
      });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const latest = recent[0] ?? null;

  const openEditor = async (card: DataCardModel): Promise<void> => {
    // The edit dialog can file the card into a folder; it needs the tree.
    try {
      const tree = await foldersApi.list();
      const flat: import('../api/types').Folder[] = [];
      const walk = (items: import('../api/types').Folder[]): void => {
        items.forEach((folder) => {
          flat.push(folder);
          walk(folder.children ?? []);
        });
      };
      walk(tree.items);
      setFolders(flat);
    } catch {
      setFolders([]);
    }
    setEditCard(card);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-fg">Enter url</h1>
        <p className="mt-1 text-sm text-dim">
          Paste a direct video link or an app domain — YouTube, TikTok, Facebook, Instagram — and
          RecSterio downloads it, extracts the audio and transcribes the Khmer–English speech.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            id="scrape-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://"
            autoComplete="off"
            inputMode="url"
            aria-label="Video URL"
            className={`${inputCls} h-12 rounded-full border-2 px-5 pr-12 text-base`}
          />
          <button
            type="submit"
            disabled={busy}
            aria-label="Download and transcribe"
            className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-fg text-base transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-base/40 border-t-base" />
            ) : (
              <ArrowUpRightIcon size={17} />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className={`${btnNeutral} h-12 rounded-full px-3`}
          title="Upload a file from this device"
        >
          <UploadIcon size={16} />
          <span className="hidden sm:inline">Upload</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="video/*,audio/*,.mp4,.mov,.mkv,.webm,.mp3,.wav,.m4a"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </form>

      {error ? (
        <div role="alert" className="rounded-lg border border-bad/40 bg-bad-soft px-4 py-3">
          <p className="font-mono text-2xs uppercase tracking-wider text-bad">{error.code}</p>
          <p className="mt-0.5 text-sm text-fg">{error.message}</p>
        </div>
      ) : null}

      {recent.length === 0 ? (
        <div className="glow-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-sm font-semibold text-fg">What happens next</h2>
              <p className="mt-1 text-xs text-dim">
                Download → extract 16 kHz audio → transcribe with per-segment Khmer/English tags.
                Large files (over 20 MB) go through this page rather than the Telegram bot.
              </p>
            </div>
            <span className="hidden shrink-0 rounded-full border border-line bg-raised px-2.5 py-1 text-2xs uppercase tracking-wider text-faint sm:inline">
              queue
            </span>
          </div>
          <div className="mt-4 grid gap-2 text-xs text-faint sm:grid-cols-3">
            {['Video', 'Audio', 'Transcript'].map((label, index) => (
              <div key={label} className="rounded-lg border border-dashed border-line px-3 py-6 text-center">
                <p className="font-mono text-2xs uppercase tracking-wider">{`0${index + 1}`}</p>
                <p className="mt-1 text-dim">{label}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {latest ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold text-fg">
              {latest.card ? 'Your unit' : 'Processing'}
            </h2>
            <span className="max-w-[60%] truncate font-mono text-2xs text-faint">{latest.url}</span>
          </div>

          {latest.card ? (
            <DataCard
              card={latest.card}
              editable={isAuthenticated}
              onEdit={(card) => void openEditor(card)}
            />
          ) : (
            <div className="glow-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-fg">
                    {latest.status === 'failed'
                      ? 'That link could not be processed'
                      : latest.status === 'downloading'
                        ? 'Downloading…'
                        : latest.status === 'transcribing'
                          ? 'Transcribing Khmer–English speech…'
                          : 'Working…'}
                  </p>
                  <p className="mt-0.5 truncate text-2xs text-faint">
                    {latest.error ?? latest.url}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs text-dim">
                  {latest.status === 'failed' ? '—' : `${latest.progress}%`}
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised">
                <div
                  className={`h-full rounded-full transition-all ${
                    latest.status === 'failed' ? 'bg-bad' : 'bg-accent'
                  }`}
                  style={{ width: `${Math.max(4, latest.progress)}%` }}
                />
              </div>
              {latest.status === 'failed' ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className={btnPrimary}
                  >
                    <UploadIcon size={14} /> Upload the file instead
                  </button>
                  <button type="button" onClick={() => setRecent([])} className={btnNeutral}>
                    Dismiss
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {recent.length > 1 ? (
        <section className="space-y-2">
          <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-faint">
            This session
          </h2>
          <ul className="card divide-y divide-line-soft">
            {recent.slice(1).map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    item.status === 'failed'
                      ? 'bg-bad'
                      : item.status === 'transcribed'
                        ? 'bg-ok'
                        : 'bg-accent'
                  }`}
                />
                <span className="min-w-0 flex-1 truncate text-xs text-dim">{item.url}</span>
                <span className="shrink-0 font-mono text-2xs uppercase tracking-wider text-faint">
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-card px-3.5 py-2.5">
        <p className="text-xs text-dim">
          Keep the unit? File it into a dataset folder and it becomes part of the ZIP export.
        </p>
        <button type="button" onClick={() => navigate('/dataset')} className={btnNeutral}>
          <FolderIcon size={14} /> Open dataset
        </button>
      </div>

      <CardEditDialog
        card={editCard}
        folders={folders}
        onClose={() => setEditCard(null)}
        onSaved={() => {
          setRecent((items) =>
            items.map((item) =>
              item.card ? { ...item, card: { ...item.card, folder_name: null } } : item,
            ),
          );
          if (activeId === null) toast.info('Saved. Find it in the dataset browser.');
        }}
      />
    </div>
  );
}
