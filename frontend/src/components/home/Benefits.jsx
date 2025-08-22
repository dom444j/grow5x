import React from 'react'

const Benefits = () => {
  const benefits = [
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
      ),
      title: "Agentes IA de Alto Rendimiento",
      description: "Accede a agentes IA especializados para gestión automatizada durante 8 días por ciclo. Tecnología automatizada avanzada de vanguardia.",
      highlight: "IA Avanzada"
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: "Ciclos de Licencia Optimizados",
      description: "Licencias de herramientas IA con ciclos de 9 días (8 días operativos + 1 día de liquidación). Sistema completamente automatizado.",
      highlight: "Ciclos IA"
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      title: "Comisiones por Licencias",
      description: "Gana comisiones del 10% por cada licencia de herramienta IA vendida. Dos niveles de comisiones para maximizar tus ingresos.",
      highlight: "Licencias IA"
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: "Tecnología Blockchain Segura",
      description: "Todas las operaciones de licencias se realizan en blockchain BEP20 con USDT. Transparencia total y seguridad garantizada.",
      highlight: "Blockchain"
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
        </svg>
      ),
      title: "Licencias Flexibles",
      description: "Múltiples paquetes de licencias desde $50 hasta $5,000 USDT. Elige la herramienta IA que mejor se adapte a tus necesidades.",
      highlight: "Desde $50"
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      title: "Soporte 24/7",
      description: "Equipo de soporte disponible las 24 horas a través de Telegram. Resolución rápida de cualquier consulta.",
      highlight: "24/7"
    }
  ]

  return (
    <section id="benefits" className="section-padding bg-gradient-to-br from-secondary-50 via-white to-primary-50 relative overflow-hidden">
      {/* Elementos decorativos */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-64 h-64 bg-gradient-to-br from-primary-100/40 to-blue-100/40 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-10 w-80 h-80 bg-gradient-to-tr from-secondary-100/40 to-purple-100/40 rounded-full blur-3xl"></div>
      </div>
      
      <div className="container-max relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-6">
            ¿Por qué elegir Grow5X?
          </h2>
          <p className="text-xl text-secondary-600 max-w-3xl mx-auto">
            Descubre todas las ventajas de licenciar nuestras herramientas tecnológicas 
            con agentes IA especializados en arbitraje automatizado.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => (
            <div key={index} className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50 hover:shadow-2xl hover:scale-105 transition-all duration-500 hover:bg-white/90">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-primary-100 to-blue-100 rounded-xl flex items-center justify-center text-primary-600 mr-4 group-hover:scale-110 transition-transform duration-300">
                  {benefit.icon}
                </div>
                <div className="bg-gradient-to-r from-primary-100 to-blue-100 text-primary-700 text-xs font-semibold px-3 py-1 rounded-full border border-primary-200">
                  {benefit.highlight}
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-secondary-800 mb-3 group-hover:text-primary-600 transition-colors duration-300">
                {benefit.title}
              </h3>
              
              <p className="text-secondary-600 leading-relaxed">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA adicional */}
        <div className="text-center mt-16">
          <div className="bg-gradient-to-br from-white/90 to-primary-50/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8 max-w-4xl mx-auto border border-white/50 relative overflow-hidden">
            {/* Elementos decorativos del CTA */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-primary-200/30 to-blue-200/30 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-tr from-secondary-200/30 to-purple-200/30 rounded-full blur-2xl"></div>
            
            <div className="relative z-10">
              <h3 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-secondary-800 to-primary-600 mb-4">
                🚀 ¿Listo para licenciar herramientas IA?
              </h3>
              <p className="text-secondary-600 mb-8 text-lg leading-relaxed">
                Únete a cientos de usuarios que ya están optimizando su capital con nuestros agentes IA.
                El proceso de licenciamiento toma menos de 2 minutos.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="/register" className="group relative bg-gradient-to-r from-primary-600 to-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 overflow-hidden">
                  <span className="relative z-10">✨ Obtener Licencia</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </a>
                <a href="/simulator" className="group bg-white/80 backdrop-blur-sm border-2 border-primary-600 text-primary-600 px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 hover:bg-primary-600 hover:text-white">
                  📊 Simular Rendimiento IA
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Benefits