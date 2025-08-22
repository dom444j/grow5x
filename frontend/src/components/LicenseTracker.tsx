import React from 'react';
import { FiClock, FiCheck, FiDollarSign, FiTrendingUp, FiCalendar } from 'react-icons/fi';
import { toRenderableNumber } from '../utils/decimal';
import ProgressBar from './ProgressBar';

interface DailyBenefit {
  day: number;
  amount: number;
  releaseDate: string;
  status: 'pending' | 'released' | 'failed';
}

interface BenefitSchedule {
  scheduleId: string;
  purchase: {
    purchaseId: string;
    totalAmount: number;
    package: {
      packageId: string;
      name: string;
    };
    confirmedAt: string;
  };
  startAt: string;
  days: number;
  dailyRate: number;
  dailyBenefitAmount: number;
  scheduleStatus: 'active' | 'completed' | 'pending';
  totalReleased: number;
  daysReleased: number;
  dailyBenefits: DailyBenefit[];
  createdAt: string;
}

interface LicenseTrackerProps {
  schedule: BenefitSchedule;
}

const LicenseTracker: React.FC<LicenseTrackerProps> = ({ schedule }) => {
  const progressPercentage = (schedule.daysReleased / schedule.days) * 100;
  const remainingDays = schedule.days - schedule.daysReleased;
  const expectedTotal = schedule.dailyBenefitAmount * schedule.days;
  const remainingAmount = expectedTotal - schedule.totalReleased;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'released':
        return 'text-green-600 bg-green-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'released':
        return FiCheck;
      case 'pending':
        return FiClock;
      default:
        return FiClock;
    }
  };

  return (
    <div className="bg-gradient-to-r from-white to-blue-50 border border-blue-200 rounded-lg p-6 hover:shadow-lg transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
            <FiTrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {schedule.purchase.package.name}
            </h3>
            <p className="text-sm text-gray-600">
              Licencia ${toRenderableNumber(schedule.purchase.totalAmount)} USDT
            </p>
          </div>
        </div>
        
        <div className={`flex items-center px-3 py-1 rounded-full ${
          schedule.scheduleStatus === 'completed' ? 'bg-green-100 text-green-600' :
          schedule.scheduleStatus === 'active' ? 'bg-blue-100 text-blue-600' :
          'bg-yellow-100 text-yellow-600'
        }`}>
          <span className="text-sm font-medium capitalize">
            {schedule.scheduleStatus === 'completed' ? 'Completada' :
             schedule.scheduleStatus === 'active' ? 'Activa' : 'Pendiente'}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <ProgressBar
          percentage={progressPercentage}
          size="lg"
          color="gradient"
          label="Progreso de Liquidación"
          animated={true}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Día {schedule.daysReleased} de {schedule.days}</span>
          <span>{remainingDays} días restantes</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 border border-gray-100">
          <div className="flex items-center text-green-600 mb-2">
            <FiDollarSign className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Liquidado</span>
          </div>
          <p className="text-lg font-bold text-gray-900">
            ${toRenderableNumber(schedule.totalReleased)}
          </p>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-100">
          <div className="flex items-center text-blue-600 mb-2">
            <FiClock className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Pendiente</span>
          </div>
          <p className="text-lg font-bold text-gray-900">
            ${toRenderableNumber(remainingAmount)}
          </p>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-100">
          <div className="flex items-center text-purple-600 mb-2">
            <FiTrendingUp className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Diario</span>
          </div>
          <p className="text-lg font-bold text-gray-900">
            ${toRenderableNumber(schedule.dailyBenefitAmount)}
          </p>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-100">
          <div className="flex items-center text-orange-600 mb-2">
            <FiCalendar className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Tasa</span>
          </div>
          <p className="text-lg font-bold text-gray-900">
            {(schedule.dailyRate * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Daily Benefits Timeline */}
      <div className="bg-white rounded-lg p-4 border border-gray-100">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Cronograma de Liquidaciones</h4>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {schedule.dailyBenefits.map((benefit, index) => {
            const StatusIcon = getStatusIcon(benefit.status);
            const isToday = new Date(benefit.releaseDate).toDateString() === new Date().toDateString();
            
            return (
              <div
                key={index}
                className={`relative p-2 rounded-lg border-2 transition-all duration-200 ${
                  benefit.status === 'released' ? 'border-green-200 bg-green-50' :
                  benefit.status === 'pending' && isToday ? 'border-blue-200 bg-blue-50 ring-2 ring-blue-300' :
                  benefit.status === 'pending' ? 'border-yellow-200 bg-yellow-50' :
                  'border-red-200 bg-red-50'
                }`}
                title={`Día ${benefit.day}: $${toRenderableNumber(benefit.amount)} - ${new Date(benefit.releaseDate).toLocaleDateString()}`}
              >
                <div className="flex flex-col items-center">
                  <StatusIcon className={`w-4 h-4 mb-1 ${
                    benefit.status === 'released' ? 'text-green-600' :
                    benefit.status === 'pending' ? 'text-yellow-600' :
                    'text-red-600'
                  }`} />
                  <span className="text-xs font-medium text-gray-700">{benefit.day}</span>
                  {isToday && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="flex items-center justify-center mt-4 space-x-6 text-sm">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-100 border-2 border-green-200 rounded mr-2"></div>
            <span className="text-gray-600">Liquidado</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-yellow-100 border-2 border-yellow-200 rounded mr-2"></div>
            <span className="text-gray-600">Pendiente</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-100 border-2 border-blue-200 rounded mr-2 ring-2 ring-blue-300"></div>
            <span className="text-gray-600">Hoy</span>
          </div>
        </div>
      </div>

      {/* License Info */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex justify-between text-sm text-gray-600">
          <span>ID de Compra: {schedule.purchase.purchaseId}</span>
          <span>Iniciado: {new Date(schedule.startAt).toLocaleDateString('es-ES')}</span>
        </div>
      </div>
    </div>
  );
};

export default LicenseTracker;