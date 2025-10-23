/**
 * 🚨 SESSION MANAGER - Control Manual de Sesión Supabase
 * 
 * PROBLEMA IDENTIFICADO:
 * - autoRefreshToken de Supabase causa recargas agresivas al cambiar ventanas
 * - _recoverAndRefresh se ejecuta innecesariamente
 * - Múltiples llamadas a /auth/v1/user y /rest/v1/user_roles
 * 
 * SOLUCIÓN:
 * - Refresh manual con throttling
 * - Control basado en visibilidad de página
 * - Caché de tokens y roles
 */

import { supabase } from '@/integrations/supabase/client';
import { CURRENT_TAB_ID } from '@/stores/globalStore';

// 🔧 Configuración de throttling
const REFRESH_THROTTLE_MS = 5 * 60 * 1000; // 5 minutos entre refreshes
const TOKEN_EXPIRY_BUFFER_MS = 10 * 60 * 1000; // Refrescar 10 min antes de expirar

// Estado interno
let lastRefreshTime = 0;
let refreshInProgress = false;
let sessionCheckInterval: NodeJS.Timeout | null = null;

// 🚨 Flag para pausar actualizaciones cuando la página está oculta
let isPageVisible = true;

/**
 * Inicializar listener de visibilidad
 */
const initVisibilityListener = () => {
  if (typeof document === 'undefined') return;
  
  document.addEventListener('visibilitychange', () => {
    isPageVisible = !document.hidden;
    
    if (document.hidden) {
      console.log('[SessionManager] 🔒 Página oculta [Tab:', CURRENT_TAB_ID, '] - pausando verificaciones de sesión');
    } else {
      console.log('[SessionManager] 👁️ Página visible [Tab:', CURRENT_TAB_ID, '] - verificando sesión si es necesario');
      
      // Al volver a la página, verificar si necesitamos refrescar
      // Pero con throttle para no hacer refresh agresivo
      const timeSinceLastRefresh = Date.now() - lastRefreshTime;
      if (timeSinceLastRefresh > REFRESH_THROTTLE_MS) {
        checkAndRefreshSession();
      } else {
        console.log('[SessionManager] ⏭️ Último refresh hace', Math.round(timeSinceLastRefresh / 1000), 's - saltando');
      }
    }
  });
};

/**
 * Verificar y refrescar sesión si es necesario
 */
export const checkAndRefreshSession = async (): Promise<boolean> => {
  // 🚨 NO refrescar si la página está oculta
  if (!isPageVisible) {
    console.log('[SessionManager] ⏭️ Página oculta - saltando verificación de sesión');
    return false;
  }
  
  // 🚨 NO refrescar si ya hay un refresh en progreso
  if (refreshInProgress) {
    console.log('[SessionManager] ⏭️ Refresh ya en progreso - saltando');
    return false;
  }
  
  // 🚨 Throttling: NO refrescar si fue reciente
  const timeSinceLastRefresh = Date.now() - lastRefreshTime;
  if (timeSinceLastRefresh < REFRESH_THROTTLE_MS) {
    console.log('[SessionManager] ⏭️ Refresh reciente hace', Math.round(timeSinceLastRefresh / 1000), 's - saltando');
    return false;
  }
  
  refreshInProgress = true;
  
  try {
    // Obtener sesión actual
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('[SessionManager] ❌ Error obteniendo sesión:', error);
      return false;
    }
    
    if (!session) {
      console.log('[SessionManager] 🚫 No hay sesión activa');
      return false;
    }
    
    // Verificar si el token está por expirar
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const timeUntilExpiry = expiresAt - Date.now();
    
    console.log('[SessionManager] 🕐 Token expira en', Math.round(timeUntilExpiry / 1000 / 60), 'minutos');
    
    // Solo refrescar si está por expirar
    if (timeUntilExpiry > TOKEN_EXPIRY_BUFFER_MS) {
      console.log('[SessionManager] ✅ Token válido - no requiere refresh');
      lastRefreshTime = Date.now();
      return true;
    }
    
    console.log('[SessionManager] 🔄 Refrescando token...');
    
    // Refrescar sesión manualmente
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError) {
      console.error('[SessionManager] ❌ Error refrescando sesión:', refreshError);
      return false;
    }
    
    if (refreshData.session) {
      console.log('[SessionManager] ✅ Sesión refrescada exitosamente');
      lastRefreshTime = Date.now();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[SessionManager] ❌ Excepción en checkAndRefreshSession:', error);
    return false;
  } finally {
    refreshInProgress = false;
  }
};

/**
 * Iniciar verificación periódica de sesión
 */
export const startSessionCheck = () => {
  // Limpiar intervalo existente
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
  }
  
  console.log('[SessionManager] 🚀 Iniciando verificación periódica de sesión [Tab:', CURRENT_TAB_ID, ']');
  
  // Verificar cada 2 minutos (pero con throttling interno de 5 min)
  sessionCheckInterval = setInterval(() => {
    checkAndRefreshSession();
  }, 2 * 60 * 1000);
  
  // Verificación inicial
  checkAndRefreshSession();
};

/**
 * Detener verificación periódica de sesión
 */
export const stopSessionCheck = () => {
  if (sessionCheckInterval) {
    console.log('[SessionManager] 🛑 Deteniendo verificación de sesión [Tab:', CURRENT_TAB_ID, ']');
    clearInterval(sessionCheckInterval);
    sessionCheckInterval = null;
  }
};

/**
 * Forzar refresh inmediato (solo usar en casos específicos)
 */
export const forceRefreshSession = async (): Promise<boolean> => {
  console.log('[SessionManager] ⚡ Refresh forzado de sesión');
  lastRefreshTime = 0; // Reset throttle
  return checkAndRefreshSession();
};

/**
 * Obtener tiempo desde último refresh
 */
export const getTimeSinceLastRefresh = (): number => {
  return Date.now() - lastRefreshTime;
};

/**
 * Inicializar SessionManager
 */
export const initSessionManager = () => {
  if (typeof window === 'undefined') return;
  
  console.log('[SessionManager] 🔧 Inicializando SessionManager con control manual de refresh');
  
  // Inicializar listener de visibilidad
  initVisibilityListener();
  
  // Iniciar verificación periódica
  startSessionCheck();
  
  // Cleanup al descargar página
  window.addEventListener('beforeunload', () => {
    stopSessionCheck();
  });
};

// Auto-inicializar si estamos en el navegador
if (typeof window !== 'undefined') {
  initSessionManager();
}
