import { Fragment } from 'react';
import type { Job } from '../api/types';
import { formatDateTime, formatRelative } from '../lib/format';
import EmptyState from './EmptyState';
import Spinner from './Spinner';
import StatusBadge from './StatusBadge';
import { btnGhost, btnNeutral, tableCellCls, tableHeadCls } from './ui';

interface JobTableProps {
  jobs: Job[];
  loading: boolean;
  videoTitles?: Record<string, string>;
  onRetry?: (job: Job) => void;
  onCancel?: (job: Job) => void;
  busyId?: string | null;
  /** Right to requeue jobs (the operator surface); hides Retry otherwise. */
  canRetry?: boolean;
  /** Right to cancel jobs (the operator surface); hides Cancel otherwise. */
  canCancel?: boolean;
}

function jobDuration(job: Job): string {
  if (!job.started_at) return '—';
  const end = job.finished_at ? Date.parse(job.finished_at) : Date.now();
  const ms = end - Date.parse(job.started_at);
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

export default function JobTable({
  jobs,
  loading,
  videoTitles,
  onRetry,
  onCancel,
  busyId,
  canRetry = false,
  canCancel = false,
}: JobTableProps) {
  if (loading && jobs.length === 0) {
    return (
      <div className="flex items-center justify-center gap-3 px-6 py-16">
        <Spinner className="h-5 w-5" />
        <span className="text-sm text-dim">Loading jobs…</span>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        title="No jobs match these filters"
        description="The worker queue is filtered by status and kind — clear a filter to see the rest of the queue."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] border-collapse">
        <thead className="border-b border-line bg-raised/40">
          <tr>
            <th scope="col" className={tableHeadCls}>Kind</th>
            <th scope="col" className={tableHeadCls}>Status</th>
            <th scope="col" className={tableHeadCls}>Attempts</th>
            <th scope="col" className={tableHeadCls}>Video</th>
            <th scope="col" className={tableHeadCls}>Scheduled</th>
            <th scope="col" className={tableHeadCls}>Duration</th>
            <th scope="col" className={`${tableHeadCls} sticky right-0 border-l border-line bg-card text-right`}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const retryable = job.status === 'failed' || job.status === 'dead';
            const cancellable = job.status === 'running' || job.status === 'queued';
            return (
              <Fragment key={job.id}>
                <tr className="align-middle transition-colors hover:bg-raised/40">
                  <td className={tableCellCls}>
                    <span className="font-mono text-xs font-medium text-fg">{job.kind}</span>
                    <span className="mt-0.5 block font-mono text-2xs text-faint">prio {job.priority}</span>
                  </td>
                  <td className={tableCellCls}>
                    <StatusBadge status={String(job.status)} />
                  </td>
                  <td className={`${tableCellCls} whitespace-nowrap font-mono text-xs`}>
                    {job.attempts}/{job.max_attempts}
                  </td>
                  <td className={tableCellCls}>
                    {job.video_id ? (
                      <span className="block max-w-[11rem] truncate text-xs text-dim">
                        {videoTitles?.[job.video_id] ?? job.video_id.slice(0, 8)}
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className={`${tableCellCls} whitespace-nowrap text-xs`}>
                    <span title={formatDateTime(job.scheduled_at)}>{formatRelative(job.scheduled_at)}</span>
                  </td>
                  <td className={`${tableCellCls} whitespace-nowrap font-mono text-xs`}>{jobDuration(job)}</td>
                  <td className={`${tableCellCls} sticky right-0 border-l border-line bg-card text-right`}>
                    <div className="flex items-center justify-end gap-1">
                      {canRetry ? (
                        <button
                          type="button"
                          onClick={() => onRetry?.(job)}
                          disabled={!retryable || busyId === job.id}
                          className={`${btnNeutral} px-2 py-1 text-xs`}
                          title={retryable ? 'Requeue this job' : 'Only failed or dead jobs can be retried'}
                        >
                          Retry
                        </button>
                      ) : null}
                      {canCancel && onCancel ? (
                        <button
                          type="button"
                          onClick={() => onCancel(job)}
                          disabled={!cancellable || busyId === job.id}
                          className={`${btnGhost} px-2 py-1 text-xs`}
                          title={cancellable ? 'Cancel this job' : 'Only queued or running jobs can be cancelled'}
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>

                {job.last_error ? (
                  <tr className="bg-bad-soft/25">
                    <td colSpan={7} className="px-3 pb-2.5 pt-0">
                      <div className="flex items-start gap-2 rounded border border-bad/25 bg-bad-soft/40 px-2.5 py-1.5">
                        <span className="mt-0.5 shrink-0 font-mono text-2xs uppercase tracking-wider text-bad/80">
                          last error
                        </span>
                        <span className="min-w-0 whitespace-pre-wrap break-words font-mono text-2xs leading-relaxed text-bad">
                          {job.last_error}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
