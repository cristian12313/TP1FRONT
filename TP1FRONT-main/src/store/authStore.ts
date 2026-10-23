import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '../types';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

/** ¿El JWT existe y su `exp` no ha pasado? (solo lee el payload; no lo valida). */
function tokenVigente(token: string | null): boolean {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),

      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null }),

      // La sesión sigue viva mientras lo esté el REFRESH token. Antes solo se
      // miraba el access token (30 min): navegar o recargar con él caducado
      // expulsaba al login aunque el refresh (7 días) siguiera siendo válido.
      // Ahora se deja pasar y la primera petición recibe el 401 y el
      // interceptor de api/client.ts renueva el access token. Si el refresh
      // está revocado (logout en otro lado), ese mismo interceptor limpia la
      // sesión y redirige al login.
      isAuthenticated: () => {
        const { accessToken, refreshToken } = get();
        return tokenVigente(accessToken) || tokenVigente(refreshToken);
      },
    }),
    {
      name: 'jps-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
