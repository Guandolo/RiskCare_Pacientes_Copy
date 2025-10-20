import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = 'paciente' | 'profesional_clinico' | 'admin_clinica' | 'superadmin';

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
          return;
        }

        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching roles:', error);
          setRoles([]);
        } else {
          setRoles(data?.map(r => r.role as UserRole) || []);
        }
      } catch (error) {
        console.error('Error in fetchRoles:', error);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRoles();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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