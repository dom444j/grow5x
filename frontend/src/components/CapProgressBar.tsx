import React from 'react';
import ProgressBar from './ProgressBar';
import { FiTarget, FiTrendingUp } from 'react-icons/fi';
import { toRenderableNumber } from '../utils/decimal';

interface CapProgressBarProps {
  currentAmount: number;
  capAmount: number;
  capPercentMax: number;
  className?: string;
  showDetails?: boolean;
}

const CapProgressBar: React.FC<CapProgressBarProps> = ({
  currentAmount,
  capAmount,
  capPercentMax,
  className = '',
  showDetails = true
}) => {
  const progressPercentage = capAmount > 0 ? (currentAmount / capAmount) * 100 : 0;
  const remainingAmount = Math.max(capAmount - currentAmount, 0);
  const isNearCap = progressPercentage >= 80;
  const isAtCap = progressPercentage >= 100;

  const getProgressColor = () => {
    if (isAtCap) return 'red';
    if (isNearCap) return 'orange';
    return 'green';
  };

  const getStatusText = () => {
    if (isAtCap) return 'Tope alcanzado';
    if (isNearCap) return 'Cerca del tope';
    return 'En progreso';
  };

  const getStatusIcon = () => {
    if (isAtCap) return FiTarget;
    return FiTrendingUp;
  };

  const StatusIcon = getStatusIcon();

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <StatusIcon className={`w-5 h-5 mr-2 ${
            isAtCap ? 'text-red-600' :
            isNearCap ? 'text-orange-600' :
            'text-green-600'
          }`} />
          <span className="text-sm font-medium text-gray-700">
            Progreso hacia Tope de Ganancias
          </span>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          isAtCap ? 'bg-red-100 text-red-700' :
          isNearCap ? 'bg-orange-100 text-orange-700' :
          'bg-green-100 text-green-700'
        }`}>
          {getStatusText()}
        </span>
      </div>

      {/* Progress Bar */}
      <ProgressBar
        percentage={progressPercentage}
        size="md"
        color={getProgressColor()}
        showPercentage={true}
        animated={true}
        className="mb-3"
      />

      {/* Details */}
      {showDetails && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Ganado:</span>
            <p className="font-semibold text-gray-900">
              ${toRenderableNumber(currentAmount)}
            </p>
          </div>
          <div>
            <span className="text-gray-600">Tope ({capPercentMax}%):</span>
            <p className="font-semibold text-gray-900">
              ${toRenderableNumber(capAmount)}
            </p>
          </div>
          {!isAtCap && (
            <div className="col-span-2">
              <span className="text-gray-600">Restante:</span>
              <p className="font-semibold text-green-600">
                ${toRenderableNumber(remainingAmount)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Warning for near cap */}
      {isNearCap && !isAtCap && (
        <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-xs text-orange-700">
            ⚠️ Te estás acercando al tope de ganancias. Considera reinvertir pronto.
          </p>
        </div>
      )}

      {/* Cap reached warning */}
      {isAtCap && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-700">
            🎯 Has alcanzado el tope máximo de ganancias para esta licencia.
          </p>
        </div>
      )}
    </div>
  );
};

export default CapProgressBar;