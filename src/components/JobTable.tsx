import { Fragment } from 'react';
import type { Job } from '../api/types';
import { formatDateTime, formatRelative } from '../lib/format';
import { jobKindLabel, jobStatusLabel } from '../lib/statusLabels';
import { CloseIcon, RefreshIcon } from './icons';
import EmptyState from './EmptyState';
import Spinner from './Spinner';
import StatusBadge from './StatusBadge';
import { iconActionCls, tableCellCls, tableHeadCls } from './ui';

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
  if (!job.started_at) return 'None';
  const end = job.finished_at ? Date.parse(job.finished_at) : Date.now();
  const ms = end - Date.parse(job.started_at);
  if (!Number.isFinite(ms) || ms < 0) return 'None';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

const isRetryable = (job: Job): boolean => job.status === 'failed' || job.status === 'dead';
const isCancellable = (job: Job): boolean => job.status === 'running' || job.status === 'queued';

/**
 * Icon-only row actions, shared by the desk table and the phone card list so
 * the two layouts can never drift apart on meaning. Each button carries an
 * aria-label and a title that names the rule (why it may be disabled).
 */
function JobActions({
  job,
  onRetry,
  onCancel,
  busyId,
  canRetry,
  canCancel,
}: Pick<JobTableProps, 'onRetry' | 'onCancel' | 'busyId' | 'canRetry' | 'canCancel'> & {
  job: Job;
}) {
  const retryable = isRetryable(job);
  const cancellable = isCancellable(job);
  return (
    <div className="flex items-center gap-1">
      {canRetry ? (
        <button
          type="button"
          onClick={() => onRetry?.(job)}
          disabled={!retryable || busyId === job.id}
          className={iconActionCls('warn')}
          aria-label="Retry this job"
          title={retryable ? 'Retry: requeue with a fresh attempt budget' : 'Only failed or dead jobs can be retried'}
        >
          <RefreshIcon size={15} />
        </button>
      ) : null}
      {canCancel && onCancel ? (
        <button
          type="button"
          onClick={() => onCancel(job)}
          disabled={!cancellable || busyId === job.id}
          className={iconActionCls('bad')}
          aria-label="Cancel this job"
          title={cancellable ? 'Cancel this job' : 'Only queued or running jobs can be cancelled'}
        >
          <CloseIcon size={15} />
        </button>
      ) : null}
    </div>
  );
}

function JobError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded border border-bad/25 bg-bad-soft/40 px-2.5 py-1.5">
      <span className="mt-0.5 shrink-0 font-mono text-2xs uppercase tracking-wider text-bad/80">
        last error
      </span>
      <span className="min-w-0 whitespace-pre-wrap break-words font-mono text-2xs leading-relaxed text-bad">
        {message}
      </span>
    </div>
  );
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
        description="Recordings you add are queued here for transcription. An empty queue means nothing is waiting. Clear a filter to see the rest of the queue."
      />
    );
  }

  const actions = (job: Job) => (
    <JobActions
      job={job}
      onRetry={onRetry}
      onCancel={onCancel}
      busyId={busyId}
      canRetry={canRetry}
      canCancel={canCancel}
    />
  );

  const videoName = (job: Job): string | null =>
    job.video_id ? videoTitles?.[job.video_id] ?? job.video_id.slice(0, 8) : null;

  return (
    <>
      {/* Phones: one card per job (portal-style), newest action in the corner. */}
      <ul className="divide-y divide-line md:hidden">
        {jobs.map((job) => {
          const title = videoName(job);
          return (
            <li key={job.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{jobKindLabel(job.kind)}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-dim">
                    <span className="whitespace-nowrap font-mono text-2xs text-faint">
                      {job.attempts}/{job.max_attempts}
                    </span>
                    <span className="whitespace-nowrap font-mono text-2xs text-faint">
                      {jobDuration(job)}
                    </span>
                    <span className="whitespace-nowrap" title={formatDateTime(job.scheduled_at)}>
                      {formatRelative(job.scheduled_at)}
                    </span>
                  </p>
                </div>
                <StatusBadge status={String(job.status)} label={jobStatusLabel(job.status)} />
              </div>
              {title ? (
                <p className="mt-1.5 truncate text-xs text-dim">{title}</p>
              ) : null}
              {job.last_error ? (
                <div className="mt-2">
                  <JobError message={job.last_error} />
                </div>
              ) : null}
              <div className="mt-2 flex justify-end">{actions(job)}</div>
            </li>
          );
        })}
      </ul>

      {/* md+: the full table, horizontally scrollable when the queue is wide. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[46rem] border-collapse">
          <thead className="border-b border-line bg-raised/40">
            <tr>
              <th scope="col" className={tableHeadCls}>Kind</th>
              <th scope="col" className={tableHeadCls}>Status</th>
              <th scope="col" className={tableHeadCls}>Tries</th>
              <th scope="col" className={tableHeadCls}>Video</th>
              <th scope="col" className={tableHeadCls}>Scheduled</th>
              <th scope="col" className={tableHeadCls}>Duration</th>
              <th scope="col" className={`${tableHeadCls} sticky right-0 border-l border-line bg-card text-right`}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <Fragment key={job.id}>
                <tr className="align-middle transition-colors hover:bg-raised/40">
                  <td className={tableCellCls}>
                    <span className="text-xs font-medium text-fg">{jobKindLabel(job.kind)}</span>
                    <span className="mt-0.5 block font-mono text-2xs text-faint">prio {job.priority}</span>
                  </td>
                  <td className={tableCellCls}>
                    <StatusBadge status={String(job.status)} label={jobStatusLabel(job.status)} />
                  </td>
                  <td className={`${tableCellCls} whitespace-nowrap font-mono text-xs`}>
                    {job.attempts}/{job.max_attempts}
                  </td>
                  <td className={tableCellCls}>
                    {videoName(job) ? (
                      <span className="block max-w-[11rem] truncate text-xs text-dim">{videoName(job)}</span>
                    ) : (
                      <span className="text-faint">None</span>
                    )}
                  </td>
                  <td className={`${tableCellCls} whitespace-nowrap text-xs`}>
                    <span title={formatDateTime(job.scheduled_at)}>{formatRelative(job.scheduled_at)}</span>
                  </td>
                  <td className={`${tableCellCls} whitespace-nowrap font-mono text-xs`}>{jobDuration(job)}</td>
                  <td className={`${tableCellCls} sticky right-0 border-l border-line bg-card`}>
                    <div className="flex justify-end">{actions(job)}</div>
                  </td>
                </tr>

                {job.last_error ? (
                  <tr className="bg-bad-soft/25">
                    <td colSpan={7} className="px-3 pb-2.5 pt-0">
                      <JobError message={job.last_error} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
