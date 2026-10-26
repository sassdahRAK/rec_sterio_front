/**
 * Passcodes for a private folder (instruction.txt #4, #7): a custom or
 * generated code, an expiry, a one-time switch and limits on uses/devices.
 */
import { useCallback, useEffect, useState } from 'react';
import { ApiError, passcodesApi } from '../api/client';
import type { Folder, Passcode } from '../api/types';
import { formatDateTime } from '../lib/format';
import { toast } from '../store/toast';
import Modal from './Modal';
import { CopyIcon, KeyIcon } from './icons';
import { btnNeutral, btnPrimary, inputCls, labelCls, selectCls } from './ui';

interface PasscodeDialogProps {
  folder: Folder | null;
  onClose: () => void;
}

type ExpiryPreset = 'never' | '1h' | '24h' | '7d' | '30d';

const EXPIRY_HOURS: Record<ExpiryPreset, number> = {
  never: 0,
  '1h': 1,
  '24h': 24,
  '7d': 168,
  '30d': 720,
};

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Passcode copied.');
  } catch {
    window.prompt('Copy this passcode:', text);
  }
}

export default function PasscodeDialog({ folder, onClose }: PasscodeDialogProps) {
  const [codes, setCodes] = useState<Passcode[]>([]);
  const [label, setLabel] = useState('');
  const [code, setCode] = useState('');
  const [expiry, setExpiry] = useState<ExpiryPreset>('never');
  const [maxUses, setMaxUses] = useState('');
  const [maxDevices, setMaxDevices] = useState('');
  const [oneTime, setOneTime] = useState(false);
  const [created, setCreated] = useState<Passcode | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!folder) return;
    setLoading(true);
    try {
      setCodes(await passcodesApi.list(folder.id));
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError instanceof ApiError ? apiError.message : 'Could not load passcodes.');
    } finally {
      setLoading(false);
    }
  }, [folder]);

  useEffect(() => {
    if (!folder) return;
    setCreated(null);
    setLabel('');
    setCode('');
    setExpiry('never');
    setMaxUses('');
    setMaxDevices('');
    setOneTime(false);
    setError(null);
    void load();
  }, [folder, load]);

  if (!folder) return null;

  const create = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const hours = EXPIRY_HOURS[expiry];
      const result = await passcodesApi.create(folder.id, {
        // Blank means "generate one for me"; the server returns it once.
        code: code.trim() || null,
        label: label.trim() || null,
        expires_at: hours ? new Date(Date.now() + hours * 3600_000).toISOString() : null,
        max_uses: maxUses ? Number(maxUses) : null,
        max_devices: maxDevices ? Number(maxDevices) : null,
        one_time: oneTime,
      });
      setCreated(result);
      setCode('');
      setLabel('');
      await load();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError instanceof ApiError ? apiError.message : 'Could not create the passcode.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={folder !== null}
      title={`Passcodes for “${folder.name}”`}
      description="A guest opens the folder by entering the code. Codes are stored hashed and can be revoked at any time."
      onClose={onClose}
      width="lg"
      busy={busy}
    >
      <div className="space-y-4">
        {created?.code ? (
          <div className="rounded-lg border border-ok/40 bg-ok-soft p-3">
            <p className="text-2xs font-semibold uppercase tracking-wider text-ok">
              Passcode created — copy it now, it is shown only once
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="flex-1 rounded-md border border-ok/30 bg-card px-3 py-2 font-mono text-lg tracking-[0.2em] text-fg">
                {created.code}
              </code>
              <button
                type="button"
                onClick={() => void copyText(created.code as string)}
                className={btnNeutral}
              >
                <CopyIcon size={14} /> Copy
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="pass-code" className={labelCls}>
              Code <span className="normal-case tracking-normal text-faint">(blank = generate)</span>
            </label>
            <input
              id="pass-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="ABCD-2345"
              minLength={4}
              maxLength={64}
              className={`${inputCls} font-mono uppercase tracking-[0.12em]`}
            />
          </div>
          <div>
            <label htmlFor="pass-label" className={labelCls}>
              Label
            </label>
            <input
              id="pass-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="For the reviewer group"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="pass-expiry" className={labelCls}>
              Expires
            </label>
            <select
              id="pass-expiry"
              value={expiry}
              onChange={(event) => setExpiry(event.target.value as ExpiryPreset)}
              className={`${selectCls} w-full`}
            >
              <option value="never">Never</option>
              <option value="1h">In 1 hour</option>
              <option value="24h">In 24 hours</option>
              <option value="7d">In 7 days</option>
              <option value="30d">In 30 days</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pass-uses" className={labelCls}>
                Max uses
              </label>
              <input
                id="pass-uses"
                type="number"
                min={1}
                value={maxUses}
                onChange={(event) => setMaxUses(event.target.value)}
                placeholder="∞"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="pass-devices" className={labelCls}>
                Max devices
              </label>
              <input
                id="pass-devices"
                type="number"
                min={1}
                value={maxDevices}
                onChange={(event) => setMaxDevices(event.target.value)}
                placeholder="∞"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-line bg-raised px-3 py-2">
          <input
            type="checkbox"
            checked={oneTime}
            onChange={(event) => setOneTime(event.target.checked)}
            className="h-4 w-4 rounded border-line bg-card text-accent focus:ring-accent/40"
          />
          <span className="text-sm text-fg">
            One-time pass
            <span className="ml-1 text-2xs text-faint">burns after its first successful use</span>
          </span>
        </label>

        {error ? (
          <p role="alert" className="rounded-md border border-bad/40 bg-bad-soft px-3 py-2 text-xs text-bad">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-between">
          <p className="inline-flex items-center gap-1.5 text-2xs text-faint">
            <KeyIcon size={12} /> Guests unlock it from the dataset page with “Have a passcode?”.
          </p>
          <button type="button" onClick={() => void create()} disabled={busy} className={btnPrimary}>
            {busy ? 'Creating…' : 'Create passcode'}
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-raised/70 text-2xs uppercase tracking-wider text-faint">
              <tr>
                <th className="px-3 py-2 font-semibold">Code</th>
                <th className="px-3 py-2 font-semibold">Limits</th>
                <th className="px-3 py-2 font-semibold">Uses</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-xs text-faint">
                    Loading…
                  </td>
                </tr>
              ) : codes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-xs text-faint">
                    No passcodes for this folder yet.
                  </td>
                </tr>
              ) : (
                codes.map((item) => {
                  const dead =
                    Boolean(item.revoked_at) ||
                    (item.expires_at ? Date.parse(item.expires_at) <= Date.now() : false);
                  return (
                    <tr key={item.id} className="border-t border-line-soft">
                      <td className="px-3 py-2">
                        <p className="text-fg">{item.label || 'Passcode'}</p>
                        <p className="text-2xs text-faint">
                          {item.one_time ? 'one-time' : 'reusable'} ·{' '}
                          {item.expires_at ? formatDateTime(item.expires_at) : 'never expires'}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-xs text-dim">
                        {item.max_uses ?? '∞'} uses · {item.max_devices ?? '∞'} devices
                      </td>
                      <td className="px-3 py-2 text-xs text-dim">
                        {item.use_count}
                        {item.max_devices ? ` · ${item.device_count}/${item.max_devices} devices` : ''}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {dead ? (
                          <span className="chip border-line bg-neutral-soft text-faint">revoked</span>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => {
                              await passcodesApi.revoke(item.id);
                              toast.success('Passcode revoked.');
                              await load();
                            }}
                            className={`${btnNeutral} px-2 py-1 text-xs`}
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
