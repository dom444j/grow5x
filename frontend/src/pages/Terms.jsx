import React from 'react'
import UserHeader from '../components/home/UserHeader'
import Footer from '../components/home/Footer'

const Terms = () => {
  return (
    <div className="min-h-screen">
      <UserHeader />
      <main className="section-padding bg-white">
        <div className="container-max max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-secondary-900 mb-4">
              Términos y Condiciones
            </h1>
            <p className="text-secondary-600">
              Última actualización: Enero 2024
            </p>
          </div>

          <div className="prose prose-lg max-w-none">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-yellow-800 mb-3">⚠️ Aviso Importante</h2>
              <p className="text-yellow-700">
                GrowX5 es una plataforma tecnológica descentralizada que proporciona herramientas automatizadas de gestión mediante algoritmos de IA. 
                No somos una entidad financiera regulada, banco o asesor de inversiones. Operamos exclusivamente como proveedor de tecnología y herramientas digitales.
                Al utilizar nuestros servicios, usted asume completamente todos los riesgos tecnológicos asociados.
              </p>
            </div>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">1. Aceptación de los Términos</h2>
              <p className="text-secondary-600 mb-4">
                Al acceder y utilizar la plataforma Grow5X, usted acepta estar sujeto a estos Términos y Condiciones. 
                Si no está de acuerdo con alguna parte de estos términos, no debe utilizar nuestros servicios.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">2. Descripción del Servicio</h2>
              <p className="text-secondary-600 mb-4">
                GrowX5 proporciona herramientas automatizadas de gestión a través de algoritmos de IA y sistemas tecnológicos. 
                Toda la información es únicamente con fines informativos. No ofrecemos asesoramiento financiero personalizado ni recomendaciones de inversión.
              </p>
              <ul className="list-disc list-inside text-secondary-600 space-y-2 mb-4">
                <li>Herramientas automatizadas de gestión mediante algoritmos de IA sin intervención humana directa</li>
                <li>Herramientas tecnológicas para análisis de datos</li>
                <li>Sistema de referidos tecnológico</li>
                <li>Procesamiento de transacciones en criptomonedas</li>
                <li>Plataforma descentralizada y tecnológica</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">3. Requisitos de Elegibilidad</h2>
              <ul className="list-disc list-inside text-secondary-600 space-y-2">
                <li>Ser mayor de 18 años</li>
                <li>Tener capacidad legal para celebrar contratos</li>
                <li>Proporcionar información veraz y actualizada</li>
                <li>Contar con un código de referido válido para el registro</li>
                <li>Cumplir con las leyes locales aplicables</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">4. Naturaleza de las Herramientas Tecnológicas</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
                <h3 className="font-semibold text-red-800 mb-3">ADVERTENCIA DE RIESGO TECNOLÓGICO</h3>
                <ul className="list-disc list-inside text-red-700 space-y-2">
                  <li>El uso de herramientas automatizadas de GrowX5 conlleva riesgos tecnológicos donde el usuario asume toda la responsabilidad por los resultados</li>
                  <li>Las herramientas operan mediante algoritmos automatizados sin intervención humana directa</li>
                  <li>Los recursos gestionados están expuestos a pérdidas totales. Los usuarios deben estar preparados para asumir el 100% de las pérdidas potenciales</li>
                  <li>Solo utilice recursos que pueda permitirse perder completamente</li>
                  <li>GrowX5 no garantiza resultados específicos o rendimientos de las herramientas</li>
                  <li>Los resultados pasados no predicen resultados futuros</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">5. Sistema de Comisiones</h2>
              <p className="text-secondary-600 mb-4">
                El sistema de referidos opera bajo las siguientes condiciones:
              </p>
              <ul className="list-disc list-inside text-secondary-600 space-y-2">
                <li><strong>Comisión Directa:</strong> 10% del monto de licenciamiento de herramientas por el referido directo, pagada el día 9 del ciclo</li>
                <li><strong>Comisión Padre:</strong> 10% del monto de licenciamiento de herramientas por referidos de segundo nivel, pagada el día 17 del ciclo</li>
                <li>Las comisiones son únicas por referido y ciclo</li>
                <li>No hay límite en el número de referidos</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">6. Pagos y Retiros</h2>
              <ul className="list-disc list-inside text-secondary-600 space-y-2">
                <li>Todos los pagos se realizan en USDT a través de la red BEP20</li>
                <li>Los retiros tienen un monto mínimo de 10 USDT</li>
                <li>Se requiere verificación mediante PIN de Telegram para retiros</li>
                <li>Los pagos diarios se procesan automáticamente</li>
                <li>La plataforma se reserva el derecho de solicitar verificación adicional</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">7. Prohibiciones</h2>
              <p className="text-secondary-600 mb-4">Está estrictamente prohibido:</p>
              <ul className="list-disc list-inside text-secondary-600 space-y-2">
                <li>Crear múltiples cuentas</li>
                <li>Utilizar información falsa o de terceros</li>
                <li>Intentar manipular el sistema de referidos</li>
                <li>Realizar actividades fraudulentas o ilegales</li>
                <li>Interferir con el funcionamiento de la plataforma</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">8. Suspensión y Terminación</h2>
              <p className="text-secondary-600 mb-4">
                Grow5X se reserva el derecho de suspender o terminar cuentas que violen estos términos, 
                sin previo aviso y sin reembolso de fondos en casos de fraude comprobado.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">9. Limitaciones de Responsabilidad y Asunción de Riesgos</h2>
              <p className="text-secondary-600 mb-4">
                GrowX5 no es responsable por pérdidas resultantes de la volatilidad del mercado, fallas técnicas o errores del usuario. 
                No compensamos pérdidas derivadas del funcionamiento normal de la plataforma. Los usuarios son completamente responsables 
                de evaluar su tolerancia al riesgo, cumplir con las leyes de su jurisdicción y tomar decisiones informadas sobre el uso 
                de nuestras herramientas tecnológicas.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">10. Modificaciones</h2>
              <p className="text-secondary-600 mb-4">
                Estos términos pueden ser modificados en cualquier momento. Los usuarios serán notificados 
                de cambios significativos y el uso continuado de la plataforma constituye aceptación de los nuevos términos.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">11. Contacto</h2>
              <p className="text-secondary-600">
                Para consultas sobre estos términos, contacte a nuestro equipo legal en legal@growx5.app.
              </p>
            </section>

            <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-6 mt-12">
              <p className="text-secondary-700 text-center">
                <strong>Al utilizar GrowX5, usted confirma que ha leído, entendido y acepta 
                estos Términos y Condiciones en su totalidad, asumiendo completamente todos los riesgos 
                asociados con el uso de nuestras herramientas tecnológicas.</strong>
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default Terms