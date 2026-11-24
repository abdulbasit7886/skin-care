import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleGuard from '@/components/RoleGuard';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Dashboard from '@/pages/Dashboard';
import Patients from '@/pages/Patients';
import PatientFile from '@/pages/PatientFile';
import Scheduling from '@/pages/Scheduling';
import Appointments from '@/pages/Appointments';
import Reception from '@/pages/Reception';
import EMR from '@/pages/EMR';
import Setup from '@/pages/Setup';
import Reports from '@/pages/Reports';
import ImportChart from '@/pages/ImportChart';
import ArchivedRecords from '@/pages/ArchivedRecords';
import UserPermissions from '@/pages/UserPermissions';
import Facilities from '@/pages/Facilities';
import AuditLog from '@/pages/AuditLog';
import Roles from '@/pages/Roles';
import Messages from '@/pages/Messages';
import Account from '@/pages/Account';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { landingForUser } from '@/lib/roles';
import ScrollToTop from './components/ScrollToTop';

const Spinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

// Login / password pages: a signed-in user goes straight to their landing page.
const PublicOnly = ({ children }) => {
  const { isAuthenticated, isLoadingAuth, authChecked, user } = useAuth();
  if (isLoadingAuth || !authChecked) return <Spinner />;
  if (isAuthenticated) return <Navigate to={landingForUser(user)} replace />;
  return children;
};

// Unauthenticated visitors are sent to /login, remembering where they were going.
const ToLogin = () => {
  const location = useLocation();
  const target = location.pathname + location.search;
  const qs = target && target !== '/' ? `?returnTo=${encodeURIComponent(target)}` : '';
  return <Navigate to={`/login${qs}`} replace />;
};

const PortalRoutes = () => (
  <Routes>
    <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
    <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route element={<ProtectedRoute unauthenticatedElement={<ToLogin />} />}>
      <Route element={<RoleGuard />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/:patientId" element={<PatientFile />} />
          <Route path="/import-chart" element={<ImportChart />} />
          <Route path="/archived-records" element={<ArchivedRecords />} />
          <Route path="/scheduling" element={<Scheduling />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/reception" element={<Reception />} />
          <Route path="/emr/:appointmentId" element={<EMR />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/user-permissions" element={<UserPermissions />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/facilities" element={<Facilities />} />
          <Route path="/audit-log" element={<AuditLog />} />
          <Route path="/roles" element={<Roles />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/account" element={<Account />} />
        </Route>
      </Route>
    </Route>
    <Route path="*" element={<PageNotFound />} />
  </Routes>
);

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router basename="/portal">
          <ScrollToTop />
          <PortalRoutes />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
