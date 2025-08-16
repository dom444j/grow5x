import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import Loading from '../../components/common/Loading';

const Legal = ({ section: propSection }) => {
  const { section: paramSection } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  
  // Determinar qué sección mostrar (priorizar props sobre params)
  const activeSection = propSection || paramSection || 'terms';
  
  // Determinar si estamos en un contexto de usuario o público
  const isUserContext = location.pathname.startsWith('/user/');
  
  useEffect(() => {
    const loadLegalContent = async () => {
      try {
        setLoading(true);
        
        // En una aplicación real, aquí cargaríamos el contenido desde la API
        // Por ahora, simulamos una carga con contenido estático
        setTimeout(() => {
          let legalContent = '';
          
          switch (activeSection) {
            case 'terms':
              legalContent = getLegalContent('terms', t);
              break;
            case 'privacy':
              legalContent = getLegalContent('privacy', t);
              break;
            case 'risk':
              legalContent = getLegalContent('risk', t);
              break;
            default:
              // Si la sección no existe, redirigir a términos
              const basePath = isUserContext ? '/user/legal/terms' : '/legal/terms';
              navigate(basePath, { replace: true });
              return;
          }
          
          setContent(legalContent);
          setLoading(false);
        }, 800);
      } catch (error) {
        console.error('Error al cargar contenido legal:', error);
        setLoading(false);
      }
    };
    
    loadLegalContent();
  }, [activeSection, language, navigate, isUserContext]);
  
  // Tabs para navegar entre secciones legales
  const getTabPath = (tabId) => {
    const basePath = isUserContext ? '/user/legal/' : '/legal/';
    return `${basePath}${tabId}`;
  };
  
  const tabs = [
    { id: 'terms', label: 'Términos y Condiciones', path: getTabPath('terms') },
    { id: 'privacy', label: 'Política de Privacidad', path: getTabPath('privacy') },
    { id: 'risk', label: 'Divulgación de Riesgos', path: getTabPath('risk') },
  ];
  
  if (loading) {
    return <Loading size="lg" center text="Cargando documento..." />;
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Tabs de navegación */}
      <div className="flex overflow-x-auto mb-6 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            className={`py-3 px-4 font-medium text-sm whitespace-nowrap ${activeSection === tab.id ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Contenido legal */}
      <div className={`p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
          {activeSection === 'terms' && 'Términos y Condiciones'}
          {activeSection === 'privacy' && 'Política de Privacidad'}
          {activeSection === 'risk' && 'Divulgación de Riesgos'}
        </h1>
        
        <div className="prose prose-blue max-w-none dark:prose-invert prose-headings:text-gray-900 dark:prose-headings:text-white prose-p:text-gray-700 dark:prose-p:text-gray-300">
          <div dangerouslySetInnerHTML={{ __html: content }} />
        </div>
        
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
          <p>Última actualización: {activeSection === 'terms' ? '23 de julio de 2025' : activeSection === 'privacy' ? '23 de julio de 2025' : '23 de julio de 2025'}</p>
        </div>
      </div>
    </div>
  );
};

// Función auxiliar para obtener contenido legal desde las traducciones
const getLegalContent = (section, t) => {
  switch (section) {
    case 'terms':
      // Definir directamente el contenido de los términos y condiciones
      return `
        <div class="space-y-6">
          <div>
            <h2 class="text-xl font-semibold mb-3">1. Definition and Purpose</h2>
            <p class="mb-4">GrowX5 is a decentralized technological platform that provides automated tools for risk capital management. We are not a regulated financial entity, bank, or investment advisor. We operate exclusively as a technology provider.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">2. Acceptance of Terms</h2>
            <p class="mb-4">By accessing and using the GrowX5 platform, you agree to be legally bound by these Terms and Conditions. If you do not agree with any of these terms, you must not use our services.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">3. Service Description</h2>
            <p class="mb-4">GrowX5 provides automated tools for risk capital management through algorithms and technological systems. All information is for informational purposes only. We do not offer personalized financial advice.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">4. Risk Nature of Investment</h2>
            <p class="mb-4">Capital provision to GrowX5 constitutes a high-risk investment where the user assumes all potential losses. Funds are managed through automated algorithms without direct human intervention.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">5. Total Loss Risk</h2>
            <p class="mb-4">Your operating capital is exposed to total losses. Users must be prepared to lose 100% of their contributed capital. Only invest money you can afford to lose completely.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">6. No Guarantees</h2>
            <p class="mb-4">GrowX5 does not guarantee specific returns or investment results. Past returns do not predict future results. The platform may experience interruptions or technical failures.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">7. User Responsibilities</h2>
            <p class="mb-4">Users are completely responsible for evaluating their risk tolerance, complying with the laws of their jurisdiction, and making informed decisions about their investments.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">8. Registration and Verification</h2>
            <p class="mb-4">Users must provide truthful information during registration. KYC is optional and only required for specific cases determined by the platform. We implement privacy by design.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">9. Liability Limitations</h2>
            <p class="mb-4">GrowX5 is not liable for losses resulting from market volatility, technical failures, or user errors. We do not compensate for losses derived from the normal operation of the platform.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">10. Intellectual Property</h2>
            <p class="mb-4">All content, algorithms, and technology on the platform are the exclusive property of GrowX5. Users may not copy, modify, or distribute our intellectual property.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">11. Termination of Service</h2>
            <p class="mb-4">GrowX5 reserves the right to terminate or suspend services to any user at any time, especially in cases of terms violation or suspicious activity detection.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">12. Modifications to Terms</h2>
            <p class="mb-4">GrowX5 may modify these terms at any time. Users will be notified of significant changes, and continued use of the platform constitutes acceptance of the new terms.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">13. Applicable Law</h2>
            <p class="mb-4">These terms are governed by the laws of the jurisdiction where GrowX5 is legally established. Any dispute will be resolved in the courts of said jurisdiction.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">14. Contact</h2>
            <p class="mb-4">For any questions about these terms, please contact us at legal@growx5.app.</p>
          </div>
        </div>
      `;
    case 'privacy':
      // Definir directamente el contenido de la política de privacidad
      return `
        <div class="space-y-6">
          <div>
            <h2 class="text-xl font-semibold mb-3">1. Introduction</h2>
            <p class="mb-4">At GrowX5, we prioritize your privacy and the protection of your personal data. This Privacy Policy explains how we collect, use, and protect your information when you use our platform.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">2. Information We Collect</h2>
            <p class="mb-4">We collect minimal personal information necessary for platform operation, including:</p>
            <ul class="list-disc pl-5 mb-4">
              <li>Email address</li>
              <li>Wallet addresses</li>
              <li>IP address and device information</li>
              <li>Usage data and platform interactions</li>
              <li>Optional KYC information when required</li>
            </ul>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <p class="mb-4">We use your information to:</p>
            <ul class="list-disc pl-5 mb-4">
              <li>Provide and improve our services</li>
              <li>Process transactions and manage your account</li>
              <li>Communicate with you about your account and updates</li>
              <li>Comply with legal obligations</li>
              <li>Detect and prevent fraud</li>
            </ul>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">4. Data Protection</h2>
            <p class="mb-4">We implement strong security measures to protect your data from unauthorized access, alteration, or disclosure. We use encryption, secure servers, and regular security audits.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">5. Data Sharing</h2>
            <p class="mb-4">We do not sell your personal data. We may share information with:</p>
            <ul class="list-disc pl-5 mb-4">
              <li>Service providers who help us operate our platform</li>
              <li>Legal authorities when required by law</li>
              <li>Business partners with your explicit consent</li>
            </ul>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">6. Your Rights</h2>
            <p class="mb-4">You have the right to:</p>
            <ul class="list-disc pl-5 mb-4">
              <li>Access your personal data</li>
              <li>Correct inaccurate information</li>
              <li>Delete your data (with certain limitations)</li>
              <li>Object to processing of your data</li>
              <li>Data portability</li>
            </ul>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">7. Cookies and Tracking</h2>
            <p class="mb-4">We use cookies and similar technologies to enhance your experience, analyze usage, and assist in our marketing efforts. You can control cookies through your browser settings.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">8. Third-Party Links</h2>
            <p class="mb-4">Our platform may contain links to third-party websites. We are not responsible for the privacy practices of these sites. We encourage you to read their privacy policies.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">9. Children's Privacy</h2>
            <p class="mb-4">Our services are not intended for individuals under 18 years of age. We do not knowingly collect personal information from children.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">10. Changes to Privacy Policy</h2>
            <p class="mb-4">We may update this Privacy Policy periodically. We will notify you of significant changes through email or platform notifications.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">11. Contact Us</h2>
            <p class="mb-4">If you have questions about this Privacy Policy, please contact our Data Protection Officer at privacy@growx5.app.</p>
          </div>
        </div>
      `;
    case 'risk':
      // Definir directamente el contenido de la divulgación de riesgos
      return `
        <div class="space-y-6">
          <div>
            <h2 class="text-xl font-semibold mb-3">1. High-Risk Investment</h2>
            <p class="mb-4">GrowX5 involves high-risk capital management. The value of your investment can fluctuate significantly and may result in the loss of your entire investment.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">2. No Guaranteed Returns</h2>
            <p class="mb-4">Past performance is not indicative of future results. Any examples of returns shown are for illustrative purposes only and do not represent guaranteed returns.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">3. Algorithmic Risk</h2>
            <p class="mb-4">Our platform uses automated algorithms that operate without human intervention. These algorithms may not perform as expected in all market conditions.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">4. Market Volatility</h2>
            <p class="mb-4">Financial markets can be highly volatile. Rapid price movements can lead to substantial losses in short periods.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">5. Liquidity Risk</h2>
            <p class="mb-4">There may be situations where assets cannot be quickly sold or converted to cash without significant loss in value.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">6. Technical Risks</h2>
            <p class="mb-4">Our platform may experience technical issues, including system failures, connectivity problems, or security breaches that could affect your investment.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">7. Regulatory Risks</h2>
            <p class="mb-4">Changes in laws, regulations, or tax policies may adversely affect the operation of GrowX5 or the value of your investment.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">8. Counterparty Risks</h2>
            <p class="mb-4">The platform may interact with third-party services or financial institutions that could fail to meet their obligations.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">9. Concentration Risk</h2>
            <p class="mb-4">Investing a large portion of your assets in a single platform or strategy increases your risk of significant losses.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">10. Operational Risk</h2>
            <p class="mb-4">Errors in internal processes, people, and systems may occur and impact the performance of the platform.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">11. No Financial Advice</h2>
            <p class="mb-4">GrowX5 does not provide personalized investment advice. Our platform is not a substitute for professional financial guidance.</p>
          </div>
          
          <div>
            <h2 class="text-xl font-semibold mb-3">12. User Responsibility</h2>
            <p class="mb-4">You are solely responsible for evaluating the risks associated with using GrowX5 and determining whether it is appropriate for your financial situation.</p>
          </div>
        </div>
      `;
    default:
      return '';
  }
};

export default Legal;