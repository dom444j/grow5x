import { useNavigate } from 'react-router-dom'

export function usePostAuthRedirect() {
  const navigate = useNavigate()
  return (role: 'admin'|'user'|'support') => {
    if (role === 'admin') {
      navigate('/admin/overview', { replace: true })
    } else if (role === 'support') {
      navigate('/admin/support', { replace: true })
    } else {
      navigate('/user/dashboard', { replace: true })
    }
  }
}