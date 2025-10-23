import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = 'paciente' | 'profesional_clinico' | 'admin_clinica' | 'superadmin';

// 🚨 CACHE GLOBAL de roles para evitar consultas repetidas
// Cada usuario tiene su cache con timestamp
interface RoleCache {
  userId: string;
  roles: UserRole[];
  timestamp: number;
}

let roleCache: RoleCache | null = null;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutos

// 🚨 Flag para evitar múltiples fetches simultáneos
let fetchInProgress = false;
let fetchPromise: Promise<UserRole[]> | null = null;

export const useUserRole = () => {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setRoles([]);
          setLoading(false);
          roleCache = null;
          return;
        }

        // 🚨 VERIFICAR CACHE: Si el cache es válido, usarlo
        const now = Date.now();
        if (roleCache && 
            roleCache.userId === user.id && 
            (now - roleCache.timestamp) < CACHE_DURATION_MS) {
          console.log('[useUserRole] 📦 Usando roles desde cache');
          setRoles(roleCache.roles);
          setLoading(false);
          return;
        }

        // 🚨 Si ya hay un fetch en progreso, esperarlo
        if (fetchInProgress && fetchPromise) {
          console.log('[useUserRole] ⏳ Fetch en progreso, esperando...');
          const cachedRoles = await fetchPromise;
          setRoles(cachedRoles);
          setLoading(false);
          return;
        }

        // 🚨 Iniciar nuevo fetch
        fetchInProgress = true;
        console.log('[useUserRole] 🔄 Cargando roles para usuario:', user.id);
        
        fetchPromise = (async () => {
          const { data, error } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);

          if (error) {
            console.error('[useUserRole] ❌ Error fetching roles:', error);
            return [];
          }

          const fetchedRoles = data?.map(r => r.role as UserRole) || [];
          
          // Actualizar cache
          roleCache = {
            userId: user.id,
            roles: fetchedRoles,
            timestamp: Date.now(),
          };
          
          console.log('[useUserRole] ✅ Roles cargados y cacheados:', fetchedRoles);
          
          return fetchedRoles;
        })();

        const fetchedRoles = await fetchPromise;
        setRoles(fetchedRoles);
        
      } catch (error) {
        console.error('[useUserRole] ❌ Error in fetchRoles:', error);
        setRoles([]);
      } finally {
        setLoading(false);
        fetchInProgress = false;
        fetchPromise = null;
      }
    };

    // 🚨 SOLO cargar UNA VEZ al montar
    fetchRoles();

    // 🚨 CRÍTICO: ELIMINADO onAuthStateChange
    // Las recargas constantes de roles eran causadas por este listener
    // Los roles NO cambian frecuentemente, el cache de 10 min es suficiente
    // Si se necesita recargar, usar invalidateRoleCache()
    
    // 🚨 SOLO recargar cuando el componente se monta (nuevo login)
    // NO recargar en cada evento de auth (TOKEN_REFRESHED, etc.)
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 🚨 Array vacío = solo al montar

  const hasRole = (role: UserRole) => roles.includes(role);
  const hasAnyRole = (checkRoles: UserRole[]) => checkRoles.some(r => roles.includes(r));
  const isPaciente = hasRole('paciente');
  const isProfesional = hasRole('profesional_clinico');
  const isAdminClinica = hasRole('admin_clinica');
  const isSuperAdmin = hasRole('superadmin');

  return {
    roles,
    loading,
    hasRole,
    hasAnyRole,
    isPaciente,
    isProfesional,
    isAdminClinica,
    isSuperAdmin,
  };
};

/**
 * 🚨 FUNCIÓN HELPER: Invalidar cache de roles manualmente
 * Usar cuando se sabe que los roles cambiaron (ej. admin actualiza roles)
 */
export const invalidateRoleCache = () => {
  console.log('[useUserRole] 🗑️ Cache de roles invalidado manualmente');
  roleCache = null;
};