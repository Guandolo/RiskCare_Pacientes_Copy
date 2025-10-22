import { useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";
import { useGlobalStore } from "@/stores/globalStore";

interface PatientProfile {
  user_id: string;
  full_name: string | null;
  identification: string;
  document_type: string;
  age: number | null;
  eps: string | null;
  phone: string | null;
  topus_data: any;
}

interface ActivePatientContextType {
  activePatient: PatientProfile | null;
  setActivePatient: (patient: PatientProfile | null) => void;
  clearActivePatient: () => void;
  loading: boolean;
}

// Provider ya no es necesario pero lo mantenemos para compatibilidad
export const ActivePatientProvider = ({ children }: { children: ReactNode }) => {
  const { isProfesional } = useUserRole();
  const { 
    activePatient, 
    currentPatientUserId, 
    activePatientLoading,
    loadActivePatient 
  } = useGlobalStore();

  useEffect(() => {
    // Para profesionales: cargar paciente activo si existe contexto pero no hay paciente cargado
    if (!isProfesional) return;

    const initializePatient = async () => {
      // Si ya hay un paciente activo en el store, no hacer nada
      if (activePatient?.user_id) return;

      // Si hay un contexto de paciente pero no está cargado, cargar el perfil
      if (currentPatientUserId && !activePatient) {
        await loadActivePatient(currentPatientUserId);
        return;
      }

      // Verificar si hay un contexto guardado en la base de datos
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: context, error } = await supabase
        .from('profesional_patient_context')
        .select('current_patient_user_id')
        .eq('profesional_user_id', user.id)
        .maybeSingle();

      if (!error && context?.current_patient_user_id) {
        await loadActivePatient(context.current_patient_user_id);
      }
    };

    initializePatient();
  }, [isProfesional, activePatient, currentPatientUserId, loadActivePatient]);

  return <>{children}</>;
};

// Hook simplificado que usa el store global
export const useActivePatient = (): ActivePatientContextType => {
  const { 
    activePatient, 
    setActivePatient: setPatient, 
    clearActivePatient: clearPatient,
    activePatientLoading 
  } = useGlobalStore();

  return {
    activePatient,
    setActivePatient: setPatient,
    clearActivePatient: clearPatient,
    loading: activePatientLoading
  };
};
