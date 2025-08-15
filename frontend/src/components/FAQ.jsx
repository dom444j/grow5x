import React, { useState } from 'react';

const FAQ = () => {
  const [openItems, setOpenItems] = useState([0]); // Primer ítem abierto por defecto

  const faqs = [
    {
      id: 0,
      question: "¿Cómo funcionan exactamente las licencias de herramientas IA?",
      answer: "GrowX5 ofrece licencias de herramientas tecnológicas especializadas con agentes IA para arbitraje automatizado. Nuestros agentes IA operan en ciclos de 9 días (8 días de operación IA + 1 día de liquidación) utilizando algoritmos avanzados para optimizar operaciones de arbitraje. Todo el proceso es completamente automatizado por nuestros agentes especializados."
    },
    {
      id: 1,
      question: "¿Cuál es el rendimiento esperado de los agentes IA?",
      answer: "Nuestros agentes IA están diseñados para generar un rendimiento del 12.5% diario durante los 8 días de operación de cada ciclo. Esto se traduce en aproximadamente un 100% de rendimiento por ciclo completo de 9 días. Sin embargo, es importante recordar que todos los rendimientos dependen del desempeño de nuestros agentes especializados y las condiciones del mercado."
    },
    {
      id: 2,
      question: "¿Necesito conocimientos técnicos para usar las herramientas IA?",
      answer: "No, absolutamente no. Las licencias de herramientas IA están diseñadas para ser completamente automatizadas. Una vez que adquieres tu licencia, nuestros agentes IA se encargan de todo el proceso de arbitraje y optimización. La plataforma es intuitiva y fácil de usar, con guías paso a paso para ayudarte en cada etapa del proceso."
    },
    {
      id: 3,
      question: "¿Cómo funciona la liquidación de agentes IA?",
      answer: "Puedes liquidar los rendimientos de tus agentes IA en cualquier momento sin periodos de bloqueo. Las liquidaciones se procesan de forma inmediata a través de USDT BEP20. Simplemente accede a tu panel de usuario, selecciona la opción de liquidación, ingresa la cantidad deseada y tu dirección de wallet. El proceso es rápido, seguro y transparente."
    },
    {
      id: 4,
      question: "¿Es seguro mi dinero con GrowX5?",
      answer: "La seguridad es nuestra máxima prioridad. Utilizamos protocolos de seguridad de nivel bancario, incluyendo cifrado extremo a extremo, autenticación de dos factores y auditorías regulares. Además, operamos con USDT BEP20 en blockchain, lo que proporciona transparencia y trazabilidad completa de todas las transacciones."
    },
    {
      id: 5,
      question: "¿Qué métodos de pago aceptan para las licencias?",
      answer: "Actualmente aceptamos USDT BEP20 como método principal para adquirir licencias de herramientas IA. Esta criptomoneda ofrece transacciones rápidas, seguras y con comisiones mínimas. Estamos trabajando en integrar más métodos de pago para ofrecer mayor flexibilidad en la adquisición de licencias en el futuro."
    },
    {
      id: 6,
      question: "¿Es segura la plataforma de herramientas IA?",
      answer: "La seguridad es nuestra máxima prioridad. Utilizamos tecnología blockchain, encriptación de grado militar, autenticación de dos factores y almacenamiento en frío para proteger tus licencias y rendimientos. Además, realizamos auditorías de seguridad regulares y mantenemos seguros de protección para garantizar la máxima tranquilidad."
    },
    {
      id: 7,
      question: "¿Cómo se garantiza mi privacidad?",
      answer: "Tu privacidad es fundamental para nosotros. Ofrecemos registro anónimo con solo email o Telegram, sin KYC obligatorio para licencias estándar. Todos los datos están cifrados y nunca compartimos información personal con terceros. Operamos bajo estrictos protocolos de privacidad y cumplimos con las regulaciones de protección de datos."
    },
    {
      id: 8,
      question: "¿Hay comisiones ocultas en las licencias?",
      answer: "No, somos completamente transparentes con nuestras tarifas de licencias. No cobramos comisiones por activación de licencias, liquidaciones ni por el uso de las herramientas IA. Nuestro modelo se basa en el éxito compartido: solo ganamos cuando tus agentes IA generan rendimientos. Todos los costos están claramente especificados en nuestros términos."
    },
    {
      id: 9,
      question: "¿Cómo puedo contactar con soporte?",
      answer: "Ofrecemos soporte 24/7 a través de múltiples canales: chat en vivo integrado en la plataforma, email prioritario (support@growx5.app), y nuestro canal oficial de Telegram (@CanalGrow5X). Nuestro equipo de soporte está altamente capacitado y responde rápidamente a todas las consultas. También tenemos una base de conocimientos completa disponible en la plataforma."
    }
  ];

  const toggleItem = (id) => {
    setOpenItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  return (
    <section className="py-20 bg-gradient-to-br from-gray-50 via-primary-25 to-secondary-25 relative overflow-hidden">
      {/* Elementos decorativos */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-80 h-80 bg-gradient-to-br from-primary-100/20 to-blue-100/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-gradient-to-tr from-secondary-100/20 to-purple-100/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-20">
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            ❓ Preguntas Frecuentes
          </h2>
          <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
            Resolvemos las dudas más comunes sobre <span className="font-bold text-primary-600">GrowX5</span>. 
            Si tienes alguna pregunta adicional, nuestro equipo de soporte está disponible 
            <span className="font-bold text-secondary-600">24/7</span>.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div
                key={faq.id}
                className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.02]"
              >
                <button
                  onClick={() => toggleItem(faq.id)}
                  className="w-full px-8 py-6 text-left flex items-center justify-between hover:bg-primary-50/50 transition-all duration-300 group-hover:bg-gradient-to-r group-hover:from-primary-50/30 group-hover:to-secondary-50/30"
                >
                  <h3 className="text-xl font-bold text-gray-900 pr-4 group-hover:text-primary-700 transition-colors duration-300">
                    {faq.question}
                  </h3>
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-100 to-secondary-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <svg
                        className={`w-6 h-6 text-primary-600 transition-transform duration-300 ${
                          openItems.includes(faq.id) ? 'transform rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </button>
                
                <div
                  className={`transition-all duration-500 ease-in-out ${
                    openItems.includes(faq.id)
                      ? 'max-h-96 opacity-100'
                      : 'max-h-0 opacity-0'
                  } overflow-hidden`}
                >
                  <div className="px-8 pb-6">
                    <div className="border-t border-gradient-to-r from-primary-200 to-secondary-200 pt-5">
                      <p className="text-gray-700 leading-relaxed text-lg bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact CTA */}
        <div className="mt-20 text-center">
          <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-700 rounded-3xl p-10 text-white max-w-3xl mx-auto shadow-2xl border border-white/20 backdrop-blur-sm relative overflow-hidden">
            {/* Elementos decorativos internos */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-yellow-300/10 rounded-full blur-2xl"></div>
            </div>
            
            <div className="relative z-10">
              <h3 className="text-3xl md:text-4xl font-bold mb-6">
                💬 ¿Tienes más preguntas?
              </h3>
              <p className="text-xl md:text-2xl mb-8 opacity-95 leading-relaxed">
                Nuestro equipo de soporte está disponible <span className="font-bold text-yellow-300">24/7</span> 
                para ayudarte con cualquier duda sobre <span className="font-bold text-blue-300">licencias de herramientas IA</span>.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <a
                  href="mailto:support@growx5.app"
                  className="group bg-white text-primary-600 px-8 py-4 rounded-2xl font-bold hover:bg-gray-100 transition-all duration-300 inline-flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transform"
                >
                  <svg className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform duration-300" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  📧 Enviar Email
                </a>
                <a
                  href="https://t.me/CanalGrow5X"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-transparent border-3 border-white text-white px-8 py-4 rounded-2xl font-bold hover:bg-white hover:text-primary-600 transition-all duration-300 inline-flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transform backdrop-blur-sm"
                >
                  <svg className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform duration-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                  💬 Telegram
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQ;