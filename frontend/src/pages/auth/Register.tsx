import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import UserHeader from '../../components/home/UserHeader';
import Footer from '../../components/home/Footer';
import { useTelegram, TelegramNotification } from '../../utils/telegram';
import { useAuth } from '../../contexts/AuthContext';
import { usePostAuthRedirect } from '@/lib/postAuthRedirect';
import { api } from '../../lib/api';

// Zod validation schema
const registerSchema = z.object({
  firstName: z.string().min(1, 'El nombre es obligatorio').max(50, 'El nombre es muy largo'),
  lastName: z.string().min(1, 'El apellido es obligatorio').max(50, 'El apellido es muy largo'),
  email: z.string().email('El email no es válido'),
  phone: z.string().min(10, 'El teléfono debe tener al menos 10 dígitos').max(20, 'El teléfono es muy largo'),
  country: z.string().min(2, 'El país es obligatorio').max(50, 'El país es muy largo'),
  telegram: z.string().optional(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string(),
  referralCode: z.string().min(1, 'El código de referido es obligatorio'),
  acceptTerms: z.boolean().refine(val => val === true, 'Debes aceptar los términos y condiciones'),
  acceptPrivacy: z.boolean().refine(val => val === true, 'Debes aceptar la política de privacidad')
}).refine(data => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword']
});

type RegisterFormData = z.infer<typeof registerSchema>;

interface ReferralInfo {
  isValid: boolean | null;
  referrerName: string;
  source: 'url' | 'cookie' | 'manual' | '';
}

interface FormErrors {
  [key: string]: string;
}

const Register: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    country: '',
    telegram: '',
    password: '',
    confirmPassword: '',
    referralCode: '',
    acceptTerms: false,
    acceptPrivacy: false
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showTelegramNotification, setShowTelegramNotification] = useState(false);
  const [referralInfo, setReferralInfo] = useState<ReferralInfo>({ 
    isValid: null, 
    referrerName: '', 
    source: '' 
  });
  const { register, isLoading, error, clearError } = useAuth();
  const { sendWelcomeMessage } = useTelegram();
  const navigate = useNavigate();

  // Cookie utilities
  const getCookie = (name: string): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  };

  const setCookie = (name: string, value: string, days: number = 30): void => {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  };

  // Validate referral code
  const validateReferralCode = async (code: string): Promise<void> => {
    if (!code) {
      setReferralInfo({ isValid: null, referrerName: '', source: '' });
      return;
    }

    try {
      const response = await api.get(`/referrals/validate/${code}`, {});
      const data = response as any;
      
      if (data && data.success) {
        const referrerData = data.referrer || {};
        const referrerName = referrerData.firstName && referrerData.lastName 
          ? `${referrerData.firstName} ${referrerData.lastName}`
          : referrerData.name || 'Usuario';
        setReferralInfo({
          isValid: true,
          referrerName,
          source: referralInfo.source
        });
      } else {
        setReferralInfo({ isValid: false, referrerName: '', source: referralInfo.source });
      }
    } catch (error) {
      console.error('Error validating referral code:', error);
      setReferralInfo({ isValid: false, referrerName: '', source: referralInfo.source });
    }
  };

  useEffect(() => {
    // Get referral code from URL or cookie
    let refCode = searchParams.get('ref');
    let source: ReferralInfo['source'] = 'url';
    
    if (!refCode) {
      refCode = getCookie('g5x_ref');
      source = 'cookie';
    }
    
    if (refCode) {
      // Set cookie for future visits if it came from URL
      if (source === 'url') {
        setCookie('g5x_ref', refCode, 30); // 30 days
      }
      
      setFormData(prev => ({ ...prev, referralCode: refCode! }));
      setReferralInfo(prev => ({ ...prev, source }));
      validateReferralCode(refCode);
    }
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    // Validate referral code when it changes
    if (name === 'referralCode') {
      setReferralInfo(prev => ({ ...prev, source: 'manual' }));
      validateReferralCode(value);
    }
  };

  const validateForm = (): boolean => {
    try {
      registerSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: FormErrors = {};
        error.errors.forEach(err => {
          if (err.path.length > 0) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    clearError();
    
    if (!validateForm()) {
      return;
    }

    try {
      await register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        country: formData.country,
        password: formData.password,
        referralCode: formData.referralCode,
        telegramUsername: formData.telegram
      });
      
      // Show Telegram notification after successful registration
      setShowTelegramNotification(true);
      // Send welcome message automatically
      sendWelcomeMessage(formData.email);
      // Redirect to appropriate dashboard based on user role
      // Note: If backend auto-logs user after registration, use postAuthRedirect
      // Otherwise, redirect to login
      navigate('/auth/login?registered=1');
    } catch (error) {
      // Errors are handled automatically by the context with toast
      console.error('Register error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-50 via-primary-50/30 to-secondary-100 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-400/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-300/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>
      
      <UserHeader />
      <main className="section-padding relative z-10">
        <div className="container-max">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8 animate-fade-in">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl mb-4 shadow-lg">
                  <span className="text-2xl font-bold text-white">G5</span>
                </div>
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-secondary-900 to-secondary-700 bg-clip-text text-transparent mb-3">
                Crear Cuenta en Grow5X
              </h1>
              <p className="text-lg text-secondary-600 mb-6">
                Únete a la plataforma de licencias IA más avanzada
              </p>
              <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-primary-50 to-primary-100 text-primary-700 px-6 py-3 rounded-xl border border-primary-200 shadow-sm hover:shadow-md transition-all duration-300">
                <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="font-semibold">Agentes IA - Licencias desde $50</span>
              </div>
            </div>

            {/* Form */}
            <div className="backdrop-blur-sm bg-white/80 border border-white/20 rounded-3xl shadow-2xl p-8 hover:shadow-3xl transition-all duration-500 animate-slide-up">
              {/* General error */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <p className="text-red-700 font-medium">{(error as any)?.message || error || 'Error desconocido'}</p>
                  </div>
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Names */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-secondary-700 mb-2">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border-2 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 hover:bg-white/70 ${
                        errors.firstName ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-secondary-200'
                      }`}
                      placeholder="Tu nombre"
                      required
                    />
                    {errors.firstName && <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-secondary-700 mb-2">
                      Apellido *
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border-2 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 hover:bg-white/70 ${
                        errors.lastName ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-secondary-200'
                      }`}
                      placeholder="Tu apellido"
                      required
                    />
                    {errors.lastName && <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>}
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-secondary-700 mb-2">
                    Correo Electrónico *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border-2 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 hover:bg-white/70 ${
                      errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-secondary-200'
                    }`}
                    placeholder="tu@email.com"
                    required
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                </div>

                {/* Phone and Country */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-secondary-700 mb-2">
                      Teléfono *
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border-2 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 hover:bg-white/70 ${
                        errors.phone ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-secondary-200'
                      }`}
                      placeholder="+1234567890"
                      required
                    />
                    {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
                  </div>
                  <div>
                    <label htmlFor="country" className="block text-sm font-medium text-secondary-700 mb-2">
                      País *
                    </label>
                    <input
                      type="text"
                      id="country"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border-2 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 hover:bg-white/70 ${
                        errors.country ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-secondary-200'
                      }`}
                      placeholder="México"
                      required
                    />
                    {errors.country && <p className="mt-1 text-sm text-red-600">{errors.country}</p>}
                  </div>
                </div>

                {/* Telegram */}
                <div>
                  <label htmlFor="telegram" className="block text-sm font-medium text-secondary-700 mb-2">
                    Usuario de Telegram
                    <span className="text-secondary-500 text-xs ml-1">(Opcional - para notificaciones)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-secondary-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.374 0 0 5.373 0 12s5.374 12 12 12 12-5.373 12-12S18.626 0 12 0zm5.568 8.16c-.169 1.858-.896 6.728-.896 6.728-.377 2.655-.377 2.655-1.377 2.655-.896 0-1.209-.896-1.209-.896s-2.655-2.655-2.655-2.655-.896-.896-.896-1.792c0-.896.896-1.792.896-1.792s4.447-4.447 4.447-4.447c.448-.448.896-.448.896 0s-.448.896-.448.896l-3.551 3.551s-.448.448 0 .896c.448.448.896 0 .896 0l2.655-2.655s.448-.448.896 0c.448.448 0 .896 0 .896z"/>
                      </svg>
                    </div>
                    <input
                      type="text"
                      id="telegram"
                      name="telegram"
                      value={formData.telegram}
                      onChange={handleChange}
                      className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 hover:bg-white/70 ${
                        errors.telegram ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-secondary-200'
                      }`}
                      placeholder="@tu_usuario"
                    />
                  </div>
                  {errors.telegram && <p className="mt-1 text-sm text-red-600">{errors.telegram}</p>}
                  <p className="mt-1 text-sm text-secondary-500">
                    📱 Opcional: Agrega tu usuario de Telegram para recibir notificaciones de bienvenida, activaciones y retiros.
                  </p>
                </div>

                {/* Passwords */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-secondary-700 mb-2">
                      Contraseña *
                    </label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border-2 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 hover:bg-white/70 ${
                        errors.password ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-secondary-200'
                      }`}
                      placeholder="••••••••"
                      required
                    />
                    {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-secondary-700 mb-2">
                      Confirmar Contraseña *
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border-2 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 hover:bg-white/70 ${
                        errors.confirmPassword ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-secondary-200'
                      }`}
                      placeholder="••••••••"
                      required
                    />
                    {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
                  </div>
                </div>

                {/* Referral Code */}
                <div>
                  <label htmlFor="referralCode" className="block text-sm font-medium text-secondary-700 mb-2">
                    Código de Referido * 
                    <span className="text-primary-600 font-semibold">(Obligatorio)</span>
                    {referralInfo.source && (
                      <span className="ml-2 text-xs text-secondary-500">
                        ({referralInfo.source === 'url' ? 'desde enlace' : 
                          referralInfo.source === 'cookie' ? 'detectado automáticamente' : 'ingresado manualmente'})
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="referralCode"
                      name="referralCode"
                      value={formData.referralCode}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 pr-12 border-2 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 hover:bg-white/70 ${
                        errors.referralCode ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 
                        referralInfo.isValid === true ? 'border-green-500 focus:border-green-500 focus:ring-green-500/20' :
                        referralInfo.isValid === false ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' :
                        'border-secondary-200'
                      }`}
                      placeholder="Código de quien te invitó"
                    />
                    {/* Status icon */}
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      {referralInfo.isValid === true && (
                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                      {referralInfo.isValid === false && (
                        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                  
                  {/* Validation feedback */}
                  {referralInfo.isValid === true && referralInfo.referrerName && (
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm text-green-700">
                          <span className="font-medium">Código válido!</span> Serás referido por <span className="font-semibold">{referralInfo.referrerName}</span>
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {referralInfo.isValid === false && formData.referralCode && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm text-red-700">
                          <span className="font-medium">Código inválido.</span> Verifica que esté escrito correctamente.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {errors.referralCode && <p className="mt-1 text-sm text-red-600">{errors.referralCode}</p>}
                  
                  {!formData.referralCode && (
                    <p className="mt-1 text-sm text-secondary-500">
                      💡 El código de referido es obligatorio para registrarse. Si no tienes uno, contacta a nuestro soporte.
                    </p>
                  )}
                </div>

                {/* Terms and Conditions */}
                <div className="space-y-4">
                  <div className="flex items-start">
                    <input
                      id="acceptTerms"
                      name="acceptTerms"
                      type="checkbox"
                      checked={formData.acceptTerms}
                      onChange={handleChange}
                      className={`mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded ${
                        errors.acceptTerms ? 'border-red-500' : ''
                      }`}
                    />
                    <label htmlFor="acceptTerms" className="ml-2 block text-sm text-secondary-700">
                      Acepto los{' '}
                      <Link to="/terms" className="text-primary-600 hover:text-primary-500 underline">
                        Términos y Condiciones
                      </Link>
                      {' '}*
                    </label>
                  </div>
                  {errors.acceptTerms && <p className="text-sm text-red-600">{errors.acceptTerms}</p>}

                  <div className="flex items-start">
                    <input
                      id="acceptPrivacy"
                      name="acceptPrivacy"
                      type="checkbox"
                      checked={formData.acceptPrivacy}
                      onChange={handleChange}
                      className={`mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded ${
                        errors.acceptPrivacy ? 'border-red-500' : ''
                      }`}
                    />
                    <label htmlFor="acceptPrivacy" className="ml-2 block text-sm text-secondary-700">
                      Acepto la{' '}
                      <Link to="/privacy" className="text-primary-600 hover:text-primary-500 underline">
                        Política de Privacidad
                      </Link>
                      {' '}*
                    </label>
                  </div>
                  {errors.acceptPrivacy && <p className="text-sm text-red-600">{errors.acceptPrivacy}</p>}
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none focus:outline-none focus:ring-4 focus:ring-primary-500/50"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creando cuenta...
                    </div>
                  ) : (
                    <span className="flex items-center justify-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      Crear Cuenta
                    </span>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-secondary-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-secondary-500">¿Ya tienes cuenta?</span>
                  </div>
                </div>
              </div>

              {/* Link to login */}
              <div className="mt-6">
                <div className="text-center">
                  <p className="text-secondary-600 mb-2">
                    ¿Ya tienes una cuenta?
                  </p>
                  <Link 
                    to="/login" 
                    className="inline-flex items-center px-4 py-2 text-primary-600 hover:text-primary-700 font-medium border border-primary-200 hover:border-primary-300 rounded-lg transition-all duration-300 hover:bg-primary-50 group"
                  >
                    <svg className="w-4 h-4 mr-2 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Inicia sesión
                  </Link>
                </div>
              </div>
            </div>

            {/* Featured benefits */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-green-600 font-bold text-lg">12.5%</div>
                <div className="text-green-700 text-sm">Retorno diario</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <div className="text-blue-600 font-bold text-lg">45 días</div>
                <div className="text-blue-700 text-sm">Ciclo completo</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                <div className="text-purple-600 font-bold text-lg">10%</div>
                <div className="text-purple-700 text-sm">Comisión referidos</div>
              </div>
            </div>

            {/* Risk notice */}
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <h4 className="font-semibold text-yellow-800">Aviso Importante</h4>
                  <p className="text-yellow-700 text-sm mt-1">
                    El mundo de las criptomonedas conlleva riesgos. Solo invierte lo que puedas permitirte perder completamente. 
                    Los rendimientos pasados no garantizan resultados futuros.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      
      {/* Telegram notification */}
      {showTelegramNotification && (
        <TelegramNotification
          type="WELCOME"
          userEmail={formData.email}
          onClose={() => setShowTelegramNotification(false)}
        />
      )}
    </div>
  );
};

export default Register;