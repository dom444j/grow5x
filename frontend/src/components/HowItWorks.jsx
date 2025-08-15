import React from 'react'

const HowItWorks = () => {
  const steps = [
    {
      number: "01",
      title: "Regístrate",
      description: "Crea tu cuenta gratuita con un código de referido válido. El proceso de registro toma menos de 2 minutos.",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      number: "02",
      title: "Elige tu Licencia IA",
      description: "Selecciona el paquete de licencia de herramientas IA que mejor se adapte a tus necesidades, desde $50 hasta $5,000 USDT.",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      number: "03",
      title: "Activa tu Licencia",
      description: "Transfiere USDT (BEP20) a la wallet generada automáticamente para activar tu licencia de herramientas IA.",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      number: "04",
      title: "Agente IA Operando",
      description: "Tu agente IA especializado comienza a operar generando 12.5% diario durante 8 días por ciclo. Completa 5 ciclos en 45 días.",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      )
    }
  ]

  return (
    <section id="how-it-works" className="section-padding bg-gradient-to-br from-gray-50 via-primary-25 to-secondary-25 relative overflow-hidden">
      {/* Elementos decorativos */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-gradient-to-br from-primary-100/20 to-blue-100/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-gradient-to-tr from-secondary-100/20 to-purple-100/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
      
      <div className="container-max relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-6">
            ¿Cómo funciona?
          </h2>
          <p className="text-xl text-secondary-600 max-w-3xl mx-auto">
            Licenciar herramientas IA con Grow5X es muy simple. 
            Sigue estos 4 pasos y empieza a optimizar tu capital con agentes especializados.
          </p>
        </div>

        {/* Pasos del proceso */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {steps.map((step, index) => (
            <div key={index} className="relative group">
              {/* Línea conectora (solo en desktop) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-16 left-full w-full h-0.5 bg-primary-200 transform translate-x-4 -translate-y-1/2 z-0">
                  <div className="absolute right-0 top-1/2 transform translate-x-1 -translate-y-1/2">
                    <svg className="w-4 h-4 text-primary-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
              
              <div className="relative z-10 text-center p-6 bg-white/60 backdrop-blur-sm rounded-3xl shadow-lg border border-white/50 hover:shadow-xl hover:scale-105 transition-all duration-300">
                {/* Número del paso */}
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-600 to-blue-600 text-white text-xl font-bold rounded-full mb-4 group-hover:scale-110 transition-transform duration-300">
                  {step.number}
                </div>
                
                {/* Icono */}
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-primary-100 to-blue-100 rounded-xl flex items-center justify-center text-primary-600 group-hover:scale-110 transition-transform duration-300">
                    {step.icon}
                  </div>
                </div>
                
                {/* Contenido */}
                <h3 className="text-xl font-bold text-secondary-800 mb-3 group-hover:text-primary-600 transition-colors duration-300">
                  {step.title}
                </h3>
                <p className="text-secondary-600 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Información adicional del ciclo */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-10 shadow-xl border border-white/50">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-3xl font-bold text-secondary-800 mb-6">
                📊 Estructura del Ciclo de Agentes IA
              </h3>
              <p className="text-secondary-600 mb-8 text-lg leading-relaxed">
                Nuestros agentes IA funcionan con ciclos de 9 días: 8 días de operación automatizada 
                seguidos de 1 día de liquidación, repetido 5 veces para completar 45 días.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-4 p-4 bg-primary-50/50 rounded-xl">
                  <div className="w-3 h-3 bg-primary-600 rounded-full"></div>
                  <span className="text-secondary-700 font-medium">⏰ <strong>8 días de operación IA:</strong> Recibes 12.5% diario</span>
                </div>
                <div className="flex items-center space-x-4 p-4 bg-success-50/50 rounded-xl">
                  <div className="w-3 h-3 bg-success-400 rounded-full"></div>
                  <span className="text-secondary-700 font-medium">💰 <strong>1 día de liquidación:</strong> Procesamiento y transferencia</span>
                </div>
                <div className="flex items-center space-x-4 p-4 bg-secondary-50/50 rounded-xl">
                  <div className="w-3 h-3 bg-success-600 rounded-full"></div>
                  <span className="text-secondary-700 font-medium">🔄 <strong>5 ciclos de IA:</strong> Total 45 días de ciclo</span>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-8 shadow-lg border border-gray-100">
              <h4 className="font-bold text-secondary-800 mb-6 text-center text-lg">
                📊 Ejemplo de Cronograma
              </h4>
              
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-9 gap-1">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-primary-100 text-primary-700 text-center py-1 rounded text-xs font-medium">
                      {i + 1}
                    </div>
                  ))}
                  <div className="bg-secondary-100 text-secondary-600 text-center py-1 rounded text-xs">
                    OFF
                  </div>
                </div>
                
                <div className="text-center text-xs text-secondary-500 mt-2">
                  Ciclo 1 (Días 1-9)
                </div>
                
                <div className="grid grid-cols-9 gap-1 mt-3">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-primary-100 text-primary-700 text-center py-1 rounded text-xs font-medium">
                      {i + 10}
                    </div>
                  ))}
                  <div className="bg-success-100 text-success-600 text-center py-1 rounded text-xs">
                    PAY
                  </div>
                </div>
                
                <div className="text-center text-xs text-secondary-500 mt-2">
                  Ciclo 2 (Días 10-18)
                </div>
                
                <div className="text-center text-xs text-secondary-400 mt-4">
                  ... y así hasta completar 45 días
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HowItWorks