import React from 'react'

const WhatIs = () => {
  return (
    <section className="section-padding bg-gradient-to-br from-white via-primary-25 to-secondary-25 relative overflow-hidden">
      {/* Elementos decorativos */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-32 right-20 w-72 h-72 bg-gradient-to-br from-primary-100/30 to-blue-100/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-32 left-20 w-96 h-96 bg-gradient-to-tr from-secondary-100/30 to-purple-100/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
      
      <div className="container-max relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-6">
            ¿Qué es Grow5X?
          </h2>
          <p className="text-xl text-secondary-600 max-w-3xl mx-auto">
            Una plataforma de herramientas tecnológicas bajo licencia que te permite acceder 
            a agentes IA especializados en arbitraje automatizado para optimizar tu capital.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Contenido principal */}
          <div>
            <div className="space-y-8">
              <div className="group flex items-start space-x-4 p-6 bg-white/60 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 hover:shadow-xl hover:scale-105 transition-all duration-300">
                <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-primary-100 to-blue-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-7 h-7 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-secondary-800 mb-2 group-hover:text-primary-600 transition-colors duration-300">
                    🤖 Agentes IA Especializados
                  </h3>
                  <p className="text-secondary-600 leading-relaxed">
                    Accede a agentes de inteligencia artificial especializados en arbitraje que operan 
                    24/7 con algoritmos avanzados para optimizar el rendimiento de tu capital.
                  </p>
                </div>
              </div>

              <div className="group flex items-start space-x-4 p-6 bg-white/60 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 hover:shadow-xl hover:scale-105 transition-all duration-300">
                <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-success-100 to-emerald-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-7 h-7 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-secondary-800 mb-2 group-hover:text-success-600 transition-colors duration-300">
                    🛠️ Licencias de Herramientas IA
                  </h3>
                  <p className="text-secondary-600 leading-relaxed">
                    Obtén licencias de uso para herramientas tecnológicas avanzadas que incluyen 
                    agentes IA especializados en diferentes estrategias de arbitraje automatizado.
                  </p>
                </div>
              </div>

              <div className="group flex items-start space-x-4 p-6 bg-white/60 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 hover:shadow-xl hover:scale-105 transition-all duration-300">
                <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-secondary-100 to-purple-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-7 h-7 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-secondary-800 mb-2 group-hover:text-secondary-600 transition-colors duration-300">
                    🔒 Tecnología Segura y Transparente
                  </h3>
                  <p className="text-secondary-600 leading-relaxed">
                    Todas las operaciones se realizan con criptomonedas USDT en la red BEP20. 
                    Sistema transparente con seguimiento en tiempo real del rendimiento de los agentes IA.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Estadísticas y datos */}
          <div className="bg-gradient-to-br from-primary-50 to-secondary-50 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-secondary-800 mb-8 text-center">
              Especificaciones de Agentes IA
            </h3>
            
            <div className="space-y-6">
              {/* Agente IA */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h4 className="font-semibold text-secondary-800 mb-4">🤖 Agente IA de Arbitraje</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-secondary-600">Duración Total:</span>
                    <div className="font-semibold">45 días</div>
                  </div>
                  <div>
                    <span className="text-secondary-600">Por Ciclo:</span>
                    <div className="font-semibold">9 días</div>
                  </div>
                  <div>
                    <span className="text-secondary-600">Total Ciclos:</span>
                    <div className="font-semibold">5 ciclos</div>
                  </div>
                  <div>
                    <span className="text-secondary-600">Rendimiento IA:</span>
                    <div className="font-semibold text-primary-600">12.5% diario</div>
                  </div>
                </div>
              </div>

              {/* Licencias */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h4 className="font-semibold text-secondary-800 mb-4">🛠️ Licencias de Herramientas</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-secondary-600">Licencia directa:</span>
                    <span className="font-semibold text-success-600">10% comisión</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-secondary-600">Licencia padre global:</span>
                    <span className="font-semibold text-success-600">10% comisión</span>
                  </div>
                  <div className="text-xs text-secondary-500 mt-2">
                    * Comisiones por licencias vendidas
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default WhatIs