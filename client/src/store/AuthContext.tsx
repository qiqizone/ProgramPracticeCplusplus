import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, clearToken, setToken } from '../api/client';
import type { User } from '../types';

interface AuthValue {
  user: User | null;
  loading: boolean;
  localMode: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

interface AuthResponse {
  token: string;
  user: User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [localMode, setLocalMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 本地免登录模式下后端无需 token 也会返回用户，因此首次进入直接拉取
    api<User & { localMode?: boolean }>('/auth/me')
      .then((data) => {
        setUser(data);
        setLocalMode(Boolean(data.localMode));
      })
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, []);

  async function login(username: string, password: string) {
    const data = await api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(data.token);
    setUser(data.user);
  }

  async function register(username: string, password: string) {
    const data = await api<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, localMode, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return value;
}
