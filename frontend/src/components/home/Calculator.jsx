import React, { useState, useEffect } from 'react'

const Calculator = () => {
  const [investment, setInvestment] = useState(50)
  const [results, setResults] = useState({
    dailyReturn: 0,
    totalReturns: 0,
    finalAmount: 0,
    roi: 0
  })

  // 7 licencias exactas con montos fijos
  const packages = [
    { name: 'Licencia IA 1', amount: 50, color: 'bg-blue-100 text-blue-800' },
    { name: 'Licencia IA 2', amount: 100, color: 'bg-green-100 text-green-800' },
    { name: 'Licencia IA 3', amount: 250, color: 'bg-yellow-100 text-yellow-800' },
    { name: 'Licencia IA 4', amount: 500, color: 'bg-purple-100 text-purple-800' },
    { name: 'Licencia IA 5', amount: 1000, color: 'bg-red-100 text-red-800' },
    { name: 'Licencia IA 6', amount: 2500, color: 'bg-indigo-100 text-indigo-800' },
    { name: 'Licencia IA 7', amount: 5000, color: 'bg-pink-100 text-pink-800' }
  ]

  const getPackageInfo = (amount) => {
    return packages.find(pkg => pkg.amount === amount) || null
  }

  useEffect(() => {
    const dailyRate = 0.125 // 12.5%
    const tradingDaysPerCycle = 8 // 8 días de trading por ciclo
    const cycles = 5 // 5 ciclos completos
    const totalTradingDays = tradingDaysPerCycle * cycles // 40 días de trading total
    
    const dailyReturn = investment * dailyRate
    const totalReturns = dailyReturn * totalTradingDays
    const finalAmount = investment + totalReturns
    const roi = (totalReturns / investment) * 100

    setResults({
      dailyReturn,
      totalReturns,
      finalAmount,
      roi
    })
  }, [investment])

  const currentPackage = getPackageInfo(investment)

  return (
    <section className="section-padding bg-gradient-to-br from-primary-50 via-blue-50 to-purple-50">
      <div className="container-max">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Agentes IA Especializados en Arbitraje
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-6">
            Simulador de Herramientas IA
          </h2>
          <p className="text-xl text-secondary-600 max-w-3xl mx-auto">
            Calcula el potencial de nuestras herramientas tecnológicas con agentes IA automatizados bajo licencia de uso
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Panel de entrada */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-secondary-800 mb-6">
                Tu Licencia IA
              </h3>
              
              {/* Selección de licencias */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-secondary-700 mb-4">
                  Selecciona tu licencia de herramienta IA
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {packages.map((pkg, index) => (
                    <button
                      key={index}
                      onClick={() => setInvestment(pkg.amount)}
                      className={`p-4 rounded-lg text-center transition-all duration-200 border-2 ${
                        investment === pkg.amount
                          ? `${pkg.color} border-current shadow-lg transform scale-105`
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-semibold text-sm">{pkg.name}</div>
                      <div className="text-lg font-bold">${pkg.amount}</div>
                      <div className="text-xs opacity-75">USDT</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Información del paquete seleccionado */}
              {currentPackage && (
                <div className={`rounded-lg p-4 ${currentPackage.color} border-2 border-current`}>
                  <div className="text-center">
                    <div className="font-bold text-lg">{currentPackage.name}</div>
                    <div className="text-2xl font-bold">${currentPackage.amount} USDT</div>
                    <div className="text-sm opacity-75">Licencia IA seleccionada</div>
                  </div>
                </div>
              )}

              {/* Información del sistema */}
              <div className="mt-6 bg-blue-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-3">🤖 Detalles de Agentes IA</h4>
                <div className="space-y-2 text-sm text-blue-800">
                  <div className="flex justify-between">
                    <span>Rendimiento IA diario:</span>
                    <span className="font-semibold">12.5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Días de operación IA:</span>
                    <span className="font-semibold">8 días × 5 ciclos</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duración total:</span>
                    <span className="font-semibold">45 días</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel de resultados */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-secondary-800 mb-6">
                Proyección de Rendimientos IA
              </h3>
              
              <div className="space-y-6">
                {/* Ganancia diaria */}
                <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg p-4 border border-primary-200">
                  <div className="text-sm text-primary-700 mb-1">🤖 Rendimiento IA Diario</div>
                  <div className="text-2xl font-bold text-primary-800">
                    ${results.dailyReturn.toFixed(2)} USDT
                  </div>
                  <div className="text-xs text-primary-600">Generado por agente especializado</div>
                </div>

                {/* Total de rendimientos */}
                <div className="bg-success-50 rounded-lg p-4">
                  <div className="text-sm text-success-700 mb-1">Total de Rendimientos IA (40 días)</div>
                  <div className="text-2xl font-bold text-success-800">
                    ${results.totalReturns.toFixed(2)} USDT
                  </div>
                  <div className="text-xs text-success-600">Solo rendimientos IA, sin costo de licencia</div>
                </div>

                {/* Monto final */}
                <div className="bg-secondary-50 rounded-lg p-4">
                  <div className="text-sm text-secondary-700 mb-1">Monto Final (Licencia + Rendimientos IA)</div>
                  <div className="text-3xl font-bold text-secondary-800">
                    ${results.finalAmount.toFixed(2)} USDT
                  </div>
                  <div className="text-xs text-secondary-600">Después de 45 días</div>
                </div>

                {/* ROI */}
                <div className="bg-gradient-to-r from-primary-500 to-success-500 text-white rounded-lg p-4">
                  <div className="text-sm opacity-90 mb-1">Retorno de Licencia IA (ROI)</div>
                  <div className="text-3xl font-bold">
                    +{results.roi.toFixed(1)}%
                  </div>
                  <div className="text-xs opacity-90">En 45 días</div>
                </div>
              </div>

              {/* Cronograma de agente IA */}
              <div className="mt-8 p-4 bg-gradient-to-r from-secondary-50 to-purple-50 rounded-lg border border-purple-200">
                <h4 className="font-semibold text-secondary-800 mb-3">🤖 Cronograma del Agente IA</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-secondary-600">Ciclo 1 (Días 1-8):</span>
                    <span className="font-medium">${(results.dailyReturn * 8).toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary-600">Ciclo 2 (Días 10-17):</span>
                    <span className="font-medium">${(results.dailyReturn * 8).toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary-600">Ciclo 3 (Días 19-26):</span>
                    <span className="font-medium">${(results.dailyReturn * 8).toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary-600">Ciclo 4 (Días 28-35):</span>
                    <span className="font-medium">${(results.dailyReturn * 8).toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary-600">Ciclo 5 (Días 37-44):</span>
                    <span className="font-medium">${(results.dailyReturn * 8).toFixed(2)} USDT</span>
                  </div>
                  <div className="border-t border-secondary-200 pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Finalización (Día 45):</span>
                      <span className="text-primary-600">+${investment.toFixed(2)} USDT (Capital + Licencia)</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-purple-600 bg-purple-50 p-2 rounded">
                  💡 Cada ciclo es ejecutado por un agente IA especializado en arbitraje de criptomonedas
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <div className="bg-gradient-to-r from-white to-blue-50 rounded-2xl shadow-lg p-8 max-w-2xl mx-auto border border-blue-100">
              <div className="flex items-center justify-center gap-2 mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-bold text-secondary-800">
                  ¿Listo para licenciar estas herramientas IA?
                </h3>
              </div>
              <p className="text-secondary-600 mb-6">
                Obtén acceso a nuestros agentes IA especializados en arbitraje bajo licencia de uso. Comienza en menos de 24 horas.
              </p>
              <div className="space-y-3">
                <a href="/register" className="btn-primary block">
                  Licenciar Herramientas IA - ${investment} USDT
                </a>
                <p className="text-xs text-gray-500">
                  🔒 Licencia de uso • 🤖 Agentes IA incluidos • 📊 Soporte técnico 24/7
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Calculator