import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalStore } from "@/stores/globalStore";

// Singleton auth listener to avoid multiple subscriptions across components
let authInitialized = false;
let currentSession: Session | null = null;
let currentUser: User | null = null;

// 🚨 THROTTLING: Prevenir notificaciones excesivas
let lastNotificationTime = 0;
const NOTIFICATION_THROTTLE_MS = 1000; // 1 segundo entre notificaciones

const ensureAuthListener = () => {
  if (authInitialized) return;
  
  console.log('[useAuth] 🔧 Inicializando listener único de autenticación');
  
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('[useAuth] 🔔 Auth event:', event);
    
    currentSession = session;
    currentUser = session?.user ?? null;
    
    // 🚨 THROTTLING: Solo notificar si ha pasado suficiente tiempo
    const now = Date.now();
    const timeSinceLastNotification = now - lastNotificationTime;
    
    if (timeSinceLastNotification < NOTIFICATION_THROTTLE_MS && event !== 'SIGNED_OUT') {
      console.log('[useAuth] ⏭️ Notificación throttled (hace', timeSinceLastNotification, 'ms)');
      return;
    }
    
    lastNotificationTime = now;
    
    // Notificar a la app sin crear múltiples listeners por componente
    window.dispatchEvent(new CustomEvent('authChanged', { detail: { event, hasSession: !!session } }));

    // Seguridad: al cerrar sesión desde cualquier pestaña/contexto, limpiar y redirigir de inmediato
    if (event === 'SIGNED_OUT') {
      console.log('[useAuth] 🚪 SIGNED_OUT detectado - limpiando y redirigiendo');
      try {
        // Limpiar el store global primero
        useGlobalStore.getState().resetStore();
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
      if (window.top) {
        (window.top as Window).location.href = '/auth';
      } else {
        window.location.href = '/auth';
      }
    }
  });
  authInitialized = true;
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Usar un único listener global y escuchar eventos en cada componente
    ensureAuthListener();

    const handleAuthChanged = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('[useAuth] 📥 Evento authChanged recibido:', customEvent.detail?.event);
      
      setSession(currentSession);
      setUser(currentUser);
      setLoading(false);
    };

    window.addEventListener('authChanged', handleAuthChanged);

    // Inicializar estado con la sesión actual (solo UNA vez al montar)
    supabase.auth.getSession().then(({ data: { session } }) => {
      currentSession = session;
      currentUser = session?.user ?? null;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        console.log('[useAuth] ✅ Sesión inicial cargada para usuario:', session.user.id);
      } else {
        console.log('[useAuth] 🚫 No hay sesión inicial');
      }
    });

    return () => {
      window.removeEventListener('authChanged', handleAuthChanged);
      // Nota: no desuscribimos el listener global para evitar perder eventos
    };
  }, []);

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          prompt: 'select_account',
        },
        skipBrowserRedirect: true,
      },
    });
    
    if (error) {
      console.error("[useAuth] ❌ Error al iniciar sesión con Google:", error.message);
      throw error;
    }

    if (data?.url) {
      console.log('[useAuth] 🔗 Redirigiendo a Google OAuth');
      // Redirige en el contexto top para evitar el bloqueo de Google dentro del iframe del preview
      if (window.top) {
        (window.top as Window).location.href = data.url;
      } else {
        window.location.href = data.url;
      }
    }
  };

  const signOut = async () => {
    console.log('[useAuth] 🚪 Iniciando sign out');
    // Usa la ruta dedicada para un cierre de sesión profundo
    if (window.top) {
      (window.top as Window).location.href = "/logout";
    } else {
      window.location.href = "/logout";
    }
  };

  return {
    user,
    session,
    loading,
    signInWithGoogle,
    signOut,
  };
};
