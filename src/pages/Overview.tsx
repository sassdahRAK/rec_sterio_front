import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { jobsApi, statsApi } from '../api/client';
import type { Job, Stats } from '../api/types';
import ErrorState from '../components/ErrorState';
import Spinner from '../components/Spinner';
import StatCard from '../components/StatCard';
import { statusColor, toneForStatus } from '../components/StatusBadge';
import { formatBytes, formatRelative, truncate } from '../lib/format';
import { btnNeutral } from '../components/ui';

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

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const [statsResult, jobsResult] = await Promise.all([
        statsApi.get(),
        jobsApi.list({ status: 'failed', page_size: 5, sort: '-created_at' }),
      ]);
      setStats(statsResult);
      setFailures(jobsResult.items);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-20">
        <Spinner className="h-5 w-5" />
        <span className="text-sm text-dim">Loading pipeline statistics…</span>
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => void load()} />;
  }

  if (!stats) return null;

  const videoEntries = orderEntries(stats.videos_by_status);
  const sourceEntries = Object.entries(stats.transcripts_by_source);
  const transcriptTotal = sourceEntries.reduce((sum, [, value]) => sum + value, 0);

  return (
    <div className="mx-auto max-w-[96rem] space-y-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="shrink-0">
          <h2 className="font-display text-2xl font-bold tracking-tight text-fg">Pipeline overview</h2>
          <p className="mt-0.5 text-sm text-dim">
            Live counters from <span className="font-mono text-xs text-faint">GET /api/v1/stats</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className={`${btnNeutral} ml-auto rounded-full`}
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Videos" value={stats.videos_total} hint="total ingested" />
        <StatCard label="Transcripts" value={stats.transcripts_total} hint="across all versions" />
        <StatCard label="Merges" value={stats.merges_total} hint="gemini reconciliations" tone="info" />
        <StatCard
          label="Queued jobs"
          value={stats.jobs_queued}
          hint="waiting for a worker"
          tone={stats.jobs_queued > 0 ? 'warn' : 'default'}
        />
        <StatCard
          label="Failed jobs"
          value={stats.jobs_failed}
          hint="need attention"
          tone={stats.jobs_failed > 0 ? 'bad' : 'ok'}
        />
        <StatCard label="Media stored" value={formatBytes(stats.total_media_bytes)} hint="on-disk footprint" />
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
                    title={`${key}: ${value}`}
                  />
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {videoEntries.map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${statusColor(key)}`} />
                    <span className="truncate font-mono text-2xs text-dim">{key}</span>
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
                  label={key}
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
                <span className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-2xs text-dim">
                  {job.kind}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-xs text-bad">
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
                  {job.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
