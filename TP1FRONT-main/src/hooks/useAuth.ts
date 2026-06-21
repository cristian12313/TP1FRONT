import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const { user, accessToken, setAuth, clearAuth, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const login = async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    setAuth(data.user, data.access_token, data.refresh_token);
    return data.user;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Si falla el endpoint no importa, limpiamos igual
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  return { user, accessToken, isAuthenticated, login, logout };
}
