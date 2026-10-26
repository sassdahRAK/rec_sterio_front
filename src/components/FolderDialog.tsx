/** Create a dataset folder — public (guests) or private (invite/passcode). */
import { useEffect, useState } from 'react';
import { ApiError, foldersApi } from '../api/client';
import type { Folder, FolderVisibility } from '../api/types';
import { toast } from '../store/toast';
import Modal from './Modal';
import { GlobeIcon, LockIcon } from './icons';
import { btnNeutral, btnPrimary, inputCls, labelCls, selectCls } from './ui';

interface FolderDialogProps {
  open: boolean;
  folders: Folder[];
  canPublish: boolean;
  defaultParentId?: string | null;
  onClose: () => void;
  onCreated: (folder: Folder) => void;
}

function flatten(items: Folder[], depth = 0): Array<{ id: string; label: string }> {
  const out: Array<{ id: string; label: string }> = [];
  for (const item of items) {
    out.push({ id: item.id, label: `${'— '.repeat(depth)}${item.name}` });
    out.push(...flatten(item.children ?? [], depth + 1));
  }
  return out;
}

export default function FolderDialog({
  open,
  folders,
  canPublish,
  defaultParentId = null,
  onClose,
  onCreated,
}: FolderDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<FolderVisibility>(canPublish ? 'public' : 'private');
  const [parentId, setParentId] = useState<string>(defaultParentId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setVisibility(canPublish ? 'public' : 'private');
    setParentId(defaultParentId ?? '');
    setError(null);
  }, [open, canPublish, defaultParentId]);

  const submit = async (): Promise<void> => {
    if (!name.trim()) {
      setError('Give the folder a name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const folder = await foldersApi.create({
        name: name.trim(),
        description: description.trim() || null,
        visibility,
        parent_id: parentId || null,
      });
      toast.success(`Folder “${folder.name}” created.`);
      onCreated(folder);
      onClose();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError instanceof ApiError ? apiError.message : 'Could not create the folder.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="New dataset folder"
      description="Folders group videos into one publishable unit. Sub-folders become directories inside the ZIP."
      onClose={onClose}
      busy={busy}
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="folder-name" className={labelCls}>
            Name
          </label>
          <input
            id="folder-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Khmer street interviews — Phnom Penh"
            className={inputCls}
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="folder-description" className={labelCls}>
            Description <span className="normal-case tracking-normal text-faint">(optional)</span>
          </label>
          <textarea
            id="folder-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            placeholder="What this dataset contains, how it was collected…"
            className={`${inputCls} resize-y`}
          />
        </div>

        <div>
          <span className={labelCls}>Visibility</span>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setVisibility('public')}
              disabled={!canPublish}
              className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition ${
                visibility === 'public'
                  ? 'border-accent bg-accent-soft/70'
                  : 'border-line bg-raised hover:border-accent/40'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <GlobeIcon size={16} className="mt-0.5 text-accent" />
              <span>
                <span className="block text-sm font-medium text-fg">Public</span>
                <span className="block text-2xs text-faint">
                  Anyone, including guests, can browse it.
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setVisibility('private')}
              className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition ${
                visibility === 'private'
                  ? 'border-accent bg-accent-soft/70'
                  : 'border-line bg-raised hover:border-accent/40'
              }`}
            >
              <LockIcon size={16} className="mt-0.5 text-dim" />
              <span>
                <span className="block text-sm font-medium text-fg">Private</span>
                <span className="block text-2xs text-faint">
                  Members, share links and passcodes only.
                </span>
              </span>
            </button>
          </div>
          {!canPublish ? (
            <p className="mt-1.5 text-2xs text-faint">Only the operator account can publish publicly.</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="folder-parent" className={labelCls}>
            Parent folder
          </label>
          <select
            id="folder-parent"
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
            className={`${selectCls} w-full`}
          >
            <option value="">No parent (top level)</option>
            {flatten(folders).map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.label}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <p role="alert" className="rounded-md border border-bad/40 bg-bad-soft px-3 py-2 text-xs text-bad">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnNeutral} disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={() => void submit()} className={btnPrimary} disabled={busy}>
            {busy ? 'Creating…' : 'Create folder'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
