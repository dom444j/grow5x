import React from 'react';

const Roadmap = () => {
  const roadmapItems = [
    {
      phase: "Fase 1",
      title: "Lanzamiento de la Plataforma",
      status: "Completado",
      date: "Q4 2023",
      items: [
        "Desarrollo de la plataforma de licencias IA",
        "Sistema de pagos con USDT BEP20",
        "Panel de usuario básico",
        "Sistema de comisiones por licencias"
      ]
    },
    {
      phase: "Fase 2",
      title: "Expansión y Mejoras",
      status: "En Progreso",
      date: "Q1 2024",
      items: [
        "Aplicación móvil nativa",
        "Nuevos métodos de pago para licencias",
        "Sistema de notificaciones avanzado",
        "Programa de licencias mejorado"
      ]
    },
    {
      phase: "Fase 3",
      title: "Innovación y Crecimiento",
      status: "Planificado",
      date: "Q2 2024",
      items: [
        "Agentes IA avanzados para arbitraje",
        "Staking de tokens nativos",
        "Marketplace de herramientas IA",
        "Integración con exchanges principales"
      ]
    },
    {
      phase: "Fase 4",
      title: "Ecosistema Completo",
      status: "Futuro",
      date: "Q3 2024",
      items: [
        "Token nativo Grow5X (G5X)",
        "DAO y gobernanza comunitaria",
        "Productos DeFi avanzados",
        "Expansión global"
      ]
    }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completado':
        return 'bg-green-500';
      case 'En Progreso':
        return 'bg-primary-500';
      case 'Planificado':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Roadmap de Desarrollo
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Conoce nuestro plan de crecimiento y las innovaciones que estamos desarrollando 
            para ofrecerte la mejor experiencia con herramientas IA bajo licencia.
          </p>
        </div>

        <div className="relative">
          {/* Línea vertical central */}
          <div className="absolute left-1/2 transform -translate-x-1/2 w-1 bg-gray-300 h-full hidden lg:block"></div>

          <div className="space-y-12">
            {roadmapItems.map((item, index) => (
              <div key={index} className={`flex flex-col lg:flex-row items-center ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'}`}>
                {/* Contenido */}
                <div className={`w-full lg:w-5/12 ${index % 2 === 0 ? 'lg:pr-8' : 'lg:pl-8'}`}>
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-semibold text-primary-600 bg-primary-100 px-3 py-1 rounded-full">
                        {item.phase}
                      </span>
                      <span className="text-sm text-gray-500">{item.date}</span>
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {item.title}
                    </h3>
                    
                    <div className="flex items-center mb-4">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(item.status)} mr-2`}></div>
                      <span className="text-sm font-medium text-gray-700">{item.status}</span>
                    </div>

                    <ul className="space-y-2">
                      {item.items.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start">
                          <svg className="w-5 h-5 text-primary-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Círculo central */}
                <div className="hidden lg:flex w-2/12 justify-center">
                  <div className={`w-6 h-6 rounded-full ${getStatusColor(item.status)} border-4 border-white shadow-lg z-10`}></div>
                </div>

                {/* Espacio vacío para el layout alternado */}
                <div className="hidden lg:block w-5/12"></div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <div className="bg-gradient-to-r from-primary-600 to-secondary-600 rounded-2xl p-8 text-white">
            <h3 className="text-2xl font-bold mb-4">
              ¿Listo para ser parte del futuro?
            </h3>
            <p className="text-lg mb-6 opacity-90">
              Únete a Grow5X hoy y aprovecha todas las innovaciones que estamos desarrollando.
            </p>
            <button className="bg-white text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Comenzar Ahora
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Roadmap;