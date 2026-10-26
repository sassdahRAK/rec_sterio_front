import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from './components/AppShell';
import Layout from './components/Layout';
import Spinner from './components/Spinner';
import Cleaned from './pages/Cleaned';
import Dataset from './pages/Dataset';
import Jobs from './pages/Jobs';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Scrape from './pages/Scrape';
import ShareLanding from './pages/ShareLanding';
import VideoDetailPage from './pages/VideoDetail';
import Videos from './pages/Videos';
import { registerUnauthorizedHandler, useAuthStore } from './store/auth';

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
      <Route path="/share/:token" element={<ShareLanding />} />

      {/* The dataset portal — guests welcome. */}
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/scrape" replace />} />
        <Route path="scrape" element={<Scrape />} />
        <Route path="dataset" element={<Dataset />} />
        <Route path="dataset/f/:folderId" element={<Dataset />} />
        <Route path="cleaned" element={<Cleaned />} />
      </Route>

      {/* The operations console — signed-in users only. */}
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="overview" element={<Overview />} />
        <Route path="videos" element={<Videos />} />
        <Route path="videos/:id" element={<VideoDetailPage />} />
        <Route path="jobs" element={<Jobs />} />
      </Route>

      <Route path="*" element={<Navigate to="/scrape" replace />} />
    </Routes>
  );
}
