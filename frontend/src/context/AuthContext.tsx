import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser } from '../types';
import { api } from '../utils/api';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('jdu_token'));
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('jdu_token');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('jdu_token');
    if (!storedToken) { setIsLoading(false); return; }
    api.get<AuthUser>('/auth/me')
      .then(userData => { setUser(userData); setToken(storedToken); })
      .catch(() => logout())
      .finally(() => setIsLoading(false));
  }, [logout]);

  const login = async (email: string, password: string) => {
    const result = await api.post<{ token: string; user: AuthUser }>('/auth/login', { email: email.trim().toLowerCase(), password });
    localStorage.setItem('jdu_token', result.token);
    setToken(result.token);
    setUser(result.user);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      isLoading,
      isAdmin: user?.role === 'ADMIN',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
