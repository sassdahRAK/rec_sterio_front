/**
 * Cleaned data (instruction.txt #8, #9): only human-corrected transcripts, shown
 * as the video/audio/transcript cards from the design reference, with edit and
 * delete available to whoever holds the editor role.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, datasetApi, foldersApi, videosApi } from '../api/client';
import type { DataCard as DataCardModel, Folder } from '../api/types';
import CardEditDialog from '../components/CardEditDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import DataCard from '../components/DataCard';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { btnPrimary, inputCls, selectCls } from '../components/ui';
import { SearchIcon } from '../components/icons';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/toast';

function flatten(items: Folder[]): Folder[] {
  return items.flatMap((folder) => [folder, ...flatten(folder.children ?? [])]);
}

export default function Cleaned() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [cards, setCards] = useState<DataCardModel[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderId, setFolderId] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [editCard, setEditCard] = useState<DataCardModel | null>(null);
  const [deleteCard, setDeleteCard] = useState<DataCardModel | null>(null);
  const [busy, setBusy] = useState(false);

  const allFolders = useMemo(() => flatten(folders), [folders]);
  const roleById = useMemo(() => {
    const map = new Map<string, string | null>();
    allFolders.forEach((folder) => map.set(folder.id, folder.my_role));
    return map;
  }, [allFolders]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [page, tree] = await Promise.all([
        datasetApi.cards({
          cleaned: true,
          folder_id: folderId || undefined,
          q: debounced || undefined,
          page_size: 100,
        }),
        foldersApi.list(),
      ]);
      setCards(page.items);
      setFolders(tree.items);
    } catch (err) {
      setError(err);
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [folderId, debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = (card: DataCardModel): boolean => {
    if (!isAuthenticated) return false;
    if (role === 'admin') return true;
    if (!card.folder_id) return true;
    return roleById.get(card.folder_id) === 'editor';
  };

  const removeCard = async (): Promise<void> => {
    if (!deleteCard) return;
    setBusy(true);
    try {
      await videosApi.remove(deleteCard.video_id);
      toast.success('Cleaned card deleted.');
      setDeleteCard(null);
      await load();
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'delete_failed', apiError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-fg">Cleaned</h1>
          <p className="mt-0.5 text-sm text-dim">
            Human-corrected transcripts only ·{' '}
            {loading ? 'loading…' : `${cards.length} card${cards.length === 1 ? '' : 's'}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <SearchIcon
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search cleaned data…"
              aria-label="Search cleaned data"
              className={`${inputCls} w-full pl-8 sm:w-56`}
            />
          </div>
          <select
            value={folderId}
            onChange={(event) => setFolderId(event.target.value)}
            aria-label="Filter by folder"
            className={selectCls}
          >
            <option value="">All folders</option>
            {allFolders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-ok/30 bg-ok-soft px-3.5 py-2.5 text-xs text-ok">
        <strong className="font-semibold">Cleaned</strong> means a person reviewed the transcript.
        Editing a card writes a new version and keeps the raw ASR output in the video's history.
      </div>

      {error ? <ErrorState error={error} onRetry={() => void load()} /> : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="glow-card h-[26rem] animate-pulse bg-raised/40" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          title="No cleaned data yet"
          description="Open a transcript, fix the Khmer–English text, then tick “Cleaned”. It will appear here as a card."
          action={
            <button type="button" onClick={() => navigate('/dataset')} className={btnPrimary}>
              Go to the dataset
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((card, index) => (
            <DataCard
              key={card.video_id}
              card={card}
              index={index}
              editable={canEdit(card)}
              onEdit={setEditCard}
              onDelete={setDeleteCard}
            />
          ))}
        </div>
      )}

      <CardEditDialog
        card={editCard}
        folders={allFolders.filter(
          (folder) => folder.my_role === 'editor' || folder.id === editCard?.folder_id,
        )}
        onClose={() => setEditCard(null)}
        onSaved={() => void load()}
      />

      <ConfirmDialog
        open={deleteCard !== null}
        destructive
        title="Delete this cleaned card?"
        message={
          deleteCard
            ? `“${deleteCard.title ?? deleteCard.video_id}” and every transcript version attached to it will be removed. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete card"
        busy={busy}
        onConfirm={() => void removeCard()}
        onCancel={() => setDeleteCard(null)}
      />
    </div>
  );
}
