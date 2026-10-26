/**
 * One dataset unit (instruction.txt #8, #9): video, audio and transcript in a
 * single card, with the Raw/Cleaned badge and edit/delete controls for people
 * who hold the editor role.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, mediaApi } from '../api/client';
import type { DataCard as DataCardModel } from '../api/types';
import { formatDuration, truncate } from '../lib/format';
import { toast } from '../store/toast';
import {
  DownloadIcon,
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
  onEdit?: (card: DataCardModel) => void;
  onDelete?: (card: DataCardModel) => void;
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
  const ready = card.status === 'transcribed' || card.status === 'downloaded';

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
            className="h-full w-full object-contain"
          />
        ) : (
          <button
            type="button"
            onClick={() => void start()}
            disabled={!ready || loading}
            aria-label={ready ? `Play ${card.title ?? 'video'}` : 'Media is still processing'}
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
                {card.status}
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

function AudioPane({ card }: { card: DataCardModel }) {
  const { url, loading, load } = useMediaBlob('audio', card.video_id);
  const [armed, setArmed] = useState(false);
  const [playing, setPlaying] = useState(false);

  const toggle = async (): Promise<void> => {
    if (!url) {
      const src = await load();
      if (!src) return;
      setArmed(true);
      return;
    }
    setArmed(true);
    setPlaying((p) => !p);
  };

  return (
    <div>
      <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.16em] text-faint">Audio</p>
      <div className="flex items-center gap-3 rounded-xl border border-line bg-raised/70 px-3 py-2">
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={!card.audio_available || loading}
          aria-label={playing ? 'Pause audio' : 'Play audio'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-card text-fg transition hover:border-accent/50 disabled:opacity-40"
        >
          {loading ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
          ) : playing ? (
            <PauseIcon size={13} />
          ) : (
            <PlayIcon size={13} />
          )}
        </button>

        <div className="flex h-10 min-w-0 flex-1 items-center gap-[2px] overflow-hidden" aria-hidden="true">
          {BAR_HEIGHTS.map((height, i) => (
            <span
              key={i}
              className={`wave-bar ${playing ? 'animate-pulse-bar' : ''}`}
              style={{
                height: `${height}px`,
                animationDelay: `${(i % 7) * 90}ms`,
                opacity: playing ? 0.9 : 0.45,
              }}
            />
          ))}
        </div>

        <span className="shrink-0 font-mono text-2xs text-faint">
          {card.audio_available ? formatDuration(card.duration_seconds) : 'no audio'}
        </span>
      </div>
      {armed && url ? (
        <audio
          src={url}
          controls
          autoPlay
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className="mt-2 h-8 w-full"
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
  const text = card.transcript_preview ?? '';
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
                className="text-sm leading-relaxed text-fg"
                style={{ overflowWrap: 'anywhere' }}
                title={text}
              >
                {truncate(text, 220)}
              </p>
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

export default function DataCard({ card, editable = false, onEdit, onDelete, index = 0 }: DataCardProps) {
  return (
    <article
      className="glow-card animate-fade-up p-4"
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
            <span aria-hidden="true">·</span>
            <span className="font-mono">{formatDuration(card.duration_seconds)}</span>
            {card.source_url && !card.source_url.startsWith('upload://') ? (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={card.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-accent hover:underline"
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
          {editable ? (
            <>
              <button
                type="button"
                onClick={() => onEdit?.(card)}
                className="icon-btn"
                aria-label="Edit this card"
              >
                <PencilIcon size={14} />
              </button>
              <button
                type="button"
                onClick={() => onDelete?.(card)}
                className="icon-btn hover:border-bad/50 hover:bg-bad-soft hover:text-bad"
                aria-label="Delete this card"
              >
                <TrashIcon size={14} />
              </button>
            </>
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
