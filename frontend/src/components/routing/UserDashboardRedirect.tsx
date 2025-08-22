import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface UserDashboardRedirectProps {
  children: React.ReactNode
}

/**
 * Componente que redirige a admins y support al panel correspondiente
 * cuando intentan acceder a rutas de usuario
 */
const UserDashboardRedirect: React.FC<UserDashboardRedirectProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      // Redirigir admins y support a sus paneles correspondientes
      if (user.role === 'admin') {
        navigate('/admin/overview', { replace: true })
        return
      } else if (user.role === 'support') {
        navigate('/admin/support', { replace: true })
        return
      }
    }
  }, [user, isAuthenticated, isLoading, navigate])

  // Mostrar loading mientras se verifica
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Solo mostrar contenido si es usuario normal
  if (isAuthenticated && user && (user.role === 'admin' || user.role === 'support')) {
    return null
  }

  return <>{children}</>
}

export default UserDashboardRedirect