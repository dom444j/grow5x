import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { FiX, FiCreditCard, FiGlobe, FiTag, FiFileText } from 'react-icons/fi';
import useWallets from '../../hooks/useWallets';

const AddWalletModal = ({ isOpen, onClose }) => {
  const { createWallet } = useWallets();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    address: '',
    network: 'BEP20',
    currency: 'USDT',
    label: '',
    notes: ''
  });
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    // Validate address
    if (!formData.address.trim()) {
      newErrors.address = 'La dirección de wallet es requerida';
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(formData.address.trim())) {
      newErrors.address = 'La dirección debe ser una dirección Ethereum válida (0x...)';
    }

    // Validate network
    if (!formData.network) {
      newErrors.network = 'La red es requerida';
    }

    // Validate currency
    if (!formData.currency) {
      newErrors.currency = 'La moneda es requerida';
    }

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
      await createWallet({
        address: formData.address.trim(),
        network: formData.network,
        currency: formData.currency,
        label: formData.label.trim() || undefined,
        notes: formData.notes.trim() || undefined
      });
      
      // Reset form and close modal
      setFormData({
        address: '',
        network: 'BEP20',
        currency: 'USDT',
        label: '',
        notes: ''
      });
      setErrors({});
      onClose();
    } catch (error) {
      console.error('Error creating wallet:', error);
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
      setFormData({
        address: '',
        network: 'BEP20',
        currency: 'USDT',
        label: '',
        notes: ''
      });
      setErrors({});
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <FiCreditCard className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Añadir Nueva Wallet</h2>
              <p className="text-sm text-gray-600">Agregar una nueva wallet al pool de recaudo</p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FiCreditCard className="w-4 h-4 inline mr-2" />
              Dirección de Wallet *
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="0x1234567890abcdef1234567890abcdef12345678"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm ${
                errors.address ? 'border-red-300' : 'border-gray-300'
              }`}
              disabled={loading}
            />
            {errors.address && (
              <p className="mt-1 text-sm text-red-600">{errors.address}</p>
            )}
          </div>

          {/* Network */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FiGlobe className="w-4 h-4 inline mr-2" />
              Red *
            </label>
            <select
              value={formData.network}
              onChange={(e) => handleInputChange('network', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                errors.network ? 'border-red-300' : 'border-gray-300'
              }`}
              disabled={loading}
            >
              <option value="BEP20">BEP20 (Binance Smart Chain)</option>
              <option value="ERC20">ERC20 (Ethereum)</option>
              <option value="TRC20">TRC20 (Tron)</option>
            </select>
            {errors.network && (
              <p className="mt-1 text-sm text-red-600">{errors.network}</p>
            )}
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Moneda *
            </label>
            <select
              value={formData.currency}
              onChange={(e) => handleInputChange('currency', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                errors.currency ? 'border-red-300' : 'border-gray-300'
              }`}
              disabled={loading}
            >
              <option value="USDT">USDT</option>
              <option value="USDC">USDC</option>
              <option value="BUSD">BUSD</option>
            </select>
            {errors.currency && (
              <p className="mt-1 text-sm text-red-600">{errors.currency}</p>
            )}
          </div>

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FiTag className="w-4 h-4 inline mr-2" />
              Label (Opcional)
            </label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => handleInputChange('label', e.target.value)}
              placeholder="Ej: Wallet Principal, Backup 1, etc."
              maxLength={50}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
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
              Notas (Opcional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Notas adicionales sobre esta wallet..."
              rows={3}
              maxLength={500}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none ${
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

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              </div>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Información importante:</p>
                <ul className="space-y-1 text-blue-700">
                  <li>• La wallet será añadida al pool de rotación LRS</li>
                  <li>• Asegúrate de que la dirección sea correcta</li>
                  <li>• La wallet estará disponible inmediatamente</li>
                  <li>• Puedes editarla o suspenderla después</li>
                </ul>
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
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creando...
                </>
              ) : (
                <>
                  <FiCreditCard className="w-4 h-4" />
                  Crear Wallet
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddWalletModal;