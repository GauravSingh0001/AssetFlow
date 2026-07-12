import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const token = api.getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { user: me } = await api.getMe();
      setUser(me);
    } catch {
      api.clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (email, password) => {
    const { token, user: u } = await api.login(email, password);
    api.setToken(token);
    setUser(u);
    return u;
  };

  const signup = async (data) => {
    const { token, user: u } = await api.signup(data);
    api.setToken(token);
    setUser(u);
    return u;
  };

  const logout = () => {
    api.clearToken();
    setUser(null);
  };

  const forgotPassword = (email) => api.forgotPassword(email);

  const isAdmin = user?.role === 'Admin';
  const isManager = ['Admin', 'AssetManager'].includes(user?.role);
  const isDeptHead = ['Admin', 'AssetManager', 'DeptHead'].includes(user?.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, forgotPassword, isAdmin, isManager, isDeptHead }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
