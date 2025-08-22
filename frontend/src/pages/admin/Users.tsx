import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAdminUsers, AdminUser, UserFilters, AssignRoleData } from '../../hooks/useAdminUsers';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import HealthIndicator from '../../components/ui/HealthIndicator';
import AdminLayout from '../../components/admin/AdminLayout';
import { UserPlus, Search, Filter, MoreVertical, Shield, Eye, Edit, Trash2, UserCheck, UserX, AlertTriangle, RefreshCw, Clock } from 'lucide-react';
import { apiUtils } from '../../services/api';

// Component for role assignment modal
interface RoleAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  user: AdminUser | null;
  roles: Array<{ name: string; displayName: string }>;
  onAssignRole: (roleData: AssignRoleData) => Promise<void>;
  loading: boolean;
}

const RoleAssignmentModal: React.FC<RoleAssignmentModalProps> = ({
  open,
  onClose,
  user,
  roles,
  onAssignRole,
  loading
}) => {
  const [selectedRole, setSelectedRole] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedRole) return;

    await onAssignRole({
      role: selectedRole as 'user' | 'admin' | 'support' | 'padre'
    });
    
    setSelectedRole('');
    setReason('');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">
          Asignar Rol a {user?.email}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Seleccionar rol...</option>
              {roles.map((role) => (
                <option key={role.name} value={role.name}>
                  {role.displayName}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Razón (opcional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Razón para la asignación del rol..."
            />
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={loading || !selectedRole}
            >
              {loading ? 'Asignando...' : 'Asignar Rol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AdminUsers: React.FC = () => {
  const {
    users,
    roles,
    loading,
    error,
    pagination,
    filters,
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
  } = useAdminUsers();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [assignRoleLoading, setAssignRoleLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    country: '',
    telegramUsername: ''
  });
  const [deleteNotes, setDeleteNotes] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    setLastUpdated(new Date());

    // Configurar actualización automática cada 60 segundos
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        fetchUsers();
        setLastUpdated(new Date());
      }, 60000);
    }

    // Limpiar intervalo al desmontar
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh]);



  const handleAssignRole = async (roleData: AssignRoleData) => {
    if (!selectedUser) return;
    
    setAssignRoleLoading(true);
    try {
      await assignUserRole(selectedUser._id, roleData);
      await fetchUsers(); // Refresh the users list
      setModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error assigning role:', error);
    } finally {
      setAssignRoleLoading(false);
    }
  };

  const handleViewDetails = async (user: AdminUser) => {
    try {
      setActionLoading(true);
      const details = await getUserDetails(user._id);
      setSelectedUser(user);
      setUserDetails(details);
      setShowUserDetails(true);
    } catch (error) {
      console.error('Error fetching user details:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditUser = (user: AdminUser) => {
    setSelectedUser(user);
    setEditFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || '',
      country: user.country || '',
      telegramUsername: user.telegramUsername || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    
    try {
      setActionLoading(true);
      await updateUser(selectedUser._id, editFormData);
      setShowEditModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error updating user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivateUser = async (user: AdminUser) => {
    try {
      setActionLoading(true);
      await activateUser(user._id);
    } catch (error) {
      console.error('Error activating user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleManuallyActivateUser = async (user: AdminUser) => {
    try {
      setActionLoading(true);
      await manuallyActivateUser(user._id, 'Activación manual por administrador');
    } catch (error) {
      console.error('Error manually activating user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivateUser = async (user: AdminUser) => {
    try {
      setActionLoading(true);
      await deactivateUser(user._id);
    } catch (error) {
      console.error('Error deactivating user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = (user: AdminUser) => {
    console.log('handleDeleteUser called with user:', user);
    try {
      setSelectedUser(user);
      setDeleteNotes('');
      setShowDeleteModal(true);
      console.log('Delete modal should be shown now');
    } catch (error) {
      console.error('Error in handleDeleteUser:', error);
    }
  };

  const confirmDeleteUser = async () => {
    console.log('confirmDeleteUser called with selectedUser:', selectedUser);
    if (!selectedUser) {
      console.error('No selected user for deletion');
      return;
    }
    
    try {
      setActionLoading(true);
      console.log('Calling deleteUser API with ID:', selectedUser._id, 'and notes:', deleteNotes);
      
      const result = await deleteUser(selectedUser._id, deleteNotes);
      console.log('Delete user result:', result);
      
      setShowDeleteModal(false);
      setSelectedUser(null);
      setDeleteNotes('');
      
      // Show success message
      alert('Usuario eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error al eliminar usuario: ' + (error?.message || 'Error desconocido'));
    } finally {
      setActionLoading(false);
    }
  };

  const openRoleModal = (user: AdminUser) => {
    setSelectedUser(user);
    setModalOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (user: AdminUser) => {
    if (!user.isActive) {
      return <span className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded-full">Inactivo</span>;
    }
    if (!user.isEmailVerified) {
      return <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full">No Verificado</span>;
    }
    return <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">Activo</span>;
  };

  return (
    <AdminLayout title="Usuarios">
      <Helmet>
        <title>Gestión de Usuarios - Admin | Grow5x</title>
      </Helmet>

      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Gestión de Usuarios</h1>
            <p className="text-gray-600">Administra usuarios y asigna roles del sistema</p>
            {lastUpdated && (
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Última actualización: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-actualizar
            </label>
            <button
              onClick={() => {
                fetchUsers();
                setLastUpdated(new Date());
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Búsqueda
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
              placeholder="Email, nombre, ID..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol
            </label>
            <select
              value={filters.role || ''}
              onChange={(e) => updateFilters({ role: e.target.value as 'user' | 'admin' | 'support' | 'padre' | '' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los roles</option>
              {roles.map((role) => (
                <option key={role.name} value={role.name}>
                  {role.displayName}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              value={filters.isActive !== undefined ? filters.isActive.toString() : ''}
              onChange={(e) => updateFilters({ 
                isActive: e.target.value === '' ? undefined : e.target.value === 'true' 
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Verificado
            </label>
            <select
              value={filters.isEmailVerified !== undefined ? filters.isEmailVerified.toString() : ''}
              onChange={(e) => updateFilters({ 
                isEmailVerified: e.target.value === '' ? undefined : e.target.value === 'true' 
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="true">Verificados</option>
              <option value="false">No Verificados</option>
            </select>
          </div>
        </div>
        
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={resetFilters}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Limpiar Filtros
          </button>
          <button
            onClick={() => fetchUsers()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {(error as any)?.message || error || 'Error desconocido'}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Usuarios ({pagination.total})</h2>
        </div>
        
        {loading ? (
          <div className="p-6">
            <SkeletonLoader rows={5} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Telegram
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Último Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registro
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users && users.length > 0 ? users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        {user.telegramUsername && (
                          <div className="text-xs text-blue-600">@{user.telegramUsername}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(user)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        {user.telegramVerified ? (
                          <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                            ✓ Verificado
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full">
                            ⏳ Pendiente
                          </span>
                        )}
                        {user.telegramUsername && (
                          <span className="text-xs text-gray-500">@{user.telegramUsername}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                        {user.role || 'user'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.lastLogin ? formatDate(user.lastLogin) : 'Nunca'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex space-x-2 justify-end">
                        {/* Ver detalles */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleViewDetails(user);
                          }}
                          className="text-blue-600 hover:text-blue-900 text-xs px-2 py-1 border border-blue-300 rounded transition-colors"
                          title="Ver detalles"
                        >
                          Ver
                        </button>
                        
                        {/* Editar usuario */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleEditUser(user);
                          }}
                          className="text-green-600 hover:text-green-900 text-xs px-2 py-1 border border-green-300 rounded transition-colors"
                          title="Editar usuario"
                        >
                          Editar
                        </button>
                        
                        {/* Cambiar rol */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openRoleModal(user);
                          }}
                          className="text-purple-600 hover:text-purple-900 text-xs px-2 py-1 border border-purple-300 rounded transition-colors"
                          title="Cambiar rol"
                        >
                          Rol
                        </button>
                        
                        {/* Activar/Desactivar usuario */}
                        {user.isActive ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeactivateUser(user);
                            }}
                            className="text-orange-600 hover:text-orange-900 text-xs px-2 py-1 border border-orange-300 rounded transition-colors"
                            title="Desactivar usuario"
                          >
                            Desact
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleActivateUser(user);
                              }}
                              className="text-green-600 hover:text-green-900 text-xs px-2 py-1 border border-green-300 rounded transition-colors"
                              title="Activar usuario"
                            >
                              Activ
                            </button>
                            {!user.telegramVerified && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleManuallyActivateUser(user);
                                }}
                                className="text-blue-600 hover:text-blue-900 text-xs px-2 py-1 border border-blue-300 rounded transition-colors"
                                title="Activar manualmente con verificación de Telegram"
                              >
                                Manual
                              </button>
                            )}
                          </>
                        )}
                        
                        {/* Eliminar usuario */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Delete button clicked for user:', user._id);
                            handleDeleteUser(user);
                          }}
                          className="text-red-600 hover:text-red-900 text-xs px-2 py-1 border border-red-300 rounded transition-colors hover:bg-red-50"
                          title="Eliminar usuario"
                        >
                          Elim
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      {loading ? 'Cargando usuarios...' : 'No hay usuarios disponibles'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Mostrando {((pagination.page - 1) * pagination.limit) + 1} a {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} usuarios
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => changePage(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter(page => 
                  page === 1 || 
                  page === pagination.totalPages || 
                  Math.abs(page - pagination.page) <= 2
                )
                .map((page, index, array) => {
                  const showEllipsis = index > 0 && array[index - 1] < page - 1;
                  return (
                    <React.Fragment key={page}>
                      {showEllipsis && <span className="px-2 py-1 text-sm text-gray-500">...</span>}
                      <button
                        onClick={() => changePage(page)}
                        className={`px-3 py-1 text-sm border rounded-md ${
                          page === pagination.page
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                })
              }
              
              <button
                onClick={() => changePage(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Role Assignment Modal */}
      <RoleAssignmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        user={selectedUser}
        roles={roles}
        onAssignRole={handleAssignRole}
        loading={assignRoleLoading}
      />

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Editar Usuario: {selectedUser.firstName} {selectedUser.lastName}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={editFormData.firstName}
                  onChange={(e) => setEditFormData({...editFormData, firstName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apellido
                </label>
                <input
                  type="text"
                  value={editFormData.lastName}
                  onChange={(e) => setEditFormData({...editFormData, lastName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="text"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  País
                </label>
                <input
                  type="text"
                  value={editFormData.country}
                  onChange={(e) => setEditFormData({...editFormData, country: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Usuario de Telegram
                </label>
                <input
                  type="text"
                  value={editFormData.telegramUsername}
                  onChange={(e) => setEditFormData({...editFormData, telegramUsername: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                disabled={actionLoading}
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateUser}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
              >
                {actionLoading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {showUserDetails && userDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Detalles del Usuario
              </h3>
              <button
                onClick={() => setShowUserDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">ID de Usuario</label>
                  <p className="text-sm text-gray-900">{userDetails.userId}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <p className="text-sm text-gray-900">{userDetails.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                  <p className="text-sm text-gray-900">{userDetails.firstName} {userDetails.lastName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                  <p className="text-sm text-gray-900">{userDetails.phone || 'No especificado'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">País</label>
                  <p className="text-sm text-gray-900">{userDetails.country || 'No especificado'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Rol</label>
                  <p className="text-sm text-gray-900">{userDetails.role}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Estado</label>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    userDetails.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {userDetails.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email Verificado</label>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    userDetails.isEmailVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {userDetails.isEmailVerified ? 'Verificado' : 'No Verificado'}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Balances</label>
                <div className="grid grid-cols-3 gap-4 bg-gray-50 p-3 rounded-md">
                  <div>
                    <p className="text-xs text-gray-500">Disponible</p>
                    <p className="text-sm font-medium">{apiUtils.formatCurrency(userDetails.balances?.available || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Pendiente</p>
                    <p className="text-sm font-medium">{apiUtils.formatCurrency(userDetails.balances?.pending || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-sm font-medium">{apiUtils.formatCurrency(userDetails.balances?.total || 0)}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estadísticas de Referidos</label>
                <div className="grid grid-cols-3 gap-4 bg-gray-50 p-3 rounded-md">
                  <div>
                    <p className="text-xs text-gray-500">Total Referidos</p>
                    <p className="text-sm font-medium">{userDetails.referralStats?.totalReferrals || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Referidos Activos</p>
                    <p className="text-sm font-medium">{userDetails.referralStats?.activeReferrals || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Comisiones Totales</p>
                    <p className="text-sm font-medium">{apiUtils.formatCurrency(userDetails.referralStats?.totalCommissions || 0)}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fecha de Registro</label>
                  <p className="text-sm text-gray-900">{formatDate(userDetails.createdAt)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Último Login</label>
                  <p className="text-sm text-gray-900">{userDetails.lastLogin ? formatDate(userDetails.lastLogin) : 'Nunca'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {/* Modal de Confirmación de Eliminación */}
      {showDeleteModal && selectedUser && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) {
              setShowDeleteModal(false);
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600 mr-2 flex-shrink-0" />
              <h3 className="text-lg font-medium text-gray-900">
                Confirmar Eliminación
              </h3>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                ¿Estás seguro de que deseas eliminar al usuario:
              </p>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="font-medium text-gray-900">
                  {selectedUser.firstName} {selectedUser.lastName}
                </p>
                <p className="text-sm text-gray-600">
                  {selectedUser.email}
                </p>
                <p className="text-sm text-gray-600">
                  ID: {selectedUser._id}
                </p>
              </div>
              <p className="text-sm text-red-600 mt-2 font-medium">
                Esta acción desactivará la cuenta y no se puede deshacer.
              </p>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas de eliminación (opcional)
              </label>
              <textarea
                value={deleteNotes}
                onChange={(e) => setDeleteNotes(e.target.value)}
                placeholder="Especifica la razón de la eliminación..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                rows={3}
                disabled={actionLoading}
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  console.log('Cancel button clicked');
                  setShowDeleteModal(false);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                disabled={actionLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  console.log('Confirm delete button clicked');
                  confirmDeleteUser();
                }}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50 transition-colors"
              >
                {actionLoading ? (
                  <>
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                    Eliminando...
                  </>
                ) : (
                  'Eliminar Usuario'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminUsers;