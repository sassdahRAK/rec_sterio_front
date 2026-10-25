import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Jobs from './pages/Jobs';
import Login from './pages/Login';
import Overview from './pages/Overview';
import VideoDetailPage from './pages/VideoDetail';
import Videos from './pages/Videos';
import { registerUnauthorizedHandler, useAuthStore } from './store/auth';

function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

export default function App() {
  const restore = useAuthStore((s) => s.restore);

  useEffect(() => {
    restore();
    return registerUnauthorizedHandler();
  }, [restore]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Overview />} />
        <Route path="videos" element={<Videos />} />
        <Route path="videos/:id" element={<VideoDetailPage />} />
        <Route path="jobs" element={<Jobs />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
