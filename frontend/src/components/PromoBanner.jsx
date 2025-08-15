import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const PromoBanner = () => {
  const [isVisible, setIsVisible] = useState(true)
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  })

  // Fecha límite de la oferta (30 días desde ahora)
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 30)

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime()
      const distance = endDate.getTime() - now

      if (distance > 0) {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        })
      } else {
        setIsVisible(false)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  if (!isVisible) return null

  return (
    <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white relative overflow-hidden">
      {/* Elementos decorativos animados */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/10 rounded-full animate-pulse"></div>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-20 h-20 bg-white/5 rounded-full animate-bounce"></div>
      </div>

      <div className="container-max relative z-10">
        <div className="flex items-center justify-between py-4">
          {/* Botón cerrar */}
          <button
            onClick={() => setIsVisible(false)}
            className="absolute top-2 right-4 text-white/80 hover:text-white transition-colors lg:hidden"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex-1 text-center lg:text-left">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              {/* Contenido principal */}
              <div className="mb-4 lg:mb-0">
                <div className="flex items-center justify-center lg:justify-start mb-2">
                  <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold mr-3 animate-pulse">
                    🔥 OFERTA LIMITADA
                  </span>
                  <span className="text-sm font-medium opacity-90">
                    Solo quedan pocas licencias
                  </span>
                </div>
                
                <h3 className="text-lg lg:text-xl font-bold mb-2">
                  ¡Primeros 1000 usuarios reciben bonos extra!
                </h3>
                
                <p className="text-sm lg:text-base opacity-90 max-w-2xl">
                  Bonos adicionales en tu primer ciclo de agentes IA + descuentos especiales en agentes personalizados
                </p>
              </div>

              {/* Contador y CTA */}
              <div className="flex flex-col lg:flex-row items-center space-y-4 lg:space-y-0 lg:space-x-6">
                {/* Contador regresivo */}
                <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                  <span className="text-xs font-medium opacity-80">Termina en:</span>
                  <div className="flex space-x-1 text-sm font-bold">
                    <div className="bg-white/20 px-2 py-1 rounded text-center min-w-[2rem]">
                      {timeLeft.days.toString().padStart(2, '0')}
                      <div className="text-xs opacity-70">días</div>
                    </div>
                    <span className="self-center">:</span>
                    <div className="bg-white/20 px-2 py-1 rounded text-center min-w-[2rem]">
                      {timeLeft.hours.toString().padStart(2, '0')}
                      <div className="text-xs opacity-70">hrs</div>
                    </div>
                    <span className="self-center">:</span>
                    <div className="bg-white/20 px-2 py-1 rounded text-center min-w-[2rem]">
                      {timeLeft.minutes.toString().padStart(2, '0')}
                      <div className="text-xs opacity-70">min</div>
                    </div>
                  </div>
                </div>

                {/* Botón CTA */}
                <Link
                  to="/register"
                  className="group bg-white text-orange-600 hover:bg-gray-100 font-bold px-6 py-3 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2"
                >
                  <span>🚀 Reclamar Bono</span>
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

          {/* Botón cerrar desktop */}
          <button
            onClick={() => setIsVisible(false)}
            className="hidden lg:block ml-4 text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Barra de progreso animada */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20">
        <div className="h-full bg-white/40 animate-pulse" style={{width: '23%'}}></div>
      </div>
    </div>
  )
}

export default PromoBanner