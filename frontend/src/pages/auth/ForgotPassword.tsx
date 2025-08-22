import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

interface ForgotPasswordFormData {
  email: string;
}

interface ResetPasswordFormData {
  code: string;
  newPassword: string;
  confirmPassword: string;
}

interface FormErrors {
  email?: string;
  code?: string;
  newPassword?: string;
  confirmPassword?: string;
}

interface ForgotPasswordApiResponse {
  data: {
    success: boolean;
    message?: string;
    data?: {
      token: string;
    };
    code?: string;
  };
}

interface ResetPasswordApiResponse {
  data: {
    success: boolean;
    message?: string;
    data?: any;
    code?: string;
    attemptsLeft?: number;
  };
}

interface ApiErrorResponse {
  message?: string;
  code?: string;
  attemptsLeft?: number;
}

interface ApiError extends Error {
  response?: {
    data?: ApiErrorResponse;
  };
}

export default function ForgotPassword() {
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [attemptsLeft, setAttemptsLeft] = useState<number>(3);
  const navigate = useNavigate();

  const [forgotData, setForgotData] = useState<ForgotPasswordFormData>({
    email: ''
  });

  const [resetData, setResetData] = useState<ResetPasswordFormData>({
    code: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const handleForgotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForgotData({
      ...forgotData,
      [e.target.name]: e.target.value
    });
  };

  const handleResetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResetData({
      ...resetData,
      [e.target.name]: e.target.value
    });
  };

  const validateForgotForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!forgotData.email) {
      newErrors.email = 'El email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(forgotData.email)) {
      newErrors.email = 'El email no es válido';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateResetForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!resetData.code) {
      newErrors.code = 'El código es requerido';
    } else if (resetData.code.length !== 6) {
      newErrors.code = 'El código debe tener 6 dígitos';
    }
    
    if (!resetData.newPassword) {
      newErrors.newPassword = 'La nueva contraseña es requerida';
    } else if (resetData.newPassword.length < 8) {
      newErrors.newPassword = 'La contraseña debe tener al menos 8 caracteres';
    }
    
    if (!resetData.confirmPassword) {
      newErrors.confirmPassword = 'Confirma tu nueva contraseña';
    } else if (resetData.newPassword !== resetData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!validateForgotForm()) {
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post<ForgotPasswordApiResponse>('/auth/forgot-password', {
        email: forgotData.email
      });

      if (response.data.success) {
        setToken(response.data.data?.token || '');
        setSuccess('Código enviado a tu Telegram. Revisa tus mensajes.');
        setStep('reset');
      } else {
        setError(response.data.message || 'Error al solicitar recuperación');
      }
    } catch (err: any) {
      console.error('Error al solicitar recuperación:', err);
      const apiError = err as ApiError;
      
      if (apiError.response?.data?.code === 'NO_TELEGRAM') {
        setError('No tienes Telegram configurado. Contacta al soporte para recuperar tu contraseña.');
      } else if (apiError.response?.data?.code === 'RESET_ALREADY_REQUESTED') {
        setError('Ya tienes una solicitud activa. Revisa tu Telegram.');
      } else {
        setError(apiError.response?.data?.message || 'Error al solicitar recuperación');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!validateResetForm()) {
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post<ResetPasswordApiResponse>('/auth/reset-password', {
        token,
        code: resetData.code,
        newPassword: resetData.newPassword
      });

      if (response.data.success) {
        setSuccess('¡Contraseña actualizada exitosamente! Redirigiendo al login...');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(response.data.message || 'Error al cambiar contraseña');
      }
    } catch (err: any) {
      console.error('Error al cambiar contraseña:', err);
      const apiError = err as ApiError;
      
      if (apiError.response?.data?.code === 'INVALID_CODE') {
        const attemptsLeft = apiError.response?.data?.attemptsLeft || 0;
        setAttemptsLeft(attemptsLeft);
        setError(`Código incorrecto. Te quedan ${attemptsLeft} intentos.`);
      } else if (apiError.response?.data?.code === 'TOKEN_EXPIRED') {
        setError('El código ha expirado. Solicita uno nuevo.');
        setStep('request');
      } else if (apiError.response?.data?.code === 'TOO_MANY_ATTEMPTS') {
        setError('Demasiados intentos fallidos. Solicita un nuevo código.');
        setStep('request');
      } else {
        setError(apiError.response?.data?.message || 'Error al cambiar contraseña');
      }
    } finally {
      setLoading(false);
    }
  };

  const requestNewCode = () => {
    setStep('request');
    setToken('');
    setResetData({ code: '', newPassword: '', confirmPassword: '' });
    setError('');
    setSuccess('');
    setAttemptsLeft(3);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 relative overflow-hidden">
      {/* Elementos decorativos de fondo */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
      <div className="absolute top-0 right-0 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse" style={{animationDelay: '2s'}}></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse" style={{animationDelay: '4s'}}></div>
      
      <main className="py-16 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-md mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              {/* Logo G5 */}
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl mb-4 shadow-lg transform hover:scale-105 transition-transform duration-300">
                <span className="text-2xl font-bold text-white">G5</span>
              </div>
              
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-800 bg-clip-text text-transparent mb-3">
                {step === 'request' ? 'Recuperar Contraseña' : 'Cambiar Contraseña'}
              </h1>
              <p className="text-gray-600 text-lg">
                {step === 'request' 
                  ? 'Te enviaremos un código por Telegram'
                  : 'Ingresa el código que recibiste en Telegram'
                }
              </p>
            </div>

            {/* Formulario */}
            <div className="bg-white/70 backdrop-blur-lg border border-white/20 shadow-2xl rounded-2xl p-8">
              {/* Mensajes de error y éxito */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <p className="text-red-700 font-medium">{error}</p>
                  </div>
                </div>
              )}

              {success && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <p className="text-green-700 font-medium">{success}</p>
                  </div>
                </div>
              )}
              
              {step === 'request' ? (
                <form onSubmit={handleForgotSubmit} className="space-y-6">
                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={forgotData.email}
                      onChange={handleForgotChange}
                      className={`w-full px-4 py-3 border-2 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 hover:bg-white/70 ${
                        errors.email ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-gray-200'
                      }`}
                      placeholder="tu@email.com"
                      required
                    />
                    {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
                  </div>

                  {/* Botón de submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none focus:outline-none focus:ring-4 focus:ring-blue-500/50"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Enviando código...
                      </div>
                    ) : (
                      <span className="flex items-center justify-center">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                        </svg>
                        Enviar Código por Telegram
                      </span>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetSubmit} className="space-y-6">
                  {/* Código */}
                  <div>
                    <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                      Código de Telegram (6 dígitos)
                    </label>
                    <input
                      type="text"
                      id="code"
                      name="code"
                      value={resetData.code}
                      onChange={handleResetChange}
                      className={`w-full px-4 py-3 border-2 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 hover:bg-white/70 text-center text-2xl tracking-widest ${
                        errors.code ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-gray-200'
                      }`}
                      placeholder="123456"
                      maxLength={6}
                      required
                    />
                    {errors.code && <p className="text-sm text-red-600 mt-1">{errors.code}</p>}
                    {attemptsLeft < 3 && (
                      <p className="text-sm text-orange-600 mt-1">
                        Te quedan {attemptsLeft} intentos
                      </p>
                    )}
                  </div>

                  {/* Nueva contraseña */}
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                      Nueva Contraseña
                    </label>
                    <input
                      type="password"
                      id="newPassword"
                      name="newPassword"
                      value={resetData.newPassword}
                      onChange={handleResetChange}
                      className={`w-full px-4 py-3 border-2 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 hover:bg-white/70 ${
                        errors.newPassword ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-gray-200'
                      }`}
                      placeholder="••••••••"
                      required
                    />
                    {errors.newPassword && <p className="text-sm text-red-600 mt-1">{errors.newPassword}</p>}
                  </div>

                  {/* Confirmar contraseña */}
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                      Confirmar Nueva Contraseña
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={resetData.confirmPassword}
                      onChange={handleResetChange}
                      className={`w-full px-4 py-3 border-2 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 hover:bg-white/70 ${
                        errors.confirmPassword ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-gray-200'
                      }`}
                      placeholder="••••••••"
                      required
                    />
                    {errors.confirmPassword && <p className="text-sm text-red-600 mt-1">{errors.confirmPassword}</p>}
                  </div>

                  {/* Botón de submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none focus:outline-none focus:ring-4 focus:ring-green-500/50"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Cambiando contraseña...
                      </div>
                    ) : (
                      <span className="flex items-center justify-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Cambiar Contraseña
                      </span>
                    )}
                  </button>

                  {/* Solicitar nuevo código */}
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={requestNewCode}
                      className="text-blue-600 hover:text-blue-500 text-sm font-medium transition-colors duration-300"
                    >
                      ¿No recibiste el código? Solicitar uno nuevo
                    </button>
                  </div>
                </form>
              )}

              {/* Link de regreso al login */}
              <div className="mt-6 text-center">
                <Link 
                  to="/login" 
                  className="inline-flex items-center text-gray-600 hover:text-gray-700 font-medium transition-colors duration-300"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Volver al Login
                </Link>
              </div>
            </div>

            {/* Información de seguridad */}
            <div className="mt-8 text-center">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-2">🔒 Seguridad</h3>
                <p className="text-blue-700 text-sm">
                  El código de recuperación expira en 15 minutos y solo puede usarse una vez.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}