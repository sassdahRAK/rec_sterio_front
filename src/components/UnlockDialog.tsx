/**
 * Open a passcode-protected folder (instruction.txt #4). The redeemed token is
 * scoped to that folder alone, so it cannot widen access anywhere else.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, publicApi } from '../api/client';
import { deviceKey } from '../lib/device';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/toast';
import Modal from './Modal';
import { btnNeutral, btnPrimary, inputCls, labelCls } from './ui';

interface UnlockDialogProps {
  open: boolean;
  folderId?: string | null;
  onClose: () => void;
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export default function UnlockDialog({ open, folderId = null, onClose }: UnlockDialogProps) {
  const navigate = useNavigate();
  const enterScopedFolder = useAuthStore((s) => s.enterScopedFolder);
  const [target, setTarget] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTarget(folderId ?? '');
    setCode('');
    setError(null);
  }, [open, folderId]);

  const submit = async (): Promise<void> => {
    const id = target.match(UUID_RE)?.[0] ?? (folderId || '');
    if (!id) {
      setError('Paste the folder link, or pick a locked folder from the list.');
      return;
    }
    if (!code.trim()) {
      setError('Enter the passcode.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await publicApi.redeemPasscode(id, code.trim(), deviceKey());
      enterScopedFolder(result.token, { folderId: result.folder_id, access: 'passcode' });
      toast.success('Folder unlocked.');
      onClose();
      navigate(`/dataset/f/${result.folder_id}`);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError instanceof ApiError ? apiError.message : 'Could not open that folder.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Open a private folder"
      description="Enter the passcode the folder owner gave you. Access is limited to that folder."
      onClose={onClose}
      busy={busy}
      width="sm"
    >
      <div className="space-y-3.5">
        <div>
          <label htmlFor="unlock-folder" className={labelCls}>
            Folder link or ID
          </label>
          <input
            id="unlock-folder"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="https://…/dataset/f/…"
            className={`${inputCls} font-mono text-xs`}
            disabled={Boolean(folderId)}
          />
        </div>
        <div>
          <label htmlFor="unlock-code" className={labelCls}>
            Passcode
          </label>
          <input
            id="unlock-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit();
            }}
            placeholder="ABCD-2345"
            autoFocus
            className={`${inputCls} font-mono uppercase tracking-[0.18em]`}
          />
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
            {busy ? 'Unlocking…' : 'Unlock folder'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
