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
    // 🚨 SOLO ejecutar UNA VEZ al montar
    // NO incluir loadActivePatient en dependencias para evitar loops infinitos
    
    // Para profesionales: cargar paciente activo si existe contexto pero no hay paciente cargado
    if (!isProfesional) return;

    const initializePatient = async () => {
      // Si ya hay un paciente activo en el store, no hacer nada
      if (activePatient?.user_id) {
        console.log('[ActivePatientProvider] ⏭️ Ya hay paciente activo, saltando inicialización');
        return;
      }

      // Si hay un contexto de paciente pero no está cargado, cargar el perfil
      if (currentPatientUserId && !activePatient) {
        console.log('[ActivePatientProvider] 🔄 Cargando paciente desde contexto:', currentPatientUserId);
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
        console.log('[ActivePatientProvider] 🔄 Cargando paciente desde BD:', context.current_patient_user_id);
        await loadActivePatient(context.current_patient_user_id);
      }
    };

    initializePatient();
    
    // 🚨 CRÍTICO: Solo ejecutar al montar, NO en cada cambio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Array vacío = solo al montar

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
