import React, { useState, useEffect } from 'react';

const Testimonials = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const testimonials = [
    {
      id: 1,
      name: "Carlos R.",
      location: "Madrid, España",
      duration: "3 meses de uso",
      returns: "78% de rendimiento IA",
      rating: 5,
      comment: "Las herramientas IA de GrowX5 han superado todas mis expectativas. Los agentes IA especializados son increíbles y los rendimientos son consistentes. El soporte 24/7 es excepcional.",
      avatar: "/avatars/carlos.svg"
    },
    {
      id: 2,
      name: "Laura M.",
      location: "Barcelona, España",
      duration: "2 meses de uso",
      returns: "52% de rendimiento IA",
      rating: 5,
      comment: "La plataforma de licencias IA es muy intuitiva y los resultados de los agentes hablan por sí solos. Me encanta la transparencia y la facilidad para liquidar rendimientos.",
      avatar: "/avatars/laura.svg"
    },
    {
      id: 3,
      name: "Miguel A.",
      location: "Valencia, España",
      duration: "4 meses de uso",
      returns: "104% de rendimiento IA",
      rating: 4,
      comment: "Excelente plataforma de herramientas IA. Los ciclos de 9 días de los agentes funcionan perfectamente y la privacidad está garantizada. Muy recomendable.",
      avatar: "/avatars/miguel.svg"
    },
    {
      id: 4,
      name: "Ana P.",
      location: "Sevilla, España",
      duration: "6 meses de uso",
      returns: "201% de rendimiento IA",
      rating: 5,
      comment: "Increíble plataforma de licencias IA. He duplicado mi inversión inicial en herramientas IA y sigo reinvirtiendo. El equipo de soporte es muy profesional.",
      avatar: "/avatars/ana.svg"
    },
    {
      id: 5,
      name: "Javier L.",
      location: "Bilbao, España",
      duration: "5 meses de uso",
      returns: "132% de rendimiento IA",
      rating: 5,
      comment: "La automatización de los agentes IA es impresionante. No necesito hacer nada y los rendimientos llegan puntualmente. Una experiencia excepcional.",
      avatar: "/avatars/javier.svg"
    }
  ];

  // Auto-rotate testimonials every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => 
        prevIndex === testimonials.length - 1 ? 0 : prevIndex + 1
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [testimonials.length]);

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, index) => (
      <svg
        key={index}
        className={`w-5 h-5 ${
          index < rating ? 'text-yellow-400' : 'text-gray-300'
        }`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ));
  };

  const goToSlide = (index) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setCurrentIndex(currentIndex === 0 ? testimonials.length - 1 : currentIndex - 1);
  };

  const goToNext = () => {
    setCurrentIndex(currentIndex === testimonials.length - 1 ? 0 : currentIndex + 1);
  };

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-secondary-800 mb-4">
            Lo que dicen nuestros usuarios
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Miles de usuarios ya están generando rendimientos con nuestras herramientas IA bajo licencia. 
            Descubre sus experiencias y resultados reales con nuestros agentes especializados.
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Testimonial Card */}
          <div className="bg-gradient-to-br from-primary-50 to-secondary-50 rounded-2xl p-8 shadow-xl border border-primary-100">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <img
                  src={testimonials[currentIndex].avatar}
                  alt={testimonials[currentIndex].name}
                  className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
                />
              </div>

              {/* Content */}
              <div className="flex-1 text-center md:text-left">
                {/* Stars */}
                <div className="flex justify-center md:justify-start mb-4">
                  {renderStars(testimonials[currentIndex].rating)}
                </div>

                {/* Comment */}
                <blockquote className="text-lg text-gray-700 mb-6 italic">
                  "{testimonials[currentIndex].comment}"
                </blockquote>

                {/* User Info */}
                <div className="space-y-2">
                  <h4 className="text-xl font-bold text-gray-900">
                    {testimonials[currentIndex].name}
                  </h4>
                  <p className="text-gray-600">
                    {testimonials[currentIndex].location}
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 gap-2 text-sm text-gray-500">
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      {testimonials[currentIndex].duration}
                    </span>
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                      </svg>
                      {testimonials[currentIndex].returns}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={goToPrevious}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-4 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={goToNext}
            className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-4 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Dots Indicator */}
        <div className="flex justify-center mt-8 space-x-2">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${
                index === currentIndex
                  ? 'bg-primary-500 scale-125'
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6">
            <div className="text-3xl font-bold text-green-600 mb-2">500+</div>
            <div className="text-gray-700">Usuarios Activos</div>
          </div>
          <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-6">
            <div className="text-3xl font-bold text-primary-600 mb-2">4.8/5</div>
            <div className="text-gray-700">Calificación Promedio</div>
          </div>
          <div className="bg-gradient-to-br from-secondary-50 to-secondary-100 rounded-xl p-6">
            <div className="text-3xl font-bold text-secondary-600 mb-2">98%</div>
            <div className="text-gray-700">Satisfacción del Cliente</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;