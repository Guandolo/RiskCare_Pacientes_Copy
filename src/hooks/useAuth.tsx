import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalStore } from "@/stores/globalStore";

// Singleton auth listener to avoid multiple subscriptions across components
let authInitialized = false;
let currentSession: Session | null = null;
let currentUser: User | null = null;

const ensureAuthListener = () => {
  if (authInitialized) return;
  supabase.auth.onAuthStateChange((event, session) => {
    currentSession = session;
    currentUser = session?.user ?? null;
    // Notificar a la app sin crear múltiples listeners por componente
    window.dispatchEvent(new CustomEvent('authChanged', { detail: { event, hasSession: !!session } }));

    // Seguridad: al cerrar sesión desde cualquier pestaña/contexto, limpiar y redirigir de inmediato
    if (event === 'SIGNED_OUT') {
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

    const handleAuthChanged = () => {
      setSession(currentSession);
      setUser(currentUser);
      setLoading(false);
    };

    window.addEventListener('authChanged', handleAuthChanged);

    // Inicializar estado con la sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      currentSession = session;
      currentUser = session?.user ?? null;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
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
      console.error("Error al iniciar sesión con Google:", error.message);
      throw error;
    }

    if (data?.url) {
      // Redirige en el contexto top para evitar el bloqueo de Google dentro del iframe del preview
      if (window.top) {
        (window.top as Window).location.href = data.url;
      } else {
        window.location.href = data.url;
      }
    }
  };

  const signOut = async () => {
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
