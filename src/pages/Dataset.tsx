/**
 * The dataset browser (instruction.txt #1, #3, #6, #8, #9): folders on the
 * left, data cards on the right. Guests see public folders; signed-in users
 * also get "My folders", creation, sharing, passcodes and ZIP export.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, datasetApi, foldersApi, saveBlob, videosApi } from '../api/client';
import type { DataCard as DataCardModel, Folder } from '../api/types';
import CardEditDialog from '../components/CardEditDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import DataCard from '../components/DataCard';
import ErrorState from '../components/ErrorState';
import FolderDialog from '../components/FolderDialog';
import FolderRail from '../components/FolderRail';
import Pagination from '../components/Pagination';
import PasscodeDialog from '../components/PasscodeDialog';
import ShareDialog from '../components/ShareDialog';
import { btnNeutral, btnPrimary, inputCls } from '../components/ui';
import {
  DownloadIcon,
  KeyIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  ShareIcon,
  TrashIcon,
} from '../components/icons';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/toast';

const PAGE_SIZE = 20;

function flatten(items: Folder[]): Folder[] {
  return items.flatMap((folder) => [folder, ...flatten(folder.children ?? [])]);
}

export default function Dataset() {
  const navigate = useNavigate();
  const { folderId = null } = useParams<{ folderId: string }>();
  const role = useAuthStore((s) => s.role);
  const email = useAuthStore((s) => s.email);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [cards, setCards] = useState<DataCardModel[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const [folderDialog, setFolderDialog] = useState<{ open: boolean; parentId: string | null }>({
    open: false,
    parentId: null,
  });
  const [shareFolder, setShareFolder] = useState<Folder | null>(null);
  const [passcodeFolder, setPasscodeFolder] = useState<Folder | null>(null);
  const [editCard, setEditCard] = useState<DataCardModel | null>(null);
  const [deleteCard, setDeleteCard] = useState<DataCardModel | null>(null);
  const [deleteFolder, setDeleteFolder] = useState<Folder | null>(null);

  const allFolders = useMemo(() => flatten(folders), [folders]);
  const selectedFolder = useMemo(
    () => allFolders.find((folder) => folder.id === folderId) ?? null,
    [allFolders, folderId],
  );
  const roleById = useMemo(() => {
    const map = new Map<string, string | null>();
    allFolders.forEach((folder) => map.set(folder.id, folder.my_role));
    return map;
  }, [allFolders]);

  const canPublish = role === 'admin';
  const canManageSelected = isAuthenticated && selectedFolder?.my_role === 'editor';

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadFolders = useCallback(async (): Promise<Folder[]> => {
    const result = await foldersApi.list();
    setFolders(result.items);
    return result.items;
  }, []);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await loadFolders();
      const result = await datasetApi.cards({
        folder_id: folderId ?? undefined,
        q: debounced || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setCards(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err);
      setCards([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [folderId, debounced, page, loadFolders]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleCards = useMemo(() => {
    if (tab === 'all' || !email) return cards;
    // "My folders": the caller's own folders, matched on the owner recorded by
    // the folder listing. Unfiled cards are not part of anyone's folder.
    return cards.filter((card) => {
      if (!card.folder_id) return false;
      const owner = allFolders.find((folder) => folder.id === card.folder_id);
      return owner ? owner.owner_email === email : false;
    });
  }, [cards, tab, email, allFolders]);

  const cardEditable = useCallback(
    (card: DataCardModel): boolean => {
      if (!isAuthenticated) return false;
      if (role === 'admin') return true;
      if (!card.folder_id) return true; // the API still enforces creator-or-editor
      return roleById.get(card.folder_id) === 'editor';
    },
    [isAuthenticated, role, roleById],
  );

  const downloadZip = async (folder: Folder): Promise<void> => {
    setBusy(true);
    try {
      const blob = await foldersApi.zip(folder.id);
      saveBlob(blob, `${folder.name.replace(/[^\w\u1780-\u17FF -]+/g, '_') || 'dataset'}.zip`);
      toast.success(`Downloaded “${folder.name}” — video, audio and transcripts.`);
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(
        apiError instanceof ApiError ? apiError.code : 'export_failed',
        apiError instanceof ApiError ? apiError.message : 'Could not build the ZIP.',
      );
    } finally {
      setBusy(false);
    }
  };

  const removeCard = async (): Promise<void> => {
    if (!deleteCard) return;
    setBusy(true);
    try {
      await videosApi.remove(deleteCard.video_id);
      toast.success('Card deleted.');
      setDeleteCard(null);
      await load();
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'delete_failed', apiError.message);
    } finally {
      setBusy(false);
    }
  };

  const removeFolder = async (): Promise<void> => {
    if (!deleteFolder) return;
    setBusy(true);
    try {
      await foldersApi.remove(deleteFolder.id);
      toast.success(`Folder “${deleteFolder.name}” deleted. Its videos were kept, unfiled.`);
      setDeleteFolder(null);
      if (folderId === deleteFolder.id) navigate('/dataset');
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
          <h1 className="font-display text-2xl font-bold tracking-tight text-fg">Dataset</h1>
          <p className="mt-0.5 text-sm text-dim">
            {selectedFolder ? selectedFolder.name : 'Every recording you can see'} ·{' '}
            {loading ? 'loading…' : `${total} unit${total === 1 ? '' : 's'}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFolderDialog({ open: true, parentId: selectedFolder?.id ?? null })}
            className={btnPrimary}
          >
            <PlusIcon size={14} /> New folder
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`tab ${tab === 'all' ? 'tab-active' : ''}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setTab('mine')}
            disabled={!isAuthenticated}
            className={`tab ${tab === 'mine' ? 'tab-active' : ''} disabled:opacity-40`}
            title={isAuthenticated ? undefined : 'Sign in to see your folders'}
          >
            My Folder
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <SearchIcon size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search recordings…"
            aria-label="Search recordings"
            className={`${inputCls} pl-8`}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-[4.6rem] lg:self-start">
          <FolderRail
            folders={folders}
            selectedId={folderId}
            onSelect={(folder) => {
              setPage(1);
              navigate(folder ? `/dataset/f/${folder.id}` : '/dataset');
            }}
            allCount={undefined}
          />

          {selectedFolder ? (
            <div className="card mt-3 space-y-1.5 p-2">
              <p className="px-1.5 pb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-faint">
                This folder
              </p>
              {canManageSelected ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShareFolder(selectedFolder)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-dim hover:bg-raised hover:text-fg"
                  >
                    <ShareIcon size={13} /> Share & invite
                  </button>
                  <button
                    type="button"
                    onClick={() => setPasscodeFolder(selectedFolder)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-dim hover:bg-raised hover:text-fg"
                  >
                    <KeyIcon size={13} /> Passcodes
                  </button>
                  <button
                    type="button"
                    onClick={() => setFolderDialog({ open: true, parentId: selectedFolder.id })}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-dim hover:bg-raised hover:text-fg"
                  >
                    <PlusIcon size={13} /> Sub-folder
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteFolder(selectedFolder)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-bad hover:bg-bad-soft"
                  >
                    <TrashIcon size={13} /> Delete folder
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => void downloadZip(selectedFolder)}
                disabled={busy}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-dim hover:bg-raised hover:text-fg"
              >
                <DownloadIcon size={13} /> Download ZIP
              </button>
              <p className="px-1.5 pt-1 text-2xs text-faint">
                {selectedFolder.visibility === 'public' ? 'Public' : 'Private'} ·{' '}
                {selectedFolder.video_count} unit{selectedFolder.video_count === 1 ? '' : 's'} ·{' '}
                {selectedFolder.my_role ?? 'no access'}
              </p>
            </div>
          ) : null}
        </aside>

        <section className="min-w-0">
          {error ? <ErrorState error={error} onRetry={() => void load()} /> : null}

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1].map((key) => (
                <div key={key} className="glow-card h-[26rem] animate-pulse bg-raised/40" />
              ))}
            </div>
          ) : visibleCards.length === 0 ? (
            <div className="glow-card p-8 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-raised text-faint">
                <PencilIcon size={18} />
              </span>
              <h2 className="mt-3 font-display text-base font-semibold text-fg">
                {tab === 'mine' ? 'Your folders are empty' : 'No recordings here yet'}
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-dim">
                {tab === 'mine'
                  ? 'Create a folder, then file recordings into it from a card’s edit dialog.'
                  : 'Add a recording from the video library, or open a folder that already has data.'}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => navigate('/videos')} className={btnPrimary}>
                  Open the video library
                </button>
                <button
                  type="button"
                  onClick={() => setFolderDialog({ open: true, parentId: selectedFolder?.id ?? null })}
                  className={btnNeutral}
                >
                  New folder
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {visibleCards.map((card, index) => (
                  <DataCard
                    key={card.video_id}
                    card={card}
                    index={index}
                    editable={cardEditable(card)}
                    onEdit={setEditCard}
                    onDelete={setDeleteCard}
                  />
                ))}
              </div>

              {total > PAGE_SIZE ? (
                <div className="card mt-4 overflow-hidden">
                  <Pagination
                    page={page}
                    pageSize={PAGE_SIZE}
                    total={total}
                    itemLabel="units"
                    onPageChange={setPage}
                    onPageSizeChange={() => undefined}
                  />
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      <FolderDialog
        open={folderDialog.open}
        folders={folders}
        canPublish={canPublish}
        defaultParentId={folderDialog.parentId}
        onClose={() => setFolderDialog({ open: false, parentId: null })}
        onCreated={(folder) => {
          void loadFolders();
          navigate(`/dataset/f/${folder.id}`);
        }}
      />

      <ShareDialog folder={shareFolder} onClose={() => setShareFolder(null)} />
      <PasscodeDialog folder={passcodeFolder} onClose={() => setPasscodeFolder(null)} />
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
        title="Delete this card?"
        message={
          deleteCard
            ? `“${deleteCard.title ?? deleteCard.video_id}” and its media, audio and transcript versions will be removed. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete card"
        busy={busy}
        onConfirm={() => void removeCard()}
        onCancel={() => setDeleteCard(null)}
      />

      <ConfirmDialog
        open={deleteFolder !== null}
        destructive
        title="Delete this folder?"
        message={
          deleteFolder
            ? `“${deleteFolder.name}” and its sub-folders will be removed. The videos stay in the library, unfiled.`
            : ''
        }
        confirmLabel="Delete folder"
        busy={busy}
        onConfirm={() => void removeFolder()}
        onCancel={() => setDeleteFolder(null)}
      />
    </div>
  );
}
