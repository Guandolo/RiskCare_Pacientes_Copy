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

  // Cargar paciente activo desde el contexto del profesional
  useEffect(() => {
    if (!isProfesional) {
      setLoading(false);
      return;
    }

    const loadActivePatient = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Obtener el contexto actual del profesional
        const { data: context, error } = await supabase
          .from('profesional_patient_context')
          .select('current_patient_user_id')
          .eq('profesional_user_id', user.id)
          .maybeSingle();

        if (error || !context || !context.current_patient_user_id) {
          setActivePatientState(null);
          setLoading(false);
          return;
        }

        // Cargar perfil completo del paciente activo
        const { data: profile, error: profileError } = await supabase
          .from('patient_profiles')
          .select('*')
          .eq('user_id', context.current_patient_user_id)
          .single();

        if (profileError) {
          console.error('Error loading active patient profile:', profileError);
          setActivePatientState(null);
        } else {
          setActivePatientState(profile);
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
  };

  const clearActivePatient = () => {
    setActivePatientState(null);
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
