import type { DiffSegment, Merge } from '../api/types';
import { formatRelative } from '../lib/format';
import EmptyState from './EmptyState';
import Spinner from './Spinner';
import StatusBadge from './StatusBadge';
import { btnPrimary } from './ui';

interface MergeDiffProps {
  merge: Merge;
  applying?: boolean;
  applied?: boolean;
  onApply: (merge: Merge) => void;
}

/** The contract does not pin the exact key names inside `merges.diff.segments`, so read tolerantly. */
function textOf(segment: DiffSegment, engine: 'whisper' | 'gemini'): string {
  const candidates =
    engine === 'whisper'
      ? [segment.whisper_text, (segment as Record<string, unknown>).whisper, (segment as Record<string, unknown>).base_text, (segment as Record<string, unknown>).base]
      : [segment.gemini_text, (segment as Record<string, unknown>).gemini];
  for (const candidate of candidates) {
    if (typeof candidate === 'string') return candidate;
  }
  return '';
}

function mergedOf(segment: DiffSegment): string {
  if (typeof segment.merged_text === 'string') return segment.merged_text;
  const fallback = (segment as Record<string, unknown>).text;
  return typeof fallback === 'string' ? fallback : '';
}

function provenance(segment: DiffSegment): 'whisper' | 'gemini' | 'both' {
  const raw = String(segment.source ?? '').toLowerCase();
  if (raw === 'both' || raw === 'agree' || raw === 'agreeing') return 'both';
  if (raw === 'gemini') return 'gemini';
  if (raw === 'whisper' || raw === 'base') return 'whisper';
  const hasW = Boolean(textOf(segment, 'whisper'));
  const hasG = Boolean(textOf(segment, 'gemini'));
  if (hasW && hasG) return 'both';
  return hasG ? 'gemini' : 'whisper';
}

const provenanceStyles: Record<string, { rail: string; chip: string; label: string }> = {
  both: { rail: 'bg-ok', chip: 'border-ok/40 bg-ok-soft text-ok', label: 'both agree' },
  whisper: { rail: 'bg-info', chip: 'border-info/40 bg-info-soft text-info', label: 'whisper kept' },
  gemini: { rail: 'bg-violet', chip: 'border-violet/40 bg-violet-soft text-violet', label: 'gemini used' },
};

export default function MergeDiff({ merge, applying = false, applied = false, onApply }: MergeDiffProps) {
  const diff = merge.diff;
  const segments = diff?.segments ?? [];
  const stats = diff?.stats ?? {};
  const ready = merge.status === 'ready';

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <h3 className="font-display text-sm font-semibold text-fg">Merge diff</h3>
        <StatusBadge status={String(merge.status)} />
        {merge.model ? <span className="font-mono text-2xs text-faint">{merge.model}</span> : null}
        <span className="text-2xs text-faint">created {formatRelative(merge.created_at)}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className={btnPrimary}
            disabled={!ready || applying || applied}
            onClick={() => onApply(merge)}
            title={ready ? 'Promote the merged transcript to be the current one' : 'This merge is not ready yet'}
          >
            {applying ? <Spinner className="h-3.5 w-3.5" /> : null}
            {applied ? 'Merge applied' : 'Apply merge'}
          </button>
        </div>
      </div>

      {merge.error ? (
        <div className="border-b border-line px-4 py-3">
          <p className="font-mono text-2xs uppercase tracking-wider text-bad">merge error</p>
          <p className="mt-1 font-mono text-xs text-bad/90">{merge.error}</p>
        </div>
      ) : null}

      {diff?.summary ? (
        <p className="border-b border-line-soft px-4 py-3 text-sm leading-relaxed text-dim">{diff.summary}</p>
      ) : null}

      {segments.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-2.5">
          <span className="text-2xs uppercase tracking-[0.14em] text-faint">Provenance</span>
          {(['both', 'whisper', 'gemini'] as const).map((key) => {
            // The contract does not pin the stat key names, so try the common spellings
            // and fall back to counting the segments ourselves.
            const aliases = {
              both: ['both', 'both_agree', 'agree'],
              whisper: ['whisper_only', 'whisper'],
              gemini: ['gemini_only', 'gemini'],
            }[key];
            const reported = aliases.map((alias) => stats[alias]).find((v) => typeof v === 'number');
            const count =
              typeof reported === 'number'
                ? reported
                : segments.filter((s) => provenance(s) === key).length;
            return (
              <span
                key={key}
                className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide ${provenanceStyles[key].chip}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${provenanceStyles[key].rail}`} />
                {key === 'both' ? 'both engines' : key === 'whisper' ? 'whisper only' : 'gemini only'}
                <span className="font-mono opacity-80">({count})</span>
              </span>
            );
          })}
          <span className="ml-auto font-mono text-2xs text-faint">
            {segments.length} aligned region{segments.length === 1 ? '' : 's'}
          </span>
        </div>
      ) : null}

      {segments.length === 0 ? (
        <EmptyState
          title={ready ? 'This merge has no recorded diff' : 'Diff is not available yet'}
          description={
            ready
              ? 'The worker finished without writing a segment diff for this merge.'
              : 'The diff appears once the merge job reaches the ready state.'
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse">
            <thead className="border-b border-line bg-raised/40">
              <tr>
                <th scope="col" className="w-10 px-3 py-2 text-left text-2xs font-semibold uppercase tracking-[0.12em] text-faint">
                  #
                </th>
                <th scope="col" className="px-3 py-2 text-left text-2xs font-semibold uppercase tracking-[0.12em] text-info">
                  Whisper
                </th>
                <th scope="col" className="px-3 py-2 text-left text-2xs font-semibold uppercase tracking-[0.12em] text-violet">
                  Gemini
                </th>
                <th scope="col" className="px-3 py-2 text-left text-2xs font-semibold uppercase tracking-[0.12em] text-ok">
                  Reconciled
                </th>
              </tr>
            </thead>
            <tbody>
              {segments.map((segment, index) => {
                const source = provenance(segment);
                const style = provenanceStyles[source];
                const whisper = textOf(segment, 'whisper');
                const gemini = textOf(segment, 'gemini');
                const merged = mergedOf(segment);
                return (
                  <tr key={`${index}-${source}`} className="align-top">
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 h-8 w-0.5 rounded-full ${style.rail}`} aria-hidden="true" />
                        <span className="font-mono text-2xs text-faint">{index + 1}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-dim">
                        {whisper || <span className="italic text-faint">— nothing —</span>}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-dim">
                        {gemini || <span className="italic text-faint">— nothing —</span>}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`mb-1 inline-flex rounded border px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide ${style.chip}`}
                      >
                        {style.label}
                      </span>
                      <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-fg">
                        {merged || <span className="italic text-faint">— nothing —</span>}
                      </p>
                      {segment.reason ? (
                        <p className="mt-1 text-2xs italic leading-relaxed text-faint">{segment.reason}</p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {merge.merged_transcript_id ? (
        <div className="border-t border-line-soft px-4 py-2.5 text-2xs text-faint">
          merged transcript <span className="font-mono text-dim">{merge.merged_transcript_id}</span>
        </div>
      ) : null}
    </div>
  );
}
