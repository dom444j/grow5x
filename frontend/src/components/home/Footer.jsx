import React, { useState } from 'react'
import { Link } from 'react-router-dom'

const Footer = () => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isRiskWarningExpanded, setIsRiskWarningExpanded] = useState(false)

  return (
    <footer className="bg-secondary-900 text-white">
      {/* Botón colapsable para móvil */}
      <div className="md:hidden border-b border-secondary-700">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-secondary-800 transition-colors"
        >
          <span className="font-semibold text-primary-400">Grow5X - Información</span>
          <svg
            className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div className={`container-max section-padding ${!isExpanded ? 'hidden md:block' : ''}`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo y descripción */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center mb-4">
              <span className="text-2xl font-bold text-primary-400">Grow5X</span>
            </div>
            <p className="text-secondary-300 mb-4">
              Plataforma de herramientas tecnológicas bajo licencia con agentes IA especializados en arbitraje.
              Ciclos de 9 días con rendimientos del 12.5% diario mediante automatización IA completa.
            </p>
            <div className="bg-yellow-900 border border-yellow-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setIsRiskWarningExpanded(!isRiskWarningExpanded)}
                className="w-full p-4 text-left hover:bg-yellow-800 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-inset"
              >
                <h4 className="text-yellow-300 font-semibold flex items-center justify-between">
                  <span className="flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Aviso de Riesgos
                  </span>
                  <svg
                    className={`w-5 h-5 transform transition-transform duration-200 ${isRiskWarningExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </h4>
              </button>
              {isRiskWarningExpanded && (
                <div className="px-4 pb-4 animate-fadeIn">
                  <p className="text-yellow-200 text-sm">
                    Las licencias de herramientas IA y operaciones de arbitraje conllevan riesgos significativos. Los rendimientos pasados de nuestros agentes IA no garantizan resultados futuros. 
                    Adquiere licencias solo con capital que puedas permitirte perder.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Enlaces rápidos */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Enlaces Rápidos</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-secondary-300 hover:text-primary-400 transition-colors">
                  Inicio
                </Link>
              </li>
              <li>
                <Link to="/simulator" className="text-secondary-300 hover:text-primary-400 transition-colors">
                  Simulador
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-secondary-300 hover:text-primary-400 transition-colors">
                  Registrarse
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/terms" className="text-secondary-300 hover:text-primary-400 transition-colors">
                  Términos y Condiciones
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-secondary-300 hover:text-primary-400 transition-colors">
                  Política de Privacidad
                </Link>
              </li>
            </ul>
            <div className="mt-6">
              <h4 className="text-sm font-semibold mb-2">Contacto</h4>
              <p className="text-secondary-300 text-sm">
                Telegram: @grow5x_support
              </p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-secondary-700 mt-8 pt-8 text-center">
          <p className="text-secondary-400 text-sm">
            © 2025 Grow5X. Todos los derechos reservados.
          </p>
          <p className="text-secondary-500 text-xs mt-2">
            Esta plataforma opera con criptomonedas y no está regulada por autoridades financieras tradicionales.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer