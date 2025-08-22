import React, { useEffect, useState } from 'react';
import { withAuth } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import UserLayout from '../../components/UserLayout';
import ProgressBar from '../../components/ProgressBar';
import CapProgressBar from '../../components/CapProgressBar';

type DashboardData = {
  balance: {
    available: number;
    invested: number;
    withdrawn: number;
    lockedCommissions: number;
  };
  licenses: {
    active: number;
    completed: number;
    total: number;
    details: Array<{
      _id: string;
      purchaseAmount: number;
      dailyBenefitAmount: number;
      remainingDays: number;
      progressPercent: number;
      remainingAmount: number;
      scheduleStatus: string;
      isPaused?: boolean;
      capReached?: boolean;
      capPercentMax?: number;
      totalAmount: number;
      pauseReason?: string;
      package: {
        name: string;
        dailyRate: number;
      };
    }>;
  };
  withdrawals: {
    pending: number;
    completed: number;
    totalAmount: number;
  };
  referral: {
    code: string;
    total: number;
    active: number;
    totalCommissions: number;
    link?: string;
  };
  stats: {
    totalInvested: number;
    totalWithdrawn: number;
    totalEarnings: number;
    pendingCommissions: number;
  };
};

export default function Dashboard() {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const client = withAuth(token);
        const res = await client.GET('/api/me/overview', {});
        if ((res as any)?.data) {
          setData((res as any).data);
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  if (loading) {
    return (
      <UserLayout title="Dashboard">
        <div className="p-6">
          <div className="animate-pulse">
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-48 bg-gray-200 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout title="Dashboard">
      <div className="p-6 space-y-6">
        {/* Balance Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card title="Saldo Disponible" value={data?.balance?.available ?? 0} color="green" />
          <Card title="Total Invertido" value={data?.stats?.totalInvested ?? 0} color="blue" />
          <Card title="Total Ganado" value={data?.stats?.totalEarnings ?? 0} color="purple" />
          <Card title="Total Retirado" value={data?.stats?.totalWithdrawn ?? 0} color="gray" />
        </div>

        {/* Licenses and Referrals */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Active Licenses */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold mb-4">Licencias Activas</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Activas:</span>
                <span className="font-semibold">{data?.licenses?.active ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Completadas:</span>
                <span className="font-semibold">{data?.licenses?.completed ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total:</span>
                <span className="font-semibold">{data?.licenses?.total ?? 0}</span>
              </div>
            </div>
            {data?.licenses?.details && data.licenses.details.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Licencias en Progreso:</h4>
                <div className="space-y-3">
                  {data.licenses.details.slice(0, 3).map((license) => {
                    const getStatusColor = (status: string, isPaused?: boolean) => {
                      if (isPaused) return 'text-yellow-600';
                      switch (status) {
                        case 'ACTIVE': return 'text-green-600';
                        case 'PAUSED': return 'text-yellow-600';
                        case 'COMPLETED': return 'text-blue-600';
                        case 'CANCELLED': return 'text-red-600';
                        default: return 'text-gray-600';
                      }
                    };
                    
                    const getStatusText = (status: string, isPaused?: boolean) => {
                      if (isPaused) return 'Pausada';
                      switch (status) {
                        case 'ACTIVE': return 'Activa';
                        case 'PAUSED': return 'Pausada';
                        case 'COMPLETED': return 'Completada';
                        case 'CANCELLED': return 'Cancelada';
                        default: return status;
                      }
                    };
                    
                    return (
                      <div key={license._id} className="text-sm border border-gray-200 rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-600 font-medium">{license.package?.name}</span>
                          <div className="flex items-center space-x-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              license.scheduleStatus === 'ACTIVE' && !license.isPaused ? 'bg-green-100 text-green-600' :
                              license.isPaused || license.scheduleStatus === 'PAUSED' ? 'bg-yellow-100 text-yellow-600' :
                              license.scheduleStatus === 'COMPLETED' ? 'bg-blue-100 text-blue-600' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {getStatusText(license.scheduleStatus, license.isPaused)}
                            </span>
                            <span className="text-green-600 font-medium">{license.progressPercent.toFixed(1)}%</span>
                          </div>
                        </div>
                        <ProgressBar
                          percentage={license.progressPercent}
                          size="sm"
                          color="gradient"
                          label="Progreso"
                          animated={true}
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>
                            {license.remainingDays !== undefined && license.remainingDays > 0 ? 
                              `${license.remainingDays} días restantes` : 
                              'Completado'
                            }
                          </span>
                          {license.capReached && (
                          <span className="text-orange-600">Tope alcanzado</span>
                        )}
                        
                        {/* Cap Progress */}
                        {license.capPercentMax && license.remainingAmount !== undefined && (
                          <div className="mt-3">
                            <CapProgressBar
                              currentAmount={license.totalAmount - (license.remainingAmount || 0)}
                              capAmount={license.totalAmount * (license.capPercentMax / 100)}
                              capPercentMax={license.capPercentMax}
                              showDetails={false}
                              className="border-0 p-0 bg-transparent"
                            />
                          </div>
                        )}
                        </div>
                        {license.isPaused && license.pauseReason && (
                          <div className="mt-2 text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
                            {license.pauseReason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Referral Stats */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold mb-4">Referidos</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Referidos:</span>
                <span className="font-semibold">{data?.referral?.total ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Activos:</span>
                <span className="font-semibold">{data?.referral?.active ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Comisiones Totales:</span>
                <span className="font-semibold text-green-600">${data?.referral?.totalCommissions?.toFixed(2) ?? '0.00'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pendientes:</span>
                <span className="font-semibold text-orange-600">${data?.stats?.pendingCommissions?.toFixed(2) ?? '0.00'}</span>
              </div>
            </div>
            {data?.referral?.link && (
              <div className="mt-4 pt-4 border-t">
                <label className="text-sm font-medium text-gray-700">Tu enlace de referido:</label>
                <div className="mt-1 flex">
                  <input 
                    type="text" 
                    value={data.referral.link} 
                    readOnly 
                    className="flex-1 text-sm bg-gray-50 border border-gray-300 rounded-l-md px-3 py-2"
                  />
                  <button 
                    onClick={() => navigator.clipboard.writeText(data.referral.link!)}
                    className="bg-blue-500 text-white px-3 py-2 rounded-r-md text-sm hover:bg-blue-600"
                  >
                    Copiar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </UserLayout>
  );
}

function Card({ title, value, color = 'gray' }: { title: string; value: number; color?: string }) {
  const colorClasses = {
    green: 'border-green-200 bg-green-50',
    blue: 'border-blue-200 bg-blue-50',
    purple: 'border-purple-200 bg-purple-50',
    gray: 'border-gray-200 bg-gray-50'
  };

  const textColorClasses = {
    green: 'text-green-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    gray: 'text-gray-600'
  };

  return (
    <div className={`border rounded-xl p-4 shadow-sm ${colorClasses[color as keyof typeof colorClasses] || colorClasses.gray}`}>
      <div className="text-sm text-gray-500">{title}</div>
      <div className={`text-2xl font-semibold ${textColorClasses[color as keyof typeof textColorClasses] || textColorClasses.gray}`}>
        ${value.toFixed(2)}
      </div>
      <div className="text-xs text-gray-400">USDT</div>
    </div>
  );
}