import React from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import PromoBanner from '../components/PromoBanner'
import Hero from '../components/Hero'
import WhatIs from '../components/WhatIs'
import Benefits from '../components/Benefits'
import HowItWorks from '../components/HowItWorks'
import AIAgents from '../components/AIAgents'
import Calculator from '../components/Calculator'
import Roadmap from '../components/Roadmap'
import Testimonials from '../components/Testimonials'
import FAQ from '../components/FAQ'
import CTA from '../components/CTA'

const Landing = () => {
  return (
    <div className="min-h-screen">
      <Header />
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