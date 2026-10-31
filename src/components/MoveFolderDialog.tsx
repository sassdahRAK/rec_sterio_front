/**
 * Move a folder to a new parent — the keyboard path to what dragging does.
 *
 * Folders that cannot receive this one are listed but disabled rather than
 * hidden: seeing "Inside itself" explains why, where a missing option would
 * look like a bug.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Folder } from '../api/types';
import Modal from './Modal';
import { MoveIcon } from './icons';
import { btnNeutral, btnPrimary, labelCls, selectCls } from './ui';

interface Option {
  id: string;
  label: string;
  disabled: boolean;
  note?: string;
}

function flatten(items: Folder[], depth = 0): { folder: Folder; depth: number }[] {
  return items.flatMap((folder) => [
    { folder, depth },
    ...flatten(folder.children ?? [], depth + 1),
  ]);
}

/** Ids in the subtree rooted at `rootId` (root included). */
function subtreeIds(items: Folder[], rootId: string): Set<string> {
  const found = new Set<string>();
  const collect = (n: Folder): void => {
    found.add(n.id);
    (n.children ?? []).forEach(collect);
  };
  const walk = (nodes: Folder[]): boolean => {
    for (const node of nodes) {
      if (node.id === rootId) {
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

export default function MoveFolderDialog({
  folder,
  folders,
  busy = false,
  onClose,
  onMove,
}: {
  folder: Folder | null;
  folders: Folder[];
  busy?: boolean;
  onClose: () => void;
  onMove: (folder: Folder, parentId: string | null) => void;
}) {
  const [dest, setDest] = useState<string>('');

  // Reset to the folder's current parent whenever a different folder opens.
  useEffect(() => {
    setDest(folder?.parent_id ?? '');
  }, [folder?.id, folder?.parent_id]);

  const options = useMemo<Option[]>(() => {
    if (!folder) return [];
    const inside = subtreeIds(folders, folder.id);
    return [
      { id: '', label: 'Top level (no parent)', disabled: false },
      ...flatten(folders).map(({ folder: candidate, depth }) => {
        const isSelf = candidate.id === folder.id;
        const isInside = inside.has(candidate.id) && !isSelf;
        const noRights = candidate.my_role !== 'editor';
        return {
          id: candidate.id,
          label: `${'\u00A0\u00A0'.repeat(depth)}${candidate.name}`,
          disabled: isSelf || isInside || noRights,
          note: isSelf ? 'this folder' : isInside ? 'inside itself' : noRights ? 'no edit rights' : undefined,
        };
      }),
    ];
  }, [folder, folders]);

  const current = folder?.parent_id ?? '';

  return (
    <Modal
      open={folder !== null}
      title="Move folder"
      description={
        folder
          ? `Choose where “${folder.name}” lives. Its sub-folders and videos move with it.`
          : undefined
      }
      onClose={onClose}
      busy={busy}
      width="sm"
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="move-parent" className={labelCls}>
            Move into
          </label>
          <select
            id="move-parent"
            value={dest}
            onChange={(event) => setDest(event.target.value)}
            className={`${selectCls} w-full`}
          >
            {options.map((option) => (
              <option key={option.id || 'root'} value={option.id} disabled={option.disabled}>
                {option.label}
                {option.note ? ` (${option.note})` : ''}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-2xs text-faint">
            A folder cannot be moved inside itself or one of its own sub-folders.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnNeutral} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={busy || !folder || dest === current}
            onClick={() => folder && onMove(folder, dest || null)}
          >
            {busy ? 'Moving…' : dest === current ? 'Already here' : (
              <>
                <MoveIcon size={15} /> Move folder
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
