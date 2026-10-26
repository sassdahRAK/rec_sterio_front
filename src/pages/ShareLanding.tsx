/**
 * A share link lands here (instruction.txt #1). Redemption swaps the visitor's
 * guest token for one scoped to that one folder, then opens it.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, publicApi } from '../api/client';
import { deviceKey } from '../lib/device';
import { useAuthStore } from '../store/auth';
import { btnPrimary } from '../components/ui';
import { LockIcon } from '../components/icons';
import Spinner from '../components/Spinner';

export default function ShareLanding() {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const enterScopedFolder = useAuthStore((s) => s.enterScopedFolder);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    // A signed-in member or the operator already has their own session; send
    // them straight to the folder and let the API decide what they may see.
    if (isAuthenticated) {
      setError(null);
      return;
    }

    publicApi
      .redeemShare(token, deviceKey())
      .then((result) => {
        if (cancelled) return;
        enterScopedFolder(result.token, { folderId: result.folder_id, access: 'share' });
        navigate(`/dataset/f/${result.folder_id}`, { replace: true });
      })
      .catch((err) => {
        if (cancelled) return;
        const apiError = err as ApiError;
        setError({
          code: apiError instanceof ApiError ? apiError.code : 'share_failed',
          message:
            apiError instanceof ApiError
              ? apiError.message
              : 'Could not open this share link.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [token, isAuthenticated, enterScopedFolder, navigate]);

  if (isAuthenticated) {
    return (
      <div className="portal-wash flex min-h-screen items-center justify-center px-4">
        <div className="card max-w-sm p-6 text-center">
          <p className="text-sm text-dim">You are signed in.</p>
          <Link to="/dataset" className={`${btnPrimary} mt-3`}>
            Open the dataset
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-wash flex min-h-screen items-center justify-center px-4 text-fg">
      <div className="card w-full max-w-sm p-6 text-center">
        {error ? (
          <>
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-bad-soft text-bad">
              <LockIcon size={19} />
            </span>
            <h1 className="mt-3 font-display text-base font-semibold">This link is not valid</h1>
            <p className="mt-1 text-sm text-dim">{error.message}</p>
            <Link to="/dataset" className={`${btnPrimary} mt-4`}>
              Browse public datasets
            </Link>
          </>
        ) : (
          <>
            <Spinner className="mx-auto h-6 w-6 text-accent" />
            <h1 className="mt-3 font-display text-base font-semibold">Opening the shared folder…</h1>
            <p className="mt-1 text-xs text-faint">No account needed — the link grants its own access.</p>
          </>
        )}
      </div>
    </div>
  );
}
