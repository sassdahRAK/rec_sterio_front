/**
 * Sharing a folder (instruction.txt #1): invite a person by email with a role,
 * or mint a revocable link that needs no account.
 */
import { useCallback, useEffect, useState } from 'react';
import { ApiError, foldersApi, sharesApi } from '../api/client';
import type { Folder, FolderMember, FolderRole, ShareLink } from '../api/types';
import { formatDateTime } from '../lib/format';
import { toast } from '../store/toast';
import Modal from './Modal';
import { CopyIcon, LinkIcon, UsersIcon } from './icons';
import { btnDanger, btnNeutral, btnPrimary, inputCls, labelCls, selectCls } from './ui';

interface ShareDialogProps {
  folder: Folder | null;
  onClose: () => void;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to the clipboard.');
  } catch {
    // Clipboard access can be blocked; show the value so it can be selected.
    window.prompt('Copy this link:', text);
  }
}

const ROLES: FolderRole[] = ['viewer', 'commenter', 'editor'];

/**
 * Where a share link opens. The API returns the URL against the portal origin,
 * which is the same origin in the deployed stack; in the split dev setup the
 * console and portal are on different ports, and a link built from the
 * console's own origin would point at a `/share` route it does not have.
 */
function shareUrl(token: string): string {
  const configured = import.meta.env.VITE_PORTAL_URL as string | undefined;
  const base = configured?.replace(/\/+$/, '') || window.location.origin;
  return `${base}/share/${token}`;
}

export default function ShareDialog({ folder, onClose }: ShareDialogProps) {
  const [tab, setTab] = useState<'people' | 'link'>('people');
  const [members, setMembers] = useState<FolderMember[]>([]);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<FolderRole>('viewer');
  const [linkRole, setLinkRole] = useState<FolderRole>('viewer');
  const [linkExpiry, setLinkExpiry] = useState<'never' | '24h' | '7d' | '30d'>('never');
  const [createdLink, setCreatedLink] = useState<ShareLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!folder) return;
    setLoading(true);
    setError(null);
    try {
      const [memberList, links] = await Promise.all([
        foldersApi.members(folder.id),
        sharesApi.list(folder.id),
      ]);
      setMembers(memberList.items);
      setLinks(links);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError instanceof ApiError ? apiError.message : 'Could not load sharing settings.');
    } finally {
      setLoading(false);
    }
  }, [folder]);

  useEffect(() => {
    if (!folder) return;
    setCreatedLink(null);
    setEmail('');
    setTab('people');
    void load();
  }, [folder, load]);

  if (!folder) return null;

  const invite = async (): Promise<void> => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const member = await foldersApi.invite(folder.id, email.trim(), role);
      toast.success(`${member.email} can now ${member.role === 'viewer' ? 'view' : member.role} this folder.`);
      setEmail('');
      await load();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError instanceof ApiError ? apiError.message : 'Could not invite that person.');
    } finally {
      setBusy(false);
    }
  };

  const createLink = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const hours = linkExpiry === 'never' ? 0 : linkExpiry === '24h' ? 24 : linkExpiry === '7d' ? 168 : 720;
      const expiresAt = hours ? new Date(Date.now() + hours * 3600_000).toISOString() : null;
      const link = await sharesApi.create(folder.id, linkRole, expiresAt);
      setCreatedLink(link);
      await load();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError instanceof ApiError ? apiError.message : 'Could not create a share link.');
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (member: FolderMember, next: FolderRole): Promise<void> => {
    try {
      await foldersApi.setMemberRole(folder.id, member.user_id, next);
      await load();
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'update_failed', apiError.message);
    }
  };

  const removeMember = async (member: FolderMember): Promise<void> => {
    try {
      await foldersApi.removeMember(folder.id, member.user_id);
      toast.success(`Removed ${member.email}.`);
      await load();
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'remove_failed', apiError.message);
    }
  };

  return (
    <Modal
      open={folder !== null}
      title={`Share “${folder.name}”`}
      description="Invite people who have an account, or send a link that works without one."
      onClose={onClose}
      width="lg"
      busy={busy}
    >
      <div className="mb-4 flex gap-4 border-b border-line">
        <button
          type="button"
          onClick={() => setTab('people')}
          className={`tab ${tab === 'people' ? 'tab-active' : ''}`}
        >
          <UsersIcon size={14} /> People
        </button>
        <button
          type="button"
          onClick={() => setTab('link')}
          className={`tab ${tab === 'link' ? 'tab-active' : ''}`}
        >
          <LinkIcon size={14} /> Link
        </button>
      </div>

      {error ? (
        <p role="alert" className="mb-3 rounded-md border border-bad/40 bg-bad-soft px-3 py-2 text-xs text-bad">
          {error}
        </p>
      ) : null}

      {tab === 'people' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[14rem] flex-1">
              <label htmlFor="invite-email" className={labelCls}>
                Invite by email
              </label>
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@example.com"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="invite-role" className={labelCls}>
                Role
              </label>
              <select
                id="invite-role"
                value={role}
                onChange={(event) => setRole(event.target.value as FolderRole)}
                className={selectCls}
              >
                {ROLES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={() => void invite()} disabled={busy || !email.trim()} className={btnPrimary}>
              Invite
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-raised/70 text-2xs uppercase tracking-wider text-faint">
                <tr>
                  <th className="px-3 py-2 font-semibold">Person</th>
                  <th className="px-3 py-2 font-semibold">Role</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-xs text-faint">
                      Loading…
                    </td>
                  </tr>
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-xs text-faint">
                      No one has been invited yet.
                    </td>
                  </tr>
                ) : (
                  members.map((member) => (
                    <tr key={member.user_id} className="border-t border-line-soft">
                      <td className="px-3 py-2">
                        <p className="text-fg">{member.name || member.email}</p>
                        <p className="text-2xs text-faint">{member.email}</p>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={member.role}
                          onChange={(event) => void changeRole(member, event.target.value as FolderRole)}
                          aria-label={`Role for ${member.email}`}
                          className={`${selectCls} py-1 text-xs`}
                        >
                          {ROLES.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => void removeMember(member)}
                          className={`${btnDanger} px-2 py-1 text-xs`}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-2xs text-faint">
            Viewer can read · Commenter can also comment · Editor can edit and delete cards.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="link-role" className={labelCls}>
                Link grants
              </label>
              <select
                id="link-role"
                value={linkRole}
                onChange={(event) => setLinkRole(event.target.value as FolderRole)}
                className={selectCls}
              >
                {ROLES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="link-expiry" className={labelCls}>
                Expires
              </label>
              <select
                id="link-expiry"
                value={linkExpiry}
                onChange={(event) => setLinkExpiry(event.target.value as typeof linkExpiry)}
                className={selectCls}
              >
                <option value="never">Never</option>
                <option value="24h">In 24 hours</option>
                <option value="7d">In 7 days</option>
                <option value="30d">In 30 days</option>
              </select>
            </div>
            <button type="button" onClick={() => void createLink()} disabled={busy} className={btnPrimary}>
              Create link
            </button>
          </div>

          {createdLink?.url ? (
            <div className="rounded-lg border border-ok/40 bg-ok-soft p-3">
              <p className="text-2xs font-semibold uppercase tracking-wider text-ok">New link</p>
              <div className="mt-1.5 flex items-center gap-2">
                <input readOnly value={createdLink.url} className={`${inputCls} font-mono text-xs`} />
                <button
                  type="button"
                  onClick={() => void copyText(createdLink.url as string)}
                  className={btnNeutral}
                >
                  <CopyIcon size={14} /> Copy
                </button>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            {links.length === 0 ? (
              <p className="rounded-lg border border-line bg-raised/50 px-3 py-4 text-center text-xs text-faint">
                No links yet. Anyone with a link can open this folder.
              </p>
            ) : (
              links.map((link) => {
                const dead = Boolean(link.revoked_at);
                return (
                  <div
                    key={link.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-raised/50 px-3 py-2"
                  >
                    <span
                      className={`chip ${
                        dead
                          ? 'border-line bg-neutral-soft text-faint'
                          : 'border-ok/40 bg-ok-soft text-ok'
                      }`}
                    >
                      {dead ? 'revoked' : link.role}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-2xs text-dim">
                      /share/{link.token.slice(0, 10)}…
                    </span>
                    <span className="text-2xs text-faint">
                      {link.expires_at ? `expires ${formatDateTime(link.expires_at)}` : 'never expires'}
                    </span>
                    {!dead ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await copyText(shareUrl(link.token));
                        }}
                        className="icon-btn"
                        aria-label="Copy link"
                      >
                        <CopyIcon size={13} />
                      </button>
                    ) : null}
                    {!dead ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await sharesApi.revoke(link.id);
                          toast.success('Link revoked.');
                          await load();
                        }}
                        className={`${btnDanger} px-2 py-1 text-xs`}
                      >
                        Revoke
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
          <p className="text-2xs text-faint">
            Tip: a private folder can also be opened with a passcode — use the key button on the folder.
          </p>
        </div>
      )}
    </Modal>
  );
}
