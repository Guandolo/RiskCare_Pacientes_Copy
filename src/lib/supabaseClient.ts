import { supabase } from "@/integrations/supabase/client";
import { useGlobalStore } from "@/stores/globalStore";

// Interceptor global para errores 401
let isRedirecting = false;

export const setupSupabaseErrorHandler = () => {
  // Interceptar las respuestas del cliente de Supabase
  const originalFrom = supabase.from.bind(supabase);
  const originalRpc = supabase.rpc.bind(supabase);
  const originalStorage = supabase.storage;
  
  // Función para manejar errores 401
  const handle401 = (error: any) => {
    if (error?.status === 401 || error?.code === 'PGRST301' || error?.message?.includes('JWT')) {
      if (!isRedirecting) {
        isRedirecting = true;
        console.error('Error 401 detectado: Sesión expirada o no autorizada');
        
        // Limpiar el store global
        useGlobalStore.getState().resetStore();
        
        // Limpiar storage
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch {}
        
        // Redirigir al login
        setTimeout(() => {
          if (window.top) {
            (window.top as Window).location.href = '/auth';
          } else {
            window.location.href = '/auth';
          }
        }, 100);
      }
    }
  };

  // Interceptar llamadas a tablas
  supabase.from = ((table: string) => {
    const query = originalFrom(table);
    const originalSelect = query.select.bind(query);
    const originalInsert = query.insert.bind(query);
    const originalUpdate = query.update.bind(query);
    const originalDelete = query.delete.bind(query);
    const originalUpsert = query.upsert.bind(query);

    // Interceptar select
    query.select = ((...args: any[]) => {
      const result = originalSelect(...args);
      const originalThen = result.then?.bind(result);
      
      if (originalThen) {
        result.then = ((resolve: any, reject: any) => {
          return originalThen((data: any) => {
            if (data.error) handle401(data.error);
            return resolve(data);
          }, reject);
        }) as any;
      }
      
      return result;
    }) as any;

    // Interceptar insert
    query.insert = ((...args: any[]) => {
      const result = originalInsert(...args);
      const originalThen = result.then?.bind(result);
      
      if (originalThen) {
        result.then = ((resolve: any, reject: any) => {
          return originalThen((data: any) => {
            if (data.error) handle401(data.error);
            return resolve(data);
          }, reject);
        }) as any;
      }
      
      return result;
    }) as any;

    // Interceptar update
    query.update = ((...args: any[]) => {
      const result = originalUpdate(...args);
      const originalThen = result.then?.bind(result);
      
      if (originalThen) {
        result.then = ((resolve: any, reject: any) => {
          return originalThen((data: any) => {
            if (data.error) handle401(data.error);
            return resolve(data);
          }, reject);
        }) as any;
      }
      
      return result;
    }) as any;

    // Interceptar delete
    query.delete = ((...args: any[]) => {
      const result = originalDelete(...args);
      const originalThen = result.then?.bind(result);
      
      if (originalThen) {
        result.then = ((resolve: any, reject: any) => {
          return originalThen((data: any) => {
            if (data.error) handle401(data.error);
            return resolve(data);
          }, reject);
        }) as any;
      }
      
      return result;
    }) as any;

    // Interceptar upsert
    query.upsert = ((...args: any[]) => {
      const result = originalUpsert(...args);
      const originalThen = result.then?.bind(result);
      
      if (originalThen) {
        result.then = ((resolve: any, reject: any) => {
          return originalThen((data: any) => {
            if (data.error) handle401(data.error);
            return resolve(data);
          }, reject);
        }) as any;
      }
      
      return result;
    }) as any;

    return query;
  }) as any;
};

// Inicializar el handler al importar este módulo
if (typeof window !== 'undefined') {
  setupSupabaseErrorHandler();
}

export { supabase };
