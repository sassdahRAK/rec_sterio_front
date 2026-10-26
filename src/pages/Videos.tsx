import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, videosApi } from '../api/client';
import type { Video, VideoListQuery } from '../api/types';
import AddVideoDialog from '../components/AddVideoDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import ErrorState from '../components/ErrorState';
import Pagination from '../components/Pagination';
import VideoTable from '../components/VideoTable';
import { PLATFORMS, VIDEO_STATUSES } from '../api/types';
import { toast } from '../store/toast';
import { btnNeutral, btnPrimary, inputCls, labelCls, selectCls } from '../components/ui';

export default function Videos() {
  const navigate = useNavigate();
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

  // Debounce the free-text search so every keystroke does not hit the API.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery((prev) => ({ ...prev, q: search.trim() || undefined, page: 1 }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const result = await videosApi.list(query);
      setVideos(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRetry = async (video: Video): Promise<void> => {
    setBusyId(video.id);
    try {
      await videosApi.retry(video.id);
      toast.success(`Re-queued the download for “${video.title ?? video.id}”.`);
      await load();
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'unexpected_error', apiError.message);
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
      await load();
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-fg">Video library</h2>
          <p className="mt-0.5 text-sm text-dim">{summary}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void load()} className={btnNeutral}>
            Refresh
          </button>
          <button type="button" onClick={() => setAddOpen(true)} className={btnPrimary}>
            Add video
          </button>
        </div>
      </div>

      <div className="card grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="video-search" className={labelCls}>
            Search
          </label>
          <input
            id="video-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title or source URL"
            className={inputCls}
          />
        </div>

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
          onView={(video) => navigate(`/videos/${video.id}`)}
          onRetry={(video) => void onRetry(video)}
          onDelete={(video) => setDeleteTarget(video)}
        />
        {!loading && videos.length > 0 ? (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            itemLabel="videos"
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

      <div className="flex justify-end">
        <button type="button" className={btnPrimary} onClick={() => navigate('/jobs')}>
          Inspect the job queue
        </button>
      </div>
    </div>
  );
}
