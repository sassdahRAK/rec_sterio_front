import { useState } from 'react';
import type { Transcript } from '../api/types';
import { formatDateTime, formatRelative, wordCount } from '../lib/format';
import { transcriptStatusLabel } from '../lib/statusLabels';
import EmptyState from './EmptyState';
import StatusBadge, { SourceBadge } from './StatusBadge';
import { btnGhost } from './ui';

interface TranscriptVersionListProps {
  versions: Transcript[];
  currentId?: string | null;
  onLoad?: (transcript: Transcript) => void;
}

export default function TranscriptVersionList({ versions, currentId, onLoad }: TranscriptVersionListProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (versions.length === 0) {
    return (
      <EmptyState
        title="No versions yet"
        description="Every transcript source — Whisper, Gemini, manual edits and merges — is kept as its own version."
      />
    );
  }

  return (
    <div className="card divide-y divide-line-soft">
      {versions.map((version) => {
        const isOpen = openId === version.id;
        const isCurrent = version.id === currentId;
        return (
          <div key={version.id} className={isCurrent ? 'bg-accent/5' : ''}>
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <span className="font-mono text-xs font-semibold text-fg">v{version.version}</span>
              <SourceBadge source={String(version.source)} />
              <StatusBadge status={String(version.status)} label={transcriptStatusLabel(version.status)} />
              {isCurrent ? (
                <span className="rounded-full border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide text-accent">
                  current
                </span>
              ) : null}
              <div className="ml-auto flex items-center gap-1">
                <span className="hidden font-mono text-2xs text-faint sm:inline">
                  {wordCount(version.content)} words
                </span>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : version.id)}
                  className={`${btnGhost} px-2 py-1 text-xs`}
                  aria-expanded={isOpen}
                >
                  {isOpen ? 'Hide' : 'View'}
                </button>
                <button
                  type="button"
                  onClick={() => onLoad?.(version)}
                  className={`${btnGhost} px-2 py-1 text-xs`}
                  title="Load this version into the editor — saving it would create a new version"
                >
                  Edit
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 pb-2 text-2xs text-faint">
              <span className="font-mono">{version.created_by}</span>
              <span title={formatDateTime(version.created_at)}>{formatRelative(version.created_at)}</span>
              {version.language ? <span className="font-mono">{version.language}</span> : null}
            </div>

            {isOpen ? (
              <pre className="mx-3 mb-3 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded border border-line bg-raised/60 p-3 font-mono text-2xs leading-relaxed text-dim">
                {version.content || <span className="italic text-faint">This version has no text yet.</span>}
              </pre>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
