import React from 'react';

const AIAgents = () => {
  const agents = [
    {
      id: 1,
      name: "ArbitrageBot Alpha",
      specialty: "Arbitraje de Criptomonedas",
      performance: "12.5% diario",
      description: "Especializado en detectar diferencias de precios entre exchanges para maximizar ganancias.",
      features: ["Análisis en tiempo real", "Ejecución automática", "Gestión de riesgos"],
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      id: 2,
      name: "TradingBot Beta",
      specialty: "Trading Algorítmico",
      performance: "12.5% diario",
      description: "Utiliza algoritmos avanzados de machine learning para identificar patrones de mercado.",
      features: ["IA predictiva", "Análisis técnico", "Optimización continua"],
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    {
      id: 3,
      name: "ScalpingBot Gamma",
      specialty: "Scalping Automatizado",
      performance: "12.5% diario",
      description: "Ejecuta múltiples operaciones de corta duración para aprovechar pequeñas fluctuaciones.",
      features: ["Alta frecuencia", "Baja latencia", "Gestión automática"],
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
      )
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-secondary-50 to-primary-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-6">
            Nuestros Agentes IA Especializados
          </h2>
          <p className="text-xl text-secondary-600 max-w-3xl mx-auto">
            Cada agente IA está diseñado con algoritmos específicos para maximizar 
            el rendimiento en diferentes estrategias de arbitraje y trading automatizado.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {agents.map((agent) => (
            <div key={agent.id} className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full text-white mb-4">
                  {agent.icon}
                </div>
                <h3 className="text-2xl font-bold text-secondary-900 mb-2">
                  {agent.name}
                </h3>
                <p className="text-primary-600 font-semibold mb-2">
                  {agent.specialty}
                </p>
                <div className="inline-block bg-success-100 text-success-800 px-4 py-2 rounded-full font-bold">
                  {agent.performance}
                </div>
              </div>

              <p className="text-secondary-600 mb-6 text-center">
                {agent.description}
              </p>

              <div className="space-y-3">
                <h4 className="font-semibold text-secondary-800 mb-3">Características:</h4>
                {agent.features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                    <span className="text-secondary-700">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-secondary-100">
                <button className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold py-3 px-6 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all duration-300 transform hover:scale-105">
                  Licenciar Agente IA
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-secondary-900 mb-4">
              ¿Por qué nuestros Agentes IA son únicos?
            </h3>
            <div className="grid md:grid-cols-2 gap-8 mt-8">
              <div className="text-left">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
                  <span className="font-semibold text-secondary-800">Tecnología Propietaria</span>
                </div>
                <p className="text-secondary-600 ml-6">
                  Algoritmos desarrollados internamente con años de investigación en mercados financieros.
                </p>
              </div>
              <div className="text-left">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
                  <span className="font-semibold text-secondary-800">Aprendizaje Continuo</span>
                </div>
                <p className="text-secondary-600 ml-6">
                  Los agentes se adaptan constantemente a las condiciones del mercado para optimizar resultados.
                </p>
              </div>
              <div className="text-left">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
                  <span className="font-semibold text-secondary-800">Gestión de Riesgos</span>
                </div>
                <p className="text-secondary-600 ml-6">
                  Sistemas avanzados de protección que minimizan la exposición al riesgo.
                </p>
              </div>
              <div className="text-left">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
                  <span className="font-semibold text-secondary-800">Transparencia Total</span>
                </div>
                <p className="text-secondary-600 ml-6">
                  Monitoreo en tiempo real de todas las operaciones y rendimientos de cada agente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AIAgents;