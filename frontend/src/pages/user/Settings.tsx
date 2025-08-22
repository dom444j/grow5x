import React, { useState } from 'react';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useMe } from '../../hooks/useMe';
import { useProfile } from '../../hooks/useProfile';
import { AlertCircle, CheckCircle, Save, Wallet, User, ArrowLeft, Settings as SettingsIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

const Settings: React.FC = () => {
  const { settings, loading, error, updateSettings } = useUserSettings();
  const { user, loading: userLoading, refetch } = useMe();
  const { updateProfile, loading: profileLoading } = useProfile();
  
  const [formData, setFormData] = useState({
    defaultWithdrawalAddress: '',
    network: 'BEP20'
  });
  
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    country: '',
    telegramUsername: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [profileSuccessMessage, setProfileSuccessMessage] = useState('');
  const [validationError, setValidationError] = useState('');
  const [profileValidationError, setProfileValidationError] = useState('');

  // Update form data when settings are loaded
  React.useEffect(() => {
    if (settings) {
      setFormData({
        defaultWithdrawalAddress: settings.defaultWithdrawalAddress || '',
        network: settings.network || 'BEP20'
      });
    }
  }, [settings]);

  // Update profile data when user is loaded
  React.useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        country: user.country || '',
        telegramUsername: user.telegramUsername || ''
      });
    }
  }, [user]);

  const validateBEP20Address = (address: string): boolean => {
    const bep20Regex = /^0x[a-fA-F0-9]{40}$/;
    return bep20Regex.test(address);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setValidationError('');
    setSuccessMessage('');
  };

  const handleProfileInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
    setProfileValidationError('');
    setProfileSuccessMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    setSuccessMessage('');

    // Validate BEP20 address if provided
    if (formData.defaultWithdrawalAddress && !validateBEP20Address(formData.defaultWithdrawalAddress)) {
      setValidationError('La dirección BEP20 debe tener el formato: 0x seguido de 40 caracteres hexadecimales');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const success = await updateSettings({
        defaultWithdrawalAddress: formData.defaultWithdrawalAddress || undefined
      });

      if (success) {
        setSuccessMessage('Configuración actualizada exitosamente');
      }
    } catch (err) {
      console.error('Error updating settings:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Profile form submitted!');
    setProfileValidationError('');
    setProfileSuccessMessage('');

    // Basic validation
    if (!profileData.firstName.trim() || !profileData.lastName.trim()) {
      setProfileValidationError('El nombre y apellido son obligatorios');
      return;
    }

    if (profileData.phone && !/^\+?[1-9]\d{1,14}$/.test(profileData.phone.replace(/\s/g, ''))) {
      setProfileValidationError('El número de teléfono no tiene un formato válido');
      return;
    }

    setIsSubmittingProfile(true);
    
    try {
      console.log('About to call updateProfile with:', {
        firstName: profileData.firstName.trim(),
        lastName: profileData.lastName.trim(),
        phone: profileData.phone.trim(),
        country: profileData.country.trim(),
        telegramUsername: profileData.telegramUsername.trim()
      });
      
      const success = await updateProfile({
        firstName: profileData.firstName.trim(),
        lastName: profileData.lastName.trim(),
        phone: profileData.phone.trim(),
        country: profileData.country.trim(),
        telegramUsername: profileData.telegramUsername.trim()
      });

      console.log('updateProfile result:', success);
      if (success) {
        setProfileSuccessMessage('Perfil actualizado exitosamente');
        await refetch(); // Refresh user data
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setProfileValidationError('Error al actualizar el perfil');
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  if (loading || userLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="bg-gradient-to-r from-white to-gray-50 rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <Link
                to="/user/dashboard"
                className="flex items-center gap-2 text-primary-600 hover:text-primary-700 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm font-medium">Volver al Dashboard</span>
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
                <SettingsIcon className="h-5 w-5 text-white" />
              </div>
              Configuración
            </h1>
            <p className="text-sm text-gray-600 mt-2 ml-13">
              Gestiona tu perfil y configuración de cuenta
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700">{(error as any)?.message || error || 'Error desconocido'}</span>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            <span className="text-green-700">{successMessage}</span>
          </div>
        )}

        {/* Profile Success Message */}
        {profileSuccessMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            <span className="text-green-700">{profileSuccessMessage}</span>
          </div>
        )}

        {/* Validation Error */}
        {validationError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700">{validationError}</span>
          </div>
        )}

        {/* Profile Validation Error */}
        {profileValidationError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700">{profileValidationError}</span>
          </div>
        )}

        {/* Profile Form */}
        <div className="bg-gradient-to-r from-white to-gray-50 rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="px-6 py-4 bg-gradient-to-r from-primary-500 to-primary-600">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <User className="h-5 w-5" />
              Información Personal
            </h2>
            <p className="text-sm text-primary-100 mt-1">
              Actualiza tu información personal y datos de contacto
            </p>
          </div>

          <form onSubmit={handleProfileSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* First Name */}
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={profileData.firstName}
                  onChange={handleProfileInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 bg-white hover:border-primary-300"
                  placeholder="Tu nombre"
                />
              </div>

              {/* Last Name */}
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                  Apellido *
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={profileData.lastName}
                  onChange={handleProfileInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 bg-white hover:border-primary-300"
                  placeholder="Tu apellido"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={profileData.phone}
                  onChange={handleProfileInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 bg-white hover:border-primary-300"
                  placeholder="+1234567890"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Incluye el código de país (ej: +57 para Colombia)
                </p>
              </div>

              {/* Country */}
              <div>
                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
                  País
                </label>
                <input
                  type="text"
                  id="country"
                  name="country"
                  value={profileData.country}
                  onChange={handleProfileInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 bg-white hover:border-primary-300"
                  placeholder="Tu país de residencia"
                />
              </div>
            </div>

            {/* Telegram Username */}
            <div>
              <label htmlFor="telegramUsername" className="block text-sm font-medium text-gray-700 mb-2">
                Usuario de Telegram
              </label>
              <input
                type="text"
                id="telegramUsername"
                name="telegramUsername"
                value={profileData.telegramUsername}
                onChange={handleProfileInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 bg-white hover:border-primary-300"
                placeholder="@tu_usuario_telegram"
              />
              <p className="text-xs text-gray-500 mt-1">
                Para recibir notificaciones y soporte directo
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmittingProfile || profileLoading}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {isSubmittingProfile ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Actualizar Perfil
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Settings Form */}
        <div className="bg-gradient-to-r from-white to-gray-50 rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-primary-500 to-primary-600">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Configuración de Retiros
            </h2>
            <p className="text-sm text-primary-100 mt-1">
              Configura tu dirección de retiro por defecto para agilizar futuras transacciones
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Network Selection */}
            <div>
              <label htmlFor="network" className="block text-sm font-medium text-gray-700 mb-2">
                Red de Blockchain
              </label>
              <select
                id="network"
                name="network"
                value={formData.network}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-gray-50 transition-all duration-200"
                disabled
              >
                <option value="BEP20">BEP20 (Binance Smart Chain)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Actualmente solo soportamos la red BEP20
              </p>
            </div>

            {/* Default Withdrawal Address */}
            <div>
              <label htmlFor="defaultWithdrawalAddress" className="block text-sm font-medium text-gray-700 mb-2">
                Dirección de Retiro por Defecto
              </label>
              <input
                type="text"
                id="defaultWithdrawalAddress"
                name="defaultWithdrawalAddress"
                value={formData.defaultWithdrawalAddress}
                onChange={handleInputChange}
                placeholder="0x1234567890123456789012345678901234567890"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 bg-white hover:border-primary-300"
              />
              <p className="text-xs text-gray-500 mt-1">
                Dirección BEP20 válida para USDT. Formato: 0x seguido de 40 caracteres hexadecimales
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-primary-800">
                  <p className="font-medium mb-1">Información importante:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Esta dirección se usará como valor por defecto en nuevos retiros</li>
                    <li>Puedes cambiarla en cualquier momento</li>
                    <li>Siempre podrás especificar una dirección diferente al hacer un retiro</li>
                    <li>Asegúrate de que la dirección sea correcta antes de guardar</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Guardar Configuración
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default Settings;