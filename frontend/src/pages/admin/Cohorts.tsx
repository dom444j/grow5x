import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAdminCohorts, type Cohort, type CreateCohortData, type UpdateCohortData } from '../../hooks/useAdminCohorts';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import HealthIndicator from '../../components/ui/HealthIndicator';
import AdminLayout from '../../components/admin/AdminLayout';

// Modal para crear/editar cohorte
interface CohortModalProps {
  isOpen: boolean;
  onClose: () => void;
  cohort?: Cohort | null;
  onSubmit: (data: CreateCohortData | UpdateCohortData) => Promise<boolean>;
  isLoading: boolean;
}

const CohortModal: React.FC<CohortModalProps> = ({ isOpen, onClose, cohort, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    batchId: cohort?.batchId || '',
    name: cohort?.name || '',
    description: cohort?.description || '',
    featureFlags: {
      FEATURE_COHORT_PACKAGES: cohort?.featureFlags?.FEATURE_COHORT_PACKAGES ?? true,
      FEATURE_COHORT_WITHDRAWALS: cohort?.featureFlags?.FEATURE_COHORT_WITHDRAWALS ?? true
    },
    referralConfig: {
      directLevel1Percentage: cohort?.referralConfig?.directLevel1Percentage || 10,
      specialParentCodePercentage: cohort?.referralConfig?.specialParentCodePercentage || 10,
      specialParentCodeDelayDays: cohort?.referralConfig?.specialParentCodeDelayDays || 17
    },
    isActive: cohort?.isActive ?? true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = cohort 
      ? {
          name: formData.name,
          description: formData.description,
          featureFlags: formData.featureFlags,
          referralConfig: formData.referralConfig,
          isActive: formData.isActive
        }
      : formData;
    
    const success = await onSubmit(submitData);
    if (success) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {cohort ? 'Editar Cohorte' : 'Crear Nueva Cohorte'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Batch ID - solo en creación */}
          {!cohort && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Batch ID *
              </label>
              <input
                type="text"
                value={formData.batchId}
                onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ej: batch-2024-q1"
                pattern="^[a-zA-Z0-9_-]+$"
                title="Solo letras, números, guiones y guiones bajos"
                required
              />
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nombre descriptivo de la cohorte"
              maxLength={200}
              required
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Descripción opcional"
              maxLength={500}
              rows={3}
            />
          </div>

          {/* Feature Flags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Feature Flags
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.featureFlags.FEATURE_COHORT_PACKAGES}
                  onChange={(e) => setFormData({
                    ...formData,
                    featureFlags: {
                      ...formData.featureFlags,
                      FEATURE_COHORT_PACKAGES: e.target.checked
                    }
                  })}
                  className="mr-2"
                />
                <span className="text-sm">FEATURE_COHORT_PACKAGES</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.featureFlags.FEATURE_COHORT_WITHDRAWALS}
                  onChange={(e) => setFormData({
                    ...formData,
                    featureFlags: {
                      ...formData.featureFlags,
                      FEATURE_COHORT_WITHDRAWALS: e.target.checked
                    }
                  })}
                  className="mr-2"
                />
                <span className="text-sm">FEATURE_COHORT_WITHDRAWALS</span>
              </label>
            </div>
          </div>

          {/* Configuración de Referidos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Configuración de Referidos
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Nivel 1 Directo (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.referralConfig.directLevel1Percentage}
                  onChange={(e) => setFormData({
                    ...formData,
                    referralConfig: {
                      ...formData.referralConfig,
                      directLevel1Percentage: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Código Especial (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.referralConfig.specialParentCodePercentage}
                  onChange={(e) => setFormData({
                    ...formData,
                    referralConfig: {
                      ...formData.referralConfig,
                      specialParentCodePercentage: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Delay Días
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.referralConfig.specialParentCodeDelayDays}
                  onChange={(e) => setFormData({
                    ...formData,
                    referralConfig: {
                      ...formData.referralConfig,
                      specialParentCodeDelayDays: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Estado - solo en edición */}
          {cohort && (
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Cohorte Activa</span>
              </label>
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Guardando...' : (cohort ? 'Actualizar' : 'Crear')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Componente principal
const AdminCohorts: React.FC = () => {
  const {
    cohorts,
    loading,
    actionLoading,
    filters,
    pagination,
    createCohort,
    updateCohort,
    deleteCohort,
    changePage,
    updateFilters,
    clearFilters
  } = useAdminCohorts();

  const [selectedCohort, setSelectedCohort] = useState<Cohort | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateCohort = async (data: CreateCohortData) => {
    const success = await createCohort(data);
    return success;
  };

  const handleUpdateCohort = async (data: UpdateCohortData) => {
    if (!selectedCohort) return false;
    const success = await updateCohort(selectedCohort.batchId, data);
    return success;
  };

  const handleDeleteCohort = async (cohort: Cohort) => {
    if (window.confirm(`¿Estás seguro de que quieres desactivar la cohorte "${cohort.name}"?`)) {
      await deleteCohort(cohort.batchId);
    }
  };

  const openCreateModal = () => {
    setSelectedCohort(null);
    setIsCreating(true);
    setIsModalOpen(true);
  };

  const openEditModal = (cohort: Cohort) => {
    setSelectedCohort(cohort);
    setIsCreating(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedCohort(null);
    setIsCreating(false);
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

  return (
    <AdminLayout title="Cohortes">
      <Helmet>
        <title>Gestión de Cohortes - Admin | Grow5X</title>
      </Helmet>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Cohortes</h1>
          <p className="text-gray-600 mt-1">
            Administra las cohortes y sus feature flags
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          + Nueva Cohorte
        </button>
      </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-64">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => updateFilters({ search: e.target.value })}
                placeholder="Buscar por batch ID o nombre..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={filters.isActive === undefined ? '' : filters.isActive.toString()}
                onChange={(e) => {
                  const value = e.target.value;
                  updateFilters({ 
                    isActive: value === '' ? undefined : value === 'true' 
                  });
                }}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
            </div>
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Limpiar
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {loading ? (
            <div className="p-6">
              <SkeletonLoader rows={5} />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cohorte
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Feature Flags
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Referidos
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Creado
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {cohorts.map((cohort) => (
                      <tr key={cohort._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {cohort.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {cohort.batchId}
                            </div>
                            {cohort.description && (
                              <div className="text-xs text-gray-400 mt-1">
                                {cohort.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center text-xs">
                              <HealthIndicator 
                                status={cohort.featureFlags.FEATURE_COHORT_PACKAGES ? 'healthy' : 'error'} 
                                size="sm" 
                              />
                              <span className="ml-1">PACKAGES</span>
                            </div>
                            <div className="flex items-center text-xs">
                              <HealthIndicator 
                                status={cohort.featureFlags.FEATURE_COHORT_WITHDRAWALS ? 'healthy' : 'error'} 
                                size="sm" 
                              />
                              <span className="ml-1">WITHDRAWALS</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-gray-600 space-y-1">
                            <div>L1: {cohort.referralConfig.directLevel1Percentage}%</div>
                            <div>Especial: {cohort.referralConfig.specialParentCodePercentage}%</div>
                            <div>Delay: {cohort.referralConfig.specialParentCodeDelayDays}d</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <HealthIndicator 
                            status={cohort.isActive ? 'healthy' : 'error'}
                            label={cohort.isActive ? 'Activo' : 'Inactivo'}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600">
                            {formatDate(cohort.createdAt)}
                          </div>
                          <div className="text-xs text-gray-400">
                            por {cohort.createdBy.firstName} {cohort.createdBy.lastName}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => openEditModal(cohort)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Editar
                            </button>
                            {cohort.isActive && (
                              <button
                                onClick={() => handleDeleteCohort(cohort)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Desactivar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {pagination.pages > 1 && (
                <div className="px-6 py-3 border-t bg-gray-50 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                    {pagination.total} cohortes
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => changePage(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                      Anterior
                    </button>
                    <span className="px-3 py-1 text-sm">
                      Página {pagination.page} de {pagination.pages}
                    </span>
                    <button
                      onClick={() => changePage(pagination.page + 1)}
                      disabled={pagination.page === pagination.pages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      {/* Modal */}
      <CohortModal
        isOpen={isModalOpen}
        onClose={closeModal}
        cohort={isCreating ? null : selectedCohort}
        onSubmit={isCreating ? handleCreateCohort : handleUpdateCohort}
        isLoading={actionLoading}
      />
    </AdminLayout>
  );
};

export default AdminCohorts;