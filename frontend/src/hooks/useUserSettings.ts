// src/hooks/useUserSettings.ts
import { useState, useEffect } from 'react';
import { getJSON, putJSON } from '@/lib/api';
import { ApiResponse, UserSettings, isOk, UIError } from '@/lib/types';
import { useAuth } from '../contexts/AuthContext';

interface UseUserSettingsReturn {
  settings: UserSettings | null;
  loading: boolean;
  error: UIError;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<boolean>;
  refreshSettings: () => Promise<void>;
}

export async function fetchUserSettings(token: string) {
  // Ruta consistente con el backend (sin duplicar /api)
  const res = await getJSON<ApiResponse<UserSettings>>('/me/settings', { token });
  if (isOk(res)) return res.data;
  throw new Error(res.message);
}

export const useUserSettings = (): UseUserSettingsReturn => {
  const { token } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UIError>(null);

  const fetchSettings = async () => {
    if (!token) {
      setError({ message: 'Token de autenticación requerido' });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const settingsData = await fetchUserSettings(token);
      setSettings(settingsData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setError({ message: msg });
      console.error('Error fetching user settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>): Promise<boolean> => {
    if (!token) {
      setError({ message: 'Token de autenticación requerido' });
      return false;
    }

    try {
      setError(null);
      const res = await putJSON<ApiResponse<UserSettings>>('/me/settings', newSettings, { token });
      
      if (isOk(res)) {
        setSettings(res.data);
        return true;
      } else {
        throw new Error(res.message);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setError({ message: msg });
      console.error('Error updating user settings:', err);
      return false;
    }
  };

  const refreshSettings = async () => {
    await fetchSettings();
  };

  useEffect(() => {
    fetchSettings();
  }, [token]);

  return {
    settings,
    loading,
    error,
    updateSettings,
    refreshSettings
  };
};