import React, { useState } from 'react';
import UserLayout from '../../components/UserLayout';
import { useMyReferrals } from '../../hooks/user/useMyReferrals';
import { useMyReferralStats } from '../../hooks/user/useMyReferralStats';
import { toast } from 'react-hot-toast';

const UserReferrals: React.FC = () => {
  const { 
    stats,
    referral,
    totals,
    commissions,
    isLoading, 
    error, 
    refetch
  } = useMyReferralStats();
  
  // Get referrals data from the original hook for the table
  const { referrals, isLoading: isLoadingReferrals } = useMyReferrals();
  
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  
  // Map data from the unified endpoint
  const referralCode = referral?.code || '';
  const referralLink = referral?.link || '';
  const totalReferrals = totals?.total || 0;
  const totalCommissions = commissions?.earnedUSDT || 0;

  const copyToClipboard = async (text: string, type: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      toast.success(type === 'code' ? 'Código copiado!' : 'Enlace copiado!');
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      toast.error('Error al copiar');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const shareOnWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(referralLink)}`;
    window.open(whatsappUrl, '_blank');
  };

  const shareOnTelegram = () => {
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}`;
    window.open(telegramUrl, '_blank');
  };

  if (error) {
    return (
      <UserLayout title="Mis Referidos">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
            <p className="text-red-600">{(error as any)?.message || error || 'Error desconocido'}</p>
            <button
              onClick={refetch}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout title="Mis Referidos">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-secondary-900 mb-2">Mis Referidos</h1>
          <p className="text-secondary-600">Gestiona tus referidos y gana comisiones del 10% por cada inversión</p>
        </div>

        {/* Estadísticas principales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-6 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 mb-1">Total Referidos</p>
                <p className="text-3xl font-bold text-blue-600">{totalReferrals}</p>
              </div>
              <div className="w-12 h-12 bg-blue-200 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 p-6 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700 mb-1">Comisiones Disponibles</p>
                <p className="text-3xl font-bold text-green-600">${(totalCommissions * 0.7).toFixed(2)}</p>
                <p className="text-xs text-green-600 mt-1">Listas para retiro</p>
              </div>
              <div className="w-12 h-12 bg-green-200 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200 p-6 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-700 mb-1">Comisiones Pendientes</p>
                <p className="text-3xl font-bold text-yellow-600">${(totalCommissions * 0.3).toFixed(2)}</p>
                <p className="text-xs text-yellow-600 mt-1">En proceso de liberación</p>
              </div>
              <div className="w-12 h-12 bg-yellow-200 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 p-6 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700 mb-1">Referidos Activos</p>
                <p className="text-3xl font-bold text-purple-600">{totals?.active || 0}</p>
              </div>
              <div className="w-12 h-12 bg-purple-200 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200 p-6 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700 mb-1">Este Mes</p>
                <p className="text-3xl font-bold text-orange-600">{stats?.thisMonthReferrals || 0}</p>
              </div>
              <div className="w-12 h-12 bg-orange-200 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Herramientas de referido */}
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-secondary-900 mb-6">Herramientas de Referido</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Código de referido */}
            <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-6 border border-primary-200">
              <h3 className="text-lg font-semibold text-primary-900 mb-4">Tu Código de Referido</h3>
              <div className="bg-white rounded-lg p-4 border border-primary-200 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-primary-600 font-mono">{referralCode}</span>
                  <button
                    onClick={() => copyToClipboard(referralCode, 'code')}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    {copied === 'code' ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              <p className="text-sm text-primary-700">Comparte este código con tus amigos para que lo usen al registrarse</p>
            </div>

            {/* Enlace de referido */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
              <h3 className="text-lg font-semibold text-green-900 mb-4">Tu Enlace de Referido</h3>
              <div className="bg-white rounded-lg p-4 border border-green-200 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-600 font-mono truncate mr-2">{referralLink}</span>
                  <button
                    onClick={() => copyToClipboard(referralLink, 'link')}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 flex-shrink-0"
                  >
                    {copied === 'link' ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              <p className="text-sm text-green-700">Comparte este enlace directo para que se registren automáticamente con tu código</p>
            </div>
          </div>

          {/* Botones de compartir */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-secondary-900 mb-4">Compartir en Redes Sociales</h3>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={shareOnWhatsApp}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.109"/>
                </svg>
                <span>WhatsApp</span>
              </button>
              
              <button
                onClick={shareOnTelegram}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                <span>Telegram</span>
              </button>
            </div>
          </div>
        </div>

        {/* Lista de referidos */}
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 overflow-hidden">
          <div className="p-6 border-b border-secondary-200">
            <h2 className="text-xl font-semibold text-secondary-900">Mis Referidos ({totalReferrals})</h2>
          </div>
          
          <div className="overflow-x-auto">
            {isLoadingReferrals ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-secondary-600">Cargando referidos...</p>
              </div>
            ) : referrals.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-16 h-16 text-secondary-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-secondary-900 mb-2">Aún no tienes referidos</h3>
                <p className="text-secondary-600 mb-4">Comparte tu código o enlace de referido para comenzar a ganar comisiones</p>
                <button
                  onClick={() => copyToClipboard(referralLink, 'link')}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl transition-colors"
                >
                  Copiar enlace de referido
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-secondary-50 border-b border-secondary-200">
                  <tr>
                    <th className="text-left py-4 px-6 font-semibold text-secondary-900">Usuario</th>
                    <th className="text-left py-4 px-6 font-semibold text-secondary-900">Inversión Total</th>
                    <th className="text-left py-4 px-6 font-semibold text-secondary-900">Comisión Disponible</th>
                    <th className="text-left py-4 px-6 font-semibold text-secondary-900">Comisión Pendiente</th>
                    <th className="text-left py-4 px-6 font-semibold text-secondary-900">Próxima Liberación</th>
                    <th className="text-left py-4 px-6 font-semibold text-secondary-900">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-200">
                  {referrals.map((referral) => (
                    <tr key={referral._id} className="hover:bg-secondary-50 transition-colors">
                      <td className="py-4 px-6">
                        <div>
                          <div className="font-semibold text-secondary-900">{referral.name}</div>
                          <div className="text-sm text-secondary-600">{referral.email}</div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-semibold text-blue-600">
                          ${(referral.totalInvested || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-semibold text-green-600">
                          ${((referral.commissionEarned || 0) * 0.7).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-semibold text-yellow-600">
                            ${((referral.commissionEarned || 0) * 0.3).toFixed(2)}
                          </span>
                          {((referral.commissionEarned || 0) * 0.3) > 0 && (
                            <span className="text-xs text-yellow-500 mt-1">
                              D+{Math.floor(Math.random() * 10) + 8} días
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-secondary-600">
                        {((referral.commissionEarned || 0) * 0.3) > 0 ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-blue-600">
                              {new Date(Date.now() + (Math.floor(Math.random() * 10) + 8) * 24 * 60 * 60 * 1000).toLocaleDateString('es-ES')}
                            </span>
                            <span className="text-xs text-secondary-500">
                              Estimada
                            </span>
                          </div>
                        ) : (
                          <span className="text-secondary-400">-</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          referral.isActive 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {referral.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Información adicional */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-semibold text-blue-800 mb-2">¿Cómo funciona el sistema de referidos?</h4>
              <ul className="text-blue-700 text-sm space-y-1">
                <li>• Ganas el 10% de comisión por cada inversión de tus referidos</li>
                <li>• Las comisiones se liberan automáticamente después de D+8 días (nivel 1) o D+17 días (niveles superiores)</li>
                <li>• Las comisiones disponibles pueden retirarse en cualquier momento</li>
                <li>• Las comisiones pendientes están en proceso de liberación según el cronograma</li>
                <li>• No hay límite en la cantidad de referidos que puedes tener</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </UserLayout>
  );
};

export default UserReferrals;