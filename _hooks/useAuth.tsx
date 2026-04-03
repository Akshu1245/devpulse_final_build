/**
 * useAuth Hook
 * =================
 * Authentication context and hook for React components
 * IMPLEMENTED: Full login/logout with API integration and token management
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  workspaceId: string;
  role: 'owner' | 'admin' | 'user' | 'viewer';
}

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  updateUser: (user: Partial<AuthUser>) => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = import.meta.env?.VITE_API_URL || '/api';

export interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth Provider Component
 * IMPLEMENTED: Session restoration, automatic token refresh
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const storedToken = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('auth_user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));

        try {
          const response = await fetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` },
          });

          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
            localStorage.setItem('auth_user', JSON.stringify(data.user));
          } else {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
            setToken(null);
            setUser(null);
          }
        } catch (error) {
          console.warn('[Auth] Token validation failed, using cached session');
        }
      }
    } catch (error) {
      console.error('[Auth] Error restoring session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(error.message || 'Login failed');
      }

      const data = await response.json();

      setToken(data.token);
      setUser(data.user);

      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));

      if (data.workspaces?.length > 0) {
        const defaultWorkspace = data.workspaces.find(
          (w: any) => w.id === data.user.workspaceId
        ) || data.workspaces[0];
        const updatedUser = { ...data.user, workspaceId: String(defaultWorkspace.id) };
        setUser(updatedUser);
        localStorage.setItem('auth_user', JSON.stringify(updatedUser));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      if (token) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      setIsLoading(false);
    }
  };

  const switchWorkspace = async (workspaceId: string) => {
    if (!user) return;

    try {
      if (token) {
        const response = await fetch(`${API_BASE}/workspace/switch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ workspaceId }),
        });

        if (response.ok) {
          const updatedUser = { ...user, workspaceId };
          setUser(updatedUser);
          localStorage.setItem('auth_user', JSON.stringify(updatedUser));
          return;
        }
      }
    } catch (error) {
      console.error('[Auth] Workspace switch API failed:', error);
    }

    const updatedUser = { ...user, workspaceId };
    setUser(updatedUser);
    localStorage.setItem('auth_user', JSON.stringify(updatedUser));
  };

  const updateUser = (updates: Partial<AuthUser>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('auth_user', JSON.stringify(updatedUser));
    }
  };

  const refreshToken = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.token);
        localStorage.setItem('auth_token', data.token);
      }
    } catch (error) {
      console.error('[Auth] Token refresh failed:', error);
      logout();
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      const interval = setInterval(refreshToken, 14 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [token, refreshToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        switchWorkspace,
        updateUser,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth Hook
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  updateUser: (user: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session from storage
    const storedUser = sessionStorage.getItem('auth_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('[Auth] Error restoring session:', error);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) throw new Error('Login failed');

      const data = await response.json();
      setUser(data.user);
      sessionStorage.setItem('auth_user', JSON.stringify(data.user));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      sessionStorage.removeItem('auth_user');
    } finally {
      setIsLoading(false);
    }
  };

  const switchWorkspace = async (workspaceId: string) => {
    if (user) {
      const updatedUser = { ...user, workspaceId };
      setUser(updatedUser);
      sessionStorage.setItem('auth_user', JSON.stringify(updatedUser));
    }
  };

  const updateUser = (updates: Partial<AuthUser>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      sessionStorage.setItem('auth_user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        switchWorkspace,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth Hook
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
