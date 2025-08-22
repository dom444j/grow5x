import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { FiX, FiEdit3, FiTag, FiFileText, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
import useWallets from '../../hooks/useWallets';

const EditWalletModal = ({ isOpen, onClose, wallet }) => {
  const { updateWallet } = useWallets();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    label: '',
    notes: '',
    isActive: true,
    status: 'available'
  });
  const [errors, setErrors] = useState({});

  // Initialize form data when wallet changes
  useEffect(() => {
    if (wallet) {
      setFormData({
        label: wallet.label || '',
        notes: wallet.notes || '',
        isActive: wallet.isActive,
        status: wallet.status
      });
    }
  }, [wallet]);

  const validateForm = () => {
    const newErrors = {};

    // Validate label length
    if (formData.label && formData.label.length > 50) {
      newErrors.label = 'El label no puede exceder 50 caracteres';
    }

    // Validate notes length
    if (formData.notes && formData.notes.length > 500) {
      newErrors.notes = 'Las notas no pueden exceder 500 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const updateData = {
        label: formData.label.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        isActive: formData.isActive,
        status: formData.status
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      await updateWallet(wallet.id, updateData);
      onClose();
    } catch (error) {
      console.error('Error updating wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleClose = () => {
    if (!loading) {
      setErrors({});
      onClose();
    }
  };

  if (!isOpen || !wallet) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'text-green-600';
      case 'disabled': return 'text-red-600';
      case 'assigned': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'available': return 'Disponible';
      case 'disabled': return 'Deshabilitada';
      case 'assigned': return 'Asignada';
      default: return status;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FiEdit3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Editar Wallet</h2>
              <p className="text-sm text-gray-600 font-mono">
                {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors disabled:opacity-50"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Wallet Info */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Red:</span>
              <span className="ml-2 font-medium">{wallet.network}</span>
            </div>
            <div>
              <span className="text-gray-500">Moneda:</span>
              <span className="ml-2 font-medium">{wallet.currency}</span>
            </div>
            <div>
              <span className="text-gray-500">Estado:</span>
              <span className={`ml-2 font-medium ${getStatusColor(wallet.status)}`}>
                {getStatusLabel(wallet.status)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Creada:</span>
              <span className="ml-2 font-medium">
                {new Date(wallet.createdAt).toLocaleDateString('es-ES')}
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FiTag className="w-4 h-4 inline mr-2" />
              Label
            </label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => handleInputChange('label', e.target.value)}
              placeholder="Ej: Wallet Principal, Backup 1, etc."
              maxLength={50}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.label ? 'border-red-300' : 'border-gray-300'
              }`}
              disabled={loading}
            />
            <div className="flex justify-between mt-1">
              {errors.label && (
                <p className="text-sm text-red-600">{errors.label}</p>
              )}
              <p className="text-xs text-gray-500 ml-auto">
                {formData.label.length}/50
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FiFileText className="w-4 h-4 inline mr-2" />
              Notas
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Notas adicionales sobre esta wallet..."
              rows={3}
              maxLength={500}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                errors.notes ? 'border-red-300' : 'border-gray-300'
              }`}
              disabled={loading}
            />
            <div className="flex justify-between mt-1">
              {errors.notes && (
                <p className="text-sm text-red-600">{errors.notes}</p>
              )}
              <p className="text-xs text-gray-500 ml-auto">
                {formData.notes.length}/500
              </p>
            </div>
          </div>

          {/* Status */}
          {wallet.status !== 'assigned' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              >
                <option value="available">Disponible</option>
                <option value="disabled">Deshabilitada</option>
              </select>
            </div>
          )}

          {/* Active Toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <label className="text-sm font-medium text-gray-700">Wallet Activa</label>
              <p className="text-xs text-gray-500">Determina si la wallet puede ser usada en el pool</p>
            </div>
            <button
              type="button"
              onClick={() => handleInputChange('isActive', !formData.isActive)}
              disabled={loading || wallet.status === 'LOCKED'}
              className={`flex items-center gap-2 px-3 py-1 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                formData.isActive
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {formData.isActive ? (
                <>
                  <FiToggleRight className="w-5 h-5" />
                  <span className="text-sm font-medium">Activa</span>
                </>
              ) : (
                <>
                  <FiToggleLeft className="w-5 h-5" />
                  <span className="text-sm font-medium">Inactiva</span>
                </>
              )}
            </button>
          </div>

          {/* Warning for locked wallet */}
          {wallet.status === 'LOCKED' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 bg-yellow-600 rounded-full"></div>
                </div>
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">Wallet Bloqueada</p>
                  <p className="text-yellow-700">
                    Esta wallet está actualmente bloqueada para una transacción. Solo puedes editar el label y las notas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Statistics */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-3">Estadísticas</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-600">Total Recibido:</span>
                <div className="font-medium text-blue-900">
                  ${(wallet.totalReceived || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <span className="text-blue-600">Veces Asignada:</span>
                <div className="font-medium text-blue-900">{wallet.totalAssigned || 0}</div>
              </div>
              <div>
                <span className="text-blue-600">Tx Exitosas:</span>
                <div className="font-medium text-green-600">{wallet.successfulTransactions || 0}</div>
              </div>
              <div>
                <span className="text-blue-600">Tx Fallidas:</span>
                <div className="font-medium text-red-600">{wallet.failedTransactions || 0}</div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <FiEdit3 className="w-4 h-4" />
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditWalletModal;