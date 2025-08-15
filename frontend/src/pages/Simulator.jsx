import React, { useState } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const Simulator = () => {
  const [investment, setInvestment] = useState(1000)
  const [cycles, setCycles] = useState(1)
  const [showRegistration, setShowRegistration] = useState(false)

  // Cálculos basados en la arquitectura: 12.5% diario por 45 días
  const dailyReturn = 0.125
  const cycleDays = 45
  const totalReturn = investment * Math.pow(1 + dailyReturn, cycleDays * cycles)
  const profit = totalReturn - investment
  const roi = ((profit / investment) * 100).toFixed(2)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Header />
      
      <main className="section-padding">
        <div className="container-max">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl font-bold">📊</span>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Simulador de Licencias Grow5X
              </h1>
            </div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Calcula los retornos de tu licencia con nuestro sistema de trading automatizado
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Formulario de Simulación */}
              <div className="lg:col-span-1">
                <div className="backdrop-blur-sm bg-white/70 border border-white/20 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">⚙️</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Configuración
                    </h2>
                  </div>
                
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        💰 Licencia (USD)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">$</span>
                        <input
                          type="number"
                          value={investment}
                          onChange={(e) => setInvestment(Number(e.target.value))}
                          className="input-field pl-8 text-lg font-semibold"
                          min="100"
                          step="100"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        🔄 Ciclos (45 días c/u)
                      </label>
                      <input
                        type="number"
                        value={cycles}
                        onChange={(e) => setCycles(Number(e.target.value))}
                        className="input-field text-lg font-semibold"
                        min="1"
                        max="10"
                      />
                    </div>
                    
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-xl border border-blue-100">
                      <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                        <span>⚡</span> Sistema IA
                      </h3>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          <span className="text-blue-800">12.5% diario</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          <span className="text-blue-800">45 días/ciclo</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                          <span className="text-blue-800">24/7 activo</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                          <span className="text-blue-800">Auto-reinversión</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resultados */}
              <div className="lg:col-span-2">
                <div className="backdrop-blur-sm bg-white/70 border border-white/20 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">📈</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Proyección de Ganancias
                    </h2>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Valor Principal */}
                    <div className="text-center">
                      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white mb-4">
                        <div className="text-sm opacity-90 mb-1">💎 Valor Final</div>
                        <div className="text-3xl font-bold">
                          ${totalReturn.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-xl border border-blue-100">
                          <div className="text-lg font-bold text-blue-600">
                            ${profit.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </div>
                          <p className="text-xs text-blue-700">🎯 Retorno</p>
                        </div>
                        
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-100">
                          <div className="text-lg font-bold text-purple-600">
                            {roi}%
                          </div>
                          <p className="text-xs text-purple-700">📊 ROI Total</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Detalles y Acción */}
                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-4 rounded-xl border border-orange-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-lg font-bold text-orange-600">
                              {cycles * cycleDays} días
                            </div>
                            <p className="text-xs text-orange-700">⏱️ Período total</p>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-orange-600">
                              {cycles} ciclo{cycles > 1 ? 's' : ''}
                            </div>
                            <p className="text-xs text-orange-700">de 45 días</p>
                          </div>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => setShowRegistration(true)}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                      >
                        🚀 Adquirir Licencia
                      </button>
                      
                      <div className="text-center">
                        <p className="text-xs text-gray-500">
                          ✨ Registro gratuito • Sin comisiones ocultas
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Modal de Registro */}
            {showRegistration && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="backdrop-blur-sm bg-white/95 border border-white/20 rounded-2xl max-w-md w-full p-6 relative shadow-2xl">
                  <button 
                    onClick={() => setShowRegistration(false)}
                    className="absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all"
                  >
                    ✕
                  </button>
                  
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <span className="text-white text-2xl">🚀</span>
                    </div>
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                      ¡Adquiere tu Licencia!
                    </h3>
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-xl border border-green-100">
                      <p className="text-sm text-gray-700">
                        💰 Licencia: <span className="font-bold text-blue-600">${investment.toLocaleString()}</span>
                      </p>
                      <p className="text-sm text-gray-700">
                        🎯 Retorno proyectado: <span className="font-bold text-green-600">${profit.toLocaleString()}</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <input 
                        type="email" 
                        placeholder="📧 Tu email"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <input 
                        type="password" 
                        placeholder="🔒 Contraseña"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <input 
                        type="password" 
                        placeholder="🔒 Confirmar contraseña"
                        className="input-field"
                      />
                    </div>
                    
                    <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg">
                      ✨ Crear Cuenta y Adquirir
                    </button>
                    
                    <p className="text-sm text-gray-500 text-center">
                      ¿Ya tienes cuenta? 
                      <button className="text-blue-600 hover:text-purple-600 font-semibold hover:underline transition-colors">
                        Inicia sesión aquí
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Disclaimer */}
            <div className="mt-6">
              <div className="backdrop-blur-sm bg-gradient-to-r from-amber-50/80 to-orange-50/80 border border-amber-200/50 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm">⚠️</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-amber-900 mb-2">Aviso de Riesgo</h3>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Las proyecciones son estimaciones basadas en rendimientos históricos y no garantizan resultados futuros. 
                      Toda licencia conlleva riesgos y es posible obtener retornos menores a los proyectados. Consulte con un asesor financiero antes de adquirir una licencia.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  )
}

export default Simulator