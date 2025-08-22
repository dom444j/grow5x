import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'

const COOKIE_DAYS = 30
const isValidRef = (c?: string) => !!c && c.length >= 3 && /^[A-Z0-9]+$/.test(c)

const setReferralCookie = (code: string) => {
  const maxAge = COOKIE_DAYS * 24 * 60 * 60
  document.cookie = `g5x_ref=${encodeURIComponent(code)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`
}

export default function ReferralLinkHandler() {
  const { code } = useParams<{ code?: string }>()
  const navigate = useNavigate()
  
  useEffect(() => {
    if (code && isValidRef(code)) {
      setReferralCookie(code)
      toast.success('Código aplicado')
      navigate('/auth/register?ref=' + encodeURIComponent(code), { replace: true })
    } else {
      if (code) {
        toast.error('Código de referido inválido')
      }
      navigate('/', { replace: true }) // vuelve a la landing si no hay code o es inválido
    }
  }, [code, navigate])

  return null
}