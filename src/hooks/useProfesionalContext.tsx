import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";
import { useGlobalStore } from "@/stores/globalStore";

export const useProfesionalContext = () => {
  const { isProfesional, loading: roleLoading } = useUserRole();
  const { 
    currentPatientUserId, 
    currentClinicaId, 
    setPatientContext: setContextInStore,
    loadActivePatient
  } = useGlobalStore();

  useEffect(() => {
    if (roleLoading) return;
    
    const loadContext = async () => {
      if (!isProfesional) return;

      // Solo cargar si no hay contexto en el store
      if (currentPatientUserId) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: context, error } = await supabase
          .from('profesional_patient_context')
          .select('current_patient_user_id, current_clinica_id')
          .eq('profesional_user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading professional context:', error);
        }

        if (context?.current_patient_user_id) {
          // Cargar el contexto completo usando el store
          await setContextInStore(context.current_patient_user_id, context.current_clinica_id);
        }
      } catch (error) {
        console.error('Error in loadContext:', error);
      }
    };

    loadContext();
  }, [isProfesional, roleLoading, currentPatientUserId, setContextInStore]);

  const setPatientContext = async (patientUserId: string, clinicaId: string) => {
    await setContextInStore(patientUserId, clinicaId);
  };

  return {
    currentPatientUserId,
    currentClinicaId,
    setPatientContext,
    loading: roleLoading,
    isProfesional
  };
};
