import { useState } from 'react';
import { withAuth } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { UIError } from '../lib/types';
import { toast } from 'react-hot-toast';

interface ProfileData {
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  telegramUsername?: string;
}

interface UseProfile {
  updateProfile: (data: ProfileData) => Promise<boolean>;
  loading: boolean;
  error: UIError;
}

export const useProfile = (): UseProfile => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UIError>(null);

  const updateProfile = async (profileData: ProfileData): Promise<boolean> => {
    if (!token) {
      setError({ message: 'Token de acceso requerido' });
      return false;
    }

    try {
      setLoading(true);
      setError(null);
      
      const api = withAuth(token);
      console.log('Sending profile data:', profileData);
      const response = await api.PUT('/me/profile', profileData) as any;
      console.log('Profile update response:', response);
      
      const { data, error: apiError } = response;
      
      if (apiError) {
        throw new Error((apiError as any)?.message || 'Error al actualizar perfil');
      }
      
      toast.success('Perfil actualizado exitosamente');
      return true;
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar perfil';
      setError({ message: errorMessage });
      toast.error(errorMessage);
      console.error('Error updating profile:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    updateProfile,
    loading,
    error
  };
};