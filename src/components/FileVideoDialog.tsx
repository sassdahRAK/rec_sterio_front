/**
 * Put a video into a folder — the two ways of doing it.
 *
 * Move is curation: the unit leaves the folder it is in, so a public card stops
 * being public, and it needs edit rights where the unit currently lives. Copy
 * is perusal: it needs only read access to the source, writes into a folder the
 * caller manages, and leaves the original alone. Media is shared between the
 * two, so a copy costs no disk and no re-download.
 *
 * This is the action the dataset was missing: until now a video could only be
 * filed from the card's edit dialog, which refused to save without a non-empty
 * transcript and minted a phantom transcript version for a pure move.
 */
import { useEffect, useMemo, useState } from 'react';
import { ApiError, foldersApi, videosApi } from '../api/client';
import type { Folder } from '../api/types';
import Modal from './Modal';
import { btnNeutral, btnPrimary, labelCls, selectCls } from './ui';

export type FileMode = 'move' | 'copy';

export interface FileTarget {
  video_id: string;
  title: string | null;
  folder_id: string | null;
}

interface FileVideoDialogProps {
  target: FileTarget | null;
  folders: Folder[];
  defaultMode?: FileMode;
  onClose: () => void;
  /** Called after a successful move or copy so the caller can reload. */
  onDone: (message: string) => void;
}

function flattenFolders(items: Folder[], depth = 0): Array<{ id: string; label: string }> {
  const out: Array<{ id: string; label: string }> = [];
  for (const folder of items) {
    out.push({ id: folder.id, label: `${'— '.repeat(depth)}${folder.name}` });
    out.push(...flattenFolders(folder.children ?? [], depth + 1));
  }
  return out;
}

export default function FileVideoDialog({
  target,
  folders,
  defaultMode = 'copy',
  onClose,
  onDone,
}: FileVideoDialogProps) {
  const [mode, setMode] = useState<FileMode>(defaultMode);
  const [folderId, setFolderId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only folders the caller can write into are offered. Everything else would
  // answer 403, and a destination that exists but rejects you reads as a bug.
  const destinations = useMemo(
    () => flattenFolders(folders.filter((folder) => folder.my_role === 'editor')),
    [folders],
  );

  useEffect(() => {
    if (!target) return;
    setMode(defaultMode);
    setFolderId(
      destinations.find((folder) => folder.id !== target.folder_id)?.id ?? '',
    );
    setError(null);
  }, [target, defaultMode, destinations]);

  if (!target) return null;

  const submit = async (): Promise<void> => {
    if (!folderId) {
      setError('Choose a folder first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === 'move') {
        await foldersApi.placeVideo(target.video_id, folderId);
        onDone('Moved — the unit now lives in the folder you chose.');
      } else {
        await videosApi.copy(target.video_id, folderId);
        onDone('Copied — the original is untouched and the copy is yours to edit.');
      }
      onClose();
    } catch (err) {
      const apiError = err as ApiError;
      const code = apiError instanceof ApiError ? apiError.code : '';
      if (code === 'forbidden' && mode === 'move') {
        setError(
          'You cannot move this unit — it is not yours to take out of its folder. Copy it instead.',
        );
        setMode('copy');
      } else if (code === 'not_ready') {
        setError('This video has no media on disk yet, so there is nothing to copy.');
      } else if (code === 'validation_failed') {
        setError(apiError.message);
      } else if (apiError instanceof ApiError) {
        setError(apiError.message);
      } else {
        setError('Could not file this video.');
      }
    } finally {
      setBusy(false);
    }
  };

  const options = destinations.filter((folder) => folder.id !== target.folder_id);

  return (
    <Modal
      open
      title={mode === 'move' ? 'Move to a folder' : 'Copy to a folder'}
      description={target.title ?? target.video_id}
      onClose={onClose}
      busy={busy}
      width="md"
    >
      <div className="space-y-4">
        <div role="radiogroup" aria-label="What to do" className="grid gap-2 sm:grid-cols-2">
          {(
            [
              {
                value: 'move' as const,
                label: 'Move',
                hint: 'Removes it from where it is. Needs edit rights there.',
              },
              {
                value: 'copy' as const,
                label: 'Copy',
                hint: 'Leaves the original alone. Shares the media.',
              },
            ]
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={mode === option.value}
              onClick={() => setMode(option.value)}
              className={`rounded-lg border px-3 py-2 text-left transition ${
                mode === option.value
                  ? 'border-accent/60 bg-accent/15'
                  : 'border-line bg-raised hover:border-line hover:bg-line/30'
              }`}
            >
              <span className="block text-sm font-semibold text-fg">{option.label}</span>
              <span className="mt-0.5 block text-2xs leading-snug text-dim">{option.hint}</span>
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="file-destination" className={labelCls}>
            Destination folder
          </label>
          <select
            id="file-destination"
            value={folderId}
            onChange={(event) => setFolderId(event.target.value)}
            className={`${selectCls} w-full`}
            disabled={options.length === 0}
          >
            {options.length === 0 ? <option value="">No folder you can write to</option> : null}
            {options.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.label}
              </option>
            ))}
          </select>
          {options.length === 0 ? (
            <p className="mt-1.5 text-2xs text-faint">
              Create a folder first — or ask its owner for the editor role.
            </p>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="rounded-md border border-bad/40 bg-bad-soft px-3 py-2 text-xs text-bad">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={btnNeutral}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !folderId}
            className={btnPrimary}
          >
            {busy ? 'Saving…' : mode === 'move' ? 'Move' : 'Copy'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
