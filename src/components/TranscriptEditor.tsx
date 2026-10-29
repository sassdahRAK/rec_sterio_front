import { useEffect, useMemo, useState } from 'react';
import type { Transcript } from '../api/types';
import { wordCount } from '../lib/format';
import Spinner from './Spinner';
import StatusBadge, { SourceBadge } from './StatusBadge';
import { btnPrimary, btnNeutral, inputCls, labelCls } from './ui';

interface TranscriptEditorProps {
  transcript: Transcript | null;
  nextVersion: number;
  saving: boolean;
  onSave: (content: string, language: string | null) => void;
  /** Roles without transcript-edit rights see the text but no save controls. */
  readOnly?: boolean;
}

export default function TranscriptEditor({ transcript, nextVersion, saving, onSave, readOnly = false }: TranscriptEditorProps) {
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setContent(transcript?.content ?? '');
    setLanguage(transcript?.language ?? '');
    setDirty(false);
  }, [transcript?.id, transcript?.version, transcript?.content, transcript?.language]);

  const stats = useMemo(
    () => ({ words: wordCount(content), chars: content.length }),
    [content],
  );

  const unchanged = transcript ? content.trim() === transcript.content.trim() : content.trim() === '';

  return (
    <div className="card flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="font-display text-sm font-semibold text-fg">Transcript</h2>
        {transcript ? (
          <>
            <SourceBadge source={String(transcript.source)} />
            <StatusBadge status={String(transcript.status)} />
            <span className="font-mono text-2xs text-faint">v{transcript.version}</span>
          </>
        ) : (
          <span className="text-2xs text-faint">no transcript yet</span>
        )}
        <span className="ml-auto font-mono text-2xs text-faint">
          {stats.words} words · {stats.chars} chars
        </span>
      </div>

      <div className="p-4">
        <label htmlFor="transcript-content" className={labelCls}>
          Transcript text
        </label>
        <textarea
          id="transcript-content"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setDirty(true);
          }}
          rows={14}
          spellCheck={false}
          readOnly={readOnly}
          placeholder="Transcript text will appear here once a transcription job has produced one."
          className={`${inputCls} resize-y font-mono text-[13px] leading-relaxed`}
        />

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="w-40">
            <label htmlFor="transcript-language" className={labelCls}>
              Language tag
            </label>
            <input
              id="transcript-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="km-en"
              readOnly={readOnly}
              className={inputCls}
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {readOnly ? (
              <span className="text-2xs text-faint">Read-only — your role cannot edit transcripts.</span>
            ) : (
              <>
                <button
                  type="button"
                  className={btnNeutral}
                  disabled={!dirty || saving}
                  onClick={() => {
                    setContent(transcript?.content ?? '');
                    setLanguage(transcript?.language ?? '');
                    setDirty(false);
                  }}
                >
                  Discard changes
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={unchanged || saving || !content.trim()}
                  onClick={() => onSave(content, language.trim() || null)}
                >
                  {saving ? <Spinner className="h-3.5 w-3.5" /> : null}
                  Save as version {nextVersion}
                </button>
              </>
            )}
          </div>
        </div>

        <p className="mt-3 rounded border border-line-soft bg-raised/60 px-3 py-2 text-2xs leading-relaxed text-faint">
          Saving never overwrites an existing version. The API creates a new{' '}
          <span className="font-mono text-dim">source=manual</span> transcript (version {nextVersion}) and the
          previous version stays retrievable in the history list.
        </p>
      </div>
    </div>
  );
}
