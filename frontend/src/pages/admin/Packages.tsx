import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
  Plus,
  Edit,
  Trash2,
  Package,
  DollarSign,
  Clock,
  Users,
  Star,
  Search,
  Filter,
  UserPlus,
  Send,
  RefreshCw
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { apiClient } from '../../api/client';

interface PackageData {
  _id: string;
  name: string;
  price: number;
  currency: string;
  description: string;
  withdrawalSlaTargetMinutes: number;
  icon: string;
  popular?: boolean;
  isActive: boolean;
  isVisible: boolean;
  totalSold: number;
  totalRevenue: number;
  features: string[];
  createdAt: string;
  updatedAt: string;
}

interface User {
  _id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

const AdminPackages: React.FC = () => {
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInjectModal, setShowInjectModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PackageData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [injectionNotes, setInjectionNotes] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<number | null>(null);

  // Form state for package creation/editing
  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    currency: 'USDT',
    description: '',
    withdrawalSlaTargetMinutes: 1440,
    icon: '💎',
    popular: false,
    isActive: true,
    isVisible: true,
    features: ['Herramienta autónoma de arbitraje', 'Cashback 100% primera semana', 'Beneficios diarios 12.5%', 'Comisiones de referidos 10%']
  });

  useEffect(() => {
    fetchPackages();
    fetchUsers();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    const fetchData = async () => {
      await fetchPackages();
      setLastUpdated(new Date());
    };

    // Initial fetch
    fetchData();

    // Setup auto-refresh
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchData, 60000); // 60 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/packages');
      setPackages(response.data.packages || []);
    } catch (error) {
      console.error('Error fetching packages:', error);
      toast.error('Error al cargar paquetes');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await apiClient.get('/admin/users?limit=1000');
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/admin/packages', formData);
      toast.success('Paquete creado exitosamente');
      setShowCreateModal(false);
      resetForm();
      fetchPackages();
    } catch (error: any) {
      console.error('Error creating package:', error);
      toast.error(error.response?.data?.message || 'Error al crear paquete');
    }
  };

  const handleEditPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage) return;
    
    try {
      await apiClient.put(`/admin/packages/${selectedPackage._id}`, formData);
      toast.success('Paquete actualizado exitosamente');
      setShowEditModal(false);
      setSelectedPackage(null);
      resetForm();
      fetchPackages();
    } catch (error: any) {
      console.error('Error updating package:', error);
      toast.error(error.response?.data?.message || 'Error al actualizar paquete');
    }
  };

  const handleDeletePackage = async (packageId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este paquete?')) return;
    
    try {
      await apiClient.delete(`/admin/packages/${packageId}`);
      toast.success('Paquete eliminado exitosamente');
      fetchPackages();
    } catch (error: any) {
      console.error('Error deleting package:', error);
      toast.error(error.response?.data?.message || 'Error al eliminar paquete');
    }
  };

  const handleInjectPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage || !selectedUser) return;
    
    try {
      await apiClient.post('/admin/inject-package', {
        userId: selectedUser._id,
        packageId: selectedPackage._id,
        notes: injectionNotes
      });
      toast.success(`Paquete ${selectedPackage.name} inyectado a ${selectedUser.firstName} ${selectedUser.lastName}`);
      setShowInjectModal(false);
      setSelectedPackage(null);
      setSelectedUser(null);
      setInjectionNotes('');
    } catch (error: any) {
      console.error('Error injecting package:', error);
      toast.error(error.response?.data?.message || 'Error al inyectar paquete');
    }
  };

  const openEditModal = (pkg: PackageData) => {
    setSelectedPackage(pkg);
    setFormData({
      name: pkg.name,
      price: pkg.price,
      currency: pkg.currency,
      description: pkg.description,
      withdrawalSlaTargetMinutes: pkg.withdrawalSlaTargetMinutes,
      icon: pkg.icon,
      popular: pkg.popular || false,
      isActive: pkg.isActive,
      isVisible: pkg.isVisible,
      features: pkg.features
    });
    setShowEditModal(true);
  };

  const openInjectModal = (pkg: PackageData) => {
    setSelectedPackage(pkg);
    setShowInjectModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      price: 0,
      currency: 'USDT',
      description: '',
      withdrawalSlaTargetMinutes: 1440,
      icon: '💎',
      popular: false,
      isActive: true,
      isVisible: true,
      features: ['Herramienta autónoma de arbitraje', 'Cashback 100% primera semana', 'Beneficios diarios 12.5%', 'Comisiones de referidos 10%']
    });
  };

  const formatSlaTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} h`;
    return `${Math.floor(minutes / 1440)} días`;
  };

  const filteredPackages = packages.filter(pkg =>
    pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pkg.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = users.filter(user =>
    user.firstName.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.lastName.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.userId.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <AdminLayout title="Gestión de Paquetes">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando paquetes...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Gestión de Paquetes">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestión de Paquetes</h1>
              <p className="text-gray-600">Administra las licencias y paquetes del sistema</p>
              {lastUpdated && (
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span>Última actualización: {lastUpdated.toLocaleTimeString()}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Auto-actualizar
              </label>
              <button
                onClick={() => {
                  fetchPackages();
                  setLastUpdated(new Date());
                }}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 rounded-lg transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Crear Paquete
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar paquetes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Packages Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredPackages.map((pkg) => (
            <div key={pkg._id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{pkg.icon}</div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{pkg.name}</h3>
                    {pkg.popular && (
                      <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                        <Star className="w-3 h-3" />
                        Popular
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(pkg)}
                    className="text-blue-600 hover:text-blue-800 p-1"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openInjectModal(pkg)}
                    className="text-green-600 hover:text-green-800 p-1"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeletePackage(pkg._id)}
                    className="text-red-600 hover:text-red-800 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-gray-600 text-sm mb-4">{pkg.description}</p>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Precio:</span>
                  <span className="font-semibold">${pkg.price} {pkg.currency}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">SLA Retiro:</span>
                  <span className="text-sm">{formatSlaTime(pkg.withdrawalSlaTargetMinutes)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Vendidos:</span>
                  <span className="text-sm">{pkg.totalSold}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Ingresos:</span>
                  <span className="text-sm">${pkg.totalRevenue}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  pkg.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {pkg.isActive ? 'Activo' : 'Inactivo'}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  pkg.isVisible ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {pkg.isVisible ? 'Visible' : 'Oculto'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {filteredPackages.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No se encontraron paquetes</p>
          </div>
        )}
      </div>

      {/* Create Package Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Crear Nuevo Paquete</h2>
            <form onSubmit={handleCreatePackage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SLA Retiro (minutos)</label>
                <select
                  value={formData.withdrawalSlaTargetMinutes}
                  onChange={(e) => setFormData({...formData, withdrawalSlaTargetMinutes: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value={15}>15 minutos</option>
                  <option value={30}>30 minutos</option>
                  <option value={60}>1 hora</option>
                  <option value={180}>3 horas</option>
                  <option value={360}>6 horas</option>
                  <option value={720}>12 horas</option>
                  <option value={1440}>24 horas</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icono</label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({...formData, icon: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="💎"
                />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.popular}
                    onChange={(e) => setFormData({...formData, popular: e.target.checked})}
                    className="mr-2"
                  />
                  Popular
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                    className="mr-2"
                  />
                  Activo
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isVisible}
                    onChange={(e) => setFormData({...formData, isVisible: e.target.checked})}
                    className="mr-2"
                  />
                  Visible
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Package Modal */}
      {showEditModal && selectedPackage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Editar Paquete</h2>
            <form onSubmit={handleEditPackage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SLA Retiro (minutos)</label>
                <select
                  value={formData.withdrawalSlaTargetMinutes}
                  onChange={(e) => setFormData({...formData, withdrawalSlaTargetMinutes: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value={15}>15 minutos</option>
                  <option value={30}>30 minutos</option>
                  <option value={60}>1 hora</option>
                  <option value={180}>3 horas</option>
                  <option value={360}>6 horas</option>
                  <option value={720}>12 horas</option>
                  <option value={1440}>24 horas</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icono</label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({...formData, icon: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="💎"
                />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.popular}
                    onChange={(e) => setFormData({...formData, popular: e.target.checked})}
                    className="mr-2"
                  />
                  Popular
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                    className="mr-2"
                  />
                  Activo
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isVisible}
                    onChange={(e) => setFormData({...formData, isVisible: e.target.checked})}
                    className="mr-2"
                  />
                  Visible
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedPackage(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Actualizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inject Package Modal */}
      {showInjectModal && selectedPackage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Inyectar Paquete: {selectedPackage.name}</h2>
            <form onSubmit={handleInjectPackage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Usuario</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, email o ID..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              
              {userSearchTerm && (
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                  {filteredUsers.slice(0, 10).map((user) => (
                    <div
                      key={user._id}
                      onClick={() => {
                        setSelectedUser(user);
                        setUserSearchTerm('');
                      }}
                      className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium">{user.firstName} {user.lastName}</div>
                      <div className="text-sm text-gray-600">{user.email}</div>
                      <div className="text-xs text-gray-500">ID: {user.userId}</div>
                    </div>
                  ))}
                </div>
              )}
              
              {selectedUser && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="font-medium">Usuario Seleccionado:</div>
                  <div>{selectedUser.firstName} {selectedUser.lastName}</div>
                  <div className="text-sm text-gray-600">{selectedUser.email}</div>
                  <div className="text-xs text-gray-500">ID: {selectedUser.userId}</div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea
                  value={injectionNotes}
                  onChange={(e) => setInjectionNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  placeholder="Motivo de la inyección, observaciones, etc."
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowInjectModal(false);
                    setSelectedPackage(null);
                    setSelectedUser(null);
                    setInjectionNotes('');
                    setUserSearchTerm('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!selectedUser}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Inyectar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminPackages;