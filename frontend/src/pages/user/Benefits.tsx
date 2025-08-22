import React, { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiService, apiUtils } from '../../services/api'
import { toast } from 'react-hot-toast'
import ProgressBar from '../../components/ProgressBar'
import CapProgressBar from '../../components/CapProgressBar'

// Types
interface BenefitSchedule {
  id: string
  purchaseId: string
  packageName: string
  day: number
  amount: number
  releaseDate: Date
  status: 'paid' | 'pending'
  purchaseAmount: number
  scheduleStatus?: string
  capPercentMax?: number
  capReached?: boolean
  isPaused?: boolean
  pauseReason?: string
  remainingDays?: number
  progressPercent?: number
  remainingAmount?: number
  totalReleased?: number
}

interface Commission {
  id: string
  amount: number
  referredUser: {
    email: string
  }
  purchaseId: string
  createdAt: string
}

interface BenefitsSummary {
  totalBenefits: number
  paidBenefits: number
  pendingBenefits: number
  totalCommissions: number
}

interface BenefitsApiResponse {
  success: boolean
  data: {
    summary: {
      totalAccrued: number
      totalPaid: number
      totalPending: number
    }
    benefitSchedules: Array<{
      _id: string
      scheduleStatus: string
      capPercentMax?: number
      capReached?: boolean
      isPaused?: boolean
      pauseReason?: string
      remainingDays?: number
      progressPercent?: number
      remainingAmount?: number
      purchase: {
        purchaseId: string
        paymentHash?: string
        walletAddress?: string
        package: {
          name: string
        }
        totalAmount: number
      }
      dailyBenefits: Array<{
        amount: number
        releaseDate: string
        status: 'paid' | 'pending'
      }>
    }>
    benefitHistory: Array<any>
    commissionHistory: Array<{
      id: string
      amount: number
      purchaseId: string
      createdAt: string
    }>
  }
}

const Benefits: React.FC = () => {
  const { user, logout } = useAuth()
  const [benefitsData, setBenefitsData] = useState<BenefitSchedule[]>([])
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<BenefitsSummary>({
    totalBenefits: 0,
    paidBenefits: 0,
    pendingBenefits: 0,
    totalCommissions: 0
  })

  useEffect(() => {
    const loadBenefitsData = async (): Promise<void> => {
      try {
        setIsLoading(true)
        
        // Load user benefits data from new endpoint
        const benefitsResponse = await apiService.benefits.getUserBenefits({ limit: 100 }) as { data: BenefitsApiResponse }
        
        if (benefitsResponse.data.success) {
          const { summary, benefitSchedules, benefitHistory, commissionHistory } = benefitsResponse.data.data
          
          // Transform benefit schedules for display
          const transformedBenefits: BenefitSchedule[] = []
          let totalBenefits = 0
          let paidBenefits = 0
          let pendingBenefits = 0
          
          benefitSchedules.forEach(schedule => {
            schedule.dailyBenefits.forEach((dayBenefit, index) => {
              transformedBenefits.push({
                id: `${schedule.purchase.purchaseId}_day_${index + 1}`,
                purchaseId: schedule.purchase.purchaseId,
                packageName: schedule.purchase.package.name,
                day: index + 1,
                amount: dayBenefit.amount,
                releaseDate: new Date(dayBenefit.releaseDate),
                status: dayBenefit.status,
                purchaseAmount: schedule.purchase.totalAmount,
                scheduleStatus: schedule.scheduleStatus,
                capPercentMax: schedule.capPercentMax,
                capReached: schedule.capReached,
                isPaused: schedule.isPaused,
                pauseReason: schedule.pauseReason,
                remainingDays: schedule.remainingDays,
                progressPercent: schedule.progressPercent,
                remainingAmount: schedule.remainingAmount
              })
              
              totalBenefits += dayBenefit.amount
              if (dayBenefit.status === 'paid') {
                paidBenefits += dayBenefit.amount
              } else {
                pendingBenefits += dayBenefit.amount
              }
            })
          })
          
          // Transform commission history
          const transformedCommissions: Commission[] = commissionHistory.map(commission => ({
            id: commission.id,
            amount: commission.amount,
            referredUser: {
              email: 'Usuario Referido'
            },
            purchaseId: commission.purchaseId,
            createdAt: commission.createdAt
          }))
          
          const totalCommissions = transformedCommissions.reduce((sum, comm) => sum + comm.amount, 0)
          
          setBenefitsData(transformedBenefits.sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()))
          setCommissions(transformedCommissions)
          setSummary({
            totalBenefits,
            paidBenefits,
            pendingBenefits,
            totalCommissions
          })
        }
        
      } catch (err) {
        const errorMessage = apiUtils.getErrorMessage(err as Error)
        setError(errorMessage)
        toast.error(errorMessage)
        console.error('Benefits error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (user) {
      loadBenefitsData()
    }
  }, [user])

  const handleLogout = async (): Promise<void> => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusBadge = (status: 'paid' | 'pending'): string => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium'
    
    switch (status) {
      case 'paid':
        return `${baseClasses} bg-green-100 text-green-800`
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const getStatusText = (status: 'paid' | 'pending'): string => {
    switch (status) {
      case 'paid':
        return 'Pagado'
      case 'pending':
        return 'Pendiente'
      default:
        return 'Desconocido'
    }
  }

  const getLicenseStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'Activa'
      case 'PAUSED':
        return 'Pausada'
      case 'COMPLETED':
        return 'Completada'
      case 'CANCELLED':
        return 'Cancelada'
      default:
        return status
    }
  }

  const getLicenseStatusBadge = (status: string, isPaused?: boolean) => {
    if (isPaused) {
      return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800'
    }
    switch (status) {
      case 'ACTIVE':
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'
      case 'PAUSED':
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800'
      case 'COMPLETED':
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'
      case 'CANCELLED':
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800'
      default:
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-secondary-600">Cargando beneficios...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-secondary-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img src="/logo-mobile.svg" alt="Grow5X" className="h-8 w-auto" />
              <h1 className="ml-3 text-xl font-bold text-secondary-900">Beneficios</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-secondary-600">Hola, {user?.firstName || 'Usuario'}</span>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-700 font-medium">{error || 'Error desconocido'}</p>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-secondary-600">Total Beneficios</p>
                <p className="text-2xl font-bold text-secondary-900">
                  {formatCurrency(summary.totalBenefits)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-secondary-600">Beneficios Pagados</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary.paidBenefits)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-secondary-600">Beneficios Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(summary.pendingBenefits)}
                </p>
              </div>
            </div>
          </div>

          {/* Conditional Commissions Card - Only show if there are commissions */}
          {summary.totalCommissions > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-secondary-600">Comisiones Directas</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(summary.totalCommissions)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Benefits Schedule Table */}
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 mb-8">
          <div className="px-6 py-4 border-b border-secondary-200">
            <h3 className="text-lg font-semibold text-secondary-900">Cronograma de Beneficios</h3>
            <p className="text-sm text-secondary-600 mt-1">
              Beneficios diarios del 12.5% por 8 días consecutivos
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-secondary-200">
              <thead className="bg-secondary-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Compra
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Estado Licencia
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Día
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Fecha de Liberación
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Estado Beneficio
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-secondary-200">
                {benefitsData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="text-secondary-400">
                        <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p className="text-lg font-medium text-secondary-900 mb-1">No hay beneficios programados</p>
                        <p className="text-secondary-600">Realiza una compra confirmada para comenzar a generar beneficios diarios.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  benefitsData.map((benefit) => (
                    <tr key={benefit.id} className="hover:bg-secondary-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-secondary-900">
                            {benefit.packageName}
                          </div>
                          <div className="text-sm text-secondary-500">
                            {benefit.purchaseId}
                          </div>
                          {benefit.progressPercent !== undefined && (
                            <div className="mt-1">
                              <ProgressBar
                                percentage={benefit.progressPercent}
                                size="sm"
                                color="gradient"
                                label={`Progreso: ${benefit.progressPercent.toFixed(1)}%`}
                                showPercentage={false}
                                animated={true}
                              />
                            </div>
                          )}
                          
                          {/* Cap Progress */}
                          {benefit.capPercentMax && benefit.capPercentMax > 0 && benefit.capReached !== undefined && (
                            <div className="mt-2">
                              <CapProgressBar
                                currentAmount={benefit.totalReleased || 0}
                                capAmount={benefit.capPercentMax > 0 ? (benefit.totalReleased || 0) / (benefit.capPercentMax / 100) : 0}
                                capPercentMax={benefit.capPercentMax}
                                showDetails={false}
                                className="border-0 p-0 bg-transparent"
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <span className={getLicenseStatusBadge(benefit.scheduleStatus || 'UNKNOWN', benefit.isPaused)}>
                            {getLicenseStatusText(benefit.scheduleStatus || 'UNKNOWN')}
                          </span>
                          {benefit.isPaused && benefit.pauseReason && (
                            <div className="text-xs text-yellow-600 mt-1">
                              {benefit.pauseReason}
                            </div>
                          )}
                          {benefit.remainingDays !== undefined && benefit.remainingDays > 0 && (
                            <div className="text-xs text-secondary-500 mt-1">
                              {benefit.remainingDays} días restantes
                            </div>
                          )}
                          {benefit.capReached && (
                            <div className="text-xs text-orange-600 mt-1">
                              Tope alcanzado
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-secondary-900">
                          Día {benefit.day}/8
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-secondary-900">
                          {formatDate(benefit.releaseDate)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-secondary-900">
                          {formatCurrency(benefit.amount)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={getStatusBadge(benefit.status)}>
                          {getStatusText(benefit.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Commissions Table - Only show if there are commissions */}
        {commissions.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-secondary-200">
            <div className="px-6 py-4 border-b border-secondary-200">
              <h3 className="text-lg font-semibold text-secondary-900">Comisiones por Referidos</h3>
              <p className="text-sm text-secondary-600 mt-1">
                Comisiones del 10% por referidos directos (liberadas en D+9)
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-secondary-200">
                <thead className="bg-secondary-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                      Referido
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                      Compra
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                      Comisión
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-secondary-200">
                  {commissions.map((commission, index) => (
                    <tr key={index} className="hover:bg-secondary-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-secondary-900">
                          {commission.referredUser?.email || 'Usuario'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-secondary-900">
                          {commission.purchaseId || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-secondary-900">
                          {formatDate(new Date(commission.createdAt))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-green-600">
                          {formatCurrency(commission.amount)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Pagado
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default Benefits