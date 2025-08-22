import React from 'react'
import { Link } from 'react-router-dom'

const Hero = () => {
  return (
    <section className="bg-gradient-to-br from-primary-50 via-white to-secondary-50 section-padding relative overflow-hidden">
      {/* Elementos decorativos de fondo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-primary-200/30 to-blue-200/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-secondary-200/30 to-purple-200/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-gradient-to-r from-green-200/20 to-emerald-200/20 rounded-full blur-2xl animate-bounce"></div>
      </div>
      
      <div className="container-max relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Contenido principal */}
          <div className="text-center lg:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-secondary-900 mb-6 leading-tight">
              Optimiza tu capital con
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-blue-600 block animate-pulse">Agentes IA Grow5X</span>
            </h1>
            
            <p className="text-xl text-secondary-600 mb-8 leading-relaxed max-w-2xl">
              Plataforma de herramientas tecnológicas bajo licencia con agentes IA especializados. 
              <strong className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">Tecnología avanzada de IA</strong> para gestión automatizada durante 8 días de operación por ciclo.
              Sistema de comisiones por licencias del 10%.
            </p>

            {/* Estadísticas destacadas */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-primary-200 hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-blue-600">12.5%</div>
                <div className="text-sm text-secondary-600 font-medium">Rendimiento IA</div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-success-200 hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-success-600 to-emerald-600">9</div>
                <div className="text-sm text-secondary-600 font-medium">Días por ciclo</div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-secondary-200 col-span-2 md:col-span-1 hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-secondary-800 to-gray-700">10%</div>
                <div className="text-sm text-secondary-600 font-medium">Comisión licencias</div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/register"
                className="group relative bg-gradient-to-r from-primary-600 to-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 text-center inline-block overflow-hidden"
              >
                <span className="relative z-10">🚀 Obtener Licencia IA</span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </Link>
              <Link
                to="/simulator"
                className="group bg-white/80 backdrop-blur-sm border-2 border-primary-600 text-primary-600 px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 hover:bg-primary-600 hover:text-white text-center inline-block"
              >
                📊 Simular Agente IA
              </Link>
            </div>

            {/* Aviso legal pequeño */}
            <p className="text-xs text-secondary-500 mt-6">
              * Las licencias de herramientas IA conllevan riesgos. Lee nuestros{' '}
              <Link to="/terms" className="text-primary-600 hover:underline">
                términos y condiciones
              </Link>
              {' '}antes de licenciar.
            </p>
          </div>

          {/* Dashboard Mockup */}
          <div className="relative animate-float">
            {/* Fondo con gradiente y glassmorphism */}
            <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 rounded-3xl shadow-2xl p-8 border border-white/10 backdrop-blur-sm">
              {/* Header del Dashboard */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-white font-semibold text-lg">Panel Agentes IA</h3>
                  <p className="text-blue-300 text-sm">Licencias Activas</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>

              {/* Balance Principal */}
              <div className="glass rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-300 text-sm mb-1">Rendimiento IA Total</p>
                    <h2 className="text-white text-3xl font-bold">€12,847.50</h2>
                    <p className="text-green-400 text-sm">+25.4% este ciclo</p>
                  </div>
                  <div className="text-right">
                    <p className="text-blue-300 text-sm mb-1">Día 6/9</p>
                    <p className="text-white text-lg font-semibold">€3,211.88</p>
                    <p className="text-blue-300 text-xs">En 3 días</p>
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm mt-2 transition-colors">
                      Liquidar
                    </button>
                  </div>
                </div>
              </div>

              {/* Estadísticas en Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="glass rounded-xl p-4">
                  <p className="text-blue-300 text-xs mb-1">Agentes IA Histórico</p>
                  <p className="text-white text-sm mb-1">Últimos 6 ciclos</p>
                  <div className="flex items-end space-x-1 h-8">
                    <div className="bg-blue-500 w-2 h-4 rounded-sm"></div>
                    <div className="bg-blue-500 w-2 h-5 rounded-sm"></div>
                    <div className="bg-blue-500 w-2 h-6 rounded-sm"></div>
                    <div className="bg-blue-500 w-2 h-7 rounded-sm"></div>
                    <div className="bg-blue-500 w-2 h-8 rounded-sm"></div>
                    <div className="bg-green-500 w-2 h-8 rounded-sm"></div>
                  </div>
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-blue-300 text-xs mb-1">Gestión Licencias</p>
                  <div className="space-y-2">
                    <button className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded-lg text-xs transition-colors">
                      Nueva Licencia
                    </button>
                    <button className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded-lg text-xs transition-colors">
                      Liquidar Agente
                    </button>
                    <button className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-3 rounded-lg text-xs transition-colors">
                      Ver Agentes IA
                    </button>
                  </div>
                </div>
              </div>

              {/* Gráfico de Rendimiento */}
              <div className="glass rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-blue-300 text-sm">Performance Agentes IA</p>
                  <p className="text-green-400 text-xs">15%</p>
                </div>
                <div className="flex items-end justify-between h-16 space-x-1">
                  <div className="bg-gradient-to-t from-blue-600 to-blue-400 w-4 h-8 rounded-t-sm"></div>
                  <div className="bg-gradient-to-t from-blue-600 to-blue-400 w-4 h-10 rounded-t-sm"></div>
                  <div className="bg-gradient-to-t from-blue-600 to-blue-400 w-4 h-12 rounded-t-sm"></div>
                  <div className="bg-gradient-to-t from-blue-600 to-blue-400 w-4 h-14 rounded-t-sm"></div>
                  <div className="bg-gradient-to-t from-green-500 to-green-400 w-4 h-16 rounded-t-sm"></div>
                  <div className="bg-gradient-to-t from-green-500 to-green-400 w-4 h-16 rounded-t-sm"></div>
                </div>
                <div className="flex justify-between text-xs text-blue-300 mt-2">
                  <span>C1</span>
                  <span>C2</span>
                  <span>C3</span>
                  <span>C4</span>
                  <span>C5</span>
                  <span>C6</span>
                </div>
              </div>

              {/* Notificación */}
              <div className="mt-4 bg-orange-500/20 border border-orange-500/30 rounded-lg p-3">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mr-2 animate-pulse"></div>
                  <p className="text-orange-300 text-xs">Agente IA actualizado</p>
              </div>
              <p className="text-white text-sm mt-1">Ciclo IA completado</p>
                <p className="text-orange-200 text-xs">hace 2 horas</p>
              </div>
            </div>

            {/* Elementos decorativos flotantes */}
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full opacity-20 blur-xl"></div>
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full opacity-20 blur-xl"></div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero