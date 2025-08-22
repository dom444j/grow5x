import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function RedirectIfAuthenticated({ children }: { children: JSX.Element }) {
  const { user, token } = useAuth()
  if (token && user) {
    if (user.role === 'admin') {
      return <Navigate to='/admin/overview' replace />
    } else if (user.role === 'support') {
      return <Navigate to='/admin/support' replace />
    } else {
      return <Navigate to='/user/dashboard' replace />
    }
  }
  return children
}