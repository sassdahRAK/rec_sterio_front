import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { jobsApi, retryGet, statsApi } from '../api/client';
import type { Job, Stats } from '../api/types';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import Spinner from '../components/Spinner';
import StatCard from '../components/StatCard';
import { sourceLabel, statusColor, toneForStatus } from '../components/StatusBadge';
import { formatBytes, formatRelative, truncate } from '../lib/format';
import { useAutoRefresh } from '../lib/useAutoRefresh';
import { jobKindLabel, jobStatusLabel, videoStatusLabel } from '../lib/statusLabels';
import { btnNeutral, btnPrimary, iconBtnCls } from '../components/ui';
import { RefreshIcon } from '../components/icons';

const statusOrder = [
  'pending',
  'downloading',
  'downloaded',
  'transcribing',
  'transcribed',
  'failed',
  'quarantined',
];

function orderEntries(record: Record<string, number>): Array<[string, number]> {
  const known = statusOrder
    .filter((key) => key in record)
    .map((key) => [key, record[key]] as [string, number]);
  const extra = Object.entries(record)
    .filter(([key]) => !statusOrder.includes(key))
    .map(([key, value]) => [key, value] as [string, number]);
  return [...known, ...extra];
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate font-mono text-2xs text-dim">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, value > 0 ? 3 : 0)}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-2xs text-faint">{value}</span>
    </div>
  );
}

export default function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failures, setFailures] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  // True once a load has populated the page. A failure after that keeps the
  // last-known numbers on screen instead of swapping the whole page for the
  // error view over one blip — the banner renders only when there is no data.
  // Ordering is decided by `lastAppliedSeq`: any successful response newer
  // than the last one applied is used, so a StrictMode duplicate whose twin
  // already succeeded is not treated as "stale", and a failure never
  // overwrites an applied success. The first load retries twice (1s/3s).
  const hasDataRef = useRef(false);
  const reqSeq = useRef(0);
  const lastAppliedSeq = useRef(0);

  const load = useCallback((silent = false): void => {
    const seq = ++reqSeq.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    const run = () =>
      Promise.all([
        statsApi.get(),
        jobsApi.list({ status: 'failed', page_size: 5, sort: '-created_at' }),
      ]);
    (silent ? run() : retryGet(run))
      .then(([statsResult, jobsResult]) => {
        if (seq < lastAppliedSeq.current) return;
        lastAppliedSeq.current = seq;
        setStats(statsResult);
        setFailures(jobsResult.items);
        hasDataRef.current = true;
        setError(null);
      })
      .catch((err: unknown) => {
        if (seq < lastAppliedSeq.current) return;
        if (!hasDataRef.current) setError(err);
      })
      .finally(() => {
        if (seq === reqSeq.current && !silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The counters track the pipeline, so poll them: a video the bot just
  // finished downloading shows up without a manual Refresh. The loader never
  // sets `loading` itself (only the first paint and the Refresh button do),
  // so a poll updates the numbers without flashing the full-page spinner.
  useAutoRefresh(load, { intervalMs: 15000 });

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-20">
        <Spinner className="h-5 w-5" />
        <span className="text-sm text-dim">Loading pipeline statistics…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h2 className="break-words font-display text-2xl font-bold tracking-tight text-fg">
            Pipeline overview
          </h2>
          <p className="mt-0.5 text-sm text-dim">
            The pipeline counters could not be loaded. This is usually a temporary connection problem.
          </p>
        </div>
        <ErrorState error={error} onRetry={() => void load()} />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="card mx-auto max-w-3xl">
        <EmptyState
          title="No statistics yet"
          description="The server returned an empty statistics payload. Once the worker records a video, its counters appear here."
          action={
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void load();
              }}
              className={`${btnNeutral} rounded-full`}
            >
              Try again
            </button>
          }
        />
      </div>
    );
  }

  const videoEntries = orderEntries(stats.videos_by_status);
  const sourceEntries = Object.entries(stats.transcripts_by_source);
  const transcriptTotal = sourceEntries.reduce((sum, [, value]) => sum + value, 0);
  const pipelineEmpty =
    stats.videos_total === 0 &&
    stats.transcripts_total === 0 &&
    stats.jobs_queued === 0 &&
    stats.jobs_failed === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="min-w-0 max-w-full">
          <h2 className="break-words font-display text-2xl font-bold tracking-tight text-fg">Pipeline overview</h2>
          <p className="mt-0.5 hidden break-words text-sm text-dim sm:block">
            Ingestion, transcription and the job queue.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className={`${iconBtnCls} ml-auto`}
          aria-label="Refresh"
          title="Refresh counters"
        >
          <RefreshIcon size={16} />
        </button>
      </div>

      {pipelineEmpty ? (
        <div className="card">
          <EmptyState
            title="Nothing has been ingested yet"
            description="Add a video from the library, or send a link to the Telegram bot. Its download, transcription and merge progress will appear here."
            action={
              <Link to="/videos" className={`${btnPrimary} rounded-full`}>
                Open the video library
              </Link>
            }
          />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Videos" value={stats.videos_total} hint="ingested" />
        <StatCard label="Transcribed" value={stats.transcripts_total} hint="versions" />
        <StatCard label="Merged" value={stats.merges_total} hint="Gemini merges" tone="info" />
        <StatCard
          label="Waiting"
          value={stats.jobs_queued}
          hint="queued"
          tone={stats.jobs_queued > 0 ? 'warn' : 'default'}
        />
        <StatCard
          label="Failed jobs"
          value={stats.jobs_failed}
          hint="need attention"
          tone={stats.jobs_failed > 0 ? 'bad' : 'ok'}
        />
        <StatCard label="Storage" value={formatBytes(stats.total_media_bytes)} hint="on disk" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-fg">Video pipeline</h3>
            <Link to="/videos" className="tap-pad inline-flex items-center text-xs text-accent hover:underline">
              Open library
            </Link>
          </div>

          {videoEntries.length === 0 ? (
            <p className="py-6 text-center text-xs text-faint">No videos have been ingested yet.</p>
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-line">
                {videoEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className={`${statusColor(key)} h-full`}
                    style={{ width: `${(value / Math.max(1, stats.videos_total)) * 100}%` }}
                    title={`${videoStatusLabel(key)}: ${value}`}
                  />
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {videoEntries.map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${statusColor(key)}`} />
                    <span className="truncate text-2xs text-dim">{videoStatusLabel(key)}</span>
                    <span className="ml-auto font-mono text-2xs text-faint">{value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="card p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-fg">Transcript sources</h3>
          {sourceEntries.length === 0 ? (
            <p className="py-6 text-center text-xs text-faint">No transcripts have been produced yet.</p>
          ) : (
            <div className="space-y-2.5">
              {sourceEntries.map(([key, value]) => (
                <Bar
                  key={key}
                  label={sourceLabel(key)}
                  value={value}
                  total={transcriptTotal}
                  color={
                    key === 'whisper'
                      ? 'bg-info'
                      : key === 'gemini'
                        ? 'bg-violet'
                        : key === 'manual'
                          ? 'bg-warn'
                          : 'bg-ok'
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="font-display text-sm font-semibold text-fg">Recent failures</h3>
          <Link to="/jobs" className="tap-pad inline-flex items-center text-xs text-accent hover:underline">
            Open job queue
          </Link>
        </div>
        {failures.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-faint">No failed jobs in the queue.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {failures.map((job) => (
              <li key={job.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <span className="rounded border border-line bg-raised px-1.5 py-0.5 text-2xs text-dim">
                  {jobKindLabel(job.kind)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-mono text-xs text-bad">
                    {truncate(job.last_error ?? 'unknown error', 110)}
                  </span>
                  <span className="mt-0.5 block text-2xs text-faint">
                    attempt {job.attempts}/{job.max_attempts} · {formatRelative(job.created_at)}
                  </span>
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide ${
                    toneForStatus(job.status) === 'bad'
                      ? 'border-bad/30 bg-bad-soft text-bad'
                      : 'border-warn/30 bg-warn-soft text-warn'
                  }`}
                >
                  {jobStatusLabel(job.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
