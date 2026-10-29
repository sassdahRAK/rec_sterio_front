import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, cloudApi, settingsApi } from '../api/client';
import type { CloudBackend, DriveLink, TelegramLink } from '../api/types';
import ConfirmDialog from '../components/ConfirmDialog';
import ErrorState from '../components/ErrorState';
import Spinner from '../components/Spinner';
import { btnDanger, btnPrimary, labelCls } from '../components/ui';
import { formatDateTime } from '../lib/format';
import { toast } from '../store/toast';

/**
 * Console-account settings. Today that is one thing: the Telegram link.
 *
 * The console mints a one-time code; the bot redeems it. Once linked, the bot
 * attributes downloads to this account and its admin commands follow the
 * console account's role instead of the operator's TELEGRAM_BOT_USERNAME list.
 */
export default function Settings() {
  const [telegramUserId, setTelegramUserId] = useState<number | null>(null);
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [generating, setGenerating] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  // Cloud storage state
  const [params, setParams] = useSearchParams();
  const [driveLinks, setDriveLinks] = useState<DriveLink[]>([]);
  const [driveProviders, setDriveProviders] = useState<{ google: boolean; onedrive: boolean } | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveBusy, setDriveBusy] = useState<false | CloudBackend>(false);

  // Returns a cleanup function so an unmount mid-request cannot set state.
  const load = useCallback((): (() => void) => {
    let cancelled = false;
    settingsApi
      .getTelegramLink()
      .then((state) => {
        if (cancelled) return;
        setTelegramUserId(state.telegram_user_id);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  const loadDrives = useCallback(async () => {
    setDriveLoading(true);
    try {
      const [providers, links] = await Promise.all([cloudApi.providers(), cloudApi.links()]);
      setDriveProviders(providers);
      setDriveLinks(links);
    } catch {
      // Non-fatal: cloud section stays empty
    } finally {
      setDriveLoading(false);
    }
  }, []);

  useEffect(() => { void loadDrives(); }, [loadDrives]);

  // OAuth return: exchange code for a drive link
  useEffect(() => {
    const provider = params.get('provider') as CloudBackend | null;
    const code = params.get('code');
    if (!provider || !code || !(['google', 'onedrive'] as string[]).includes(provider)) return;
    const newParams = new URLSearchParams(params);
    newParams.delete('provider');
    newParams.delete('code');
    setParams(newParams, { replace: true });
    setDriveBusy(provider);
    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    cloudApi
      .connect(provider, code, redirectUri)
      .then((driveLink) => {
        toast.success(
          `Connected ${driveLink.account_email} to ${provider === 'google' ? 'Google Drive' : 'OneDrive'}.`,
        );
        return loadDrives();
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to connect drive.';
        toast.error('drive_connect_failed', msg);
      })
      .finally(() => setDriveBusy(false));
  // params identity changes on every render if not memoised; the meaningful
  // dependency is whether provider+code are present, so exhaustive-deps is
  // intentionally limited here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function disconnectDrive(provider: CloudBackend): Promise<void> {
    setDriveBusy(provider);
    try {
      await cloudApi.disconnect(provider);
      toast.success('Drive disconnected. Videos stored there stay listed but cannot play until you reconnect.');
      await loadDrives();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to disconnect.';
      toast.error('drive_disconnect_failed', msg);
    } finally {
      setDriveBusy(false);
    }
  }

  function connectUrl(provider: CloudBackend): string {
    const redirect = encodeURIComponent(`${window.location.origin}${window.location.pathname}`);
    if (provider === 'google') {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
      if (!clientId) return '';
      const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.file');
      return (
        `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${redirect}&response_type=code&scope=${scope}` +
        `&access_type=offline&prompt=consent`
      );
    }
    // OneDrive
    const clientId = import.meta.env.VITE_ONEDRIVE_CLIENT_ID as string | undefined;
    if (!clientId) return '';
    const scope = encodeURIComponent('offline_access https://graph.microsoft.com/Files.ReadWrite');
    const tenant = (import.meta.env.VITE_ONEDRIVE_TENANT as string | undefined) ?? 'common';
    return (
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${redirect}&response_type=code&scope=${scope}` +
      `&prompt=consent`
    );
  }

  const onGenerate = async (): Promise<void> => {
    setGenerating(true);
    try {
      const created = await settingsApi.createTelegramLink();
      setLink(created);
      toast.success('Link code generated. Complete the link in Telegram before it expires.');
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'unexpected_error', apiError.message);
    } finally {
      setGenerating(false);
    }
  };

  const onUnlink = async (): Promise<void> => {
    setUnlinking(true);
    try {
      await settingsApi.unlinkTelegram();
      setUnlinkOpen(false);
      setLink(null);
      toast.success('Telegram unlinked. Generate a new code any time to link again.');
      void load();
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError instanceof ApiError ? apiError.code : 'unexpected_error', apiError.message);
      setUnlinkOpen(false);
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-fg">Settings</h2>
        <p className="mt-0.5 text-sm text-dim">Your console account.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-10">
          <Spinner className="h-5 w-5" />
          <span className="text-sm text-dim">Loading settings…</span>
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => void load()} />
      ) : (
        <section className="card overflow-hidden">
          <h3 className="border-b border-line px-4 py-2.5 font-display text-sm font-semibold text-fg">
            Telegram
          </h3>

          {telegramUserId !== null ? (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div>
                <p className="text-sm text-fg">
                  Linked to Telegram id <span className="font-mono">{telegramUserId}</span>
                </p>
                <p className="mt-0.5 text-xs text-dim">
                  Downloads sent from that Telegram account are attributed to this console account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUnlinkOpen(true)}
                className={`${btnDanger} rounded-md`}
              >
                Unlink
              </button>
            </div>
          ) : (
            <div className="space-y-4 px-4 py-4">
              <p className="text-sm text-dim">
                Link your Telegram so the bot knows downloads are yours and bot admin rights follow
                your console account.
              </p>

              <div>
                <span className={labelCls}>One-time code</span>
                {link ? (
                  <div className="space-y-3">
                    <p className="break-all rounded-md border border-line bg-raised px-3 py-2 font-mono text-sm text-fg">
                      {link.code}
                    </p>
                    <p className="text-xs text-faint">
                      Expires in 15 minutes{link.expires_at ? ` — ${formatDateTime(link.expires_at)}` : ''}. The
                      code is one-time use.
                    </p>
                    {link.deep_link ? (
                      <a
                        href={link.deep_link}
                        target="_blank"
                        rel="noreferrer"
                        className={`${btnPrimary} rounded-md`}
                      >
                        Open Telegram
                      </a>
                    ) : (
                      <p className="text-xs text-dim">
                        In the bot, send{' '}
                        <span className="font-mono">/start {link.code.startsWith('link-') ? link.code : `link-${link.code}`}</span>{' '}
                        to finish the link, and ask the operator to set TELEGRAM_BOT_USERNAME for a one-tap
                        link.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-faint">No code yet — generate one to start linking.</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => void onGenerate()}
                disabled={generating}
                className={`${btnPrimary} rounded-md`}
              >
                {generating ? <Spinner className="h-3.5 w-3.5" /> : null}
                {link ? 'Generate a new code' : 'Generate link'}
              </button>
            </div>
          )}
        </section>
      )}

      {/* ---- Cloud Storage ---- */}
      <div>
        <h2 className="mb-1 font-display text-lg font-semibold text-fg">Cloud storage</h2>
        <p className="mb-4 text-sm text-dim">
          Keep your contributed video bytes on your own cloud. Connect a drive here, then choose it
          when uploading a clip — the file goes to your drive and the dataset catalogues it normally.
        </p>
        {driveLoading ? (
          <div className="flex items-center gap-3 py-4">
            <Spinner className="h-4 w-4" />
            <span className="text-sm text-dim">Loading cloud storage…</span>
          </div>
        ) : (
          <div className="space-y-3">
            {(
              [
                {
                  key: 'google' as CloudBackend,
                  label: 'Google Drive',
                  hint: 'Store videos in your own Google Drive (drive.file scope — only files this app creates).',
                },
                {
                  key: 'onedrive' as CloudBackend,
                  label: 'OneDrive',
                  hint: 'Store videos in your own OneDrive via Microsoft Graph (Files.ReadWrite scope).',
                },
              ] as const
            ).map((p) => {
              const connected = driveLinks.find((l) => l.provider === p.key);
              const offered = driveProviders?.[p.key];
              const url = connectUrl(p.key);
              return (
                <div key={p.key} className="card p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-fg">{p.label}</p>
                    <p className="mt-0.5 text-xs text-dim">{p.hint}</p>
                    {connected ? (
                      <p className="mt-1 truncate text-xs text-ok">
                        Connected as {connected.account_email}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0">
                    {connected ? (
                      <button
                        type="button"
                        disabled={driveBusy === p.key}
                        onClick={() => void disconnectDrive(p.key)}
                        className={`${btnDanger} rounded-md`}
                      >
                        {driveBusy === p.key ? 'Working…' : 'Disconnect'}
                      </button>
                    ) : offered === false ? (
                      <span className="text-xs text-faint">Not configured</span>
                    ) : !url ? (
                      <span className="text-xs text-faint">
                        Set VITE_{p.key.toUpperCase()}_CLIENT_ID to enable
                      </span>
                    ) : (
                      <a href={url} className={`${btnPrimary} rounded-md`}>
                        Connect
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={unlinkOpen}
        destructive
        title="Unlink Telegram?"
        message={`Downloads sent from Telegram id ${telegramUserId} will no longer be attributed to this console account, and bot admin rights will stop following it. You can link again at any time.`}
        confirmLabel="Unlink"
        busy={unlinking}
        onConfirm={() => void onUnlink()}
        onCancel={() => setUnlinkOpen(false)}
      />
    </div>
  );
}