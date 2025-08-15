import React from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const Privacy = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="section-padding bg-white">
        <div className="container-max max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-secondary-900 mb-4">
              Política de Privacidad
            </h1>
            <p className="text-secondary-600">
              Última actualización: Enero 2024
            </p>
          </div>

          <div className="prose prose-lg max-w-none">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-blue-800 mb-3">🔒 Privacidad por Diseño</h2>
              <p className="text-blue-700">
                En GrowX5 priorizamos su privacidad y la protección de sus datos personales. Implementamos privacidad por diseño. 
                Esta política explica cómo recopilamos, utilizamos y protegemos su información cuando utiliza nuestra plataforma tecnológica.
              </p>
            </div>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">1. Información que Recopilamos</h2>
              
              <h3 className="text-xl font-semibold text-secondary-700 mb-3">Información Personal Mínima</h3>
              <ul className="list-disc list-inside text-secondary-600 space-y-2 mb-4">
                <li>Dirección de correo electrónico</li>
                <li>Direcciones de wallet</li>
                <li>Dirección IP y información del dispositivo</li>
                <li>Datos de uso e interacciones con la plataforma</li>
                <li>Información KYC opcional cuando sea requerida</li>
              </ul>

              <h3 className="text-xl font-semibold text-secondary-700 mb-3">Información Financiera</h3>
              <ul className="list-disc list-inside text-secondary-600 space-y-2 mb-4">
                <li>Direcciones de wallets de criptomonedas</li>
                <li>Historial de transacciones</li>
                <li>Montos de inversión</li>
                <li>Información de referidos</li>
              </ul>

              <h3 className="text-xl font-semibold text-secondary-700 mb-3">Información Técnica</h3>
              <ul className="list-disc list-inside text-secondary-600 space-y-2">
                <li>Dirección IP</li>
                <li>Tipo de navegador y dispositivo</li>
                <li>Páginas visitadas y tiempo de permanencia</li>
                <li>Cookies y tecnologías similares</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">2. Cómo Utilizamos su Información</h2>
              <p className="text-secondary-600 mb-4">
                Utilizamos la información recopilada para los siguientes propósitos:
              </p>
              <ul className="list-disc list-inside text-secondary-600 space-y-2">
                <li>Proporcionar y mejorar nuestros servicios tecnológicos</li>
                <li>Procesar transacciones y gestionar su cuenta</li>
                <li>Comunicarnos con usted sobre su cuenta y actualizaciones</li>
                <li>Cumplir con obligaciones legales</li>
                <li>Detectar y prevenir fraudes</li>
                <li>Analizar el uso para mejorar la plataforma</li>
                <li>Proporcionar soporte técnico</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">3. Compartir Información</h2>
              <p className="text-secondary-600 mb-4">
                No vendemos sus datos personales. Podemos compartir información con:
              </p>
              <ul className="list-disc list-inside text-secondary-600 space-y-2">
                <li>Proveedores de servicios que nos ayudan a operar nuestra plataforma</li>
                <li>Autoridades legales cuando sea requerido por ley</li>
                <li>Socios comerciales con su consentimiento explícito</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">4. Protección de Datos</h2>
              <p className="text-secondary-600 mb-4">
                Implementamos medidas de seguridad sólidas para proteger sus datos del acceso no autorizado, alteración o divulgación. 
                Utilizamos encriptación, servidores seguros y auditorías de seguridad regulares.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">5. Cookies y Tecnologías de Seguimiento</h2>
              <p className="text-secondary-600 mb-4">
                Utilizamos cookies y tecnologías similares para:
              </p>
              <ul className="list-disc list-inside text-secondary-600 space-y-2 mb-4">
                <li>Mantener su sesión activa</li>
                <li>Recordar sus preferencias</li>
                <li>Analizar el uso de la plataforma</li>
                <li>Mejorar la funcionalidad del sitio</li>
              </ul>
              <p className="text-secondary-600">
                Puede configurar su navegador para rechazar cookies, aunque esto puede afectar la funcionalidad de la plataforma.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">6. Sus Derechos</h2>
              <p className="text-secondary-600 mb-4">
                Usted tiene los siguientes derechos respecto a su información personal:
              </p>
              <ul className="list-disc list-inside text-secondary-600 space-y-2">
                <li><strong>Acceso:</strong> Solicitar una copia de la información que tenemos sobre usted</li>
                <li><strong>Rectificación:</strong> Corregir información inexacta o incompleta</li>
                <li><strong>Eliminación:</strong> Solicitar la eliminación de su información personal</li>
                <li><strong>Portabilidad:</strong> Recibir sus datos en un formato estructurado</li>
                <li><strong>Oposición:</strong> Oponerse al procesamiento de sus datos en ciertas circunstancias</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">7. Retención de Datos</h2>
              <p className="text-secondary-600 mb-4">
                Conservamos su información personal durante el tiempo necesario para:
              </p>
              <ul className="list-disc list-inside text-secondary-600 space-y-2">
                <li>Proporcionar nuestros servicios</li>
                <li>Cumplir con obligaciones legales</li>
                <li>Resolver disputas</li>
                <li>Hacer cumplir nuestros acuerdos</li>
              </ul>
              <p className="text-secondary-600 mt-4">
                Generalmente, conservamos los datos de cuenta durante 7 años después del cierre de la cuenta, 
                o según lo requiera la legislación aplicable.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">8. Transferencias Internacionales</h2>
              <p className="text-secondary-600">
                Sus datos pueden ser transferidos y procesados en países fuera de su jurisdicción. 
                Nos aseguramos de que dichas transferencias cumplan con las leyes de protección de datos aplicables 
                y que se implementen las salvaguardas adecuadas.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">9. Menores de Edad</h2>
              <p className="text-secondary-600">
                Nuestros servicios no están dirigidos a menores de 18 años. No recopilamos conscientemente 
                información personal de menores. Si descubrimos que hemos recopilado información de un menor, 
                la eliminaremos inmediatamente.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">10. Cambios a esta Política</h2>
              <p className="text-secondary-600">
                Podemos actualizar esta Política de Privacidad ocasionalmente. Le notificaremos sobre cambios 
                significativos publicando la nueva política en nuestro sitio web y enviando una notificación 
                a su dirección de correo electrónico registrada.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">11. Contacto</h2>
              <p className="text-secondary-600 mb-4">
                Si tiene preguntas sobre esta Política de Privacidad, puede contactar a nuestro 
                Oficial de Protección de Datos en privacy@growx5.app.
              </p>
            </section>

            <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-6 mt-12">
              <p className="text-secondary-700 text-center">
                <strong>Al utilizar GrowX5, usted acepta el procesamiento de su información personal 
                de acuerdo con esta Política de Privacidad.</strong>
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default Privacy