// URLs y configuración de la aplicación
export const APP_URLS = {
  PRODUCTION: 'https://riskcare-pacientes-copy-445230876103.northamerica-south1.run.app',
  DEVELOPMENT: 'http://localhost:5173',
};

export const getAppUrl = () => {
  if (window.location.hostname === 'localhost') {
    return APP_URLS.DEVELOPMENT;
  }
  return APP_URLS.PRODUCTION;
};