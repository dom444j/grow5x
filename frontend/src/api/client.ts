// Cliente único tipado para API con manejo de errores estándar
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { toast } from 'react-hot-toast';

const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');

// Crear instancia de axios con configuración base
const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token de autorización
apiClient.interceptors.request.use(
  (config) => {
    try {
      const sessionData = localStorage.getItem('g5.session');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.token) {
          config.headers.Authorization = `Bearer ${session.token}`;
        }
      }
    } catch (error) {
      console.warn('Error parsing session data:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejo de respuestas y errores
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      toast.error('Sesión expirada. Redirigiendo al login...');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
      throw new Error('401: Unauthorized');
    }

    if (error.response?.status === 429) {
      toast.error('Demasiadas solicitudes. Intenta de nuevo en unos momentos.');
      throw new Error('429: Too Many Requests');
    }

    if (error.response?.status === 403) {
      toast.error('No tienes permisos para realizar esta acción.');
      throw new Error('403: Forbidden');
    }

    if (error.response?.status === 404) {
      // Para errores 404, lanzar error para que sea manejado por el componente
      toast.error('Recurso no encontrado');
      throw new Error('404: Not Found');
    }

    if (error.response?.status >= 500) {
      toast.error('Error del servidor. Intenta de nuevo más tarde.');
      throw new Error(`${error.response.status}: Server Error`);
    }

    // Intentar obtener mensaje de error del servidor
    let errorMessage = 'Error en la solicitud';
    try {
      errorMessage = error.response?.data?.message || error.response?.data?.error || errorMessage;
    } catch {
      // Si no se puede obtener el mensaje, usar genérico
    }
    
    if (error.code === 'NETWORK_ERROR' || !error.response) {
      toast.error('Error de conexión. Verifica tu internet.');
      throw new Error('Network Error');
    }
    
    toast.error(errorMessage);
    return Promise.reject(error);
  }
);

/**
 * Funciones helper para diferentes métodos HTTP
 */
export async function getJSON<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.get<T>(path, config);
  return response.data;
}

export async function postJSON<T>(path: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.post<T>(path, data, config);
  return response.data;
}

export async function putJSON<T>(path: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.put<T>(path, data, config);
  return response.data;
}

export async function deleteJSON<T>(path: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.delete<T>(path, {
    ...config,
    data
  });
  return response.data;
}

// Exportar apiClient como named export
export { apiClient };

// Exportar también como default para compatibilidad
export default {
  get: getJSON,
  post: postJSON,
  put: putJSON,
  delete: deleteJSON,
  client: apiClient
};