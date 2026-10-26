/** The dataset's folder tree — public/private marks and per-folder counts. */
import type { Folder } from '../api/types';
import { GlobeIcon, LockIcon } from './icons';

interface FolderRailProps {
  folders: Folder[];
  selectedId: string | null;
  onSelect: (folder: Folder | null) => void;
  showAll?: boolean;
  allLabel?: string;
  allCount?: number;
}

interface Row {
  folder: Folder;
  depth: number;
}

function flatten(items: Folder[], depth = 0): Row[] {
  const rows: Row[] = [];
  for (const folder of items) {
    rows.push({ folder, depth });
    rows.push(...flatten(folder.children ?? [], depth + 1));
  }
  return rows;
}

export default function FolderRail({
  folders,
  selectedId,
  onSelect,
  showAll = true,
  allLabel = 'All datasets',
  allCount,
}: FolderRailProps) {
  const rows = flatten(folders);

  return (
    <nav aria-label="Dataset folders" className="card p-2">
      {showAll ? (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
            selectedId === null ? 'bg-accent-soft text-fg' : 'text-dim hover:bg-raised hover:text-fg'
          }`}
        >
          <span className="text-accent">◉</span>
          <span className="min-w-0 flex-1 truncate font-medium">{allLabel}</span>
          {allCount !== undefined ? (
            <span className="font-mono text-2xs text-faint">{allCount}</span>
          ) : null}
        </button>
      ) : null}

      {rows.length === 0 ? (
        <p className="px-2.5 py-3 text-xs text-faint">No folders yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.map(({ folder, depth }) => {
            const active = folder.id === selectedId;
            return (
              <li key={folder.id}>
                <button
                  type="button"
                  onClick={() => onSelect(folder)}
                  style={{ paddingLeft: `${10 + depth * 14}px` }}
                  className={`flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm transition-colors ${
                    active ? 'bg-accent-soft text-fg' : 'text-dim hover:bg-raised hover:text-fg'
                  }`}
                >
                  <span className={folder.visibility === 'public' ? 'text-accent' : 'text-faint'}>
                    {folder.visibility === 'public' ? <GlobeIcon size={13} /> : <LockIcon size={13} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                  <span className="font-mono text-2xs text-faint">{folder.video_count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
