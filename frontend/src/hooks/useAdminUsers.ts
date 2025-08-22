import { useState, useCallback } from 'react';
import { getJSON, postJSON, patchJSON, deleteJSON } from '../services/api';
import { UIError } from '../lib/types';
import { User as ApiUser } from '../types/api';

// Interfaces - extending the main User type for admin-specific fields
export interface AdminUser extends ApiUser {
  _id: string;
  isEmailVerified: boolean;
  telegramUsername?: string;
  telegramVerified?: boolean;
  telegramVerifiedAt?: string;
  updatedAt: string;
  lastLogin?: string;
}

export interface UserFilters {
  search?: string;
  role?: 'user' | 'admin' | 'support' | 'padre' | '';
  isActive?: boolean | '';
  isEmailVerified?: boolean | '';
}

export interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AssignRoleData {
  role: 'user' | 'admin' | 'support' | 'padre';
}

export interface Role {
  _id: string;
  name: string;
  displayName: string;
  description?: string;
  permissions: Array<{
    resource: string;
    actions: string[];
  }>;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export const useAdminUsers = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UIError | null>(null);

  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [filters, setFilters] = useState<UserFilters>({});

  // Fetch users with filters and pagination
  const fetchUsers = useCallback(async (newFilters?: UserFilters, newPage?: number) => {
    try {
      setLoading(true);
      setError(null);

      const currentFilters = newFilters !== undefined ? newFilters : filters;
      const currentPage = newPage !== undefined ? newPage : pagination.page;

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pagination.limit.toString(),
        ...(currentFilters.search && { search: currentFilters.search }),
        ...(currentFilters.role && { role: currentFilters.role }),
        ...(currentFilters.isActive !== '' && currentFilters.isActive !== undefined && { isActive: currentFilters.isActive.toString() }),
        ...(currentFilters.isEmailVerified !== '' && currentFilters.isEmailVerified !== undefined && { isEmailVerified: currentFilters.isEmailVerified.toString() })
      });

      const queryString = params.toString();
      const url = `/admin/users${queryString ? `?${queryString}` : ''}`;
      const response = await getJSON(url);
      
      if (response.success) {
        setUsers(response.data?.users || []);
        setPagination({
          page: response.data?.pagination?.currentPage || 1,
          limit: parseInt(params.get('limit') || '20'),
          total: response.data?.pagination?.totalCount || 0,
          totalPages: response.data?.pagination?.totalPages || 1
        });
        
        if (newFilters !== undefined) {
          setFilters(currentFilters);
        }
      } else {
        throw new Error(response.error || 'Error al obtener usuarios');
      }
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Error al obtener usuarios';
      setError({ message: errorMessage });
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  // Fetch available roles
  const fetchRoles = useCallback(async () => {
    try {
      const response = await getJSON('/v1/iam/roles');
      
      if (response.success) {
        setRoles(response);
      } else {
        throw new Error(response.error || 'Error al obtener roles');
      }
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Error al obtener roles';
      console.error('Error fetching roles:', err);
      // Don't set error state for roles as it's not critical
    }
  }, []);

  // Assign role to user
  const assignUserRole = useCallback(async (userId: string, roleData: AssignRoleData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await postJSON(`/v1/iam/users/${userId}/role`, roleData);
      
      if (response.success) {
        // Update the user in the local state
        setUsers(prevUsers => 
          prevUsers.map(user => 
            user._id === userId 
              ? { ...user, role: roleData.role }
              : user
          )
        );
        return response;
      } else {
        throw new Error(response.error || 'Error al asignar rol');
      }
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Error al asignar rol';
      setError({ message: errorMessage });
      console.error('Error assigning user role:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get user role details
  const getUserRole = useCallback(async (userId: string) => {
    try {
      const response = await getJSON(`/v1/iam/users/${userId}/role`);
      
      if (response.success) {
        return response;
      } else {
        throw new Error(response.error || 'Error al obtener rol del usuario');
      }
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Error al obtener rol del usuario';
      console.error('Error getting user role:', err);
      throw err;
    }
  }, []);

  // Update filters
  const updateFilters = useCallback((newFilters: UserFilters) => {
    fetchUsers(newFilters, 1); // Reset to page 1 when filters change
  }, [fetchUsers]);

  // Change page
  const changePage = useCallback((newPage: number) => {
    fetchUsers(undefined, newPage);
  }, [fetchUsers]);

  // Reset filters
  const resetFilters = useCallback(() => {
    const emptyFilters: UserFilters = {};
    fetchUsers(emptyFilters, 1);
  }, [fetchUsers]);

  // Get user details
  const getUserDetails = useCallback(async (userId: string) => {
    try {
      const response = await getJSON(`/admin/users/${userId}`);
      
      if (response.success) {
        return response;
      } else {
        throw new Error(response.error || 'Error al obtener detalles del usuario');
      }
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Error al obtener detalles del usuario';
      console.error('Error fetching user details:', err);
      throw err;
    }
  }, []);

  // Update user
  const updateUser = useCallback(async (userId: string, userData: any) => {
    try {
      setLoading(true);
      setError(null);

      const response = await patchJSON(`/admin/users/${userId}`, userData);
      
      if (response.success) {
        // Refresh users list
        await fetchUsers();
        return response;
      } else {
        throw new Error(response.error || 'Error al actualizar usuario');
      }
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar usuario';
      setError({ message: errorMessage });
      console.error('Error updating user:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  // Activate user
  const activateUser = useCallback(async (userId: string, notes?: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await patchJSON(`/admin/users/${userId}/activate`, { notes });
      
      if (response.success) {
        // Refresh users list
        await fetchUsers();
        return response;
      } else {
        throw new Error(response.error || 'Error al activar usuario');
      }
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Error al activar usuario';
      setError({ message: errorMessage });
      console.error('Error activating user:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  // Deactivate user
  const deactivateUser = useCallback(async (userId: string, notes?: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await patchJSON(`/admin/users/${userId}/deactivate`, { notes });
      
      if (response.success) {
        // Refresh users list
        await fetchUsers();
        return response;
      } else {
        throw new Error(response.error || 'Error al desactivar usuario');
      }
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Error al desactivar usuario';
      setError({ message: errorMessage });
      console.error('Error deactivating user:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  // Delete user
  const deleteUser = useCallback(async (userId: string, notes?: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await deleteJSON(`/admin/users/${userId}`, notes ? { notes } : undefined);
      
      if (response.success) {
        // Refresh users list
        await fetchUsers();
        return response;
      } else {
        throw new Error(response.error || 'Error al eliminar usuario');
      }
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar usuario';
      setError({ message: errorMessage });
      console.error('Error deleting user:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  // Manually activate user with Telegram verification
  const manuallyActivateUser = useCallback(async (userId: string, notes?: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await patchJSON(`/admin/users/${userId}/manual-activate`, { notes });
      
      if (response.success) {
        // Refresh users list
        await fetchUsers();
        return response;
      } else {
        throw new Error(response.error || 'Error al activar usuario manualmente');
      }
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Error al activar usuario manualmente';
      setError({ message: errorMessage });
      console.error('Error manually activating user:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  return {
    // State
    users,
    roles,
    loading,
    error,
    pagination,
    filters,
    
    // Actions
    fetchUsers,
    fetchRoles,
    assignUserRole,
    getUserRole,
    getUserDetails,
    updateUser,
    activateUser,
    deactivateUser,
    deleteUser,
    manuallyActivateUser,
    updateFilters,
    changePage,
    resetFilters
  };
};