import { useEffect, useRef, useState } from 'react';
import { ApiError, videosApi } from '../api/client';
import type { Video } from '../api/types';
import Spinner from './Spinner';
import { btnNeutral, btnPrimary, inputCls, labelCls } from './ui';

interface AddVideoDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded: (video: Video, mode: 'link' | 'upload') => void;
}

type Mode = 'link' | 'upload';

const ACCEPT = '.mp4,.m4v,.mov,.webm,.mkv,.avi,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus';
const MAX_UPLOAD_MB = 512;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

/**
 * Ingest a video two ways.
 *
 * The link path depends on the platform serving a download, which TikTok and
 * YouTube increasingly refuse from a server. The upload path has no such
 * dependency: if the operator already has the file, it works.
 */
export default function AddVideoDialog({ open, onClose, onAdded }: AddVideoDialogProps) {
  const [mode, setMode] = useState<Mode>('link');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [transcribe, setTranscribe] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  useEffect(() => {
    if (open) return;
    // Reset everything when the dialog closes so a reopen starts clean.
    setUrl('');
    setTitle('');
    setNotes('');
    setFile(null);
    setError(null);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }, [open]);

  if (!open) return null;

  const submit = async (): Promise<void> => {
    setError(null);
    if (mode === 'link' && !url.trim()) {
      setError('Paste a video link first.');
      return;
    }
    if (mode === 'upload' && !file) {
      setError('Choose a file first.');
      return;
    }
    setBusy(true);
    try {
      const video =
        mode === 'link'
          ? await videosApi.create({
              source_url: url.trim(),
              title: title.trim() || null,
              notes: notes.trim() || null,
              start_transcription: transcribe,
            })
          : await videosApi.upload({
              file: file as File,
              title: title.trim() || file?.name || null,
              notes: notes.trim() || null,
              start_transcription: transcribe,
            });
      onAdded(video, mode);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'conflict') {
          setError('That video is already in the library. Check the list for it.');
        } else if (err.status === 413) {
          setError(`That file is too large. The limit is ${MAX_UPLOAD_MB} MB.`);
        } else if (err.code === 'unsupported_media_type') {
          setError('Unsupported file type. Use mp4, mov, webm, mkv, mp3, m4a, wav or flac.');
        } else {
          setError(err.message);
        }
      } else {
        setError('The request failed unexpectedly.');
      }
    } finally {
      setBusy(false);
    }
  };

  const tabCls = (active: boolean): string =>
    `rounded px-3 py-1.5 text-xs font-medium transition-colors ${
      active ? 'bg-raised text-fg shadow-sm' : 'text-dim hover:text-fg'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-video-title"
        className="card relative w-full max-w-lg animate-fade-up"
      >
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <h2 id="add-video-title" className="font-display text-base font-semibold text-fg">
              Add a video
            </h2>
            <p className="mt-0.5 text-xs text-dim">
              Link, or upload a file you already have.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded p-1 text-faint hover:text-fg disabled:opacity-40"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="inline-flex rounded border border-line bg-base p-0.5">
            <button type="button" className={tabCls(mode === 'link')} onClick={() => setMode('link')}>
              From a link
            </button>
            <button type="button" className={tabCls(mode === 'upload')} onClick={() => setMode('upload')}>
              Upload a file
            </button>
          </div>

          {mode === 'link' ? (
            <div>
              <label htmlFor="add-url" className={labelCls}>
                Video link
              </label>
              <input
                id="add-url"
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://…"
                className={inputCls}
                autoFocus
                disabled={busy}
              />
              <p className="mt-1.5 text-2xs text-faint">
                The server downloads it. TikTok and YouTube often refuse server-side
                downloads — if this fails, use “Upload a file” instead.
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="add-file" className={labelCls}>
                Media file
              </label>
              <input
                id="add-file"
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                disabled={busy}
                className="block w-full cursor-pointer rounded border border-line bg-raised px-3 py-2 text-xs text-dim file:mr-3 file:rounded file:border-0 file:bg-raised file:px-2.5 file:py-1 file:text-xs file:text-fg"
              />
              {file ? (
                <p className="mt-1.5 font-mono text-2xs text-faint">
                  {file.name} · {formatBytes(file.size)}
                </p>
              ) : (
                <p className="mt-1.5 text-2xs text-faint">
                  mp4, mov, webm, mkv, mp3, m4a, wav, flac — up to {MAX_UPLOAD_MB} MB.
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="add-title" className={labelCls}>
              Title <span className="text-faint">(optional)</span>
            </label>
            <input
              id="add-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={mode === 'upload' ? 'Defaults to the file name' : 'Defaults to the video title'}
              className={inputCls}
              disabled={busy}
            />
          </div>

          <div>
            <label htmlFor="add-notes" className={labelCls}>
              Notes <span className="text-faint">(optional)</span>
            </label>
            <input
              id="add-notes"
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={inputCls}
              disabled={busy}
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-dim">
            <input
              type="checkbox"
              checked={transcribe}
              onChange={(event) => setTranscribe(event.target.checked)}
              disabled={busy}
              className="h-3.5 w-3.5 rounded border-line bg-base"
            />
            Transcribe it after ingestion
          </label>

          {error ? (
            <p className="rounded border border-bad/40 bg-bad-soft px-3 py-2 text-xs text-bad" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button type="button" className={btnNeutral} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={btnPrimary} onClick={() => void submit()} disabled={busy}>
            {busy ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : null}
            {busy ? (mode === 'upload' ? 'Uploading…' : 'Queueing…') : 'Add video'}
          </button>
        </div>
      </div>
    </div>
  );
}
