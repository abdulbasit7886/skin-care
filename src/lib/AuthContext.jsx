import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { api, getActiveFacilityId, setActiveFacilityId } from '@/api/client';

// Session state for the EMR portal. The session itself is an httpOnly cookie set
// by the server; `user` is the `Me` object from GET /api/auth/me (role,
// effectiveRole, permissions, landingPage, doctor_id, facility_id, facilities...).

const AuthContext = createContext();

// Super admin works on one facility at a time. Make sure the stored choice still
// exists; otherwise fall back to the first active facility.
const syncActiveFacility = (me) => {
  if (!me || me.role !== 'super_admin') return null;
  const list = Array.isArray(me.facilities) ? me.facilities : [];
  const stored = getActiveFacilityId();
  const valid = list.find((f) => f.id === stored);
  const next = valid ? valid.id : (list[0]?.id || null);
  if (next !== stored) setActiveFacilityId(next);
  return next;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [activeFacilityId, setActiveFacility] = useState(getActiveFacilityId());

  const applyUser = useCallback((me) => {
    if (me && me.role === 'super_admin') {
      const fid = syncActiveFacility(me);
      setActiveFacility(fid);
      const fac = (me.facilities || []).find((f) => f.id === fid);
      me = { ...me, facility_id: fid, facility_name: fac?.name || me.facility_name || null };
    }
    setUser(me ? { ...me, effectiveRole: me.effectiveRole || me.role } : null);
    setIsAuthenticated(!!me);
  }, []);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const me = await api.auth.me();
      applyUser(me);
    } catch (error) {
      applyUser(null);
      if (error.status !== 401) {
        setAuthError({ type: 'unknown', message: error.message || 'Could not check your session' });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [applyUser]);

  useEffect(() => { checkUserAuth(); }, [checkUserAuth]);

  const login = async (loginId, password) => {
    const res = await api.auth.login(loginId, password);
    const me = res?.user || (await api.auth.me());
    applyUser(me);
    setAuthError(null);
    setAuthChecked(true);
    return me;
  };

  const logout = async (shouldRedirect = true) => {
    try { await api.auth.logout(); } catch (e) { /* session may already be gone */ }
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) window.location.href = '/portal/login';
  };

  const switchFacility = (id) => {
    if (!id || id === activeFacilityId) return;
    setActiveFacilityId(id);
    setActiveFacility(id);
    // Every page loads its data on mount; a reload re-scopes everything to the new facility.
    window.location.reload();
  };

  const navigateToLogin = () => { window.location.href = '/portal/login'; };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      authChecked,
      authError,
      activeFacilityId,
      login,
      logout,
      switchFacility,
      navigateToLogin,
      checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
