import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiService, apiUtils } from '../services/api'
import { toast } from 'react-hot-toast'
import Header from '../components/Header'
import Footer from '../components/Footer'

const Admin = () => {
  const { user, isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [pendingPayments, setPendingPayments] = useState([])
  const [pendingWithdrawals, setPendingWithdrawals] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null)

  useEffect(() => {
    if (!isAdmin()) {
      toast.error('Acceso denegado')
      return
    }
    loadDashboardData()
  }, [])

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers()
    } else if (activeTab === 'payments') {
      loadPendingPayments()
    } else if (activeTab === 'withdrawals') {
      loadPendingWithdrawals()
    }
  }, [activeTab])

  const loadDashboardData = async () => {
    try {
      setIsLoading(true)
      const response = await apiService.admin.getStats()
      setStats(response.data)
    } catch (error) {
      const errorMessage = apiUtils.getErrorMessage(error)
      toast.error(errorMessage)
      console.error('Error loading admin stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const response = await apiService.admin.getUsers({ limit: 50 })
      setUsers(response.data.users || [])
    } catch (error) {
      const errorMessage = apiUtils.getErrorMessage(error)
      toast.error(errorMessage)
    }
  }

  const loadPendingPayments = async () => {
    try {
      const response = await apiService.admin.getPendingPayments({ limit: 50 })
      setPendingPayments(response.data.payments || [])
    } catch (error) {
      const errorMessage = apiUtils.getErrorMessage(error)
      toast.error(errorMessage)
    }
  }

  const loadPendingWithdrawals = async () => {
    try {
      const response = await apiService.admin.getPendingWithdrawals({ limit: 50 })
      setPendingWithdrawals(response.data.withdrawals || [])
    } catch (error) {
      const errorMessage = apiUtils.getErrorMessage(error)
      toast.error(errorMessage)
    }
  }

  const confirmPayment = async (paymentId) => {
    try {
      await apiService.admin.confirmPayment({ paymentId })
      toast.success('Pago confirmado correctamente')
      loadPendingPayments()
      loadDashboardData()
    } catch (error) {
      const errorMessage = apiUtils.getErrorMessage(error)
      toast.error(errorMessage)
    }
  }

  const approveWithdrawal = async (withdrawalId) => {
    try {
      await apiService.admin.approveWithdrawal({ withdrawalId })
      toast.success('Retiro aprobado correctamente')
      loadPendingWithdrawals()
      loadDashboardData()
    } catch (error) {
      const errorMessage = apiUtils.getErrorMessage(error)
      toast.error(errorMessage)
    }
  }

  const rejectWithdrawal = async (withdrawalId, reason) => {
    try {
      await apiService.admin.rejectWithdrawal({ withdrawalId, reason })
      toast.success('Retiro rechazado')
      loadPendingWithdrawals()
      loadDashboardData()
    } catch (error) {
      const errorMessage = apiUtils.getErrorMessage(error)
      toast.error(errorMessage)
    }
  }

  const completeWithdrawal = async (withdrawalId, txHash) => {
    try {
      await apiService.admin.completeWithdrawal({ withdrawalId, txHash })
      toast.success('Retiro completado correctamente')
      loadPendingWithdrawals()
      loadDashboardData()
    } catch (error) {
      const errorMessage = apiUtils.getErrorMessage(error)
      toast.error(errorMessage)
    }
  }

  const runCronJob = async (jobType) => {
    try {
      await apiService.admin.runCronJob({ jobType })
      toast.success(`CRON ${jobType} ejecutado correctamente`)
      loadDashboardData()
    } catch (error) {
      const errorMessage = apiUtils.getErrorMessage(error)
      toast.error(errorMessage)
    }
  }

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!isAdmin()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
        <Header />
        <main className="section-padding">
          <div className="container-max">
            <div className="text-center py-16">
              <h1 className="text-3xl font-bold text-secondary-900 mb-4">Acceso Denegado</h1>
              <p className="text-secondary-600">No tienes permisos para acceder a esta página.</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
        <Header />
        <main className="section-padding">
          <div className="container-max">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-secondary-600">Cargando panel de administración...</p>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
      <Header />
      
      <main className="section-padding">
        <div className="container-max">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-2">
              Panel de Administración
            </h1>
            <p className="text-secondary-600">
              Gestiona usuarios, pagos, retiros y configuraciones del sistema
            </p>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-2xl shadow-lg mb-8">
            <div className="border-b border-secondary-200">
              <nav className="flex space-x-8 px-6">
                {[
                  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
                  { id: 'users', label: 'Usuarios', icon: '👥' },
                  { id: 'payments', label: 'Pagos', icon: '💳' },
                  { id: 'withdrawals', label: 'Retiros', icon: '💰' },
                  { id: 'cron', label: 'CRON Jobs', icon: '⚙️' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
                    }`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {/* Dashboard Tab */}
              {activeTab === 'dashboard' && stats && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-primary-50 rounded-xl p-6">
                      <div className="text-2xl font-bold text-primary-600 mb-1">
                        {stats.totalUsers || 0}
                      </div>
                      <div className="text-sm text-secondary-600">Total Usuarios</div>
                    </div>
                    <div className="bg-green-50 rounded-xl p-6">
                      <div className="text-2xl font-bold text-green-600 mb-1">
                        {formatAmount(stats.totalRevenue || 0)}
                      </div>
                      <div className="text-sm text-secondary-600">Ingresos Totales</div>
                    </div>
                    <div className="bg-yellow-50 rounded-xl p-6">
                      <div className="text-2xl font-bold text-yellow-600 mb-1">
                        {stats.pendingPayments || 0}
                      </div>
                      <div className="text-sm text-secondary-600">Pagos Pendientes</div>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-6">
                      <div className="text-2xl font-bold text-blue-600 mb-1">
                        {stats.pendingWithdrawals || 0}
                      </div>
                      <div className="text-sm text-secondary-600">Retiros Pendientes</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Users Tab */}
              {activeTab === 'users' && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-secondary-900">Usuarios Registrados</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-secondary-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase">Usuario</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase">Registro</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase">Estado</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase">Saldo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-secondary-200">
                        {users.map((user) => (
                          <tr key={user._id} className="hover:bg-secondary-50">
                            <td className="px-4 py-4 text-sm font-medium text-secondary-900">
                              {user.firstName} {user.lastName}
                            </td>
                            <td className="px-4 py-4 text-sm text-secondary-600">
                              {user.email}
                            </td>
                            <td className="px-4 py-4 text-sm text-secondary-600">
                              {formatDate(user.createdAt)}
                            </td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {user.isActive ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-secondary-900">
                              {formatAmount(user.balance?.total || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Payments Tab */}
              {activeTab === 'payments' && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-secondary-900">Pagos Pendientes</h2>
                  <div className="space-y-4">
                    {pendingPayments.map((payment) => (
                      <div key={payment._id} className="bg-secondary-50 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-secondary-900">
                              {payment.user?.firstName} {payment.user?.lastName}
                            </div>
                            <div className="text-sm text-secondary-600">
                              {payment.package?.name} - {formatAmount(payment.amount)}
                            </div>
                            <div className="text-xs text-secondary-500">
                              {formatDate(payment.createdAt)}
                            </div>
                            {payment.txHash && (
                              <div className="text-xs font-mono text-secondary-600 mt-1">
                                Hash: {payment.txHash}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => confirmPayment(payment._id)}
                            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                          >
                            Confirmar
                          </button>
                        </div>
                      </div>
                    ))}
                    {pendingPayments.length === 0 && (
                      <div className="text-center py-8 text-secondary-600">
                        No hay pagos pendientes
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Withdrawals Tab */}
              {activeTab === 'withdrawals' && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-secondary-900">Retiros Pendientes</h2>
                  <div className="space-y-4">
                    {pendingWithdrawals.map((withdrawal) => (
                      <div key={withdrawal._id} className="bg-secondary-50 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-secondary-900">
                              {withdrawal.user?.firstName} {withdrawal.user?.lastName}
                            </div>
                            <div className="text-sm text-secondary-600">
                              {formatAmount(withdrawal.amount)} → {withdrawal.walletAddress.slice(0, 10)}...
                            </div>
                            <div className="text-xs text-secondary-500">
                              {formatDate(withdrawal.createdAt)}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => approveWithdrawal(withdrawal._id)}
                              className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 transition-colors"
                            >
                              Aprobar
                            </button>
                            <button
                              onClick={() => rejectWithdrawal(withdrawal._id, 'Rechazado por administrador')}
                              className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors"
                            >
                              Rechazar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {pendingWithdrawals.length === 0 && (
                      <div className="text-center py-8 text-secondary-600">
                        No hay retiros pendientes
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CRON Jobs Tab */}
              {activeTab === 'cron' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-secondary-900">Gestión de CRON Jobs</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-secondary-50 rounded-xl p-6">
                      <h3 className="text-lg font-medium text-secondary-900 mb-4">Beneficios Diarios</h3>
                      <p className="text-sm text-secondary-600 mb-4">
                        Procesa los beneficios diarios del 12.5% para todos los usuarios activos.
                      </p>
                      <button
                        onClick={() => runCronJob('daily-benefits')}
                        className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors"
                      >
                        Ejecutar Ahora
                      </button>
                    </div>
                    <div className="bg-secondary-50 rounded-xl p-6">
                      <h3 className="text-lg font-medium text-secondary-900 mb-4">Liberar Comisiones</h3>
                      <p className="text-sm text-secondary-600 mb-4">
                        Libera las comisiones pendientes que han cumplido el tiempo de espera.
                      </p>
                      <button
                        onClick={() => runCronJob('unlock-commissions')}
                        className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors"
                      >
                        Ejecutar Ahora
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default Admin