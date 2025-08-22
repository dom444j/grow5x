// Shims para módulos sin tipos disponibles
declare module 'react-hot-toast';
declare module 'react-helmet-async' {
  export const Helmet: any;
  export const HelmetProvider: any;
}

// Otros módulos que puedan necesitar shims
declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}