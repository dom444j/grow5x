import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const useWallets = () => {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    network: 'BEP20'
  });

  // Get auth token from localStorage
  const getAuthToken = () => {
    try {
      const sessionData = localStorage.getItem('g5.session');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        return session.token;
      }
    } catch (error) {
      console.warn('Error parsing session data:', error);
    }
    return null;
  };

  // Fetch wallets with pagination and filters
  const fetchWallets = useCallback(async (page = 1, customFilters = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...filters,
        ...customFilters
      });

      // Remove empty values
      for (const [key, value] of queryParams.entries()) {
        if (!value || value === 'all') {
          queryParams.delete(key);
        }
      }

      const response = await fetch(`${API_BASE}/admin/wallets?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al obtener wallets');
      }

      const data = await response.json();
      
      if (data.success) {
        setWallets(data.data);
        setPagination(data.pagination);
      } else {
        throw new Error(data.error || 'Error al obtener wallets');
      }
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, filters]);

  // Create new wallet
  const createWallet = async (walletData) => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_BASE}/admin/wallets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(walletData)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al crear wallet');
      }

      if (data.success) {
        toast.success(data.message || 'Wallet creada exitosamente');
        // Refresh wallets list
        await fetchWallets(pagination.page);
        return data.data;
      } else {
        throw new Error(data.error || 'Error al crear wallet');
      }
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  // Update wallet
  const updateWallet = async (walletId, updateData) => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_BASE}/admin/wallets/${walletId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al actualizar wallet');
      }

      if (data.success) {
        toast.success(data.message || 'Wallet actualizada exitosamente');
        // Refresh wallets list
        await fetchWallets(pagination.page);
        return data.data;
      } else {
        throw new Error(data.error || 'Error al actualizar wallet');
      }
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  // Delete wallet
  const deleteWallet = async (walletId) => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_BASE}/admin/wallets/${walletId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al eliminar wallet');
      }

      if (data.success) {
        toast.success(data.message || 'Wallet eliminada exitosamente');
        // Refresh wallets list
        await fetchWallets(pagination.page);
        return true;
      } else {
        throw new Error(data.error || 'Error al eliminar wallet');
      }
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  // Suspend wallet
  const suspendWallet = async (walletId, reason = '') => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_BASE}/admin/wallets/${walletId}/suspend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al suspender wallet');
      }

      if (data.success) {
        toast.success(data.message || 'Wallet suspendida exitosamente');
        // Refresh wallets list
        await fetchWallets(pagination.page);
        return true;
      } else {
        throw new Error(data.error || 'Error al suspender wallet');
      }
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  // Activate wallet
  const activateWallet = async (walletId) => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_BASE}/admin/wallets/${walletId}/activate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al activar wallet');
      }

      if (data.success) {
        toast.success(data.message || 'Wallet activada exitosamente');
        // Refresh wallets list
        await fetchWallets(pagination.page);
        return true;
      } else {
        throw new Error(data.error || 'Error al activar wallet');
      }
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  // Get wallet transactions
  const getWalletTransactions = async (walletId, page = 1, limit = 20) => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_BASE}/admin/wallets/${walletId}/transactions?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener transacciones');
      }

      if (data.success) {
        return data;
      } else {
        throw new Error(data.error || 'Error al obtener transacciones');
      }
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  // Update filters
  const updateFilters = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  // Change page
  const changePage = (newPage) => {
    fetchWallets(newPage);
  };

  // Initial load
  useEffect(() => {
    fetchWallets(1);
  }, []);

  // Refetch when filters change
  useEffect(() => {
    fetchWallets(1);
  }, [filters]);

  return {
    wallets,
    loading,
    error,
    pagination,
    filters,
    fetchWallets,
    createWallet,
    updateWallet,
    deleteWallet,
    suspendWallet,
    activateWallet,
    getWalletTransactions,
    updateFilters,
    changePage
  };
};

export default useWallets;