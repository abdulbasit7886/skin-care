import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const SessionError = ({ message, onRetry }) => (
  <div className="fixed inset-0 flex items-center justify-center bg-background px-6">
    <div className="max-w-sm text-center">
      <h2 className="font-display text-xl font-semibold">Cannot reach the server</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <button onClick={onRetry} className="mt-5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
        Try again
      </button>
    </div>
  </div>
);

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth } = useAuth();

  if (isLoadingAuth || !authChecked) return fallback;
  if (authError && !isAuthenticated) return <SessionError message={authError.message} onRetry={checkUserAuth} />;
  if (!isAuthenticated) return unauthenticatedElement;
  return <Outlet />;
}
