import React from 'react';

/**
 * Skeleton component for loading states
 */
const Skeleton = ({ 
  className = '', 
  width = 'w-full', 
  height = 'h-4', 
  rounded = 'rounded',
  animate = true 
}) => {
  return (
    <div 
      className={`bg-gray-200 ${width} ${height} ${rounded} ${animate ? 'animate-pulse' : ''} ${className}`}
    />
  );
};

/**
 * Card skeleton for package/purchase cards
 */
export const CardSkeleton = ({ className = '' }) => {
  return (
    <div className={`bg-white rounded-2xl shadow-lg p-8 border border-secondary-100 ${className}`}>
      <Skeleton width="w-12" height="h-12" rounded="rounded-xl" className="mb-4" />
      <Skeleton width="w-3/4" height="h-6" className="mb-3" />
      <Skeleton width="w-full" height="h-4" className="mb-2" />
      <Skeleton width="w-2/3" height="h-4" className="mb-6" />
      <Skeleton width="w-1/2" height="h-8" className="mb-2" />
      <Skeleton width="w-1/3" height="h-4" className="mb-6" />
      <Skeleton width="w-full" height="h-12" rounded="rounded-xl" />
    </div>
  );
};

/**
 * Table row skeleton
 */
export const TableRowSkeleton = ({ columns = 5 }) => {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="px-6 py-4">
          <Skeleton height="h-4" width={index === 0 ? 'w-3/4' : 'w-full'} />
        </td>
      ))}
    </tr>
  );
};

/**
 * Stats card skeleton
 */
export const StatsCardSkeleton = ({ className = '' }) => {
  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Skeleton width="w-1/2" height="h-4" className="mb-2" />
          <Skeleton width="w-1/3" height="h-8" />
        </div>
        <Skeleton width="w-12" height="h-12" rounded="rounded-lg" />
      </div>
    </div>
  );
};

/**
 * Dashboard skeleton layout
 */
export const DashboardSkeleton = () => {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <Skeleton width="w-1/3" height="h-8" className="mb-2" />
        <Skeleton width="w-1/2" height="h-4" />
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatsCardSkeleton key={index} />
        ))}
      </div>
      
      {/* Content Area */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <Skeleton width="w-1/4" height="h-6" className="mb-4" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center space-x-4">
              <Skeleton width="w-10" height="h-10" rounded="rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton width="w-3/4" height="h-4" />
                <Skeleton width="w-1/2" height="h-3" />
              </div>
              <Skeleton width="w-20" height="h-8" rounded="rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Packages grid skeleton
 */
export const PackagesGridSkeleton = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
      <div className="section-padding">
        <div className="container-max">
          {/* Header */}
          <div className="text-center mb-16">
            <Skeleton width="w-48" height="h-8" rounded="rounded-full" className="mx-auto mb-4" />
            <Skeleton width="w-96" height="h-12" className="mx-auto mb-6" />
            <Skeleton width="w-2/3" height="h-6" className="mx-auto" />
          </div>
          
          {/* Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, index) => (
              <CardSkeleton key={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Loading spinner component
 */
export const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };
  
  return (
    <div className={`animate-spin rounded-full border-b-2 border-primary-600 ${sizeClasses[size]} ${className}`} />
  );
};

/**
 * Full page loading component
 */
export const PageLoading = ({ message = 'Cargando...' }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <LoadingSpinner size="lg" className="mx-auto mb-4" />
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
};

export default Skeleton;