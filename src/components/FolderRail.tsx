/** The dataset's folder tree — public/private marks and per-folder counts. */
import { useMemo, useState } from 'react';
import type { Folder } from '../api/types';
import { GlobeIcon, LockIcon } from './icons';

interface FolderRailProps {
  folders: Folder[];
  selectedId: string | null;
  onSelect: (folder: Folder | null) => void;
  showAll?: boolean;
  allLabel?: string;
  allCount?: number;
  /**
   * Move a folder under a new parent (`null` = top level). Omitted when the
   * caller cannot rearrange the tree, which also hides the drag affordances.
   */
  onMove?: (folder: Folder, newParentId: string | null) => void;
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

/** Every id in the subtree rooted at `rootId`, the root included. */
function subtreeIds(items: Folder[], rootId: string): Set<string> {
  const found = new Set<string>();
  const walk = (nodes: Folder[]): boolean => {
    for (const node of nodes) {
      if (node.id === rootId) {
        const collect = (n: Folder): void => {
          found.add(n.id);
          (n.children ?? []).forEach(collect);
        };
        collect(node);
        return true;
      }
      if (walk(node.children ?? [])) return true;
    }
    return false;
  };
  walk(items);
  return found;
}

/**
 * The tree, with folders you manage draggable.
 *
 * Drop a row on another row to nest it, or on "All datasets" to lift it back to
 * the top level. A folder can never be dropped into itself or its own
 * descendant — that would detach the subtree from every listing — so those
 * targets stay inert rather than failing at the server.
 */
export default function FolderRail({
  folders,
  selectedId,
  onSelect,
  showAll = true,
  allLabel = 'All datasets',
  allCount,
  onMove,
}: FolderRailProps) {
  const rows = flatten(folders);
  const [dragging, setDragging] = useState<Folder | null>(null);
  const [overId, setOverId] = useState<string | 'root' | null>(null);

  const blocked = useMemo(
    () => (dragging ? subtreeIds(folders, dragging.id) : new Set<string>()),
    [dragging, folders],
  );

  const canMove = (folder: Folder): boolean => folder.my_role === 'editor';

  const acceptsDrop = (target: Folder | null): boolean => {
    if (!onMove || !dragging) return false;
    if (target === null) return dragging.parent_id !== null && canMove(dragging);
    if (target.id === dragging.id) return false;
    if (blocked.has(target.id)) return false;
    if (target.parent_id === dragging.id) return false;
    if (!canMove(target)) return false;
    return target.id !== dragging.parent_id;
  };

  const dropInto = (target: Folder | null): void => {
    if (!acceptsDrop(target) || !dragging) return;
    onMove?.(dragging, target ? target.id : null);
    setDragging(null);
    setOverId(null);
  };

  const dropClasses = (key: string, valid: boolean): string => {
    if (overId !== key || !dragging) return '';
    return valid ? 'ring-2 ring-accent bg-accent-soft/80' : 'ring-1 ring-bad/50';
  };

  return (
    <nav aria-label="Dataset folders" className="card p-2">
      {showAll ? (
        <button
          type="button"
          onClick={() => onSelect(null)}
          onDragOver={(event) => {
            if (!acceptsDrop(null)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setOverId('root');
          }}
          onDragLeave={() => setOverId((current) => (current === 'root' ? null : current))}
          onDrop={(event) => {
            event.preventDefault();
            dropInto(null);
          }}
          className={`tap-pad mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
            selectedId === null ? 'bg-accent-soft text-fg' : 'text-dim hover:bg-raised hover:text-fg'
          } ${dropClasses('root', true)}`}
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
            const draggable = Boolean(onMove) && canMove(folder);
            const valid = acceptsDrop(folder);
            const isDragged = dragging?.id === folder.id;
            return (
              <li key={folder.id}>
                <button
                  type="button"
                  onClick={() => onSelect(folder)}
                  draggable={draggable}
                  onDragStart={(event) => {
                    if (!draggable) return;
                    event.dataTransfer.effectAllowed = 'move';
                    // Some browsers need data set or the drag never starts.
                    event.dataTransfer.setData('text/plain', folder.id);
                    setDragging(folder);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setOverId(null);
                  }}
                  onDragOver={(event) => {
                    if (!acceptsDrop(folder)) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setOverId(folder.id);
                  }}
                  onDragLeave={() => setOverId((current) => (current === folder.id ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault();
                    dropInto(folder);
                  }}
                  style={{ paddingLeft: `${10 + depth * 14}px` }}
                  aria-label={
                    draggable ? `${folder.name}, drag to move it under another folder` : folder.name
                  }
                  className={`tap-pad flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm transition-colors ${
                    active ? 'bg-accent-soft text-fg' : 'text-dim hover:bg-raised hover:text-fg'
                  } ${isDragged ? 'opacity-40' : ''} ${
                    draggable ? 'cursor-grab active:cursor-grabbing' : ''
                  } ${dropClasses(folder.id, valid)}`}
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

      {onMove && rows.length > 0 ? (
        <p className="mt-2 border-t border-line-soft px-2.5 pt-2 text-2xs leading-relaxed text-faint">
          Drag a folder onto another to nest it, or onto “{allLabel}” to move it to the top
          level. Keyboard: open a folder and use <span className="text-dim">Move to…</span>.
        </p>
      ) : null}
    </nav>
  );
}
