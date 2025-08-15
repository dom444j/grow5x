import React from 'react'
import { Link } from 'react-router-dom'

const CTA = () => {
  return (
    <section className="section-padding bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-800 text-white relative overflow-hidden">
      {/* Elementos decorativos */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-10 w-96 h-96 bg-gradient-to-br from-white/10 to-blue-300/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-gradient-to-tr from-yellow-300/10 to-purple-300/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-primary-300/5 to-secondary-300/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>
      
      <div className="container-max relative z-10">
        <div className="text-center">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 bg-gradient-to-r from-white via-yellow-200 to-white bg-clip-text text-transparent animate-pulse">
            🚀 ¡Obtén tu Licencia de Herramientas IA Hoy!
          </h2>
          <p className="text-xl md:text-2xl lg:text-3xl mb-10 opacity-95 max-w-4xl mx-auto leading-relaxed">
            Únete a <span className="font-bold text-yellow-300">cientos de usuarios</span> que ya están optimizando su capital con 
            <span className="font-bold text-blue-300">agentes IA especializados</span> de Grow5X.
            <br className="hidden md:block" />
            <span className="text-yellow-200">El momento perfecto para empezar es ahora.</span>
          </p>
          
          {/* Estadísticas destacadas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 max-w-5xl mx-auto">
            <div className="group bg-white/15 backdrop-blur-md rounded-2xl p-8 border border-white/20 hover:bg-white/20 hover:scale-105 transition-all duration-300 shadow-xl">
              <div className="text-5xl font-bold mb-3 bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent group-hover:scale-110 transition-transform duration-300">12.5%</div>
              <div className="text-white/90 text-lg font-medium">📈 Rendimiento IA diario</div>
            </div>
            <div className="group bg-white/15 backdrop-blur-md rounded-2xl p-8 border border-white/20 hover:bg-white/20 hover:scale-105 transition-all duration-300 shadow-xl">
              <div className="text-5xl font-bold mb-3 bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent group-hover:scale-110 transition-transform duration-300">9</div>
              <div className="text-white/90 text-lg font-medium">⏰ Días por ciclo IA</div>
            </div>
            <div className="group bg-white/15 backdrop-blur-md rounded-2xl p-8 border border-white/20 hover:bg-white/20 hover:scale-105 transition-all duration-300 shadow-xl">
              <div className="text-5xl font-bold mb-3 bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text text-transparent group-hover:scale-110 transition-transform duration-300">+400%</div>
              <div className="text-white/90 text-lg font-medium">🎯 Rendimiento IA potencial</div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-12">
            <Link
              to="/register"
              className="group bg-gradient-to-r from-yellow-400 to-orange-500 text-white hover:from-yellow-500 hover:to-orange-600 font-bold py-5 px-10 rounded-2xl text-xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-yellow-300/50 shadow-2xl hover:shadow-yellow-500/25 hover:scale-105 transform"
            >
              <span className="flex items-center justify-center space-x-2">
                <span>🚀 Obtener Licencia IA</span>
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </Link>
            <Link
              to="/simulator"
              className="group border-3 border-white text-white hover:bg-white hover:text-primary-600 font-bold py-5 px-10 rounded-2xl text-xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-white/50 shadow-2xl hover:shadow-white/25 hover:scale-105 transform backdrop-blur-sm"
            >
              <span className="flex items-center justify-center space-x-2">
                <span>🧮 Simular Agente IA</span>
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </span>
            </Link>
          </div>

          {/* Urgencia y escasez */}
          <div className="bg-gradient-to-r from-yellow-500/25 to-orange-500/25 border-2 border-yellow-400/50 rounded-2xl p-8 max-w-3xl mx-auto mb-12 backdrop-blur-md shadow-2xl animate-pulse">
            <div className="flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-yellow-300 mr-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-bold text-yellow-200 text-xl">⚡ Oferta por tiempo limitado</span>
            </div>
            <p className="text-yellow-100 text-lg leading-relaxed">
              Los primeros <span className="font-bold text-yellow-300">1000 usuarios</span> registrados este mes recibirán un 
              <span className="font-bold text-orange-300">bono adicional del 2%</span> en su primer ciclo de agentes IA. 
              <br />
              <span className="text-red-300 font-bold">¡Solo quedan pocas licencias disponibles!</span>
            </p>
          </div>

          {/* Garantías y seguridad */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-center space-x-3">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <div className="font-semibold">100% Seguro</div>
                <div className="text-primary-200 text-sm">Tecnología Blockchain</div>
              </div>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <div>
                <div className="font-semibold">Soporte 24/7</div>
                <div className="text-primary-200 text-sm">Asistencia inmediata</div>
              </div>
            </div>
          </div>

          {/* Testimonial rápido */}
          <div className="mt-12 max-w-2xl mx-auto">
            <blockquote className="text-lg italic opacity-90 mb-4">
              "En solo 45 días mis agentes IA convirtieron $2,000 en $11,250. Las herramientas IA de Grow5X cambiaron mi vida financiera completamente."
            </blockquote>
            <cite className="text-primary-200 text-sm">
              - María González, Usuario de licencias IA desde hace 6 meses
            </cite>
          </div>

          {/* Aviso legal */}
          <div className="mt-8 text-xs text-primary-200 opacity-75">
            * Los rendimientos mostrados son proyecciones basadas en el desempeño histórico de nuestros agentes IA. 
            Las licencias de herramientas IA conllevan riesgos y los resultados pasados no garantizan resultados futuros.
          </div>
        </div>
      </div>
    </section>
  )
}

export default CTA