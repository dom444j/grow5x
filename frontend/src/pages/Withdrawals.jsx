import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiService, apiUtils } from '../services/api'
import { toast } from 'react-hot-toast'
import Header from '../components/Header'
import Footer from '../components/Footer'

const Withdrawals = () => {
  const { user, getBalance } = useAuth()
  const [withdrawals, setWithdrawals] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawData, setWithdrawData] = useState({
    amount: '',
    walletAddress: '',
    pin: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [otpStatus, setOtpStatus] = useState(null)
  const [isRequestingOtp, setIsRequestingOtp] = useState(false)

  useEffect(() => {
    loadWithdrawals()
  }, [])

  const loadWithdrawals = async () => {
    try {
      setIsLoading(true)
      const response = await apiService.user.getWithdrawals({ limit: 20 })
      setWithdrawals(response.data.withdrawals || [])
    } catch (error) {
      const errorMessage = apiUtils.getErrorMessage(error)
      toast.error(errorMessage)
      console.error('Error loading withdrawals:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const requestOtp = async () => {
    try {
      setIsRequestingOtp(true)
      await apiService.user.requestOtp({ type: 'withdrawal' })
      toast.success('PIN enviado a tu Telegram. Revisa tus mensajes.')
      
      // Check OTP status
      const statusResponse = await apiService.user.getOtpStatus({ type: 'withdrawal' })
      setOtpStatus(statusResponse.data)
    } catch (error) {
      const errorMessage = apiUtils.getErrorMessage(error)
      toast.error(errorMessage)
    } finally {
      setIsRequestingOtp(false)
    }
  }

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault()
    
    const amount = parseFloat(withdrawData.amount)
    const availableBalance = getBalance('available')
    
    if (amount < 50) {
      toast.error('El monto mínimo de retiro es 50 USDT')
      return
    }
    
    if (amount > availableBalance) {
      toast.error('Saldo insuficiente')
      return
    }
    
    if (!withdrawData.pin.trim()) {
      toast.error('Debes ingresar el PIN de Telegram')
      return
    }
    
    try {
      setIsSubmitting(true)
      
      await apiService.user.requestWithdrawal({
        amount: amount,
        walletAddress: withdrawData.walletAddress.trim(),
        pin: withdrawData.pin.trim()
      })
      
      toast.success('Solicitud de retiro enviada correctamente')
      
      // Reset form and close modal
      setWithdrawData({ amount: '', walletAddress: '', pin: '' })
      setShowWithdrawModal(false)
      setOtpStatus(null)
      
      // Reload withdrawals
      loadWithdrawals()
      
    } catch (error) {
      const errorMessage = apiUtils.getErrorMessage(error)
      toast.error(errorMessage)
      console.error('Withdrawal error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', text: 'Pendiente' },
      approved: { color: 'bg-blue-100 text-blue-800', text: 'Aprobado' },
      completed: { color: 'bg-green-100 text-green-800', text: 'Completado' },
      rejected: { color: 'bg-red-100 text-red-800', text: 'Rechazado' }
    }
    
    const config = statusConfig[status] || statusConfig.pending
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    )
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
        <Header />
        <main className="section-padding">
          <div className="container-max">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-secondary-600">Cargando retiros...</p>
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
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-2">
                Mis Retiros
              </h1>
              <p className="text-secondary-600">
                Gestiona tus solicitudes de retiro y revisa su estado
              </p>
            </div>
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              Nuevo Retiro
            </button>
          </div>

          {/* Balance Info */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-secondary-900 mb-4">Saldo Disponible</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-primary-50 rounded-xl">
                <div className="text-2xl font-bold text-primary-600 mb-1">
                  {formatAmount(getBalance('available'))}
                </div>
                <div className="text-sm text-secondary-600">Disponible para Retiro</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-xl">
                <div className="text-2xl font-bold text-yellow-600 mb-1">
                  {formatAmount(getBalance('pending'))}
                </div>
                <div className="text-sm text-secondary-600">Pendiente de Liberación</div>
              </div>
              <div className="text-center p-4 bg-secondary-50 rounded-xl">
                <div className="text-2xl font-bold text-secondary-600 mb-1">
                  {formatAmount(getBalance('total'))}
                </div>
                <div className="text-sm text-secondary-600">Saldo Total</div>
              </div>
            </div>
          </div>

          {/* Withdrawals List */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-secondary-100">
              <h2 className="text-xl font-semibold text-secondary-900">Historial de Retiros</h2>
            </div>
            
            {withdrawals.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-secondary-900 mb-2">No hay retiros</h3>
                <p className="text-secondary-600 mb-4">Aún no has realizado ninguna solicitud de retiro.</p>
                <button
                  onClick={() => setShowWithdrawModal(true)}
                  className="bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all duration-300"
                >
                  Realizar Primer Retiro
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-secondary-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Monto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Wallet</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Hash</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-secondary-200">
                    {withdrawals.map((withdrawal) => (
                      <tr key={withdrawal._id} className="hover:bg-secondary-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                          {formatDate(withdrawal.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-secondary-900">
                          {formatAmount(withdrawal.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600">
                          <span className="font-mono">
                            {withdrawal.walletAddress.slice(0, 6)}...{withdrawal.walletAddress.slice(-4)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(withdrawal.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600">
                          {withdrawal.txHash ? (
                            <span className="font-mono">
                              {withdrawal.txHash.slice(0, 6)}...{withdrawal.txHash.slice(-4)}
                            </span>
                          ) : (
                            <span className="text-secondary-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-secondary-900">
                  Solicitar Retiro
                </h3>
                <button
                  onClick={() => {
                    setShowWithdrawModal(false)
                    setWithdrawData({ amount: '', walletAddress: '', pin: '' })
                    setOtpStatus(null)
                  }}
                  className="text-secondary-400 hover:text-secondary-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="bg-primary-50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-secondary-700">Saldo disponible:</span>
                  <span className="text-xl font-bold text-primary-600">
                    {formatAmount(getBalance('available'))}
                  </span>
                </div>
                <p className="text-sm text-secondary-600">
                  Monto mínimo: 50 USDT • Red: BEP-20 (BSC)
                </p>
              </div>

              <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Monto a retirar (USDT)
                  </label>
                  <input
                    type="number"
                    min="50"
                    max={getBalance('available')}
                    step="0.01"
                    value={withdrawData.amount}
                    onChange={(e) => setWithdrawData(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300"
                    placeholder="50.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Dirección de wallet (BEP-20)
                  </label>
                  <input
                    type="text"
                    value={withdrawData.walletAddress}
                    onChange={(e) => setWithdrawData(prev => ({ ...prev, walletAddress: e.target.value }))}
                    className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300"
                    placeholder="0x..."
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-secondary-700">
                      PIN de Telegram
                    </label>
                    <button
                      type="button"
                      onClick={requestOtp}
                      disabled={isRequestingOtp}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
                    >
                      {isRequestingOtp ? 'Enviando...' : 'Solicitar PIN'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={withdrawData.pin}
                    onChange={(e) => setWithdrawData(prev => ({ ...prev, pin: e.target.value }))}
                    className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300"
                    placeholder="Ingresa el PIN de 6 dígitos"
                    maxLength="6"
                    required
                  />
                  <p className="text-xs text-secondary-500 mt-1">
                    Recibirás un PIN de 6 dígitos en tu Telegram
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowWithdrawModal(false)
                      setWithdrawData({ amount: '', walletAddress: '', pin: '' })
                      setOtpStatus(null)
                    }}
                    className="flex-1 px-6 py-3 border border-secondary-200 text-secondary-700 rounded-xl hover:bg-secondary-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Procesando...' : 'Solicitar Retiro'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

export default Withdrawals