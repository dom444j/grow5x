import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, Home } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const Forbidden = () => {
  const { session } = useAuth();
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate(-1);
  };

  const getHomeLink = () => {
    if (session?.role === 'admin' || session?.role === 'support') {
      return '/admin/overview';
    } else if (session?.role === 'user') {
      return '/user/dashboard';
    }
    return '/';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100">
            <Shield className="h-10 w-10 text-red-600" />
          </div>
        </div>
        
        <h1 className="text-6xl font-bold text-gray-900 mb-4">403</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">
          Acceso Denegado
        </h2>
        <p className="text-gray-500 mb-8">
          No tienes permisos para acceder a esta página. 
          Si crees que esto es un error, contacta al administrador.
        </p>
        
        <div className="space-y-4">
          <button
            onClick={handleGoBack}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver Atrás
          </button>
          
          <Link
            to={getHomeLink()}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Home className="h-4 w-4 mr-2" />
            Ir al Inicio
          </Link>
        </div>
        
        {session && (
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              Conectado como: <span className="font-medium">{session.email}</span>
              <br />
              Rol: <span className="font-medium capitalize">{session.role}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Forbidden;