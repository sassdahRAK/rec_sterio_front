import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, jobsApi, mergesApi, retryGet, transcriptsApi, videosApi } from '../api/client';
import type { Job, Merge, Transcript, TranscriptEngine, VideoDetail } from '../api/types';
import { ADMIN_TIER, OPERATOR_ROLES, TRANSCRIPT_EDIT_ROLES } from '../api/types';
import ConfirmDialog from '../components/ConfirmDialog';
import ErrorState from '../components/ErrorState';
import JobTable from '../components/JobTable';
import MergeDiff from '../components/MergeDiff';
import Spinner from '../components/Spinner';
import StatusBadge, { PlatformBadge } from '../components/StatusBadge';
import TranscriptEditor from '../components/TranscriptEditor';
import TranscriptVersionList from '../components/TranscriptVersionList';
import VideoPlayer from '../components/VideoPlayer';
import { btnDanger, btnNeutral, btnPrimary, selectCls } from '../components/ui';
import { MergeIcon, RefreshIcon, SparklesIcon, TrashIcon } from '../components/icons';
import { formatBytes, formatDateTime, formatDuration, formatRelative, shortId } from '../lib/format';
import { jobKindLabel, videoStatusLabel } from '../lib/statusLabels';
import { useAutoRefresh } from '../lib/useAutoRefresh';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/toast';

const pipelineStages = ['pending', 'downloading', 'downloaded', 'transcribing', 'transcribed'] as const;

function isActiveJob(job: Job): boolean {
  return job.status === 'running' || job.status === 'queued';
}

function StageRail({ status, progress }: { status: string; progress: number }) {
  const failed = status === 'failed' || status === 'quarantined';
  const currentIndex = pipelineStages.indexOf(status as (typeof pipelineStages)[number]);

  return (
    <ol className="flex flex-wrap items-center gap-1" aria-label="Ingestion pipeline">
      {pipelineStages.map((stage, index) => {
        const done = currentIndex > index || (currentIndex === index && status === 'transcribed');
        const active = currentIndex === index && !done;
        const tone = failed && active ? 'bad' : done ? 'ok' : active ? 'info' : 'neutral';
        const dot = tone === 'ok' ? 'bg-ok' : tone === 'info' ? 'bg-info animate-pulse' : tone === 'bad' ? 'bg-bad' : 'bg-line';
        return (
          <li key={stage} className="flex items-center gap-1">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide ${
                tone === 'ok'
                  ? 'border-ok/30 bg-ok-soft text-ok'
                  : tone === 'info'
                    ? 'border-info/30 bg-info-soft text-info'
                    : tone === 'bad'
                      ? 'border-bad/30 bg-bad-soft text-bad'
                      : 'border-line bg-raised text-faint'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
              {videoStatusLabel(stage)}
            </span>
            {index < pipelineStages.length - 1 ? <span className="text-faint">→</span> : null}
          </li>
        );
      })}
      {status === 'downloading' ? (
        <li className="ml-2 font-mono text-2xs text-info">{progress}%</li>
      ) : null}
      {failed ? (
        <li className="ml-2">
          <StatusBadge status={status} label={videoStatusLabel(status)} />
        </li>
      ) : null}
    </ol>
  );
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-2 border-b border-line-soft px-3 py-2 last:border-b-0">
      <dt className="text-2xs font-semibold uppercase tracking-[0.12em] text-faint">{label}</dt>
      <dd className="min-w-0 break-words font-mono text-xs text-dim">{children}</dd>
    </div>
  );
}

export default function VideoDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const email = useAuthStore((s) => s.email);

  // Mirrors the server's capability matrix: the admin tier manages (generate,
  // merge, delete) and — because re-enqueueing a download needs editor rights
  // on the video — retries ingestion; reviewers may correct transcripts;
  // operators still requeue *jobs* (the history table below is an operator
  // surface, unlike the video-level retry); everyone else reads.
  const canOperate = OPERATOR_ROLES.includes(role);
  const canManage = ADMIN_TIER.includes(role);
  const canEditTranscript = TRANSCRIPT_EDIT_ROLES.includes(role);
  const canRetryVideo = ADMIN_TIER.includes(role);

  const [detail, setDetail] = useState<VideoDetail | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [versions, setVersions] = useState<Transcript[]>([]);
  const [merges, setMerges] = useState<Merge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [engine, setEngine] = useState<TranscriptEngine>('both');
  const [polling, setPolling] = useState(false);
  const [pollStartedAt, setPollStartedAt] = useState<number | null>(null);
  const [applyingMergeId, setApplyingMergeId] = useState<string | null>(null);
  const [appliedMergeIds, setAppliedMergeIds] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // The transcript/versions pair has its own ordering channel — it is loaded
  // independently of the detail (after saves and merge applies too). Ordering
  // is decided by `transcriptAppliedSeq`: any response newer than the last one
  // applied wins, and a failure never overwrites an applied success — except a
  // 404, which is real data ("this video has no transcript yet"), exactly what
  // the old unconditional null-on-error path showed in that case.
  const transcriptReqSeq = useRef(0);
  const transcriptAppliedSeq = useRef(0);
  const loadTranscriptData = useCallback(async (): Promise<void> => {
    const seq = ++transcriptReqSeq.current;
    const [currentRes, versionsRes] = await Promise.allSettled([
      transcriptsApi.current(id),
      transcriptsApi.versions(id),
    ]);
    if (seq < transcriptAppliedSeq.current) return;
    transcriptAppliedSeq.current = seq;
    if (currentRes.status === 'fulfilled') setTranscript(currentRes.value);
    else if (currentRes.reason instanceof ApiError && currentRes.reason.status === 404) {
      setTranscript(null);
    }
    if (versionsRes.status === 'fulfilled') setVersions(versionsRes.value.items);
    else if (versionsRes.reason instanceof ApiError && versionsRes.reason.status === 404) {
      setVersions([]);
    }
  }, [id]);

  // Detail + merges share one ordering channel with the 3s worker watch below,
  // decided by `lastAppliedSeq`: any successful response newer than the last
  // one applied is used — crucially, a StrictMode duplicate whose twin already
  // succeeded is not treated as "stale" — and a failure never overwrites
  // applied data. The error view renders only while no detail exists (see the
  // `!detail` gate below), so a blip never hides a loaded video. Non-silent
  // loads retry twice (1s/3s) before erroring.
  const reqSeq = useRef(0);
  const lastAppliedSeq = useRef(0);
  const load = useCallback(
    (silent = false): void => {
      const seq = ++reqSeq.current;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      const run = () =>
        Promise.all([
          videosApi.get(id),
          mergesApi.listForVideo(id).catch(() => ({ items: [] as Merge[] })),
        ]);
      (silent ? run() : retryGet(run))
        .then(([detailResult, mergeList]) => {
          if (seq < lastAppliedSeq.current) return;
          lastAppliedSeq.current = seq;
          setDetail(detailResult);
          setMerges(mergeList.items);
          setError(null);
          // Watch the worker whenever any job is in flight — including one the
          // Telegram bot queued — so this page follows the pipeline without a
          // manual refresh. The poll stops itself once nothing is active.
          if (detailResult.jobs.some(isActiveJob)) {
            setPolling(true);
            setPollStartedAt((prev) => prev ?? Date.now());
          }
          void loadTranscriptData();
        })
        .catch((err: unknown) => {
          if (seq < lastAppliedSeq.current) return;
          if (!silent) setError(err);
        })
        .finally(() => {
          if (seq === reqSeq.current && !silent) setLoading(false);
        });
    },
    [id, loadTranscriptData],
  );

  useEffect(() => {
    load();
  }, [load]);

  // One lightweight status tick while a job is in flight — it never touches
  // `loading`, so the page does not flash. It shares the detail ordering
  // channel: a tick older than the last applied response is dropped, so it can
  // never overwrite a newer manual load, and its own newer responses always
  // win over older manual-load ones. When the last job leaves the queue, stop
  // watching and pull the fresh transcript/merge results.
  const pollTick = useCallback(async (): Promise<void> => {
    const seq = ++reqSeq.current;
    try {
      const fresh = await videosApi.get(id);
      if (seq < lastAppliedSeq.current) return;
      lastAppliedSeq.current = seq;
      setDetail(fresh);
      const active = fresh.jobs.some(isActiveJob);
      if (!active) {
        setPolling(false);
        setPollStartedAt(null);
        setMerges(
          (await mergesApi.listForVideo(id).catch(() => ({ items: [] as Merge[] }))).items,
        );
        void loadTranscriptData();
        toast.success('The worker finished. This page is up to date.');
      }
    } catch {
      /* keep polling; a transient error should not stop the watch */
    } finally {
      // The newest response clears the spinner even if a manual load that
      // started before this tick is still in flight — that older load will be
      // dropped by the ordering guard above, so nothing left to wait for.
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [id, loadTranscriptData]);

  // The shared hook drives the 3s watch: it pauses on a hidden tab and ticks
  // immediately on visible/focus, and it only runs while `polling` is set, so
  // there is no second timer on this page.
  useAutoRefresh(() => void pollTick(), { intervalMs: 3000, enabled: polling });

  const nextVersion = useMemo(
    () => versions.reduce((max, v) => Math.max(max, v.version), 0) + 1,
    [versions],
  );

  const onSaveTranscript = async (content: string, language: string | null): Promise<void> => {
    setSaving(true);
    try {
      const created = await transcriptsApi.save(id, { content, language, segments: null });
      toast.success(`Saved as version ${created.version}. The previous version is untouched.`);
      await loadTranscriptData();
      load();
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'unexpected_error', apiError.message);
    } finally {
      setSaving(false);
    }
  };

  const onGenerate = async (): Promise<void> => {
    setGenerating(true);
    try {
      const result = await transcriptsApi.generate(id, { engine });
      toast.success(`Queued ${result.jobs.length} job${result.jobs.length === 1 ? '' : 's'} for the ${engine} engine.`);
      setPollStartedAt(Date.now());
      setPolling(true);
      load();
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'unexpected_error', apiError.message);
    } finally {
      setGenerating(false);
    }
  };

  const onStartMerge = async (): Promise<void> => {
    const base =
      versions.find((v) => v.source === 'whisper') ?? versions.find((v) => v.status === 'ready') ?? versions[0];
    if (!base) {
      toast.error('no_transcript', 'Generate a transcript before starting a merge.');
      return;
    }
    const gemini = versions.find((v) => v.source === 'gemini');
    try {
      await mergesApi.create(id, {
        base_transcript_id: base.id,
        gemini_transcript_id: gemini?.id ?? null,
      });
      toast.success('Merge queued. The diff appears when the worker finishes.');
      const list = await mergesApi.listForVideo(id);
      setMerges(list.items);
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'unexpected_error', apiError.message);
    }
  };

  const onApplyMerge = async (merge: Merge): Promise<void> => {
    setApplyingMergeId(merge.id);
    try {
      const created = await mergesApi.apply(merge.id);
      setAppliedMergeIds((prev) => [...prev, merge.id]);
      toast.success(`Merge applied. Version ${created.version} is now the current transcript.`);
      await loadTranscriptData();
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'unexpected_error', apiError.message);
    } finally {
      setApplyingMergeId(null);
    }
  };

  const onRetryVideo = async (): Promise<void> => {
    try {
      await videosApi.retry(id);
      toast.success('Re-queued the download job for this video.');
      load();
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'unexpected_error', apiError.message);
    }
  };

  const onDelete = async (): Promise<void> => {
    setDeleting(true);
    try {
      await videosApi.remove(id);
      toast.success('Video deleted.');
      navigate('/videos', { replace: true });
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'unexpected_error', apiError.message);
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const onRetryJob = async (job: Job): Promise<void> => {
    try {
      await jobsApi.retry(job.id);
      toast.success(`${jobKindLabel(job.kind)} job re-queued.`);
      load();
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'unexpected_error', apiError.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-20">
        <Spinner className="h-5 w-5" />
        <span className="text-sm text-dim">Loading video…</span>
      </div>
    );
  }

  // The failure view only replaces the page while there is no detail to keep;
  // once the video is loaded, a failed reload or poll leaves it on screen.
  if (error && !detail) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <ErrorState error={error} onRetry={() => load()} />
        <Link to="/videos" className="text-sm text-accent hover:underline">
          ← Back to the video library
        </Link>
      </div>
    );
  }

  if (!detail) return null;

  const videoTitle = detail.title ?? detail.source_url;

  // Applying a merge promotes the merged transcript to be the current one,
  // which the server gates on editor rights over the video: the admin tier or
  // the account that ingested it (`created_by` is the `<role>:<email>` actor
  // string). An invited folder editor qualifies server-side too, but this page
  // never loads the folder tree to know that — the button is simply hidden for
  // them and the API still enforces the right.
  const canApplyMerge = canManage || (email != null && detail.created_by === `${role}:${email}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="min-w-0">
          <Link to="/videos" className="text-xs text-faint transition hover:text-accent">
            ← Video library
          </Link>
          <h2 className="mt-1 max-w-[34rem] truncate font-display text-2xl font-bold tracking-tight text-fg">{videoTitle}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge status={String(detail.status)} label={videoStatusLabel(detail.status)} />
            <PlatformBadge platform={String(detail.platform)} />
            <span className="font-mono text-2xs text-faint">id {shortId(detail.id)}</span>
            <span className="font-mono text-2xs text-faint">by {detail.created_by_display ?? detail.created_by}</span>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canManage ? (
            <div className="flex items-center gap-1.5">
              <label htmlFor="engine" className="sr-only">
                Transcription engine
              </label>
              <select
                id="engine"
                value={engine}
                onChange={(e) => setEngine(e.target.value as TranscriptEngine)}
                className={`${selectCls} w-32 rounded-full`}
              >
                <option value="both">Both engines</option>
                <option value="whisper">Whisper only</option>
                <option value="gemini">Gemini only</option>
              </select>
              {/* Icon + label on md+; the label collapses on phones, so every
                  state (including the transcribing spinner) keeps its
                  aria-label and tooltip. */}
              <button
                type="button"
                onClick={() => void onGenerate()}
                disabled={generating || polling}
                className={`${btnPrimary} rounded-full`}
                aria-label={polling ? 'Transcribing…' : 'Generate transcript'}
                title={polling ? 'Watching the worker' : 'Generate a transcript'}
              >
                {generating || polling ? <Spinner className="h-3.5 w-3.5" /> : <SparklesIcon size={14} />}
                <span className="hidden md:inline">{polling ? 'Transcribing…' : 'Generate'}</span>
              </button>
            </div>
          ) : null}
          {canManage ? (
            <button
              type="button"
              onClick={() => void onStartMerge()}
              className={`${btnNeutral} rounded-full`}
              aria-label="Start merge"
              title="Reconcile the Whisper and Gemini transcripts"
            >
              <MergeIcon size={14} />
              <span className="hidden md:inline">Merge</span>
            </button>
          ) : null}
          {canRetryVideo ? (
            <button
              type="button"
              onClick={() => void onRetryVideo()}
              className={`${btnNeutral} rounded-full`}
              aria-label="Retry the download"
              title="Re-queue the download job"
            >
              <RefreshIcon size={14} />
              <span className="hidden md:inline">Retry</span>
            </button>
          ) : null}
          {canManage ? (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className={`${btnDanger} rounded-full`}
              aria-label="Delete this video"
              title="Delete this video and its transcripts"
            >
              <TrashIcon size={14} />
              <span className="hidden md:inline">Delete</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
        <StageRail status={String(detail.status)} progress={detail.progress} />
        {polling ? (
          <span className="ml-auto inline-flex items-center gap-2 text-2xs text-info">
            <Spinner className="h-3 w-3" />
            watching the worker
            {pollStartedAt ? ` · ${Math.round((Date.now() - pollStartedAt) / 1000)}s` : ''}
          </span>
        ) : null}
      </div>

      {detail.error ? (
        <div className="rounded-lg border border-bad/40 bg-bad-soft/60 px-4 py-3">
          <p className="font-mono text-2xs uppercase tracking-wider text-bad">last error</p>
          <p className="mt-1 font-mono text-xs text-bad/90">{detail.error}</p>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <VideoPlayer
            videoId={detail.id}
            title={detail.title}
            mimeType={detail.mime_type}
            durationSeconds={detail.duration_seconds}
            fileSize={detail.file_size}
          />
        </div>

        <section className="card overflow-hidden">
          <h3 className="border-b border-line px-3 py-2.5 font-display text-sm font-semibold text-fg">Metadata</h3>
          <dl>
            <MetaRow label="Source URL">
              <a
                href={detail.source_url}
                target="_blank"
                rel="noreferrer noopener"
                className="break-all text-accent hover:underline"
              >
                {detail.source_url}
              </a>
            </MetaRow>
            <MetaRow label="Platform">{String(detail.platform)}</MetaRow>
            <MetaRow label="Duration">{formatDuration(detail.duration_seconds)}</MetaRow>
            <MetaRow label="File size">{formatBytes(detail.file_size)}</MetaRow>
            <MetaRow label="MIME type">{detail.mime_type ?? 'None'}</MetaRow>
            <MetaRow label="sha256">
              <span className="break-all">{detail.checksum_sha256 ?? 'None'}</span>
            </MetaRow>
            <MetaRow label="Created by">{detail.created_by_display ?? detail.created_by}</MetaRow>
            <MetaRow label="Created">{formatDateTime(detail.created_at)}</MetaRow>
            <MetaRow label="Updated">{formatRelative(detail.updated_at)}</MetaRow>
            <MetaRow label="Notes">{detail.notes ?? 'None'}</MetaRow>
          </dl>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TranscriptEditor
            transcript={transcript}
            nextVersion={nextVersion}
            saving={saving}
            readOnly={!canEditTranscript}
            onSave={(content, language) => void onSaveTranscript(content, language)}
          />
        </div>

        <section className="space-y-3">
          <div>
            <h3 className="mb-2 font-display text-sm font-semibold text-fg">
              Version history
              <span className="ml-2 font-mono text-2xs font-normal text-faint">{versions.length} versions</span>
            </h3>
            <TranscriptVersionList
              versions={versions}
              currentId={transcript?.id ?? null}
              onLoad={(version) => {
                setTranscript(version);
                toast.info(`Loaded version ${version.version} into the editor.`);
              }}
            />
          </div>
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="font-display text-sm font-semibold text-fg">
            Job history
            <span className="ml-2 font-mono text-2xs font-normal text-faint">{detail.jobs.length} jobs</span>
          </h3>
        </div>
        <JobTable
          jobs={detail.jobs}
          loading={false}
          videoTitles={{ [detail.id]: videoTitle }}
          canRetry={canOperate}
          onRetry={(job) => void onRetryJob(job)}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-fg">
            Merges
            <span className="ml-2 font-mono text-2xs font-normal text-faint">{merges.length} attempts</span>
          </h3>
        </div>

        {merges.length === 0 ? (
          <div className="card">
            <p className="px-4 py-10 text-center text-xs text-faint">
              No merge has been run for this video. Start one to reconcile the Whisper and Gemini transcripts.
            </p>
          </div>
        ) : (
          merges.map((merge) => (
            <MergeDiff
              key={merge.id}
              merge={merge}
              applying={applyingMergeId === merge.id}
              applied={appliedMergeIds.includes(merge.id)}
              canApply={canApplyMerge}
              onApply={(target) => void onApplyMerge(target)}
            />
          ))
        )}
      </section>

      <ConfirmDialog
        open={deleteOpen}
        destructive
        title="Delete this video?"
        message={`“${videoTitle}” and every transcript, merge and job record attached to it will be removed, along with the media file on disk. This cannot be undone.`}
        confirmLabel="Delete video"
        busy={deleting}
        onConfirm={() => void onDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
