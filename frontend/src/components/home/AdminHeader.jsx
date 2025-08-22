import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import RealtimeIndicator from '../RealtimeIndicator'

const AdminHeader = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const location = useLocation()
  const { user, isAuthenticated, logout, isAdmin, isSupport } = useAuth()
  const userMenuRef = useRef(null)

  // Cerrar menú desplegable al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Navegación pública (siempre visible)
  const publicNavigation = [
    { name: 'Inicio', href: '/', type: 'route' },
    { name: 'Licencias', href: '/licencias', type: 'route' },
    { name: 'Beneficios', href: '/beneficios', type: 'route' },
    { name: 'Referidos', href: '/referidos', type: 'route' },
    { name: 'Ayuda', href: '/ayuda', type: 'route' }
  ]

  // Navegación para administradores y soporte
  const adminNavigation = []
  if (isAuthenticated) {
    if (isAdmin()) {
      adminNavigation.push({ name: 'Panel de Administración', href: '/admin/overview' })
    } else if (isSupport()) {
      adminNavigation.push({ name: 'Panel de Soporte', href: '/admin/support' })
    }
  }

  const isActive = (path) => location.pathname === path

  const handleNavigation = (item, e) => {
    if (item.type === 'scroll') {
      e.preventDefault()
      const targetId = item.href.split('#')[1]
      const element = document.getElementById(targetId)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
      setIsMobileMenuOpen(false)
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
            {publicNavigation.map((item) => (
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
            
            {/* Indicador de tiempo real y botones de acción */}
            <div className="flex items-center space-x-3 ml-6">
              {isAuthenticated && (
                <RealtimeIndicator className="mr-2" size="sm" showText={false} />
              )}
              {isAuthenticated ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-primary-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-all duration-200"
                  >
                    <span>Hola, {user?.firstName}</span>
                    <svg className={`w-4 h-4 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* Dropdown Menu */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                      {adminNavigation.map((item) => (
                        <Link
                          key={item.name}
                          to={item.href}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors duration-200"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          {item.name}
                        </Link>
                      ))}
                      <hr className="my-2 border-gray-200" />
                      <button
                        onClick={() => {
                          logout()
                          setIsUserMenuOpen(false)
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200"
                      >
                        Cerrar Sesión
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link
                    to="/admin/login"
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors duration-200"
                  >
                    Admin Login
                  </Link>
                  <Link
                    to="/login"
                    className="px-6 py-2 bg-gradient-to-r from-primary-500 to-blue-600 text-white text-sm font-medium rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                  >
                    Iniciar Sesión
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-gray-600 hover:text-primary-600 focus:outline-none focus:text-primary-600 rounded-lg hover:bg-gray-100 transition-all duration-200"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="lg:hidden">
            <div className="px-4 pt-4 pb-6 space-y-2 border-t border-gray-200/50 bg-white/95 backdrop-blur-md">
              {publicNavigation.map((item) => (
                item.type === 'route' ? (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`block px-4 py-3 text-base font-medium rounded-lg transition-all duration-200 ${
                      isActive(item.href)
                        ? 'text-primary-600 bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200'
                        : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
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
              
              {/* Enlaces de administración móvil */}
              {isAuthenticated && adminNavigation.length > 0 && (
                <div className="pt-4 space-y-2 border-t border-gray-200/50">
                  {adminNavigation.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className="block px-4 py-3 text-base font-medium text-primary-600 hover:text-primary-700 bg-primary-50 rounded-lg transition-all duration-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              )}
              
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
                        setIsMobileMenuOpen(false)
                      }}
                      className="block w-full px-4 py-3 text-center text-base font-medium text-red-600 hover:text-red-700 bg-red-50 rounded-lg transition-colors duration-200"
                    >
                      Cerrar Sesión
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/admin/login"
                      className="block w-full px-4 py-3 text-center text-base font-medium text-gray-600 hover:text-primary-600 bg-gray-50 rounded-lg transition-colors duration-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Admin Login
                    </Link>
                    <Link
                      to="/login"
                      className="block w-full px-4 py-3 text-center text-base font-medium text-white bg-gradient-to-r from-primary-500 to-blue-600 rounded-lg shadow-lg transition-all duration-300"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Iniciar Sesión
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

export default AdminHeader