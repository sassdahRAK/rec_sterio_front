/**
 * Edit one dataset card: the transcript text, its Raw/Cleaned badge, and which
 * folder it belongs to (instruction.txt #9, #6).
 */
import { useEffect, useState } from 'react';
import { ApiError, foldersApi, transcriptsApi } from '../api/client';
import type { DataCard, Folder } from '../api/types';
import { toast } from '../store/toast';
import Modal from './Modal';
import { btnNeutral, btnPrimary, inputCls, labelCls, selectCls } from './ui';

interface CardEditDialogProps {
  card: DataCard | null;
  folders: Folder[];
  onClose: () => void;
  onSaved: () => void;
}

function flattenFolders(items: Folder[], depth = 0): Array<{ id: string; label: string }> {
  const out: Array<{ id: string; label: string }> = [];
  for (const folder of items) {
    out.push({ id: folder.id, label: `${'— '.repeat(depth)}${folder.name}` });
    out.push(...flattenFolders(folder.children ?? [], depth + 1));
  }
  return out;
}

export default function CardEditDialog({ card, folders, onClose, onSaved }: CardEditDialogProps) {
  const [content, setContent] = useState('');
  const [cleaned, setCleaned] = useState(false);
  const [folderId, setFolderId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!card) return;
    setContent('');
    setCleaned(card.badge === 'cleaned');
    setFolderId(card.folder_id ?? '');
    setError(null);
    setLoading(true);
    transcriptsApi
      .current(card.video_id)
      .then((transcript) => {
        setContent(transcript.content ?? '');
        setCleaned(transcript.cleaned);
      })
      .catch((err) => {
        const apiError = err as ApiError;
        if (apiError instanceof ApiError && apiError.status === 404) {
          setContent(card.transcript_preview ?? '');
        } else {
          setError(apiError instanceof ApiError ? apiError.message : 'Could not load the transcript.');
        }
      })
      .finally(() => setLoading(false));
  }, [card]);

  if (!card) return null;

  const save = async (): Promise<void> => {
    if (!content.trim()) {
      setError('The transcript cannot be empty.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // A new version is written, so history is never mutated.
      await transcriptsApi.save(card.video_id, { content, cleaned });
      if ((card.folder_id ?? '') !== folderId) {
        await foldersApi.placeVideo(card.video_id, folderId || null);
      }
      toast.success('Card saved — a new transcript version was created.');
      onSaved();
      onClose();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError instanceof ApiError ? apiError.message : 'Could not save this card.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={card !== null}
      title="Edit dataset card"
      description={card.title ?? card.source_url ?? card.video_id}
      onClose={onClose}
      busy={saving}
      width="lg"
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="card-transcript" className={labelCls}>
            Transcript
          </label>
          <textarea
            id="card-transcript"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={8}
            disabled={loading}
            placeholder="Khmer / English transcript…"
            className={`${inputCls} resize-y font-sans leading-relaxed`}
          />
          <p className="mt-1 text-2xs text-faint">
            Saving creates a new version; earlier versions stay in the video's history.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="card-folder" className={labelCls}>
              Folder
            </label>
            <select
              id="card-folder"
              value={folderId}
              onChange={(event) => setFolderId(event.target.value)}
              className={`${selectCls} w-full`}
            >
              <option value="">Unfiled</option>
              {flattenFolders(folders).map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 self-end rounded-md border border-line bg-raised px-3 py-2">
            <input
              type="checkbox"
              checked={cleaned}
              onChange={(event) => setCleaned(event.target.checked)}
              className="h-4 w-4 rounded border-line bg-card text-ok focus:ring-ok/40"
            />
            <span className="text-sm text-fg">
              Cleaned
              <span className="ml-1 text-2xs text-faint">human-corrected</span>
            </span>
          </label>
        </div>

        {error ? (
          <p role="alert" className="rounded-md border border-bad/40 bg-bad-soft px-3 py-2 text-xs text-bad">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={btnNeutral}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading}
            className={btnPrimary}
          >
            {saving ? 'Saving…' : 'Save card'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
