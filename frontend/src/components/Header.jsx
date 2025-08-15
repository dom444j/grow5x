import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()
  const { user, isAuthenticated, logout, isAdmin } = useAuth()

  const publicNavigation = [
    { name: 'Inicio', href: '/', type: 'route' },
    { name: 'Beneficios', href: '/#benefits', type: 'scroll' },
    { name: 'Cómo Funciona', href: '/#how-it-works', type: 'scroll' },
    { name: 'Simulador', href: '/simulator', type: 'route' },
    { name: 'Licencias', href: '/packages', type: 'route' }
  ]

  const authenticatedNavigation = [
    { name: 'Dashboard', href: '/dashboard', type: 'route' },
    { name: 'Licencias', href: '/packages', type: 'route' },
    { name: 'Retiros', href: '/withdrawals', type: 'route' },
    ...(isAdmin() ? [{ name: 'Admin', href: '/admin', type: 'route' }] : [])
  ]

  const navigation = isAuthenticated ? authenticatedNavigation : publicNavigation

  const isActive = (path) => location.pathname === path

  const handleNavigation = (item, e) => {
    if (item.type === 'scroll') {
      e.preventDefault()
      const targetId = item.href.split('#')[1]
      const element = document.getElementById(targetId)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
      setIsMenuOpen(false)
    }
  }

  return (
    <header className="bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-200/50 sticky top-0 z-50">
      <nav className="container-max">
        <div className="flex justify-between items-center py-3">
          {/* Logo G5 */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-3 group">
              {/* Logo G5 con gradiente */}
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-500 via-blue-500 to-purple-600 rounded-xl shadow-lg transform group-hover:scale-105 transition-all duration-300 flex items-center justify-center">
                  <span className="text-white font-bold text-lg tracking-tight">G5</span>
                </div>
                {/* Efecto de brillo */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              {/* Texto Grow5X */}
               <div className="hidden sm:block">
                 <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                   Grow5X
                 </span>
                 <div className="text-xs text-gray-500 font-medium tracking-wide">SMART ARBITRAGE</div>
               </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1">
            {navigation.slice(0, 4).map((item) => (
              item.type === 'route' ? (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group ${
                    isActive(item.href)
                      ? 'text-primary-600 bg-primary-50'
                      : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'
                  }`}
                >
                  {item.name}
                  {/* Indicador activo */}
                  {isActive(item.href) && (
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary-600 rounded-full"></div>
                  )}
                  {/* Efecto hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-blue-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </Link>
              ) : (
                <button
                  key={item.name}
                  onClick={(e) => handleNavigation(item, e)}
                  className="relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group text-gray-600 hover:text-primary-600 hover:bg-gray-50"
                >
                  {item.name}
                  {/* Efecto hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-blue-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
              )
            ))}
            
            {/* Botones de acción */}
            <div className="flex items-center space-x-3 ml-6">
              {isAuthenticated ? (
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-gray-600">
                    Hola, <span className="font-medium text-primary-600">{user?.firstName}</span>
                  </div>
                  <button
                    onClick={logout}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-red-600 transition-colors duration-200"
                  >
                    Cerrar Sesión
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors duration-200"
                  >
                    Iniciar Sesión
                  </Link>
                  <Link
                    to="/register"
                    className="px-6 py-2 bg-gradient-to-r from-primary-500 to-blue-600 text-white text-sm font-medium rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                  >
                    Registrarse
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-gray-600 hover:text-primary-600 focus:outline-none focus:text-primary-600 rounded-lg hover:bg-gray-100 transition-all duration-200"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="lg:hidden">
            <div className="px-4 pt-4 pb-6 space-y-2 border-t border-gray-200/50 bg-white/95 backdrop-blur-md">
              {navigation.map((item) => (
                item.type === 'route' ? (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`block px-4 py-3 text-base font-medium rounded-lg transition-all duration-200 ${
                      isActive(item.href)
                        ? 'text-primary-600 bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200'
                        : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                ) : (
                  <button
                    key={item.name}
                    onClick={(e) => handleNavigation(item, e)}
                    className="block w-full text-left px-4 py-3 text-base font-medium rounded-lg transition-all duration-200 text-gray-600 hover:text-primary-600 hover:bg-gray-50"
                  >
                    {item.name}
                  </button>
                )
              ))}
              
              {/* Botones de acción móvil */}
              <div className="pt-4 space-y-3 border-t border-gray-200/50">
                {isAuthenticated ? (
                  <>
                    <div className="px-4 py-2 text-center text-sm text-gray-600">
                      Hola, <span className="font-medium text-primary-600">{user?.firstName}</span>
                    </div>
                    <button
                      onClick={() => {
                        logout()
                        setIsMenuOpen(false)
                      }}
                      className="block w-full px-4 py-3 text-center text-base font-medium text-red-600 hover:text-red-700 bg-red-50 rounded-lg transition-colors duration-200"
                    >
                      Cerrar Sesión
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="block w-full px-4 py-3 text-center text-base font-medium text-gray-600 hover:text-primary-600 bg-gray-50 rounded-lg transition-colors duration-200"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Iniciar Sesión
                    </Link>
                    <Link
                      to="/register"
                      className="block w-full px-4 py-3 text-center text-base font-medium text-white bg-gradient-to-r from-primary-500 to-blue-600 rounded-lg shadow-lg transition-all duration-300"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Registrarse
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}

export default Header