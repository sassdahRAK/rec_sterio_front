import { useEffect, useState } from 'react';
import { isMockEnabled, videosApi } from '../api/client';
import { formatBytes, formatDuration } from '../lib/format';
import { claimPlayback, releasePlayback } from '../lib/playback';
import ErrorState from './ErrorState';
import Spinner from './Spinner';

interface VideoPlayerProps {
  videoId: string;
  title: string | null;
  mimeType: string | null;
  durationSeconds: number | null;
  fileSize: number | null;
}

/**
 * The media endpoint needs the Authorization header, which a plain <video src>
 * cannot send — so the file is fetched as a blob and played from an object URL.
 */
export default function VideoPlayer({
  videoId,
  title,
  mimeType,
  durationSeconds,
  fileSize,
}: VideoPlayerProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    if (isMockEnabled()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setObjectUrl(null);

    videosApi
      .media(videoId)
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [videoId]);

  return (
    <div className="card overflow-hidden">
      <div className="relative aspect-video w-full bg-black">
        {objectUrl ? (
          <video
            key={objectUrl}
            src={objectUrl}
            controls
            preload="metadata"
            onPlay={(event) => claimPlayback(event.currentTarget)}
            onPause={(event) => releasePlayback(event.currentTarget)}
            onEnded={(event) => releasePlayback(event.currentTarget)}
            className="h-full w-full"
            aria-label={title ? `Media for ${title}` : 'Video media'}
          />
        ) : loading ? (
          <div className="flex h-full w-full items-center justify-center gap-3">
            <Spinner className="h-5 w-5" />
            <span className="text-sm text-dim">Fetching media with your session…</span>
          </div>
        ) : error ? (
          <div className="flex h-full w-full items-center justify-center p-4">
            <ErrorState error={error} className="w-full max-w-md border-bad/40" />
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-faint" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10 9.5l5 2.5-5 2.5v-5Z" fill="currentColor" />
            </svg>
            <p className="text-sm text-dim">Media preview unavailable</p>
            <p className="max-w-sm text-xs text-faint">
              {isMockEnabled()
                ? 'Demo mode uses sample records without real media files, so there is nothing to play here. Sign in against the live server to preview actual recordings.'
                : 'The file could not be streamed. It may not have been downloaded yet.'}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-3 py-2 text-2xs text-faint">
        <span className="font-mono">{formatDuration(durationSeconds)}</span>
        <span className="font-mono">{formatBytes(fileSize)}</span>
        <span className="font-mono">{mimeType ?? 'unknown type'}</span>
        <span className="ml-auto">streamed with an Authorization header</span>
      </div>
    </div>
  );
}
