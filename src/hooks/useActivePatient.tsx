import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

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

const ActivePatientContext = createContext<ActivePatientContextType | undefined>(undefined);

export const ActivePatientProvider = ({ children }: { children: ReactNode }) => {
  const { isProfesional } = useUserRole();
  const [activePatient, setActivePatientState] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Para profesionales: priorizar paciente activo persistido en sessionStorage
    if (!isProfesional) {
      setLoading(false);
      return;
    }

    const loadActivePatient = async () => {
      try {
        // 1) Leer del sessionStorage primero (fuente de verdad inmediata para evitar parpadeos)
        const storedProfile = sessionStorage.getItem('rc_active_patient_profile');
        if (storedProfile) {
          try {
            const parsed = JSON.parse(storedProfile);
            if (parsed?.user_id) {
              setActivePatientState(parsed);
              setLoading(false); // ya tenemos un paciente activo para la UI
            }
          } catch {}
        }

        // 2) Validar contexto del profesional en segundo plano SIN sobrescribir a null
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: context, error } = await supabase
          .from('profesional_patient_context')
          .select('current_patient_user_id')
          .eq('profesional_user_id', user.id)
          .maybeSingle();

        // Si no hay contexto, NO sobreescribir un paciente activo válido ya cargado
        if (error || !context || !context.current_patient_user_id) {
          return; // respetar el almacenamiento previo
        }

        // 3) Cargar perfil del paciente activo desde BD solo si difiere del almacenado
        const currentId = (storedProfile ? (JSON.parse(storedProfile)?.user_id) : activePatient?.user_id) || null;
        if (currentId === context.current_patient_user_id) return;

        const { data: profile, error: profileError } = await supabase
          .from('patient_profiles')
          .select('*')
          .eq('user_id', context.current_patient_user_id)
          .single();

        if (!profileError && profile) {
          setActivePatientState(profile);
          try { sessionStorage.setItem('rc_active_patient_profile', JSON.stringify(profile)); } catch {}
        }
      } catch (error) {
        console.error('Error in loadActivePatient:', error);
      } finally {
        setLoading(false);
      }
    };

    loadActivePatient();
  }, [isProfesional]);

  const setActivePatient = (patient: PatientProfile | null) => {
    setActivePatientState(patient);
    try {
      if (patient) {
        sessionStorage.setItem('rc_active_patient_profile', JSON.stringify(patient));
      } else {
        sessionStorage.removeItem('rc_active_patient_profile');
      }
    } catch {}
  };

  const clearActivePatient = () => {
    setActivePatientState(null);
    try { sessionStorage.removeItem('rc_active_patient_profile'); } catch {}
  };
  return (
    <ActivePatientContext.Provider value={{ activePatient, setActivePatient, clearActivePatient, loading }}>
      {children}
    </ActivePatientContext.Provider>
  );
};

export const useActivePatient = () => {
  const context = useContext(ActivePatientContext);
  if (context === undefined) {
    throw new Error('useActivePatient must be used within an ActivePatientProvider');
  }
  return context;
};
