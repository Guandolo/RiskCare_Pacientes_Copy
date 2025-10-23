import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalStore } from "@/stores/globalStore";

// 🚨 ELIMINADO: Singleton auth listener (causaba recargas constantes)
// Ya NO necesitamos escuchar eventos de Supabase constantemente
// La sesión se verifica solo al montar y se maneja con SessionManager

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🚨 SOLO cargar sesión inicial - NO escuchar eventos
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        console.log('[useAuth] ✅ Sesión inicial cargada para usuario:', session.user.id);
      } else {
        console.log('[useAuth] 🚫 No hay sesión inicial');
      }
    };

    initSession();
    
    // 🚨 ELIMINADO: onAuthStateChange listener
    // Ese listener causaba recargas al cambiar de ventana
    // El SessionManager maneja los refreshes de token
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo al montar

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
      if (window.top) {
        (window.top as Window).location.href = data.url;
      } else {
        window.location.href = data.url;
      }
    }
  };

  const signOut = async () => {
    console.log('[useAuth] 🚪 Iniciando sign out');
    
    // Limpiar store y storage
    try {
      useGlobalStore.getState().resetStore();
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    
    // Cerrar sesión en Supabase
    await supabase.auth.signOut();
    
    // Redirigir a login
    if (window.top) {
      (window.top as Window).location.href = '/auth';
    } else {
      window.location.href = '/auth';
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
