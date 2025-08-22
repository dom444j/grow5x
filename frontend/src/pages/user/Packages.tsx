import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import UserLayout from '../../components/UserLayout';
import PurchaseModal from '../../components/PurchaseModal';
import { Loader2, Clock, CheckCircle, Zap, DollarSign } from 'lucide-react';
import { usePackages } from '../../hooks/usePackages';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { toRenderableNumber } from '../../utils/decimal';

interface Package {
  slug: string;
  name: string;
  priceUSDT: number;
  payoutWindowMin?: number;
  features: string[];
}

interface License {
  _id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  popular?: boolean;
  withdrawalSlaTargetMinutes: number;
  slug: string;
}

const Packages: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { packages, loading, error, refetch } = usePackages();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  useEffect(() => {
    if (packages && packages.length > 0) {
      const transformedLicenses: License[] = packages.map((pkg: Package, index: number) => ({
        _id: pkg.slug, // Usar slug como ID
        name: pkg.name,
        description: `Licencia de ${pkg.name}`,
        price: pkg.priceUSDT,
        icon: getPackageIcon(index),
        popular: index === 1, // Marcar el segundo como popular
        withdrawalSlaTargetMinutes: pkg.payoutWindowMin || 30,
        slug: pkg.slug
      }));
      
      setLicenses(transformedLicenses);
    }
  }, [packages]);

  useEffect(() => {
    if (error) {
      toast.error(error.message || 'Error al cargar los paquetes');
    }
  }, [error]);

  const getPackageIcon = (index: number): string => {
    const icons = ['🚀', '⭐', '💎', '👑', '🏆', '🎯', '💫'];
    return icons[index % icons.length];
  };

  const formatWithdrawalTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} min`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      return `${hours}h`;
    } else {
      const days = Math.floor(minutes / 1440);
      return `${days}d`;
    }
  };

  const handlePurchaseClick = (license: License) => {
    if (!user) {
      toast.error('Debes iniciar sesión para comprar una licencia.');
      return;
    }
    setSelectedLicense(license);
    setShowPurchaseModal(true);
  };

  const handlePurchaseSuccess = () => {
    setShowPurchaseModal(false);
    setSelectedLicense(null);
    // Redirigir a la página de compras del usuario
    navigate('/user/purchases');
  };

  if (loading) {
    return (
      <UserLayout title="Paquetes">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
            <p className="text-gray-600">Cargando paquetes...</p>
          </div>
        </div>
      </UserLayout>
    );
  }

  if (error) {
    return (
      <UserLayout title="Paquetes">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
              <p className="text-red-600 mb-4">{error.message || 'Error al cargar los paquetes'}</p>
              <button
                onClick={refetch}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout title="Paquetes">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Licencias de Producción</h2>
          <p className="text-gray-600">
            Selecciona la licencia que mejor se adapte a tus necesidades. 
            Todas incluyen herramienta autónoma de arbitraje y cashback 100% la primera semana.
          </p>
        </div>

        {/* Packages Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {licenses.map(license => (
            <div 
              key={license._id} 
              className={`relative bg-white border-2 rounded-xl p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 ${
                license.popular 
                  ? 'border-primary-500 ring-2 ring-primary-200' 
                  : 'border-gray-200 hover:border-primary-300'
              }`}
            >
              {license.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                    Más Popular
                  </span>
                </div>
              )}
              
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">{license.icon}</div>
                <div className="text-xl font-bold text-gray-900">{license.name}</div>
                <div className="text-sm text-gray-600 mt-1">{license.description}</div>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Tiempo de retiro:</span>
                  <div className="flex items-center text-sm font-semibold text-primary-600">
                    <Clock className="w-4 h-4 mr-1" />
                    {formatWithdrawalTime(license.withdrawalSlaTargetMinutes)}
                  </div>
                </div>
                
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                  <span className="text-sm text-gray-600">Cashback 100% primera semana</span>
                </div>
                
                <div className="flex items-center">
                  <Zap className="w-4 h-4 mr-2 text-blue-600" />
                  <span className="text-sm text-gray-600">Herramienta IA de arbitraje</span>
                </div>
                
                <div className="flex items-center">
                  <DollarSign className="w-4 h-4 mr-2 text-purple-600" />
                  <span className="text-sm text-gray-600">Beneficios diarios 12.5%</span>
                </div>
              </div>
              
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-primary-600">${toRenderableNumber(license.price).toLocaleString()} USDT</div>
                <div className="text-xs text-gray-500 mt-1">Pago único</div>
              </div>
              
              <button 
                onClick={() => handlePurchaseClick(license)} 
                className={`w-full font-semibold py-3 px-4 rounded-lg transition-all duration-300 ${
                  license.popular
                    ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 shadow-lg'
                    : 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700'
                }`}
              >
                Comprar Licencia
              </button>
            </div>
          ))}
        </div>

        {/* Purchase Modal */}
        <PurchaseModal
          license={selectedLicense}
          isOpen={showPurchaseModal}
          onClose={() => {
            setShowPurchaseModal(false);
            setSelectedLicense(null);
          }}
          onSuccess={handlePurchaseSuccess}
        />
      </div>
    </UserLayout>
  );
};

export default Packages;