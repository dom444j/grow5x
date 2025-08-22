import React, { useEffect } from 'react';
import UserLayout from '../../components/UserLayout';
import { useAuth } from '../../contexts/AuthContext';
import { withAuth } from '../../lib/api';
import { useState } from 'react';
import { FiRefreshCw, FiTrendingUp, FiDollarSign, FiCheck, FiPause, FiClock, FiPlay } from 'react-icons/fi';
import { useLicenseRealtime } from '../../hooks/useRealtime';

type License = {
  _id: string;
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  package: {
    _id: string;
    name: string;
    slug?: string;
  };
  principalUSDT: number;
  accruedUSDT: number;
  earnedPct: number;
  capPct: number;
  ganado: number;
  tope: number;
  remainingUSDT: number;
  restanteUSDT: number;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  isPaused?: boolean;
  scheduleStatus?: string;
  pauseReason?: string;
  daysGenerated: number;
  startedAt: string;
  createdAt: string;
  activatedAt?: string;
  // Información de wallet y compra
  purchaseId?: string;
  walletAddress?: string;
  paymentHash?: string;
  network?: string;
  // Campos específicos del frontend de usuario
  plan: {
    productionDays: number;
    pauseDays: number;
    cycleLength: number;
    totalCycles: number;
  };
  cycle: {
    index: number;
    dayInCycle: number;
    isPauseToday: boolean;
    daysPaidInCycle: number;
  };
  progress: {
    cyclePercent: number;
    lifetimePercent: number;
    remainingDaysInCycle: number;
    dailyUSDT: number;
    remainingProductionDays: number;
  };
  schedule: Array<{
    day: number;
    status: 'paid' | 'today' | 'pending' | 'pause';
  }>;
};

export default function UserLicenses() {
  const { token } = useAuth();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ active: 0, paused: 0, completed: 0, principal: 0, accrued: 0 });

  // Handle real-time license events
  useLicenseRealtime((eventType: string, data: any) => {
    console.log(`License event received: ${eventType}`, data);
    // Refresh data when license events occur
    fetchData();
  });

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const api = withAuth(token);
      const res = await api.GET('/user/licenses?status=ALL');
      const { items: rows } = (res as any).data as { items: License[] };
      setLicenses(rows);
      setStats(rows.reduce((a, r) => ({
        active: a.active + (r.status==='ACTIVE'?1:0),
        paused: a.paused + (r.status==='PAUSED'?1:0),
        completed: a.completed + (r.status==='COMPLETED'?1:0),
        principal: a.principal + (r.principalUSDT||0),
        accrued: a.accrued + (r.accruedUSDT||0),
      }), { active:0, paused:0, completed:0, principal:0, accrued:0 }));
    } catch (error) {
      console.error('Error fetching licenses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [token]);

  return (
    <UserLayout title="Licencias en Producción">
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Licencias en Producción</h2>
          <button onClick={fetchData} disabled={loading}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin':''}` } /> Actualizar
          </button>
        </div>

        {/* Tarjetas resumen */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card icon={<FiPlay />} label="Activas" value={stats.active} />
          <Card icon={<FiPause />} label="Pausadas" value={stats.paused} />
          <Card icon={<FiCheck />} label="Completadas" value={stats.completed} />
          <Card icon={<FiDollarSign />} label="Principal Total" valueUSD={stats.principal} />
          <Card icon={<FiTrendingUp />} label="Liquidado Total" valueUSD={stats.accrued} />
        </div>

        {/* Licencias */}
        <div className="space-y-6">
          {licenses.map((license) => (
            <LicenseCard key={license._id} license={license} />
          ))}
          {!loading && licenses.length === 0 && (
            <div className="text-center py-12">
              <FiDollarSign className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No tienes licencias en producción</h3>
              <p className="mt-1 text-sm text-gray-500">Compra un paquete para comenzar a generar beneficios.</p>
            </div>
          )}
        </div>
      </div>
    </UserLayout>
  );
}

function Card({icon,label,value,valueUSD}:{icon:React.ReactNode,label:string,value?:number,valueUSD?:number}) {
  return (
    <div className="bg-gradient-to-r from-white to-primary-50 border border-secondary-200 rounded-lg p-4">
      <div className="flex items-center gap-2 text-secondary-700 mb-2">{icon}<span className="text-sm font-medium">{label}</span></div>
      <div className="text-2xl font-bold">{valueUSD!==undefined ? `$${valueUSD.toFixed(2)}` : value}</div>
    </div>
  );
}

function LicenseCard({ license }: { license: License }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-700';
      case 'PAUSED': return 'bg-yellow-100 text-yellow-700';
      case 'COMPLETED': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'Activa';
      case 'PAUSED': return 'Pausada';
      case 'COMPLETED': return 'Completada';
      default: return status;
    }
  };

  const getScheduleChipColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-500 text-white';
      case 'today': return 'bg-blue-500 text-white';
      case 'pending': return 'bg-gray-200 text-gray-600';
      case 'pause': return 'bg-orange-500 text-white';
      default: return 'bg-gray-200 text-gray-600';
    }
  };

  const getScheduleChipText = (day: number, status: string) => {
    if (status === 'pause') return 'P';
    return day.toString();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {license.package.name}
          </h3>
          <p className="text-sm text-gray-500">
            Ciclo {license.cycle.index}/{license.plan.totalCycles}
            {license.cycle.isPauseToday && (
              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                <FiPause className="w-3 h-3 mr-1" />
                Pausa hoy
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(license.status)}`}>
            {getStatusText(license.status)}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            Progreso del Ciclo {license.cycle.index}
          </span>
          <span className="text-sm text-gray-500">
            {license.progress.cyclePercent.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(license.progress.cyclePercent, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{license.cycle.daysPaidInCycle} de {license.plan.productionDays} días pagados</span>
          <span>{license.progress.remainingDaysInCycle} días restantes</span>
        </div>
      </div>

      {/* Schedule */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Cronograma del Ciclo</h4>
        <div className="flex gap-2 flex-wrap">
          {license.schedule.map((day) => (
            <div
              key={day.day}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                getScheduleChipColor(day.status)
              }`}
              title={`Día ${day.day}: ${day.status === 'pause' ? 'Pausa' : day.status}`}
            >
              {getScheduleChipText(day.day, day.status)}
            </div>
          ))}
        </div>
        <div className="flex gap-4 text-xs text-gray-500 mt-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Pagado</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>Hoy</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-gray-200"></div>
            <span>Pendiente</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span>Pausa</span>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            ${license.accruedUSDT.toFixed(2)}
          </div>
          <div className="text-sm text-gray-500">Liquidado</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            ${license.restanteUSDT.toFixed(2)}
          </div>
          <div className="text-sm text-gray-500">Pendiente</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            ${license.progress.dailyUSDT.toFixed(2)}
          </div>
          <div className="text-sm text-gray-500">Diario</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {license.tope.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500">Tope</div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Principal: ${license.principalUSDT.toFixed(2)}</span>
          <span>Días restantes: {license.progress.remainingProductionDays}</span>
        </div>
      </div>
    </div>
  );
}