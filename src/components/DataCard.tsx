/**
 * One dataset unit (instruction.txt #8, #9): video, audio and transcript in a
 * single card, with the Raw/Cleaned badge and edit/delete controls for people
 * who hold the editor role.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, mediaApi } from '../api/client';
import type { DataCard as DataCardModel } from '../api/types';
import { formatDuration } from '../lib/format';
import { claimPlayback, releasePlayback } from '../lib/playback';
import { toast } from '../store/toast';
import {
  DownloadIcon,
  FolderIcon,
  LockIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  SpeakerIcon,
  TrashIcon,
} from './icons';

interface DataCardProps {
  card: DataCardModel;
  editable?: boolean;
  /**
   * Right to delete the unit. Defaults to `editable` so existing callers keep
   * the old behaviour; the dataset passes it separately because reviewers may
   * edit transcripts but never delete.
   */
  deletable?: boolean;
  onEdit?: (card: DataCardModel) => void;
  onDelete?: (card: DataCardModel) => void;
  /**
   * Open the move/copy dialog. Offered even when the card is not editable,
   * because copying somebody else's unit into your own folder is the whole
   * point of a fork — it only needs read access to this card.
   */
  onFile?: (card: DataCardModel) => void;
  index?: number;
}

/** Loads protected media through the API client, then plays it from a blob. */
function useMediaBlob(kind: 'video' | 'audio', videoId: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, []);

  const load = async (): Promise<string | null> => {
    if (urlRef.current) return urlRef.current;
    setLoading(true);
    try {
      const blob = kind === 'video' ? await mediaApi.video(videoId) : await mediaApi.audio(videoId);
      const next = URL.createObjectURL(blob);
      urlRef.current = next;
      setUrl(next);
      return next;
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(
        apiError instanceof ApiError ? apiError.code : 'media_failed',
        apiError instanceof ApiError ? apiError.message : 'Could not load this file.',
      );
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { url, loading, load };
}

function VideoPane({ card }: { card: DataCardModel }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { url, loading, load } = useMediaBlob('video', card.video_id);
  // A cloud-stored unit whose drive is disconnected cannot be fetched: the
  // play button would only ever produce a 404, so it is not offered.
  const driveOffline = card.storage_backend != null && card.storage_available === false;
  const ready = (card.status === 'transcribed' || card.status === 'downloaded') && !driveOffline;

  const start = async (): Promise<void> => {
    const src = await load();
    if (!src) return;
    window.setTimeout(() => {
      void videoRef.current?.play();
    }, 30);
  };

  return (
    <div>
      <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.16em] text-faint">Video</p>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-line bg-[linear-gradient(135deg,rgb(var(--c-accent-soft))_0%,rgb(var(--c-raised))_55%,rgb(var(--c-rose-soft))_100%)]">
        {url ? (
          <video
            ref={videoRef}
            src={url}
            controls
            playsInline
            // One screen, one soundtrack: starting this stops any other card.
            onPlay={(event) => claimPlayback(event.currentTarget)}
            onPause={(event) => releasePlayback(event.currentTarget)}
            onEnded={(event) => releasePlayback(event.currentTarget)}
            className="h-full w-full object-contain"
          />
        ) : (
          <button
            type="button"
            onClick={() => void start()}
            disabled={!ready || loading}
            aria-label={
              driveOffline
                ? "Storage unavailable — the contributor's drive is disconnected"
                : ready
                  ? `Play ${card.title ?? 'video'}`
                  : 'Media is still processing'
            }
            className="group relative flex h-full w-full items-center justify-center"
          >
            {card.thumbnail_url ? (
              <img
                src={card.thumbnail_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-80"
              />
            ) : (
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgb(var(--c-accent)/0.22),transparent_65%)]" />
            )}
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-fg/15 bg-card/80 text-fg shadow-panel backdrop-blur transition group-hover:scale-105 group-disabled:opacity-60">
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <PlayIcon size={22} />
              )}
            </span>
            {!ready ? (
              <span className="absolute bottom-2 left-2 rounded-full bg-card/85 px-2 py-0.5 text-2xs uppercase tracking-wider text-dim ring-1 ring-line">
                {driveOffline ? 'storage unavailable' : card.status}
              </span>
            ) : null}
          </button>
        )}
      </div>
    </div>
  );
}

const BAR_HEIGHTS = [
  10, 18, 26, 14, 30, 22, 34, 16, 26, 12, 30, 20, 36, 24, 16, 28, 12, 22, 32, 18, 28, 14, 34, 20,
  26, 12, 30, 22, 16, 26, 14, 20, 30, 18, 26, 12, 24, 16,
];

/**
 * The audio artifact: one player, not two.
 *
 * The row itself is the player — its button drives a hidden `<audio>` element.
 * Rendering a native `<audio controls>` underneath as well (as this used to)
 * showed the same clip twice, and the two play states fought each other.
 * The waveform doubles as the seek bar, so nothing is lost by hiding the
 * browser's own controls.
 */
function AudioPane({ card }: { card: DataCardModel }) {
  const { url, loading, load } = useMediaBlob('audio', card.video_id);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [armed, setArmed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const duration = card.duration_seconds ?? 0;
  const progress = duration > 0 ? Math.min(1, elapsed / duration) : 0;

  // Start playing as soon as the bytes exist: the first click only had the
  // blob URL to fetch, and asking for a second click to hear it is a bug.
  useEffect(() => {
    if (!armed || !url) return;
    const audio = audioRef.current;
    if (audio) void audio.play().catch(() => setPlaying(false));
  }, [armed, url]);

  const toggle = async (): Promise<void> => {
    if (!url) {
      setArmed(true);
      const src = await load();
      if (!src) setArmed(false);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      claimPlayback(audio);
      await audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  };

  // Click anywhere on the waveform to seek, like the native scrubber did.
  const seek = (event: React.MouseEvent<HTMLDivElement>): void => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = fraction * audio.duration;
    setElapsed(audio.currentTime);
  };

  const playedBars = Math.round(progress * BAR_HEIGHTS.length);

  return (
    <div>
      <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.16em] text-faint">Audio</p>
      <div className="flex items-center gap-3 rounded-xl border border-line bg-raised/70 px-3 py-2">
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={!card.audio_available || loading}
          aria-label={playing ? 'Pause audio' : 'Play audio'}
          className="tap-pad flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-card text-fg transition hover:border-accent/50 disabled:opacity-40"
        >
          {loading ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
          ) : playing ? (
            <PauseIcon size={13} />
          ) : (
            <PlayIcon size={13} />
          )}
        </button>

        <div
          role="slider"
          tabIndex={0}
          aria-label="Seek audio"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(elapsed)}
          onClick={seek}
          onKeyDown={(event) => {
            const audio = audioRef.current;
            if (!audio) return;
            if (event.key === 'ArrowRight') audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
            else if (event.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
          }}
          className="flex h-10 min-w-0 flex-1 cursor-pointer items-center gap-[2px] overflow-hidden rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          {BAR_HEIGHTS.map((height, i) => (
            <span
              key={i}
              className={`wave-bar ${playing ? 'animate-pulse-bar' : ''} ${
                i < playedBars ? 'bg-accent' : ''
              }`}
              style={{
                height: `${height}px`,
                animationDelay: `${(i % 7) * 90}ms`,
                opacity: playing ? 0.9 : 0.45,
              }}
            />
          ))}
        </div>

        <span className="shrink-0 font-mono text-2xs tabular-nums text-faint">
          {card.audio_available
            ? `${formatDuration(elapsed)} / ${formatDuration(card.duration_seconds)}`
            : 'no audio'}
        </span>
      </div>

      {/* One hidden element is the only player on the card. */}
      {armed ? (
        <audio
          ref={audioRef}
          src={url ?? undefined}
          preload="metadata"
          onPlay={(event) => {
            claimPlayback(event.currentTarget);
            setPlaying(true);
          }}
          onPause={(event) => {
            releasePlayback(event.currentTarget);
            setPlaying(false);
          }}
          onTimeUpdate={() => setElapsed(audioRef.current?.currentTime ?? 0)}
          onEnded={(event) => {
            releasePlayback(event.currentTarget);
            setPlaying(false);
            setElapsed(0);
          }}
          className="hidden"
        />
      ) : null}
    </div>
  );
}

function TranscriptPane({
  card,
  editable,
  onEdit,
}: {
  card: DataCardModel;
  editable: boolean;
  onEdit?: (card: DataCardModel) => void;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const text = card.transcript_preview ?? '';

  // The toggle only appears when the clamped text is actually cut off.
  useEffect(() => {
    const el = textRef.current;
    if (el) setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);
  const initial = useMemo(() => (card.title?.trim()?.[0] ?? 'R').toUpperCase(), [card.title]);

  const speak = (): void => {
    if (!('speechSynthesis' in window) || !text) {
      toast.info('This browser cannot read the transcript aloud.');
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    // Reading aloud is playback too: it stops any other card, and starting a
    // video or audio player cancels it (see lib/playback).
    claimPlayback({ pause: () => window.speechSynthesis.cancel() });
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'km-KH';
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-faint">Transcript</p>
        <span
          className={`chip ${
            card.badge === 'cleaned'
              ? 'border-ok/40 bg-ok-soft text-ok'
              : 'border-bad/40 bg-rose-soft text-bad'
          }`}
        >
          {card.badge === 'cleaned' ? 'Cleaned' : 'Raw'}
        </span>
      </div>

      <div className="rounded-xl border border-line bg-raised/60 p-3">
        {text ? (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bad text-2xs font-bold text-white">
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <p
                ref={textRef}
                className={`text-sm leading-relaxed text-fg${expanded ? '' : ' line-clamp-5'}`}
                style={{ overflowWrap: 'anywhere' }}
                title={expanded ? undefined : text}
              >
                {text}
              </p>
              {overflowing || expanded ? (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="tap-pad mt-1 rounded text-2xs font-semibold uppercase tracking-wider text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              ) : null}
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={speak}
                  aria-label={speaking ? 'Stop reading' : 'Read transcript aloud'}
                  className="icon-btn h-7 w-7"
                >
                  <SpeakerIcon size={13} />
                </button>
                {editable ? (
                  <button
                    type="button"
                    onClick={() => onEdit?.(card)}
                    aria-label="Edit transcript"
                    className="icon-btn h-7 w-7"
                  >
                    <PencilIcon size={13} />
                  </button>
                ) : null}
                <span className="ml-auto font-mono text-2xs uppercase tracking-wider text-faint">
                  {card.status === 'transcribed' ? 'ready' : card.status}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-faint">No transcript yet.</p>
            {card.status !== 'failed' ? (
              <span className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-faint">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                processing
              </span>
            ) : (
              <span className="chip border-bad/40 bg-bad-soft text-bad">failed</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DataCard({
  card,
  editable = false,
  deletable,
  onEdit,
  onDelete,
  onFile,
  index = 0,
}: DataCardProps) {
  const canDelete = deletable ?? editable;
  // min-w-0 lets the grid track shrink below the card's min-content width —
  // the truncated title is nowrap, so without it the card pushed ~120px of
  // horizontal scroll at 360px (same bug the portal's DataCard had).
  return (
    <article
      className="glow-card min-w-0 animate-fade-up p-4"
      style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-sm font-semibold text-fg">
            {card.title ?? card.source_url ?? 'Untitled recording'}
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-faint">
            {card.folder_name ? (
              <span className="inline-flex items-center gap-1">
                {card.folder_name}
              </span>
            ) : (
              <span>Unfiled</span>
            )}
            {card.copied_from_id ? (
              <>
                <span aria-hidden="true">·</span>
                <span
                  className="chip border-accent/40 bg-accent/10 text-accent"
                  title="A copy of another unit — the original is somewhere else"
                >
                  copy
                </span>
              </>
            ) : null}
            {card.storage_backend ? (
              <>
                <span aria-hidden="true">·</span>
                <span
                  className={`chip ${
                    card.storage_available === false
                      ? 'border-bad/40 bg-bad-soft text-bad'
                      : 'border-ok/40 bg-ok-soft text-ok'
                  }`}
                  title={
                    card.storage_available === false
                      ? "The contributor's drive is disconnected — reconnect it to play this unit"
                      : `Stored in the contributor's ${card.storage_backend === 'google' ? 'Google Drive' : 'OneDrive'}`
                  }
                >
                  {card.storage_available === false
                    ? 'drive offline'
                    : card.storage_backend === 'google'
                      ? 'drive'
                      : 'onedrive'}
                </span>
              </>
            ) : null}
            <span aria-hidden="true">·</span>
            <span className="font-mono">{formatDuration(card.duration_seconds)}</span>
            {card.source_url && !card.source_url.startsWith('upload://') ? (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={card.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="tap-pad inline-flex items-center truncate text-accent hover:underline"
                >
                  source
                </a>
              </>
            ) : (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <LockIcon size={10} /> uploaded
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {onFile ? (
            <button
              type="button"
              onClick={() => onFile(card)}
              className="icon-btn"
              aria-label="Move or copy this unit to a folder"
              title="Move or copy to a folder"
            >
              <FolderIcon size={14} />
            </button>
          ) : null}
          {editable ? (
            <button
              type="button"
              onClick={() => onEdit?.(card)}
              className="icon-btn"
              aria-label="Edit this card"
            >
              <PencilIcon size={14} />
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              onClick={() => onDelete?.(card)}
              className="icon-btn hover:border-bad/50 hover:bg-bad-soft hover:text-bad"
              aria-label="Delete this card"
            >
              <TrashIcon size={14} />
            </button>
          ) : null}
        </div>
      </header>

      <div className="space-y-3.5">
        <VideoPane card={card} />
        <AudioPane card={card} />
        <TranscriptPane card={card} editable={editable} onEdit={onEdit} />
      </div>

      <footer className="mt-3 flex items-center justify-between border-t border-line-soft pt-2.5 text-2xs text-faint">
        <span className="font-mono uppercase tracking-wider">{card.video_id.slice(0, 8)}</span>
        <a
          href={card.media_url}
          onClick={(event) => event.preventDefault()}
          className="pointer-events-none inline-flex items-center gap-1"
          aria-hidden="true"
        >
          <DownloadIcon size={11} /> dataset unit
        </a>
      </footer>
    </article>
  );
}
