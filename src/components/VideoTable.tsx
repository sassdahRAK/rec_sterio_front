import { Link } from 'react-router-dom';
import type { Video } from '../api/types';
import { formatBytes, formatDuration, formatRelative } from '../lib/format';
import { videoStatusLabel } from '../lib/statusLabels';
import EmptyState from './EmptyState';
import Spinner from './Spinner';
import StatusBadge, { PlatformBadge } from './StatusBadge';
import { iconActionCls, tableCellCls, tableHeadCls } from './ui';
import { EyeIcon, FolderIcon, RefreshIcon, TrashIcon } from './icons';

interface VideoTableProps {
  videos: Video[];
  loading: boolean;
  onView?: (video: Video) => void;
  onRetry?: (video: Video) => void;
  onDelete?: (video: Video) => void;
  /** Open the move/copy dialog — how a library video reaches a folder at all. */
  onFile?: (video: Video) => void;
  busyId?: string | null;
  /** Right to file and delete videos (admin tier); hides those buttons otherwise. */
  canManage?: boolean;
  /** Right to retry ingestion (operator roles); hides the retry button otherwise. */
  canRetry?: boolean;
}

/**
 * True when the server marked this row unopenable for the caller. The library
 * tiers (developer/reviewer) see rows of private folders they hold no role on;
 * `can_open: false` flags the rows whose detail page would only 403. A row
 * without the flag — demo data, older payloads — reads as openable.
 */
function cannotOpen(video: Video): boolean {
  return video.can_open === false;
}

export default function VideoTable({
  videos,
  loading,
  onView,
  onRetry,
  onDelete,
  onFile,
  busyId,
  canManage = false,
  canRetry = false,
}: VideoTableProps) {
  /* One row of icon-only actions, shared by the desktop table and the phone
   * card list so the affordances stay identical across breakpoints. Every
   * control carries aria-label + title; `tap-pad` inside iconActionCls lifts
   * it to 44px on touch screens. */
  const renderActions = (video: Video) => (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => onView?.(video)}
        className={iconActionCls('neutral')}
        disabled={cannotOpen(video) || busyId === video.id}
        aria-label={cannotOpen(video) ? 'No access' : `View “${video.title ?? video.id}”`}
        title={cannotOpen(video) ? 'No access' : 'Open details'}
      >
        <EyeIcon size={15} />
      </button>
      {canManage ? (
        <button
          type="button"
          onClick={() => onFile?.(video)}
          className={iconActionCls('neutral')}
          disabled={busyId === video.id}
          aria-label="Move or copy into a folder"
          title="Move or copy into a folder"
        >
          <FolderIcon size={15} />
        </button>
      ) : null}
      {canRetry ? (
        <button
          type="button"
          onClick={() => onRetry?.(video)}
          className={iconActionCls('neutral')}
          disabled={busyId === video.id}
          aria-label="Re-queue the download"
          title="Re-queue the download"
        >
          <RefreshIcon size={15} />
        </button>
      ) : null}
      {canManage ? (
        <button
          type="button"
          onClick={() => onDelete?.(video)}
          className={iconActionCls('bad')}
          disabled={busyId === video.id}
          aria-label="Delete this video"
          title="Delete this video and its transcripts"
        >
          <TrashIcon size={15} />
        </button>
      ) : null}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 px-6 py-16">
        <Spinner className="h-5 w-5" />
        <span className="text-sm text-dim">Loading videos…</span>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <EmptyState
        title="No videos match these filters"
        description="Try clearing the search box or widening the status and platform filters."
      />
    );
  }

  return (
    <>
      {/* Desktop: full table. Phones (<md): the card list below, so rows never
          force a horizontal scroll. */}
      <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[52rem] border-collapse">
        <thead className="border-b border-line bg-raised/40">
          <tr>
            <th scope="col" className={tableHeadCls}>Title</th>
            <th scope="col" className={tableHeadCls}>Platform</th>
            <th scope="col" className={tableHeadCls}>Status</th>
            <th scope="col" className={tableHeadCls}>Progress</th>
            <th scope="col" className={tableHeadCls}>Duration</th>
            <th scope="col" className={tableHeadCls}>Size</th>
            <th scope="col" className={tableHeadCls}>Created</th>
            <th scope="col" className={`${tableHeadCls} sticky right-0 border-l border-line bg-card text-right`}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {videos.map((video) => (
            <tr key={video.id} className="transition-colors hover:bg-raised/40">
              <td className={tableCellCls}>
                {cannotOpen(video) ? (
                  <span
                    className="block max-w-[12rem] truncate font-medium text-dim"
                    title={video.title ?? video.source_url}
                  >
                    {video.title ?? <span className="text-faint italic">Untitled video</span>}
                  </span>
                ) : (
                  <Link
                    to={`/videos/${video.id}`}
                    className="tap-pad block max-w-[12rem] truncate font-medium text-fg hover:text-accent"
                    title={video.title ?? video.source_url}
                  >
                    {video.title ?? <span className="text-faint italic">Untitled video</span>}
                  </Link>
                )}
                <span className="mt-0.5 block max-w-[12rem] truncate font-mono text-2xs text-faint">
                  {video.source_url}
                </span>
                {video.copied_from_id ? (
                  <span className="chip mt-1 border-accent/40 bg-accent/10 text-accent">copy</span>
                ) : null}
                {video.error ? (
                  <span className="mt-1 block max-w-[12rem] truncate text-2xs text-bad" title={video.error}>
                    {video.error}
                  </span>
                ) : null}
              </td>
              <td className={tableCellCls}>
                <PlatformBadge platform={String(video.platform)} />
              </td>
              <td className={tableCellCls}>
                <StatusBadge status={String(video.status)} label={videoStatusLabel(video.status)} />
              </td>
              <td className={tableCellCls}>
                {video.status === 'downloading' || video.progress > 0 ? (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-14 overflow-hidden rounded-full bg-line" role="presentation">
                      <div
                        className="h-full rounded-full bg-accent transition-[width] duration-300"
                        style={{ width: `${Math.min(100, Math.max(2, video.progress))}%` }}
                      />
                    </div>
                    <span className="font-mono text-2xs text-dim">{video.progress}%</span>
                  </div>
                ) : (
                  <span className="text-faint">None</span>
                )}
              </td>
              <td className={`${tableCellCls} whitespace-nowrap font-mono text-xs`}>{formatDuration(video.duration_seconds)}</td>
              <td className={`${tableCellCls} whitespace-nowrap font-mono text-xs`}>{formatBytes(video.file_size)}</td>
              <td className={`${tableCellCls} whitespace-nowrap text-xs`}>{formatRelative(video.created_at)}</td>
              <td className={`${tableCellCls} sticky right-0 border-l border-line bg-card text-right`}>
                {renderActions(video)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Phone card list: title, key chips, and the same icon actions. */}
      <ul className="divide-y divide-line-soft md:hidden">
        {videos.map((video) => (
          <li key={video.id} className="px-3 py-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                {cannotOpen(video) ? (
                  <span className="block truncate font-medium text-dim" title={video.title ?? video.source_url}>
                    {video.title ?? <span className="text-faint italic">Untitled video</span>}
                  </span>
                ) : (
                  <Link
                    to={`/videos/${video.id}`}
                    className="tap-pad block truncate font-medium text-fg hover:text-accent"
                    title={video.title ?? video.source_url}
                  >
                    {video.title ?? <span className="text-faint italic">Untitled video</span>}
                  </Link>
                )}
                <span className="mt-0.5 block truncate font-mono text-2xs text-faint">
                  {video.source_url}
                </span>
                {video.error ? (
                  <span className="mt-1 block truncate text-2xs text-bad" title={video.error}>
                    {video.error}
                  </span>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <PlatformBadge platform={String(video.platform)} />
                  <StatusBadge status={String(video.status)} label={videoStatusLabel(video.status)} />
                  {video.status === 'downloading' || video.progress > 0 ? (
                    <span className="chip font-mono">{video.progress}%</span>
                  ) : null}
                  {video.copied_from_id ? (
                    <span className="chip border-accent/40 bg-accent/10 text-accent">copy</span>
                  ) : null}
                  <span className="font-mono text-2xs text-faint">
                    {formatDuration(video.duration_seconds)} · {formatBytes(video.file_size)} · {formatRelative(video.created_at)}
                  </span>
                </div>
              </div>
              <div className="shrink-0 pt-0.5">{renderActions(video)}</div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
