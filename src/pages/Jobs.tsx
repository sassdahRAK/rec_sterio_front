import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, jobsApi, videosApi } from '../api/client';
import type { Job, JobListQuery } from '../api/types';
import { JOB_KINDS, JOB_STATUSES } from '../api/types';
import ErrorState from '../components/ErrorState';
import JobTable from '../components/JobTable';
import Pagination from '../components/Pagination';
import Spinner from '../components/Spinner';
import { jobKindLabel, jobStatusLabel } from '../lib/statusLabels';
import { toast } from '../store/toast';
import { btnNeutral, btnPrimary, labelCls, selectCls } from '../components/ui';

const REFRESH_MS = 5000;

export default function Jobs() {
  const [query, setQuery] = useState<JobListQuery>({ page: 1, page_size: 20, sort: '-created_at' });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [videoTitles, setVideoTitles] = useState<Record<string, string>>({});
  const titleCache = useRef<Record<string, string>>({});

  // Returns a cleanup function so the effect can cancel it: a filter change can
  // overlap the previous request, and a 5 s auto-refresh can overlap a manual
  // one. Without the guard the slower, older response wins.
  const load = useCallback(
    (silent = false): (() => void) => {
      let cancelled = false;
      if (!silent) setLoading(true);
      jobsApi
        .list(query)
        .then((result) => {
          if (cancelled) return;
          setJobs(result.items);
          setTotal(result.total);
          setLastUpdated(new Date());
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    },
    [query],
  );

  useEffect(() => load(), [load]);

  // Auto-refresh the queue so running jobs visibly advance.
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => load(true), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [autoRefresh, load]);

  // Keep a title map so the queue is readable without opening every video.
  useEffect(() => {
    let cancelled = false;
    const fetchTitles = async (): Promise<void> => {
      try {
        const result = await videosApi.list({ page: 1, page_size: 100 });
        if (cancelled) return;
        const map: Record<string, string> = { ...titleCache.current };
        result.items.forEach((video) => {
          map[video.id] = video.title ?? video.source_url;
        });
        titleCache.current = map;
        setVideoTitles(map);
      } catch {
        /* titles are decorative — never block the queue on them */
      }
    };
    void fetchTitles();
    const timer = window.setInterval(() => void fetchTitles(), 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const onRetry = async (job: Job): Promise<void> => {
    setBusyId(job.id);
    try {
      await jobsApi.retry(job.id);
      toast.success(`${jobKindLabel(job.kind)} job re-queued with a fresh attempt budget.`);
      load(true);
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'unexpected_error', apiError.message);
    } finally {
      setBusyId(null);
    }
  };

  const onCancel = async (job: Job): Promise<void> => {
    setBusyId(job.id);
    try {
      await jobsApi.cancel(job.id);
      toast.info(`${jobKindLabel(job.kind)} job cancelled.`);
      load(true);
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'unexpected_error', apiError.message);
    } finally {
      setBusyId(null);
    }
  };

  const statusValue = query.status ?? '';
  const kindValue = query.kind ?? '';
  const page = query.page ?? 1;
  const pageSize = query.page_size ?? 20;

  return (
    <div className="mx-auto max-w-[96rem] space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div>
          <h2 className="break-words font-display text-2xl font-bold tracking-tight text-fg">Job queue</h2>
          <p className="mt-0.5 text-sm text-dim">
            {loading ? 'Loading…' : `${total} job${total === 1 ? '' : 's'} matching the current filters`}
            {lastUpdated ? <UpdatedAt value={lastUpdated} /> : null}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-dim">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-line bg-raised text-accent focus:ring-accent/40"
            />
            Auto-refresh every 5s
          </label>
          <button type="button" onClick={() => void load()} className={`${btnNeutral} rounded-full`}>
            {loading ? <Spinner className="h-3.5 w-3.5" /> : null}
            Refresh
          </button>
        </div>
      </div>

      <div className="card grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="job-status" className={labelCls}>
            Status
          </label>
          <select
            id="job-status"
            value={statusValue}
            onChange={(e) => setQuery((prev) => ({ ...prev, status: e.target.value || undefined, page: 1 }))}
            className={`${selectCls} w-full`}
          >
            <option value="">All statuses</option>
            {JOB_STATUSES.map((status) => (
              <option key={status} value={status}>
                {jobStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="job-kind" className={labelCls}>
            Kind
          </label>
          <select
            id="job-kind"
            value={kindValue}
            onChange={(e) => setQuery((prev) => ({ ...prev, kind: e.target.value || undefined, page: 1 }))}
            className={`${selectCls} w-full`}
          >
            <option value="">All kinds</option>
            {JOB_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {jobKindLabel(kind)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="job-sort" className={labelCls}>
            Sort
          </label>
          <select
            id="job-sort"
            value={query.sort ?? '-created_at'}
            onChange={(e) => setQuery((prev) => ({ ...prev, sort: e.target.value, page: 1 }))}
            className={`${selectCls} w-full`}
          >
            <option value="-created_at">Newest first</option>
            <option value="created_at">Oldest first</option>
          </select>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            className={btnPrimary}
            onClick={() => setQuery((prev) => ({ ...prev, status: 'failed', page: 1 }))}
          >
            Show failures only
          </button>
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={() => void load()} /> : null}

      <div className="card overflow-hidden">
        <JobTable
          jobs={jobs}
          loading={loading}
          videoTitles={videoTitles}
          busyId={busyId}
          canRetry
          canCancel
          onRetry={(job) => void onRetry(job)}
          onCancel={(job) => void onCancel(job)}
        />
        {!loading && jobs.length > 0 ? (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            itemLabel="jobs"
            onPageChange={(next) => setQuery((prev) => ({ ...prev, page: next }))}
            onPageSizeChange={(size) => setQuery((prev) => ({ ...prev, page_size: size, page: 1 }))}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * The "updated HH:MM:SS" stamp. On desk widths it sits inline permanently;
 * on phones it peeks for 3s after each refresh (the queue polls every 5s, so
 * it flashes briefly then hands the header back to the count — no wrap, no
 * clutter).
 */
function UpdatedAt({ value }: { value: Date }) {
  const [visible, setVisible] = useState(true);
  const text = value.toLocaleTimeString();
  useEffect(() => {
    if (window.matchMedia('(min-width: 640px)').matches) {
      setVisible(true);
      return;
    }
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [text]);
  if (!visible) return null;
  return (
    <span className="ml-2 inline-block animate-fade-up font-mono text-2xs text-faint">
      updated {text}
    </span>
  );
}
