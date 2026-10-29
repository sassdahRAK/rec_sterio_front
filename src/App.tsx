import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { Role } from './api/types';
import { OPERATOR_ROLES, SUPER_ADMIN_ONLY } from './api/types';
import Layout from './components/Layout';
import Spinner from './components/Spinner';
import Dataset from './pages/Dataset';
import Jobs from './pages/Jobs';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Settings from './pages/Settings';
import Users from './pages/Users';
import VideoDetailPage from './pages/VideoDetail';
import Videos from './pages/Videos';
import { registerUnauthorizedHandler, useAuthStore } from './store/auth';

/**
 * The operations console.
 *
 * Everything here requires an operator account. The public dataset portal is a
 * separate app (`portal/`): browsing public folders, redeeming share links and
 * opening a private folder with a passcode all happen there, so this console
 * never has to expose a guest-facing surface.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const ready = useAuthStore((s) => s.ready);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base">
        <Spinner className="h-6 w-6 text-accent" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

/**
 * Where a role lands by default.
 *
 * Overview is a pipeline dashboard and reads `GET /stats`, which is
 * operator-only — sending a reviewer there paints a red "forbidden" panel on
 * the first screen they see. Every other role starts on the dataset instead.
 */
function Home() {
  const role = useAuthStore((s) => s.role);
  return <Navigate to={OPERATOR_ROLES.includes(role) ? '/overview' : '/dataset'} replace />;
}

/**
 * Caps a console route to the given roles. A signed-in account without the
 * right is redirected within the console — a missing capability is not a
 * session problem, so it never triggers the 401 logout path.
 */
function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const role = useAuthStore((s) => s.role);
  if (!roles.includes(role)) {
    return <Home />;
  }
  return children;
}

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
    return registerUnauthorizedHandler();
  }, [bootstrap]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route
          path="overview"
          element={
            <RequireRole roles={OPERATOR_ROLES}>
              <Overview />
            </RequireRole>
          }
        />
        <Route path="videos" element={<Videos />} />
        <Route path="videos/:id" element={<VideoDetailPage />} />
        <Route
          path="jobs"
          element={
            <RequireRole roles={OPERATOR_ROLES}>
              <Jobs />
            </RequireRole>
          }
        />
        {/* Folders, share links, passcodes and the cleaned-data cards. */}
        <Route path="dataset" element={<Dataset />} />
        <Route path="dataset/f/:folderId" element={<Dataset />} />
        {/* Console-account administration — super_admin only. */}
        <Route
          path="users"
          element={
            <RequireRole roles={SUPER_ADMIN_ONLY}>
              <Users />
            </RequireRole>
          }
        />
        {/* Account-level settings: the Telegram link. */}
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
