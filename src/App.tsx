import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Spinner from './components/Spinner';
import Dataset from './pages/Dataset';
import Jobs from './pages/Jobs';
import Login from './pages/Login';
import Overview from './pages/Overview';
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
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="videos" element={<Videos />} />
        <Route path="videos/:id" element={<VideoDetailPage />} />
        <Route path="jobs" element={<Jobs />} />
        {/* Folders, share links, passcodes and the cleaned-data cards. */}
        <Route path="dataset" element={<Dataset />} />
        <Route path="dataset/f/:folderId" element={<Dataset />} />
      </Route>

      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
}
