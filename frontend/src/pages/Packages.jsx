import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiService, apiUtils } from '../services/api'
import { toast } from 'react-hot-toast'
import Header from '../components/Header'
import Footer from '../components/Footer'

const Packages = () => {
  const { user, isAuthenticated } = useAuth()
  const [packages, setPackages] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [purchaseData, setPurchaseData] = useState({
    walletAddress: '',
    transactionHash: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    loadPackages()
  }, [])

  const loadPackages = async () => {
    try {
      setIsLoading(true)
      const response = await apiService.packages.getAll()
      setPackages(response.data)
    } catch (error) {
      const errorMessage = apiUtils.getErrorMessage(error)
      toast.error(errorMessage)
      console.error('Error loading packages:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePurchaseClick = (pkg) => {
    if (!isAuthenticated) {
      toast.error('Debes iniciar sesión para comprar una licencia')
      return
    }
    setSelectedPackage(pkg)
    setShowPurchaseModal(true)
  }

  const handlePurchaseSubmit = async (e) => {
    e.preventDefault()
    
    if (!selectedPackage) return
    
    try {
      setIsSubmitting(true)
      
      // Submit payment
      const response = await apiService.payments.submit({
        packageId: selectedPackage._id,
        amount: selectedPackage.price,
        walletAddress: purchaseData.walletAddress
      })
      
      toast.success('Pago enviado correctamente. Ahora confirma tu hash de transacción.')
      
      // If transaction hash is provided, confirm it immediately
      if (purchaseData.transactionHash.trim()) {
        await apiService.payments.confirmHash({
          transactionHash: purchaseData.transactionHash.trim()
        })
        toast.success('Hash de transacción confirmado. Tu compra está siendo procesada.')
      }
      
      // Reset form and close modal
      setPurchaseData({ walletAddress: '', transactionHash: '' })
      setShowPurchaseModal(false)
      setSelectedPackage(null)
      
    } catch (error) {
      const errorMessage = apiUtils.getErrorMessage(error)
      toast.error(errorMessage)
      console.error('Purchase error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(price)
  }

  const getPackageIcon = (name) => {
    if (name.toLowerCase().includes('starter')) {
      return (
        <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>
      )
    }
    return (
      <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
        </svg>
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
                <p className="text-secondary-600">Cargando licencias...</p>
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
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Herramientas IA Especializadas
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-secondary-900 mb-6">
              Licencias de Agentes IA
            </h1>
            <p className="text-xl text-secondary-600 max-w-3xl mx-auto">
              Elige la licencia perfecta para acceder a nuestras herramientas tecnológicas 
              con agentes IA especializados en arbitraje automatizado.
            </p>
          </div>

          {/* Packages Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {packages.map((pkg) => (
              <div key={pkg._id} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden">
                <div className="p-8">
                  {getPackageIcon(pkg.name)}
                  
                  <h3 className="text-2xl font-bold text-secondary-900 mb-2">
                    {pkg.name}
                  </h3>
                  
                  <div className="text-3xl font-bold text-primary-600 mb-4">
                    {formatPrice(pkg.price)}
                    <span className="text-sm font-normal text-secondary-500 ml-1">USDT</span>
                  </div>
                  
                  <p className="text-secondary-600 mb-6">
                    {pkg.description}
                  </p>
                  
                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {pkg.features?.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-secondary-700">{feature}</span>
                      </li>
                    )) || [
                      <li key="default1" className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-secondary-700">Agentes IA automatizados</span>
                      </li>,
                      <li key="default2" className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-secondary-700">Rendimientos del 12.5% diario</span>
                      </li>,
                      <li key="default3" className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-secondary-700">5 ciclos completos</span>
                      </li>
                    ]}
                  </ul>
                  
                  <button
                    onClick={() => handlePurchaseClick(pkg)}
                    className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    Adquirir Licencia
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Info Section */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-secondary-900 mb-6">¿Cómo funciona?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">1</span>
                </div>
                <h3 className="text-lg font-semibold text-secondary-900 mb-2">Elige tu Licencia</h3>
                <p className="text-secondary-600">Selecciona la licencia que mejor se adapte a tus necesidades y presupuesto.</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">2</span>
                </div>
                <h3 className="text-lg font-semibold text-secondary-900 mb-2">Realiza el Pago</h3>
                <p className="text-secondary-600">Paga con USDT BEP-20 de forma segura y confirma tu transacción.</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">3</span>
                </div>
                <h3 className="text-lg font-semibold text-secondary-900 mb-2">Disfruta los Beneficios</h3>
                <p className="text-secondary-600">Accede a las herramientas IA y comienza a generar rendimientos automáticamente.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Purchase Modal */}
      {showPurchaseModal && selectedPackage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-secondary-900">
                  Adquirir {selectedPackage.name}
                </h3>
                <button
                  onClick={() => {
                    setShowPurchaseModal(false)
                    setSelectedPackage(null)
                    setPurchaseData({ walletAddress: '', transactionHash: '' })
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
                  <span className="text-secondary-700">Precio:</span>
                  <span className="text-2xl font-bold text-primary-600">
                    {formatPrice(selectedPackage.price)} USDT
                  </span>
                </div>
                <p className="text-sm text-secondary-600">
                  Pago únicamente en USDT BEP-20 (Binance Smart Chain)
                </p>
              </div>

              <form onSubmit={handlePurchaseSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Tu dirección de wallet (BEP-20)
                  </label>
                  <input
                    type="text"
                    value={purchaseData.walletAddress}
                    onChange={(e) => setPurchaseData(prev => ({ ...prev, walletAddress: e.target.value }))}
                    className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300"
                    placeholder="0x..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Hash de transacción (opcional)
                  </label>
                  <input
                    type="text"
                    value={purchaseData.transactionHash}
                    onChange={(e) => setPurchaseData(prev => ({ ...prev, transactionHash: e.target.value }))}
                    className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300"
                    placeholder="0x..."
                  />
                  <p className="text-xs text-secondary-500 mt-1">
                    Puedes agregarlo ahora o confirmarlo después desde tu dashboard
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPurchaseModal(false)
                      setSelectedPackage(null)
                      setPurchaseData({ walletAddress: '', transactionHash: '' })
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
                    {isSubmitting ? 'Procesando...' : 'Confirmar Compra'}
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

export default Packages