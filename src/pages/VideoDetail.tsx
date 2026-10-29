import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, jobsApi, mergesApi, transcriptsApi, videosApi } from '../api/client';
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
import { formatBytes, formatDateTime, formatDuration, formatRelative, shortId } from '../lib/format';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/toast';

const pipelineStages = ['pending', 'downloading', 'downloaded', 'transcribing', 'transcribed'] as const;

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
              {stage}
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
          <StatusBadge status={status} />
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
  const pollRef = useRef<number | null>(null);

  const loadTranscriptData = useCallback(async (): Promise<void> => {
    try {
      const current = await transcriptsApi.current(id);
      setTranscript(current);
    } catch {
      setTranscript(null);
    }
    try {
      const list = await transcriptsApi.versions(id);
      setVersions(list.items);
    } catch {
      setVersions([]);
    }
  }, [id]);

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const [detailResult, mergeList] = await Promise.all([
        videosApi.get(id),
        mergesApi.listForVideo(id).catch(() => ({ items: [] as Merge[] })),
      ]);
      setDetail(detailResult);
      setMerges(mergeList.items);
      await loadTranscriptData();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id, loadTranscriptData]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Poll the video while a transcription job is in flight, then refresh the transcript.
  useEffect(() => {
    if (!polling) return;
    const tick = async (): Promise<void> => {
      try {
        const fresh = await videosApi.get(id);
        setDetail(fresh);
        const active = fresh.jobs.some((job) => job.status === 'running' || job.status === 'queued');
        if (!active) {
          setPolling(false);
          setPollStartedAt(null);
          await loadTranscriptData();
          toast.success('Transcription finished — the transcript has been refreshed.');
        }
      } catch {
        /* keep polling; a transient error should not stop the watch */
      }
    };
    pollRef.current = window.setInterval(() => void tick(), 3000);
    return () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [polling, id, loadTranscriptData]);

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
      await load();
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
      await load();
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
      toast.success(`Merge applied — version ${created.version} is now the current transcript.`);
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
      await load();
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
      toast.success(`Job ${job.kind} re-queued.`);
      await load();
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

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <ErrorState error={error} onRetry={() => void load()} />
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
    <div className="mx-auto max-w-[96rem] space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="min-w-0 shrink-0">
          <Link to="/videos" className="text-xs text-faint transition hover:text-accent">
            ← Video library
          </Link>
          <h2 className="mt-1 max-w-[34rem] truncate font-display text-2xl font-bold tracking-tight text-fg">{videoTitle}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge status={String(detail.status)} />
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
                <option value="both">both</option>
                <option value="whisper">whisper</option>
                <option value="gemini">gemini</option>
              </select>
              <button type="button" onClick={() => void onGenerate()} disabled={generating || polling} className={`${btnPrimary} rounded-full`}>
                {generating || polling ? <Spinner className="h-3.5 w-3.5" /> : null}
                {polling ? 'Transcribing…' : 'Generate transcript'}
              </button>
            </div>
          ) : null}
          {canManage ? (
            <button type="button" onClick={() => void onStartMerge()} className={`${btnNeutral} rounded-full`}>
              Start merge
            </button>
          ) : null}
          {canRetryVideo ? (
            <button type="button" onClick={() => void onRetryVideo()} className={`${btnNeutral} rounded-full`}>
              Retry
            </button>
          ) : null}
          {canManage ? (
            <button type="button" onClick={() => setDeleteOpen(true)} className={`${btnDanger} rounded-full`}>
              Delete
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
            <MetaRow label="MIME type">{detail.mime_type ?? '—'}</MetaRow>
            <MetaRow label="sha256">
              <span className="break-all">{detail.checksum_sha256 ?? '—'}</span>
            </MetaRow>
            <MetaRow label="Local path">{detail.local_path ?? '—'}</MetaRow>
            <MetaRow label="Created by">{detail.created_by_display ?? detail.created_by}</MetaRow>
            <MetaRow label="Created">{formatDateTime(detail.created_at)}</MetaRow>
            <MetaRow label="Updated">{formatRelative(detail.updated_at)}</MetaRow>
            <MetaRow label="Notes">{detail.notes ?? '—'}</MetaRow>
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
