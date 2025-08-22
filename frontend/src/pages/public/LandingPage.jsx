import React, { useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import UserHeader from '../../components/home/UserHeader'
import Footer from '../../components/home/Footer'
import PromoBanner from '../../components/home/PromoBanner'
import Hero from '../../components/home/Hero'
import WhatIs from '../../components/home/WhatIs'
import Benefits from '../../components/home/Benefits'
import HowItWorks from '../../components/home/HowItWorks'
import AIAgents from '../../components/home/AIAgents'
import Calculator from '../../components/home/Calculator'
import Roadmap from '../../components/home/Roadmap'
import Testimonials from '../../components/home/Testimonials'
import FAQ from '../../components/home/FAQ'
import CTA from '../../components/home/CTA'
// import AuthDebug from '../../components/debug/AuthDebug'
import '../../utils/clearAuth'

const Landing = () => {
  const { user, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const siteUrl = window.location.origin;
  const pageUrl = window.location.href;
  const ogImage = `${siteUrl}/og-image.svg`;

  // Mostrar loading mientras se verifica la autenticación
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // La landing page es pública y debe mostrarse siempre
  // Los usuarios autenticados pueden verla pero tendrán botones diferentes

  return (
    <div className="min-h-screen">
      {/* <AuthDebug /> */}
      <Helmet>
        {/* Basic Meta Tags */}
        <title>Grow5X - Plataforma de Herramientas Tecnológicas | Gestión Automatizada con IA</title>
        <meta name="description" content="Herramientas tecnológicas avanzadas para gestión automatizada mediante IA. Tecnología de vanguardia con total privacidad y seguridad. Únete a más de 500 usuarios activos." />
        <meta name="keywords" content="herramientas tecnológicas, gestión automatizada, inteligencia artificial, tecnología, privacidad, seguridad, grow5x, automatización" />
        <meta name="author" content="Grow5X" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={pageUrl} />

        {/* Open Graph Meta Tags */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Grow5X - Plataforma de Herramientas Tecnológicas" />
        <meta property="og:description" content="Herramientas tecnológicas avanzadas para gestión automatizada mediante IA. Tecnología de vanguardia con total privacidad y seguridad." />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Grow5X - Plataforma de Herramientas Tecnológicas" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:site_name" content="Grow5X" />
        <meta property="og:locale" content="es_ES" />

        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@Grow5X" />
        <meta name="twitter:creator" content="@Grow5X" />
        <meta name="twitter:title" content="Grow5X - Plataforma de Herramientas Tecnológicas" />
        <meta name="twitter:description" content="Herramientas tecnológicas avanzadas para gestión automatizada mediante IA. Tecnología de vanguardia con total privacidad y seguridad." />
        <meta name="twitter:image" content={ogImage} />
        <meta name="twitter:image:alt" content="Grow5X - Plataforma de Herramientas Tecnológicas" />

        {/* Additional SEO Meta Tags */}
        <meta name="theme-color" content="#3B82F6" />
        <meta name="msapplication-TileColor" content="#3B82F6" />
        <meta name="application-name" content="Grow5X" />
        <meta name="apple-mobile-web-app-title" content="Grow5X" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Grow5X",
            "description": "Plataforma de herramientas tecnológicas para gestión automatizada mediante IA. Comunicación exclusiva por Telegram.",
            "url": siteUrl,
            "logo": `${siteUrl}/logo.svg`,
            "sameAs": [
              "https://t.me/CanalGrow5X"
            ],
            "contactPoint": {
              "@type": "ContactPoint",
              "contactType": "customer service",
              "availableLanguage": "Spanish",
              "url": "https://t.me/CanalGrow5X",
              "description": "Soporte y comunicación exclusivamente por Telegram"
            }
          })}
        </script>
      </Helmet>
      
      <UserHeader />
      <PromoBanner />
      <main>
        <Hero />
        <WhatIs />
        <Benefits />
        <HowItWorks />
        <AIAgents />
        <Calculator />
        <Roadmap />
        <Testimonials />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}

export default Landing