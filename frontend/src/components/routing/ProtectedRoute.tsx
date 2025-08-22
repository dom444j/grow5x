import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function ProtectedRoute({
  children, allow
}: { children: JSX.Element, allow: Array<'user'|'admin'|'support'> }) {
  const { user, token, isLoading, isAuthenticated } = useAuth()
  const loc = useLocation()

  // Show loading while auth is being initialized
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !token || !user) {
    return <Navigate to="/auth/login" state={{ from: loc }} replace />
  }
  
  // Redirect to appropriate dashboard if user doesn't have required role
  if (!allow.includes(user.role)) {
    const redirectPath = user.role === 'admin' ? '/admin/overview' : '/user/dashboard'
    return <Navigate to={redirectPath} replace />
  }
  
  return children
}