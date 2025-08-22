import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock, Shield, ArrowRight } from 'lucide-react';

const AdminLogin = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, isAuthenticated, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Obtener returnTo de los query params
  const searchParams = new URLSearchParams(location.search);
  const returnTo = searchParams.get('returnTo');

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (isAuthenticated && session) {
      if (session.role === 'admin' || session.role === 'support') {
        // Si es admin/support, usar returnTo o overview por defecto
        const destination = returnTo && returnTo.startsWith('/admin/') ? returnTo : '/admin/overview';
        navigate(destination, { replace: true });
      } else if (session.role === 'user') {
        // Si es usuario, redirigir al área de usuario
        navigate('/user/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, session, navigate, returnTo]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(formData);
      
      // Verificar que el usuario tenga rol de admin o support
      if (result.user.role !== 'admin' && result.user.role !== 'support') {
        toast.error('No tienes permisos de administrador. Usa el login de usuarios.');
        return;
      }
      
      // Redirigir al destino apropiado
      const destination = returnTo && returnTo.startsWith('/admin/') ? returnTo : '/admin/overview';
      navigate(destination, { replace: true });
      
    } catch (error) {
      console.error('Admin login error:', error);
      toast.error((error as any)?.message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="bg-red-100 p-3 rounded-full">
              <Shield className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <h1 className="mt-4 text-3xl font-bold text-white">Grow5X Admin</h1>
          <h2 className="mt-6 text-3xl font-extrabold text-white">
            Panel de Administración
          </h2>
          <p className="mt-2 text-sm text-gray-300">
            Acceso restringido solo para administradores
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-xl p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Correo Electrónico
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="appearance-none relative block w-full pl-10 pr-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm"
                    placeholder="admin@grow5x.com"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Contraseña
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="appearance-none relative block w-full pl-10 pr-10 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm"
                    placeholder="Tu contraseña de administrador"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex">
                <Shield className="h-5 w-5 text-yellow-400 mt-0.5" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Acceso Restringido
                  </h3>
                  <p className="mt-1 text-sm text-yellow-700">
                    Solo personal autorizado puede acceder al panel de administración.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Verificando acceso...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Shield className="mr-2 h-4 w-4" />
                    Acceder al Panel
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
                  </div>
                )}
              </button>
            </div>
          </form>
          
          <div className="mt-6 text-center">
            <Link
              to="/"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Volver al sitio principal
            </Link>
          </div>
        </div>
        
        <div className="text-center">
          <p className="text-xs text-gray-400">
            ¿Eres usuario regular?{' '}
            <Link
              to="/login"
              className="text-blue-400 hover:text-blue-300"
            >
              Usa el login de usuarios
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;