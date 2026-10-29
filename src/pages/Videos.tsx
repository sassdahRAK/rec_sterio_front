import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, foldersApi, videosApi } from '../api/client';
import type { Folder, Video, VideoListQuery } from '../api/types';
import AddVideoDialog from '../components/AddVideoDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import ErrorState from '../components/ErrorState';
import FileVideoDialog, { type FileTarget } from '../components/FileVideoDialog';
import Pagination, { ALL_ROWS } from '../components/Pagination';
import VideoTable from '../components/VideoTable';
import { ADMIN_TIER, OPERATOR_ROLES, PLATFORMS, VIDEO_STATUSES } from '../api/types';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/toast';
import { btnNeutral, btnPrimary, inputCls, labelCls, selectCls } from '../components/ui';
import { SearchIcon } from '../components/icons';

export default function Videos() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  // Mirrors the server: re-enqueueing a download needs editor rights on the
  // video, which only the admin tier always holds — a developer would just
  // collect 403s here and still has the job-queue retry (an operator surface).
  // Filing and deleting are folder/content management, reserved for the admin
  // tier. The job-queue link below is this page's one operator surface.
  const canRetry = ADMIN_TIER.includes(role);
  const canManage = ADMIN_TIER.includes(role);
  const canOperate = OPERATOR_ROLES.includes(role);
  const [query, setQuery] = useState<VideoListQuery>({ page: 1, page_size: 20 });
  const [search, setSearch] = useState('');
  const [videos, setVideos] = useState<Video[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Video | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [fileTarget, setFileTarget] = useState<FileTarget | null>(null);

  // The folder tree the move/copy dialog offers. Loaded once: it is small, and
  // a stale entry only means a 404 the dialog reports.
  useEffect(() => {
    let cancelled = false;
    foldersApi.list().then(
      (result) => {
        if (!cancelled) setFolders(result.items);
      },
      () => {
        // Without the tree the dialog simply has no destination to offer.
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounce the free-text search so every keystroke does not hit the API.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery((prev) => ({ ...prev, q: search.trim() || undefined, page: 1 }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Returns a cleanup function so the effect can cancel it. A debounced search
  // can overlap a newer one; without the guard, whichever resolves last wins and
  // clearing the box leaves the stale empty result on screen.
  const load = useCallback((): (() => void) => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    videosApi
      .list(query)
      .then((result) => {
        if (cancelled) return;
        setVideos(result.items);
        setTotal(result.total);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err);
        setVideos([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => load(), [load]);

  const onRetry = async (video: Video): Promise<void> => {
    setBusyId(video.id);
    try {
      await videosApi.retry(video.id);
      toast.success(`Re-queued the download for “${video.title ?? video.id}”.`);
      load();
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError instanceof ApiError && apiError.code === 'job_in_progress') {
        // Double-clicking Retry used to queue a second download of the same
        // file; the API refuses now, so say why instead of showing a code.
        toast.info('Already queued — a download for this video is queued or running.');
      } else {
        toast.error(
          apiError instanceof ApiError ? apiError.code : 'unexpected_error',
          apiError.message,
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await videosApi.remove(deleteTarget.id);
      toast.success(`Deleted “${deleteTarget.title ?? deleteTarget.id}” and its transcripts.`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'unexpected_error', apiError.message);
    } finally {
      setDeleting(false);
    }
  };

  const statusValue = query.status ?? '';
  const platformValue = query.platform ?? '';
  const sortValue = query.sort ?? '-created_at';
  const page = query.page ?? 1;
  const pageSize = query.page_size ?? 20;

  const summary = useMemo(() => {
    if (loading) return 'Loading…';
    return `${total} video${total === 1 ? '' : 's'} in the library`;
  }, [loading, total]);

  return (
    <div className="mx-auto max-w-[96rem] space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="shrink-0">
          <h2 className="font-display text-2xl font-bold tracking-tight text-fg">Video library</h2>
          <p className="mt-0.5 text-sm text-dim">{summary}</p>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <SearchIcon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            id="video-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title or source URL"
            aria-label="Search videos"
            className={`${inputCls} rounded-full py-2 pl-9`}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => void load()} className={`${btnNeutral} rounded-full`}>
            Refresh
          </button>
          <button type="button" onClick={() => setAddOpen(true)} className={`${btnPrimary} rounded-full`}>
            Add video
          </button>
        </div>
      </div>

      <div className="card grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="video-status" className={labelCls}>
            Status
          </label>
          <select
            id="video-status"
            value={statusValue}
            onChange={(e) =>
              setQuery((prev) => ({ ...prev, status: e.target.value || undefined, page: 1 }))
            }
            className={`${selectCls} w-full`}
          >
            <option value="">All statuses</option>
            {VIDEO_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="video-platform" className={labelCls}>
            Platform
          </label>
          <select
            id="video-platform"
            value={platformValue}
            onChange={(e) =>
              setQuery((prev) => ({ ...prev, platform: e.target.value || undefined, page: 1 }))
            }
            className={`${selectCls} w-full`}
          >
            <option value="">All platforms</option>
            {PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="video-sort" className={labelCls}>
            Sort
          </label>
          <select
            id="video-sort"
            value={sortValue}
            onChange={(e) => setQuery((prev) => ({ ...prev, sort: e.target.value, page: 1 }))}
            className={`${selectCls} w-full`}
          >
            <option value="-created_at">Newest first</option>
            <option value="created_at">Oldest first</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={() => void load()} /> : null}

      <div className="card overflow-hidden">
        <VideoTable
          videos={videos}
          loading={loading}
          busyId={busyId}
          canManage={canManage}
          canRetry={canRetry}
          onView={(video) => navigate(`/videos/${video.id}`)}
          onRetry={(video) => void onRetry(video)}
          onDelete={(video) => setDeleteTarget(video)}
          onFile={(video) =>
            setFileTarget({
              video_id: video.id,
              title: video.title,
              folder_id: video.folder_id,
            })
          }
        />
        {!loading && videos.length > 0 ? (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            itemLabel="videos"
            pageSizes={[10, 20, 50, 100, ALL_ROWS]}
            onPageChange={(next) => setQuery((prev) => ({ ...prev, page: next }))}
            onPageSizeChange={(size) => setQuery((prev) => ({ ...prev, page_size: size, page: 1 }))}
          />
        ) : null}
      </div>

      <AddVideoDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={(video, mode) => {
          toast.success(
            mode === 'upload'
              ? `Uploaded “${video.title ?? video.id}” — extracting audio now.`
              : `Queued “${video.title ?? video.id}” for download.`,
          );
          void load();
        }}
      />

      <FileVideoDialog
        target={fileTarget}
        folders={folders}
        defaultMode={fileTarget?.folder_id ? 'copy' : 'move'}
        onClose={() => setFileTarget(null)}
        onDone={(message) => {
          toast.success(message);
          void load();
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        destructive
        title="Delete this video?"
        message={
          deleteTarget
            ? `“${deleteTarget.title ?? deleteTarget.source_url}” and every transcript, merge and job record attached to it will be removed. The downloaded media file is deleted from disk. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete video"
        busy={deleting}
        onConfirm={() => void onDelete()}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* The queue is operator-only (the /jobs route guard agrees); hiding the
          link for reviewers and users keeps the button from ending in a redirect. */}
      {canOperate ? (
        <div className="flex justify-end">
          <button type="button" className={btnPrimary} onClick={() => navigate('/jobs')}>
            Inspect the job queue
          </button>
        </div>
      ) : null}
    </div>
  );
}
