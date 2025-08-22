import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import UserHeader from '../components/home/UserHeader';
import Footer from '../components/home/Footer';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api';

interface ReferralData {
  isValid: boolean;
  referrerName: string;
  referrerEmail: string;
  code: string;
}

const ReferralLanding: React.FC = () => {
  const { code } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Cookie utilities
  const setCookie = (name: string, value: string, days: number = 30): void => {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  };

  // Validate referral code and get referrer info
  useEffect(() => {
    const validateReferralCode = async () => {
      if (!code) {
        // Si no hay código, redirigir a la landing principal
        navigate('/', { replace: true });
        return;
      }

      try {
        const response = await api.get(`/api/referrals/validate/${code}`, {});
        const data = (response as any)?.data;
        
        if (data && (data as any).success) {
          const referrerData = (data as any).referrer || {};
          setReferralData({
            isValid: true,
            referrerName: referrerData.name || 'Usuario',
            referrerEmail: referrerData.email || '',
            code: code!
          });
          
          // Set referral cookie for 30 days
          setCookie('g5x_ref', code, 30);
        } else {
          // Código inválido, redirigir a la landing principal
          navigate('/', { replace: true });
          return;
        }
      } catch (error) {
        console.error('Error validating referral code:', error);
        // Error en validación, redirigir a la landing principal
        navigate('/', { replace: true });
        return;
      } finally {
        setIsLoading(false);
      }
    };

    validateReferralCode();
  }, [code, navigate]);

  const copyReferralLink = async (): Promise<void> => {
    const currentUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      toast.success('¡Enlace copiado al portapapeles!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('Error al copiar el enlace');
    }
  };

  const handleRegister = (): void => {
    navigate(`/register?ref=${code}`);
  };

  const handleLogin = (): void => {
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary-50 via-primary-50/30 to-secondary-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-secondary-600">Validando código de referido...</p>
        </div>
      </div>
    );
  }

  const pageTitle = referralData?.isValid 
    ? `${referralData.referrerName} te invita a Grow5X` 
    : 'Únete a Grow5X';
  
  const pageDescription = referralData?.isValid 
    ? `${referralData.referrerName} te ha invitado a unirte a Grow5X, la plataforma de licencias IA más avanzada. Obtén retornos del 12.5% diario con agentes de inteligencia artificial.`
    : 'Únete a Grow5X, la plataforma de licencias IA más avanzada. Obtén retornos del 12.5% diario con agentes de inteligencia artificial.';

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content="/og-image.jpg" />
        <meta property="og:site_name" content="Grow5X" />
        
        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={window.location.href} />
        <meta property="twitter:title" content={pageTitle} />
        <meta property="twitter:description" content={pageDescription} />
        <meta property="twitter:image" content="/og-image.jpg" />
        
        {/* Additional SEO */}
        <meta name="robots" content="index, follow" />
        <meta name="author" content="Grow5X" />
        <link rel="canonical" href={window.location.href} />
      </Helmet>

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
            <div className="max-w-4xl mx-auto">
              {referralData?.isValid ? (
                // Valid referral code
                <>
                  {/* Header */}
                  <div className="text-center mb-12 animate-fade-in">
                    <div className="mb-6">
                      <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-primary-500 to-primary-600 rounded-3xl mb-6 shadow-lg">
                        <span className="text-3xl font-bold text-white">G5</span>
                      </div>
                    </div>
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-secondary-900 to-secondary-700 bg-clip-text text-transparent mb-4">
                      ¡{referralData.referrerName} te invita!
                    </h1>
                    <p className="text-xl text-secondary-600 mb-8">
                      Únete a Grow5X y comienza a generar ingresos con licencias de IA
                    </p>
                    
                    {/* Referrer info */}
                    <div className="inline-flex items-center space-x-3 bg-gradient-to-r from-green-50 to-green-100 text-green-700 px-8 py-4 rounded-2xl border border-green-200 shadow-sm">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="font-semibold">Invitado por: {referralData.referrerName}</span>
                    </div>
                  </div>

                  {/* Main content */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
                    {/* Left side - Benefits */}
                    <div className="space-y-8">
                      <div>
                        <h2 className="text-3xl font-bold text-secondary-900 mb-6">¿Por qué Grow5X?</h2>
                        <div className="space-y-6">
                          <div className="flex items-start space-x-4">
                            <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-xl font-semibold text-secondary-900 mb-2">Retornos del 12.5% diario</h3>
                              <p className="text-secondary-600">Genera ingresos consistentes con nuestros agentes de IA especializados en trading automatizado.</p>
                            </div>
                          </div>
                          
                          <div className="flex items-start space-x-4">
                            <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-xl font-semibold text-secondary-900 mb-2">Ciclo de 45 días</h3>
                              <p className="text-secondary-600">Recupera tu inversión y obtén ganancias en un período definido y transparente.</p>
                            </div>
                          </div>
                          
                          <div className="flex items-start space-x-4">
                            <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-xl font-semibold text-secondary-900 mb-2">Comisiones del 10%</h3>
                              <p className="text-secondary-600">Gana comisiones adicionales por cada persona que invites a la plataforma.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right side - CTA */}
                    <div className="backdrop-blur-sm bg-white/80 border border-white/20 rounded-3xl shadow-2xl p-8">
                      <div className="text-center mb-8">
                        <h3 className="text-2xl font-bold text-secondary-900 mb-4">Comienza ahora</h3>
                        <p className="text-secondary-600 mb-6">
                          Únete con el código de {referralData.referrerName} y comienza a generar ingresos hoy mismo.
                        </p>
                        
                        {/* Referral code display */}
                        <div className="bg-secondary-50 border border-secondary-200 rounded-xl p-4 mb-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-secondary-600 mb-1">Código de referido</p>
                              <p className="text-xl font-bold text-secondary-900">{referralData.code}</p>
                            </div>
                            <button
                              onClick={copyReferralLink}
                              className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors duration-300"
                            >
                              {copied ? (
                                <>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span className="text-sm">¡Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  <span className="text-sm">Copiar enlace</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="space-y-4">
                        <button
                          onClick={handleRegister}
                          className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300"
                        >
                          <span className="flex items-center justify-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                            Crear cuenta gratis
                          </span>
                        </button>
                        
                        <button
                          onClick={handleLogin}
                          className="w-full bg-white hover:bg-secondary-50 text-secondary-700 font-semibold py-4 px-6 rounded-xl border-2 border-secondary-200 hover:border-secondary-300 transition-all duration-300"
                        >
                          <span className="flex items-center justify-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            </svg>
                            Ya tengo cuenta
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                // Invalid referral code
                <div className="text-center">
                  <div className="mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-red-500 to-red-600 rounded-3xl mb-6 shadow-lg">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                  </div>
                  <h1 className="text-4xl font-bold text-secondary-900 mb-4">Código de referido inválido</h1>
                  <p className="text-xl text-secondary-600 mb-8">
                    El código de referido "{code}" no es válido o ha expirado.
                  </p>
                  
                  <div className="space-y-4 max-w-md mx-auto">
                    <button
                      onClick={() => navigate('/register')}
                      className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300"
                    >
                      Registrarse sin código
                    </button>
                    
                    <button
                      onClick={handleLogin}
                      className="w-full bg-white hover:bg-secondary-50 text-secondary-700 font-semibold py-4 px-6 rounded-xl border-2 border-secondary-200 hover:border-secondary-300 transition-all duration-300"
                    >
                      Iniciar sesión
                    </button>
                  </div>
                </div>
              )}

              {/* Stats section */}
              <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary-600 mb-2">$50</div>
                  <div className="text-secondary-600">Inversión mínima</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600 mb-2">12.5%</div>
                  <div className="text-secondary-600">Retorno diario</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">45</div>
                  <div className="text-secondary-600">Días de ciclo</div>
                </div>
              </div>

              {/* Risk notice */}
              <div className="mt-12 bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                <div className="flex items-start">
                  <svg className="w-6 h-6 text-yellow-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-yellow-800 mb-2">Aviso Importante sobre Riesgos</h4>
                    <p className="text-yellow-700 text-sm">
                      El trading de criptomonedas y las inversiones en IA conllevan riesgos significativos. 
                      Solo invierte lo que puedas permitirte perder completamente. Los rendimientos pasados 
                      no garantizan resultados futuros. Consulta con un asesor financiero antes de invertir.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default ReferralLanding;