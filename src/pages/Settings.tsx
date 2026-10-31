import { useCallback, useEffect, useState } from 'react';
import { ApiError, cloudApi, settingsApi } from '../api/client';
import type { CloudBackend, CloudProviders, DriveLink, TelegramLink } from '../api/types';
import ConfirmDialog from '../components/ConfirmDialog';
import ErrorState from '../components/ErrorState';
import Spinner from '../components/Spinner';
import {
  CloseIcon,
  CopyIcon,
  ExternalLinkIcon,
  LinkIcon,
} from '../components/icons';
import {
  btnDanger,
  btnNeutral,
  btnPrimary,
  iconBtnCls,
  inputCls,
  labelCls,
} from '../components/ui';
import { formatDateTime } from '../lib/format';
import { toast } from '../store/toast';

/**
 * Console-account settings: the Telegram link and personal-cloud connections.
 *
 * The console mints a one-time code; the bot redeems it. Once linked, the bot
 * attributes downloads to this account and its admin commands follow the
 * console account's role instead of the operator's TELEGRAM_BOT_USERNAME list.
 *
 * The drive OAuth handshake mirrors the portal's Settings page (the reference
 * implementation): clicking Connect remembers the provider in sessionStorage
 * and opens the provider consent screen in a new tab. The provider sends that
 * tab back to this page with `?code=…` — it never echoes a `provider` param,
 * which is why the pending key exists — and on landing we exchange the code
 * and scrub every provider param from the URL so a reload cannot reuse it. If
 * the popup never lands here (blocked, or authorized on another device) the
 * "Paste the link" dialog closes the loop with the address-bar URL or the raw
 * code. Accounts without an AdminUser row (guest / bot tokens) cannot reach
 * this page at all: RequireAuth in App.tsx sends them to the login screen.
 */

/* ------------------------------------------------------------ cloud OAuth */

/**
 * Deliberately NOT the portal's `recsterio.cloud.pending`: in production both
 * SPAs share one origin (Caddy serves the portal at `/`, this console at
 * `/console/`) and sessionStorage is per-origin — a shared key would let the
 * console consume a portal-pending handshake. Same value format ('google' |
 * 'onedrive'), different key.
 */
const PENDING_KEY = 'recsterio.admin.cloud.pending';

/** (provider, code) pairs already exchanged this page lifecycle. OAuth codes
 * are single-use, so deduping is semantically correct — and it keeps the
 * StrictMode dev double-mount from POSTing the same code twice. Module scope
 * survives the remount; a useRef would not. Cleared on full page reload. */
const exchangedCodes = new Set<string>();

/** One shared constant — the consent URL and the exchange POST body must send
 * the byte-identical redirect_uri or the provider rejects the token call.
 * The console lives under a base (`/console/` in production, `/` in dev), so
 * the landing route resolves to `<origin>/console/settings` there. */
function cloudRedirectUri(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/+$/, '')}/settings`;
}

/** Provider/auth params to scrub from the URL after the handshake, whatever
 * the provider happened to append (Google: scope/authuser/prompt/hd,
 * Microsoft: session_state, plus our own leftovers). */
const PROVIDER_PARAMS = [
  'provider',
  'code',
  'scope',
  'state',
  'session_state',
  'authuser',
  'prompt',
  'hd',
  'error',
  'error_description',
];

function scrubProviderParams(): void {
  const search = new URLSearchParams(window.location.search);
  let changed = false;
  for (const key of PROVIDER_PARAMS) {
    if (search.has(key)) {
      search.delete(key);
      changed = true;
    }
  }
  if (!changed) return;
  const qs = search.toString();
  history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
}

function readPending(): CloudBackend | null {
  const v = sessionStorage.getItem(PENDING_KEY);
  return v === 'google' || v === 'onedrive' ? v : null;
}

const providerLabel = (p: CloudBackend): string => (p === 'google' ? 'Google Drive' : 'OneDrive');

/**
 * Map a failed code exchange onto a sentence the operator can act on.
 * Shared by the landing handler and the paste dialog.
 */
function cloudErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'cloud_auth_rejected') {
      return 'That authorization link was already used or has expired. Start Connect again.';
    }
    if (err.code === 'provider_not_configured') {
      return "This storage provider isn't set up yet. Ask your administrator to enable it.";
    }
    const details = Array.isArray(err.details)
      ? (err.details as { field?: string; issue?: string }[])
      : [];
    if (
      err.code === 'validation_failed' &&
      details.some((d) => d.field === 'redirect_uri' && d.issue === 'foreign_origin')
    ) {
      return "That link doesn't match this site. Paste the full URL from the address bar after you authorized.";
    }
    const issue = details[0]?.issue;
    return issue ? `${err.message} (${issue})` : err.message;
  }
  return 'Could not reach the server. Check your connection and try again.';
}

/**
 * Pull an authorization code out of what the user pasted: a full address-bar
 * URL, a bare query string, or the raw code.
 */
function extractAuthCode(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (text.includes('code=')) {
    try {
      const fromUrl = new URL(text).searchParams.get('code');
      if (fromUrl) return fromUrl;
    } catch {
      // Not a full URL — maybe "/console/settings?code=…" or just "code=…".
      const query = text.includes('?') ? text.slice(text.indexOf('?') + 1) : text;
      const fromQuery = new URLSearchParams(query).get('code');
      if (fromQuery) return fromQuery;
    }
    return null;
  }
  // No `code=` anywhere: only accept the raw text if it looks like a token.
  // OAuth codes are URL-safe token chars — no spaces — so prose falls through
  // to null and the paste dialog shows its no-code alert instead of POSTing
  // the text as a code.
  return /^[A-Za-z0-9_\-\.]+$/.test(text) ? text : null;
}

const GoogleApp = {
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  // openid email → the backend's userinfo call needs the account email;
  // drive.file alone 502s at the end of the exchange.
  scope: 'openid email https://www.googleapis.com/auth/drive.file',
};

// The console reads its client IDs from build-time env, unlike the portal,
// which pulls the Google one from /public/config. Keep that admin convention.
function googleClientId(): string {
  return ((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '').trim();
}

const MicrosoftApp = {
  clientId: ((import.meta.env.VITE_ONEDRIVE_CLIENT_ID as string | undefined) || '').trim(),
  tenant: ((import.meta.env.VITE_ONEDRIVE_TENANT as string | undefined) || '').trim() || 'common',
  // offline_access → the backend demands a refresh token; AppFolder is the
  // scope the backend actually works inside (plain Files.ReadWrite is rejected).
  scope: 'offline_access https://graph.microsoft.com/Files.ReadWrite.AppFolder',
};

/** Consent URL builder. `redirect_uri` comes from the one shared constant. */
function consentUrl(provider: CloudBackend): string {
  const redirect = encodeURIComponent(cloudRedirectUri());
  if (provider === 'google') {
    return (
      `${GoogleApp.authUrl}?client_id=${encodeURIComponent(googleClientId())}` +
      `&redirect_uri=${redirect}&response_type=code` +
      `&scope=${encodeURIComponent(GoogleApp.scope)}` +
      '&access_type=offline&prompt=consent'
    );
  }
  return (
    `https://login.microsoftonline.com/${encodeURIComponent(MicrosoftApp.tenant)}/oauth2/v2.0/authorize` +
    `?client_id=${encodeURIComponent(MicrosoftApp.clientId)}` +
    `&redirect_uri=${redirect}&response_type=code` +
    `&scope=${encodeURIComponent(MicrosoftApp.scope)}` +
    '&prompt=consent'
  );
}
export default function Settings() {
  const [telegramUserId, setTelegramUserId] = useState<number | null>(null);
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [generating, setGenerating] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  // Cloud storage state
  const [driveLinks, setDriveLinks] = useState<DriveLink[]>([]);
  const [driveProviders, setDriveProviders] = useState<CloudProviders | null>(null);
  const [driveLoading, setDriveLoading] = useState(true);
  const [driveBusy, setDriveBusy] = useState<false | CloudBackend>(false);

  // Pending handshake (set on Connect click; survives the provider redirect).
  const [pending, setPending] = useState<CloudBackend | null>(() => readPending());
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [pendingUrl, setPendingUrl] = useState('');
  // A failed landing exchange: show the error and the received code on the
  // pending card so the paste dialog can retry with it.
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);

  // Paste dialog.
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasteBusy, setPasteBusy] = useState(false);

  // Disconnect confirmation.
  const [disconnectTarget, setDisconnectTarget] = useState<CloudBackend | null>(null);

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

  /**
   * Exchange one code. Returns an error message or null on success; on
   * success the pending key is gone, the toast fires, and the links list
   * needs a refresh.
   */
  const completeExchange = useCallback(
    async (provider: CloudBackend, code: string): Promise<string | null> => {
      setDriveBusy(provider);
      try {
        // Byte-identical redirect_uri with the consent URL, always.
        const link = await cloudApi.connect(provider, code, cloudRedirectUri());
        sessionStorage.removeItem(PENDING_KEY);
        setPending(null);
        setExchangeError(null);
        setLastCode(null);
        toast.success(`Connected as ${link.account_email} to ${providerLabel(provider)}.`);
        return null;
      } catch (err) {
        return cloudErrorMessage(err);
      } finally {
        setDriveBusy(false);
      }
    },
    [],
  );

  // Auto-complete on landing: the provider comes back with ?code=… (it never
  // sends ?provider=, so the pending key in sessionStorage names the provider;
  // a ?provider= param, if ever present, still wins).
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const code = search.get('code');
    if (!code) return;
    const providerParam = search.get('provider');
    const provider =
      providerParam === 'google' || providerParam === 'onedrive' ? providerParam : readPending();
    if (!provider) {
      // A stale OAuth URL with no pending handshake of ours — leave it alone.
      console.warn('[cloud] landed with an authorization code but no pending provider; ignoring');
      return;
    }
    // Exchange each (provider, code) at most once per page lifecycle — the
    // StrictMode double-mount must not re-POST a single-use code.
    const exchangeKey = `${provider}:${code}`;
    if (exchangedCodes.has(exchangeKey)) return;
    exchangedCodes.add(exchangeKey);
    setPending(provider);
    void (async () => {
      const message = await completeExchange(provider, code);
      if (message) {
        // Keep the code visible on the card so "Paste the link" can retry.
        setExchangeError(message);
        setLastCode(code);
      } else {
        scrubProviderParams();
        await loadDrives();
      }
    })();
    // Mount-only on purpose: the URL is scrubbed after a success and the code
    // must never be re-posted on re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startConnect(provider: CloudBackend) {
    setExchangeError(null);
    setLastCode(null);
    const url = consentUrl(provider);
    sessionStorage.setItem(PENDING_KEY, provider);
    setPending(provider);
    setPendingUrl(url);
    // `noopener` detaches the consent tab, so a null handle *may* mean the
    // popup was blocked — the card offers a plain <a> as the fallback action
    // whenever we cannot confirm the tab opened.
    setPopupBlocked(window.open(url, '_blank', 'noopener') === null);
  }

  function cancelPending() {
    sessionStorage.removeItem(PENDING_KEY);
    setPending(null);
    setPopupBlocked(false);
    setPendingUrl('');
    setExchangeError(null);
    setLastCode(null);
  }

  function openPaste(provider: CloudBackend) {
    setPending(provider); // the dialog only ever works for the pending provider
    setPasteValue('');
    setPasteError(null);
    setPasteOpen(true);
  }

  async function submitPaste(): Promise<void> {
    const provider = pending;
    if (!provider) return;
    const code = extractAuthCode(pasteValue);
    if (!code) {
      setPasteError(
        "That text doesn't contain an authorization code (look for ?code=… in the address bar)",
      );
      return;
    }
    setPasteBusy(true);
    setPasteError(null);
    try {
      const message = await completeExchange(provider, code);
      if (message) {
        // Keep the dialog open; the same paste can be retried.
        setPasteError(message);
        return;
      }
      setPasteOpen(false);
      setPasteValue('');
      scrubProviderParams();
      await loadDrives();
    } finally {
      setPasteBusy(false);
    }
  }

  async function disconnectDrive(provider: CloudBackend): Promise<void> {
    setDriveBusy(provider);
    try {
      await cloudApi.disconnect(provider);
      toast.success(
        `Disconnected ${providerLabel(provider)}. Videos stored there stay listed but cannot play until you reconnect.`,
      );
      await loadDrives();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to disconnect.';
      toast.error('drive_disconnect_failed', msg);
    } finally {
      setDriveBusy(false);
      setDisconnectTarget(null);
    }
  }

  const copyCode = async (): Promise<void> => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.code);
      toast.success('Link code copied.');
    } catch {
      // Clipboard can be blocked; show the value so it can be selected.
      window.prompt('Copy this code:', link.code);
    }
  };

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
                <CloseIcon size={15} /> Unlink
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
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 break-all rounded-md border border-line bg-raised px-3 py-2 font-mono text-sm text-fg">
                        {link.code}
                      </p>
                      <button
                        type="button"
                        onClick={() => void copyCode()}
                        aria-label="Copy link code"
                        title="Copy link code"
                        className={iconBtnCls}
                      >
                        <CopyIcon size={15} />
                      </button>
                      {link.deep_link ? (
                        <a
                          href={link.deep_link}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Open Telegram"
                          title="Open Telegram"
                          className={iconBtnCls}
                        >
                          <ExternalLinkIcon size={15} />
                        </a>
                      ) : null}
                    </div>
                    <p className="text-xs text-faint">
                      Expires in 15 minutes{link.expires_at ? ` (${formatDateTime(link.expires_at)})` : ''}. The
                      code is one-time use.
                    </p>
                    {!link.deep_link ? (
                      <p className="text-xs text-dim">
                        In the bot, send{' '}
                        <span className="font-mono">/start {link.code.startsWith('link-') ? link.code : `link-${link.code}`}</span>{' '}
                        to finish the link, and ask the operator to set TELEGRAM_BOT_USERNAME for a one-tap
                        link.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-faint">No code yet. Generate one to start linking.</p>
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
        {/* The heading already says "Cloud storage" — the fuller description
            only shows from sm up. */}
        <p className="mb-4 hidden text-sm text-dim sm:block">
          Keep your contributed video bytes on your own cloud. Connect a drive here, then choose it
          when uploading a clip. The file goes to your drive and the dataset catalogues it normally.
        </p>
        {driveProviders && (!driveProviders.google || !driveProviders.onedrive) ? (
          <div className="mb-4 rounded-md border border-line bg-raised px-3 py-2 text-xs text-dim">
            <strong className="font-semibold text-fg">Drive storage isn't enabled yet.</strong>{' '}
            Ask your administrator to enable cloud storage.
          </div>
        ) : null}
        {driveLoading && driveProviders === null ? (
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
                  hint: 'Only files this app creates (drive.file scope).',
                },
                {
                  key: 'onedrive' as CloudBackend,
                  label: 'OneDrive',
                  hint: 'The app\'s own folder (Files.ReadWrite.AppFolder scope).',
                },
              ] as const
            ).map((p) => {
              const connected = driveLinks.find((l) => l.provider === p.key);
              const offered = driveProviders?.[p.key];
              const clientIdMissing = p.key === 'google' ? !googleClientId() : !MicrosoftApp.clientId;
              const isPending = pending === p.key && !connected;
              return (
                <div key={p.key} className="card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-fg">{p.label}</p>
                      <p className="mt-0.5 text-xs text-dim">{p.hint}</p>
                      {connected ? (
                        <p className="mt-1 truncate text-xs text-ok">
                          Connected as {connected.account_email}
                        </p>
                      ) : null}
                      {!connected && offered === true && clientIdMissing ? (
                        <p className="mt-1 text-xs text-faint">
                          {p.key === 'google'
                            ? 'Google Drive isn\'t set up yet. Ask your administrator to finish enabling it.'
                            : 'OneDrive isn\'t set up yet. Ask your administrator to finish enabling it.'}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0">
                      {connected ? (
                        <button
                          type="button"
                          disabled={driveBusy === p.key}
                          onClick={() => setDisconnectTarget(p.key)}
                          className={`${btnDanger} rounded-md`}
                        >
                          {driveBusy === p.key ? 'Working…' : (
                            <>
                              <CloseIcon size={15} /> Disconnect
                            </>
                          )}
                        </button>
                      ) : isPending ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openPaste(p.key)}
                            disabled={driveBusy === p.key}
                            className={`${btnNeutral} rounded-md`}
                          >
                            Paste the link
                          </button>
                          <button
                            type="button"
                            onClick={cancelPending}
                            disabled={driveBusy === p.key}
                            className={`${btnNeutral} rounded-md`}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : offered === false ? (
                        /* The next step is visible text, not only a hover title:
                           a grey dead chip reads as "the feature is broken". */
                        <div
                          className="max-w-[16rem] text-right"
                          title="Ask your administrator to enable this provider."
                        >
                          <p className="text-xs font-medium text-faint">This feature isn't set up yet</p>
                          <p className="mt-0.5 text-2xs text-faint">
                            Ask your administrator to configure it.
                          </p>
                        </div>
                      ) : driveProviders === null ? (
                        /* Still loading (or the status call failed): never flash
                           "isn't set up" for a provider we haven't heard about. */
                        <Spinner
                          label={driveLoading ? 'Checking…' : 'Unavailable'}
                          className="justify-end"
                        />
                      ) : clientIdMissing ? (
                        <button type="button" disabled className={`${btnNeutral} rounded-md`}>
                          <LinkIcon size={15} /> Connect
                        </button>
                      ) : driveBusy === p.key ? (
                        <button type="button" disabled className={`${btnPrimary} rounded-md`}>
                          Working…
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startConnect(p.key)}
                          className={`${btnPrimary} rounded-md`}
                        >
                          <LinkIcon size={15} /> Connect
                        </button>
                      )}
                    </div>
                  </div>

                  {isPending ? (
                    <div className="mt-3 rounded-md border-l-4 border-warn bg-warn-soft px-3 py-2.5">
                      {driveBusy === p.key ? (
                        <Spinner label="Finishing the connection…" />
                      ) : (
                        <p className="text-sm text-fg">Waiting for you to finish in the browser tab…</p>
                      )}
                      {exchangeError ? (
                        <div role="alert" className="mt-2 rounded-md bg-bad-soft px-3 py-2 text-xs text-bad">
                          <p>{exchangeError}</p>
                          {lastCode ? (
                            <p className="mt-1 break-all text-faint">
                              Authorization code received: <span className="font-mono">{lastCode}</span>
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {popupBlocked && pendingUrl ? (
                        <a href={pendingUrl} target="_blank" rel="noreferrer" className={`${btnPrimary} mt-2`}>
                          <ExternalLinkIcon size={15} /> Open the authorization page
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PasteCodeDialog
        providerLabel={pending ? providerLabel(pending) : ''}
        open={pasteOpen && pending !== null}
        value={pasteValue}
        error={pasteError}
        busy={pasteBusy}
        onChange={(v) => {
          setPasteValue(v);
          if (pasteError) setPasteError(null);
        }}
        onClose={() => {
          if (!pasteBusy) setPasteOpen(false);
        }}
        onSubmit={() => void submitPaste()}
      />

      <ConfirmDialog
        open={disconnectTarget !== null}
        destructive
        title={disconnectTarget ? `Disconnect ${providerLabel(disconnectTarget)}?` : ''}
        message="Disconnecting removes the token this console uses to read your files. Videos stored there become unavailable until you reconnect (transcripts and records stay)."
        confirmLabel="Disconnect"
        busy={disconnectTarget !== null && driveBusy === disconnectTarget}
        onConfirm={() => {
          if (disconnectTarget) void disconnectDrive(disconnectTarget);
        }}
        onCancel={() => setDisconnectTarget(null)}
      />

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

/**
 * Paste dialog: the fallback for every path where the redirect does not come
 * back to this tab (blocked popup, authorized on another device, expired
 * landing exchange). Opens only from a pending card. Shell follows the
 * ConfirmDialog idiom.
 */
function PasteCodeDialog({
  providerLabel: label,
  open,
  value,
  error,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  providerLabel: string;
  open: boolean;
  value: string;
  error: string | null;
  busy: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={() => !busy && onClose()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Paste the ${label} authorization link`}
        className="card relative max-h-[85vh] w-full max-w-md overflow-y-auto animate-fade-up p-5"
      >
        <h2 className="font-display text-base font-semibold text-fg">Connect {label}</h2>
        <label className={`${labelCls} mt-3`} htmlFor="cloud-paste">
          Paste the URL you were sent back to, or just the code
        </label>
        <textarea
          id="cloud-paste"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} resize-y font-mono text-xs`}
        />
        <p className="mt-1.5 text-xs text-faint">
          After you authorize, the browser is sent back to{' '}
          <span className="font-mono">{cloudRedirectUri()}?code=…</span>. Copy the whole address-bar
          URL here.
        </p>
        {error ? (
          <div role="alert" className="mt-3 rounded-md bg-bad-soft px-3 py-2 text-xs text-bad">
            {error}
          </div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={btnNeutral}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy || !value.trim()}
            className={btnPrimary}
          >
            {busy ? (
              <>
                <Spinner className="h-4 w-4" />
                Working…
              </>
            ) : (
              'Connect'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}